// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Guards, Is } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import { EngineCore } from "@twin.org/engine-core";
import type { IEngineCore, IEngineCoreClone } from "@twin.org/engine-models";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import { nameof } from "@twin.org/nameof";
import { type IDataIntegrityProof, ProofTypes } from "@twin.org/standards-w3c-did";
import type { IImmutableProofTaskPayload } from "./models/IImmutableProofTaskPayload.js";
import type { IImmutableProofTaskResult } from "./models/IImmutableProofTaskResult.js";

const CLASS_NAME = "ImmutableProofTask";

/**
 * Process a proof.
 * @param engineCloneData The engine clone data.
 * @param payload The payload to process.
 * @returns The proof.
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
	Guards.object<IJsonLdNodeObject>(CLASS_NAME, nameof(payload.document), payload.document);

	let engine: IEngineCore | undefined;
	try {
		if (!Is.empty(engineCloneData)) {
			// If the clone data is not empty we use it to create a new engine as it's a new thread
			// otherwise we assume the factories are already populated.
			engine = new EngineCore();
			engine.populateClone(engineCloneData, true);
			await engine.start();
		}

		const identityConnector = IdentityConnectorFactory.get(payload.identityConnectorType);

		const proof = await identityConnector.createProof(
			payload.identity,
			`${payload.identity}#${payload.verificationMethodId}`,
			ProofTypes.DataIntegrityProof,
			payload.document
		);

		return {
			proofId: payload.proofId,
			proof: proof as IDataIntegrityProof
		};
	} finally {
		if (!Is.empty(engine)) {
			await engine.stop();
		}
	}
}
