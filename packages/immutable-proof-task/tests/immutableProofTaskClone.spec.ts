// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { EntityStorageIdentityConnector } from "@twin.org/identity-connector-entity-storage";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import { ImmutableProofContexts, ImmutableProofTypes } from "@twin.org/immutable-proof-models";
import { LoggingConnectorFactory } from "@twin.org/logging-models";
import { ModuleHelper } from "@twin.org/modules";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageNotarizationConnector,
	type Notarization,
	initSchema as initSchemaNotarization
} from "@twin.org/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@twin.org/notarization-models";
import { EntityStorageVaultConnector } from "@twin.org/vault-connector-entity-storage";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupTestEnv, TEST_NODE_IDENTITY } from "./setupTestEnv.js";
import { processProofTask } from "../src/processProofTask.js";

const TEST_PROOF_ID = "immutable-proof:test-proof-id-0002";
const TEST_PROOF_INTEGRITY = "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=";
const TEST_PROOF_OBJECT_ID = "uuid:1234567890";

describe("ImmutableProofTaskClone", () => {
	beforeAll(async () => {
		initSchemaNotarization();
		const notarizationEntityStorage = new MemoryEntityStorageConnector<Notarization>({
			entitySchema: nameof<Notarization>(),
			config: { storageKey: "notarization" }
		});
		EntityStorageConnectorFactory.register("notarization", () => notarizationEntityStorage);

		await setupTestEnv();
	});

	afterAll(() => {
		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();
		EntityStorageConnectorFactory.reset();
	});

	test("Can process a proof task from real engine clone data as in a worker thread", async () => {
		// A non-empty value causes processProofTask to take the execModuleMethod branch.
		// In production this would be engine.getCloneData().
		const engineCloneData = { isClone: true };

		// The worker thread starts with empty factories; the entity storages stay
		// registered to emulate the shared database the clone connects back to.
		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();

		// Mock execModuleMethod to return a fake engine whose start() re-populates
		// the connector factories, mirroring what EngineCoreBuilder.fromClone does in production.
		vi.spyOn(ModuleHelper, "execModuleMethod").mockResolvedValue({
			start: async () => {
				IdentityConnectorFactory.register(
					"entity-storage",
					() => new EntityStorageIdentityConnector()
				);
				VaultConnectorFactory.register("entity-storage", () => new EntityStorageVaultConnector());
				NotarizationConnectorFactory.register(
					"entity-storage",
					() => new EntityStorageNotarizationConnector()
				);
			},
			stop: async () => {}
		});

		const result = await processProofTask(engineCloneData, {
			proofId: TEST_PROOF_ID,
			identity: TEST_NODE_IDENTITY,
			identityConnectorType: "entity-storage",
			notarizationConnectorType: "entity-storage",
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
		expect(result.notarizationError).toBeUndefined();
		expect(result.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));

		// The execModuleMethod mock populated the factories, proving the clone branch was taken.
		expect(IdentityConnectorFactory.getIfExists("entity-storage")).toBeDefined();
		expect(NotarizationConnectorFactory.getIfExists("entity-storage")).toBeDefined();
		expect(VaultConnectorFactory.getIfExists("entity-storage")).toBeDefined();

		const notarizationStorage =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<Notarization>>("notarization");
		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toHaveLength(1);
		expect(notarizationStore[0].mode).toEqual("locked");

		vi.restoreAllMocks();
	});
});
