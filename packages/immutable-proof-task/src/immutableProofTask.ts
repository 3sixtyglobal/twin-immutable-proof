// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ContextIdStore } from "@twin.org/context";
import { Guards, Is, ObjectHelper } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { EngineCore } from "@twin.org/engine-core";
import type { IEngineCore, IEngineCoreClone } from "@twin.org/engine-models";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import { NotarizationConnectorFactory, NotarizationMode } from "@twin.org/notarization-models";
import type { IProof } from "@twin.org/standards-w3c-did";
import type { IImmutableProofTaskPayload } from "./models/IImmutableProofTaskPayload.js";
import type { IImmutableProofTaskResult } from "./models/IImmutableProofTaskResult.js";

const CLASS_NAME = "ImmutableProofTask";

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
	Guards.objectValue<IImmutableProofTaskPayload>(CLASS_NAME, nameof(payload), payload);
	Guards.stringValue(CLASS_NAME, nameof(payload.identity), payload.identity);
	Guards.stringValue(
		CLASS_NAME,
		nameof(payload.identityConnectorType),
		payload.identityConnectorType
	);
	Guards.stringValue(
		CLASS_NAME,
		nameof(payload.verificationMethodId),
		payload.verificationMethodId
	);
	Guards.object<IJsonLdNodeObject>(
		CLASS_NAME,
		nameof(payload.credentialSubject),
		payload.credentialSubject
	);
	Guards.stringValue(
		CLASS_NAME,
		nameof(payload.notarizationConnectorType),
		payload.notarizationConnectorType
	);

	let engine: IEngineCore | undefined;
	try {
		if (!Is.empty(engineCloneData)) {
			// If the clone data is not empty we use it to create a new engine as it's a new thread
			// otherwise we assume the factories are already populated.
			engine = new EngineCore();
			engine.populateClone(engineCloneData, await ContextIdStore.getContextIds(), true);
			await engine.start();
		}

		const identityConnector = IdentityConnectorFactory.get(payload.identityConnectorType);

		const result = await identityConnector.createVerifiableCredential(
			payload.identity,
			`${payload.identity}#${payload.verificationMethodId}`,
			payload.proofId,
			payload.credentialSubject
		);

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
		const notarizationId = await notarizationConnector.create(payload.identity, {
			mode: NotarizationMode.Locked,
			data: ObjectHelper.toBytes(proof),
			deleteLockDateTime: payload.deleteLockDateTime
		});

		return {
			proofId: payload.proofId,
			verifiableCredential: result.verifiableCredential,
			notarizationId
		};
	} finally {
		if (!Is.empty(engine)) {
			await engine.stop();
		}
	}
}
