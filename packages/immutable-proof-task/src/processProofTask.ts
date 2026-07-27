// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdStore } from "@twin.org/context";
import { BaseError, ComponentFactory, Guards, Is, ObjectHelper } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { EngineCore } from "@twin.org/engine-core";
import type { IEngineCore, IEngineCoreClone } from "@twin.org/engine-models";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import { NotarizationConnectorFactory, NotarizationMode } from "@twin.org/notarization-models";
import type { IProof } from "@twin.org/standards-w3c-did";
import { ImmutableProofTask } from "./immutableProofTask.js";
import type { IImmutableProofTaskPayload } from "./models/IImmutableProofTaskPayload.js";
import type { IImmutableProofTaskResult } from "./models/IImmutableProofTaskResult.js";

/**
 * Process a proof task by creating a verifiable credential and notarizing it.
 * @param engineCloneData The engine clone data used to initialize a cloned engine instance when running in a separate thread.
 * @param payload The payload containing the proof parameters.
 * @returns The task result containing the verifiable credential and notarization id.
 */
export async function processProofTask(
	engineCloneData: IEngineCoreClone,
	payload: IImmutableProofTaskPayload
): Promise<IImmutableProofTaskResult> {
	Guards.objectValue<IImmutableProofTaskPayload>(
		ImmutableProofTask.CLASS_NAME,
		nameof(payload),
		payload
	);
	Guards.stringValue(ImmutableProofTask.CLASS_NAME, nameof(payload.identity), payload.identity);
	Guards.stringValue(
		ImmutableProofTask.CLASS_NAME,
		nameof(payload.identityConnectorType),
		payload.identityConnectorType
	);
	Guards.stringValue(
		ImmutableProofTask.CLASS_NAME,
		nameof(payload.verificationMethodId),
		payload.verificationMethodId
	);
	Guards.object<IJsonLdNodeObject>(
		ImmutableProofTask.CLASS_NAME,
		nameof(payload.credentialSubject),
		payload.credentialSubject
	);
	Guards.stringValue(
		ImmutableProofTask.CLASS_NAME,
		nameof(payload.notarizationConnectorType),
		payload.notarizationConnectorType
	);

	const taskStartTime = Date.now();

	let engine: IEngineCore | undefined;
	let logging: ILoggingComponent | undefined;
	try {
		if (!Is.empty(engineCloneData)) {
			// If the clone data is not empty we use it to create a new engine as it's a new thread
			// otherwise we assume the factories are already populated.
			engine = new EngineCore();
			engine.populateClone(engineCloneData, await ContextIdStore.getContextIds(), {
				logLevel: "error",
				types: [
					"loggingComponent",
					"loggingConnector",
					"identityConnector",
					"notarizationConnector",
					"vaultConnector",
					"entityStorageConnector",
					"platformComponent",
					"dltConfig"
				],
				entityTypes: [
					"LogEntry",
					"LogEntryError",
					"IdentityDocument",
					"Notarization",
					"VaultKey",
					"VaultSecret"
				]
				// Using cast until all types align in other packages
				// then we can remove the cast and use the actual type.
			} as unknown as boolean);
			await engine.start();
		}

		logging = ComponentFactory.getIfExists<ILoggingComponent>(payload.loggingComponentType);

		await logging?.log({
			level: "debug",
			source: ImmutableProofTask.CLASS_NAME,
			ts: Date.now(),
			message: "taskEngineStarted",
			data: { proofId: payload.proofId, elapsedMs: Date.now() - taskStartTime }
		});

		const identityConnector = IdentityConnectorFactory.get(payload.identityConnectorType);

		const credentialStartTime = Date.now();
		const result = await identityConnector.createVerifiableCredential(
			payload.identity,
			`${payload.identity}#${payload.verificationMethodId}`,
			payload.proofId,
			payload.credentialSubject
		);

		await logging?.log({
			level: "debug",
			source: ImmutableProofTask.CLASS_NAME,
			ts: Date.now(),
			message: "taskVerifiableCredentialCreated",
			data: { proofId: payload.proofId, elapsedMs: Date.now() - credentialStartTime }
		});

		// The proof context is always the last one in the generated vc contexts
		// as that was the last operation performed, so we can extract it and use it for the proof itself.
		// Remove verificationMethod to reduce linkage to the issuing identity (reinstated on verify).
		const proof: IProof = result.verifiableCredential.proof as IProof;
		proof["@context"] = result.verifiableCredential["@context"][
			result.verifiableCredential["@context"].length - 1
		] as IProof["@context"];
		delete proof.verificationMethod;

		const notarizationConnector = NotarizationConnectorFactory.get(
			payload.notarizationConnectorType
		);

		const notarizationStartTime = Date.now();
		try {
			const notarizationId = await notarizationConnector.create(payload.identity, {
				mode: NotarizationMode.Locked,
				data: ObjectHelper.toBytes(proof),
				deleteLockDateTime: payload.deleteLockDateTime
			});

			await logging?.log({
				level: "debug",
				source: ImmutableProofTask.CLASS_NAME,
				ts: Date.now(),
				message: "taskNotarizationComplete",
				data: {
					proofId: payload.proofId,
					elapsedMs: Date.now() - notarizationStartTime,
					totalElapsedMs: Date.now() - taskStartTime
				}
			});

			return {
				proofId: payload.proofId,
				verifiableCredential: result.verifiableCredential,
				notarizationId
			};
		} catch (error) {
			// The notarization may have reached the ledger even though the call failed, so
			// retrying could create a duplicate on-chain object. Return the failure in the
			// result instead of throwing, which prevents the task engine from retrying.
			// Failures thrown before this point are safe for the task engine to retry.
			const notarizationError = BaseError.fromError(error);

			await logging?.log({
				level: "error",
				source: ImmutableProofTask.CLASS_NAME,
				ts: Date.now(),
				message: "taskNotarizationFailed",
				error: notarizationError,
				data: { proofId: payload.proofId, elapsedMs: Date.now() - notarizationStartTime }
			});

			return {
				proofId: payload.proofId,
				verifiableCredential: result.verifiableCredential,
				notarizationError: notarizationError.toJsonObject(true)
			};
		}
	} finally {
		if (!Is.empty(engine)) {
			try {
				await engine.stop();
			} catch (error) {
				// Cleanup must not change the task outcome, a throw here would override the
				// returned result, fail the task and enable a retry even though the
				// notarization may already be on the ledger.
				try {
					await logging?.log({
						level: "warn",
						source: ImmutableProofTask.CLASS_NAME,
						ts: Date.now(),
						message: "taskEngineStopFailed",
						error: BaseError.fromError(error),
						data: { proofId: payload.proofId }
					});
				} catch {
					// Nothing more can be done if logging also fails.
				}
			}
		}
	}
}
