// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ComponentFactory } from "@twin.org/core";
import { Engine } from "@twin.org/engine";
import {
	EntityStorageConnectorType,
	IdentityConnectorType,
	LoggingComponentType,
	LoggingConnectorType,
	NotarizationConnectorType,
	PlatformComponentType,
	VaultConnectorType,
	type IEngineConfig
} from "@twin.org/engine-types";
import type { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { IdentityConnectorFactory } from "@twin.org/identity-models";
import { ImmutableProofContexts, ImmutableProofTypes } from "@twin.org/immutable-proof-models";
import { LoggingConnectorFactory } from "@twin.org/logging-models";
import type { Notarization } from "@twin.org/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@twin.org/notarization-models";
import { VaultConnectorFactory } from "@twin.org/vault-models";
import { setupTestEnv, TEST_NODE_IDENTITY } from "./setupTestEnv.js";
import { processProofTask } from "../src/processProofTask.js";

const TEST_PROOF_ID = "immutable-proof:test-proof-id-0002";
const TEST_PROOF_INTEGRITY = "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=";
const TEST_PROOF_OBJECT_ID = "uuid:1234567890";

describe("ImmutableProofTaskClone", () => {
	beforeAll(async () => {
		await setupTestEnv();
	});

	afterAll(() => {
		ComponentFactory.reset();
		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();
		EntityStorageConnectorFactory.reset();
	});

	test("Can process a proof task from real engine clone data as in a worker thread", async () => {
		// Build a source engine shaped like a production node with entity storage backed
		// connectors, then hand its clone data to the task exactly as the background
		// task service does for a worker thread.
		const config: IEngineConfig = {
			debug: true,
			silent: true,
			types: {
				platformComponent: [{ type: PlatformComponentType.Service }],
				loggingConnector: [{ type: LoggingConnectorType.EntityStorage }],
				loggingComponent: [{ type: LoggingComponentType.Service }],
				vaultConnector: [{ type: VaultConnectorType.EntityStorage }],
				identityConnector: [{ type: IdentityConnectorType.EntityStorage }],
				notarizationConnector: [{ type: NotarizationConnectorType.EntityStorage }],
				entityStorageConnector: [{ type: EntityStorageConnectorType.Memory, options: {} }]
			}
		};

		const sourceEngine = new Engine({ config });
		await sourceEngine.start();
		const engineCloneData = sourceEngine.getCloneData();
		await sourceEngine.stop();

		// The worker thread starts with empty factories; the entity storages stay
		// registered to emulate the shared database the clone connects back to.
		ComponentFactory.reset();
		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();

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

		// The clone populated the factories itself, proving the type allowlist
		// boots the connectors the task needs.
		expect(IdentityConnectorFactory.getIfExists("entity-storage")).toBeDefined();
		expect(NotarizationConnectorFactory.getIfExists("entity-storage")).toBeDefined();
		expect(VaultConnectorFactory.getIfExists("entity-storage")).toBeDefined();

		const notarizationStorage =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<Notarization>>("notarization");
		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toHaveLength(1);
		expect(notarizationStore[0].mode).toEqual("locked");
	});
});
