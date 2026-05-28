// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { Converter, ObjectHelper } from "@twin.org/core";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { ImmutableProofContexts, ImmutableProofTypes } from "@twin.org/immutable-proof-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageNotarizationConnector,
	initSchema as initSchemaNotarization,
	type Notarization
} from "@twin.org/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@twin.org/notarization-models";
import { setupTestEnv, TEST_NODE_IDENTITY } from "./setupTestEnv.js";
import { processProofTask } from "../src/immutableProofTask.js";

let notarizationStorage: MemoryEntityStorageConnector<Notarization>;

const TEST_PROOF_ID = "immutable-proof:test-proof-id-0001";
const TEST_PROOF_INTEGRITY = "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=";
const TEST_PROOF_OBJECT_ID = "uuid:1234567890";

describe("ImmutableProofTask", () => {
	beforeAll(async () => {
		await setupTestEnv();
	});

	beforeEach(() => {
		initSchemaNotarization();

		notarizationStorage = new MemoryEntityStorageConnector<Notarization>({
			entitySchema: nameof<Notarization>()
		});
		EntityStorageConnectorFactory.register("notarization", () => notarizationStorage);
		NotarizationConnectorFactory.register(
			"notarization",
			() => new EntityStorageNotarizationConnector()
		);
	});

	test("Can process a proof task and store the notarization", async () => {
		const result = await processProofTask(undefined as never, {
			proofId: TEST_PROOF_ID,
			identity: TEST_NODE_IDENTITY,
			identityConnectorType: "identity",
			notarizationConnectorType: "notarization",
			verificationMethodId: "immutable-proof-assertion",
			credentialSubject: {
				"@context": [ImmutableProofContexts.Context, ImmutableProofContexts.ContextCommon],
				type: ImmutableProofTypes.ImmutableProof,
				id: TEST_PROOF_OBJECT_ID,
				proofIntegrity: TEST_PROOF_INTEGRITY
			}
		});

		expect(result.proofId).toEqual(TEST_PROOF_ID);
		expect(result.verifiableCredential).toBeDefined();
		expect(result.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));

		const notarizationStore = notarizationStorage.getStore();
		expect(notarizationStore).toHaveLength(1);

		const entry = notarizationStore[0];
		expect(entry.mode).toEqual("locked");
		expect(entry.transferLockUntilDestroyed).toEqual(true);
		expect(entry.deleteLockDateTime).toBeUndefined();

		// Decode the stored proof bytes and verify verificationMethod was stripped
		// and @context is the data-integrity context (last VC context)
		const storedProof = ObjectHelper.fromBytes<object>(Converter.base64ToBytes(entry.data));
		expect(storedProof).not.toHaveProperty("verificationMethod");
		expect(storedProof).toHaveProperty("@context", "https://w3id.org/security/data-integrity/v2");
		expect(storedProof).toHaveProperty("type", "DataIntegrityProof");
	});

	test("Can process a proof task with a delete lock", async () => {
		const deleteLock = "2030-01-01T00:00:00.000Z";

		const result = await processProofTask(undefined as never, {
			proofId: TEST_PROOF_ID,
			identity: TEST_NODE_IDENTITY,
			identityConnectorType: "identity",
			notarizationConnectorType: "notarization",
			verificationMethodId: "immutable-proof-assertion",
			credentialSubject: {
				"@context": [ImmutableProofContexts.Context, ImmutableProofContexts.ContextCommon],
				type: ImmutableProofTypes.ImmutableProof,
				id: TEST_PROOF_OBJECT_ID,
				proofIntegrity: TEST_PROOF_INTEGRITY
			},
			deleteLockDateTime: deleteLock
		});

		expect(result.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));

		const notarizationStore = notarizationStorage.getStore();
		expect(notarizationStore).toHaveLength(1);
		expect(notarizationStore[0].deleteLockDateTime).toEqual(deleteLock);
	});
});
