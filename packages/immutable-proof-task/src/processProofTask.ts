// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdStore } from "@twin.org/context";
import { BaseError, ComponentFactory, Guards, Is, ObjectHelper } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import type { ILoggingComponent } from "@twin.org/logging-models";
import { ModuleHelper } from "@twin.org/modules";
import { nameof } from "@twin.org/nameof";
import { NotarizationConnectorFactory, NotarizationMode } from "@twin.org/notarization-models";
import type { IProof } from "@twin.org/standards-w3c-did";
import { ImmutableProofTask } from "./immutableProofTask.js";
import type { IImmutableProofTaskPayload } from "./models/IImmutableProofTaskPayload.js";
import type { IImmutableProofTaskResult } from "./models/IImmutableProofTaskResult.js";

/**
 * The worker's engine clone, reused by every processProofTask call until processProofTaskEnd
 * tears it down.
 */
let engine:
	| {
			start: () => Promise<void>;
			stop: () => Promise<void>;
	  }
	| undefined;

/**
 * Resolves once the most recent processProofTaskStart call has finished.
 */
let startupPromise: Promise<void> | undefined;

/**
 * Build and start the worker's engine clone. Registered as the background task handler's
 * initialiseMethod, so it runs once per worker instead of once per task.
 * @param engineCloneData The engine clone data used to initialize a cloned engine instance when
 * running in a separate thread. Empty when not running in a worker thread (e.g. in tests).
 * @param loggingComponentType The logging component type to use for step logging, if configured.
 * @returns A promise that resolves once the engine has started.
 */
export async function processProofTaskStart(
	engineCloneData: unknown,
	loggingComponentType?: string
): Promise<void> {
	let built: typeof engine;
	startupPromise = (async () => {
		if (Is.empty(engineCloneData)) {
			return;
		}

		const startTime = Date.now();

		// If the clone data is not empty we are running in a worker thread - create a
		// cloned engine instance via dynamic import so no static engine dependency is needed.
		built = await ModuleHelper.execModuleMethod<NonNullable<typeof engine>>(
			"@twin.org/engine-core",
			"EngineCoreBuilder.fromClone",
			[
				"engine",
				engineCloneData,
				await ContextIdStore.getContextIds(),
				{
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
				}
			]
		);
		engine = built;
		await built.start();

		const logging = ComponentFactory.getIfExists<ILoggingComponent>(loggingComponentType);
		await logging?.log({
			level: "debug",
			source: ImmutableProofTask.CLASS_NAME,
			ts: Date.now(),
			message: "taskEngineStarted",
			data: { elapsedMs: Date.now() - startTime }
		});
	})();

	try {
		await startupPromise;
	} catch (err) {
		// Release this attempt's engine before awaiting anything, so a task waiting on the same
		// startup sees no engine and rebuilds, then stop whatever did start so it is not leaked.
		if (engine === built) {
			engine = undefined;
			startupPromise = undefined;
		}
		if (!Is.empty(built)) {
			await stopEngine(built, loggingComponentType);
		}
		throw err;
	}
}

/**
 * Stop the worker's engine clone. Registered as the background task handler's shutdownMethod.
 * @param loggingComponentType The logging component type to use for step logging, if configured.
 * @returns A promise that resolves once the engine has stopped, even if stopping failed.
 */
export async function processProofTaskEnd(loggingComponentType?: string): Promise<void> {
	const current = engine;
	engine = undefined;
	startupPromise = undefined;
	if (!Is.empty(current)) {
		await stopEngine(current, loggingComponentType);
	}
}

/**
 * Stop an engine clone, logging instead of throwing when the stop fails.
 * @param engineToStop The engine to stop.
 * @param loggingComponentType The logging component type to use for step logging, if configured.
 * @returns A promise that resolves once the stop attempt has finished.
 */
async function stopEngine(
	engineToStop: NonNullable<typeof engine>,
	loggingComponentType?: string
): Promise<void> {
	try {
		await engineToStop.stop();
	} catch (error) {
		// A throw here must not stop the rest of the shutdown from completing.
		try {
			const logging = ComponentFactory.getIfExists<ILoggingComponent>(loggingComponentType);
			await logging?.log({
				level: "warn",
				source: ImmutableProofTask.CLASS_NAME,
				ts: Date.now(),
				message: "taskEngineStopFailed",
				error: BaseError.fromError(error)
			});
		} catch {
			// Nothing more can be done if logging also fails.
		}
	}
}

/**
 * Process a proof task by creating a verifiable credential and notarizing it. Waits for the
 * worker's engine clone to finish starting, building it if it hasn't started yet.
 * @param engineCloneData The engine clone data used to initialize a cloned engine instance when running in a separate thread.
 * @param payload The payload containing the proof parameters.
 * @returns The task result containing the verifiable credential and notarization id.
 */
export async function processProofTask(
	engineCloneData: unknown,
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

	if (!Is.empty(engineCloneData)) {
		let startFailed = false;
		if (startupPromise) {
			try {
				await startupPromise;
			} catch {
				startFailed = true;
			}
		}
		if (startFailed || Is.empty(engine)) {
			await processProofTaskStart(engineCloneData, payload.loggingComponentType);
		}
	}

	const taskStartTime = Date.now();
	const logging = ComponentFactory.getIfExists<ILoggingComponent>(payload.loggingComponentType);

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

	const notarizationConnector = NotarizationConnectorFactory.get(payload.notarizationConnectorType);

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
}
