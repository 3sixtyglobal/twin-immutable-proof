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
import type { IImmutableProofTaskPayload } from "../src/models/IImmutableProofTaskPayload.js";
import {
	processProofTask,
	processProofTaskEnd,
	processProofTaskStart
} from "../src/processProofTask.js";

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

	afterEach(async () => {
		// Every test in this file builds a worker engine clone; module-level engine/startup
		// state otherwise leaks into the next test (all tests in a file share one module
		// instance), so mirror the real worker shutdown here to reset it.
		await processProofTaskEnd();
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

	test("Reuses the engine clone across consecutive tasks on the same worker", async () => {
		// A non-empty value causes processProofTask to take the execModuleMethod branch.
		// In production this would be engine.getCloneData().
		const engineCloneData = { isClone: true };

		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();

		const startSpy = vi.fn(async () => {
			IdentityConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageIdentityConnector()
			);
			VaultConnectorFactory.register("entity-storage", () => new EntityStorageVaultConnector());
			NotarizationConnectorFactory.register(
				"entity-storage",
				() => new EntityStorageNotarizationConnector()
			);
		});
		const stopSpy = vi.fn(async () => {});
		const execModuleMethodSpy = vi
			.spyOn(ModuleHelper, "execModuleMethod")
			.mockResolvedValue({ start: startSpy, stop: stopSpy });

		// notarizationStorage is shared for the whole describe block (registered in beforeAll),
		// so an earlier test's rows are already in it; only the delta this test writes matters.
		const notarizationStorageBefore =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<Notarization>>("notarization");
		const rowCountBefore = (await notarizationStorageBefore.getStore()).length;

		const buildPayload = (proofId: string): IImmutableProofTaskPayload => ({
			proofId,
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

		const result1 = await processProofTask(
			engineCloneData,
			buildPayload("immutable-proof:test-proof-id-0003")
		);
		const result2 = await processProofTask(
			engineCloneData,
			buildPayload("immutable-proof:test-proof-id-0004")
		);

		expect(result1.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));
		expect(result2.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));

		// One fromClone build, one start and no stop across the two tasks: the clone is reused.
		expect(execModuleMethodSpy).toHaveBeenCalledTimes(1);
		expect(startSpy).toHaveBeenCalledTimes(1);
		expect(stopSpy).not.toHaveBeenCalled();

		const notarizationStorage =
			EntityStorageConnectorFactory.get<MemoryEntityStorageConnector<Notarization>>("notarization");
		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toHaveLength(rowCountBefore + 2);

		vi.restoreAllMocks();
	});

	test("Starts the engine once from the worker initialise method and stops it from the shutdown method", async () => {
		const engineCloneData = { isClone: true };

		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();

		let startCount = 0;
		let stopCount = 0;
		const execModuleMethodSpy = vi.spyOn(ModuleHelper, "execModuleMethod").mockResolvedValue({
			start: async () => {
				startCount++;
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
			stop: async () => {
				stopCount++;
			}
		});

		// Mirrors what the background task service does: post the initialise message for a new
		// worker, which processProofTask below must wait for rather than starting its own clone.
		const startPromise = processProofTaskStart(engineCloneData);

		const result = await processProofTask(engineCloneData, {
			proofId: "immutable-proof:test-proof-id-0005",
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
		await startPromise;

		expect(result.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));
		expect(execModuleMethodSpy).toHaveBeenCalledTimes(1);
		expect(startCount).toEqual(1);
		expect(stopCount).toEqual(0);

		await processProofTaskEnd();
		expect(stopCount).toEqual(1);

		// A task after the worker has been shut down must build a fresh clone, not reuse the
		// stopped one.
		const result2 = await processProofTask(engineCloneData, {
			proofId: "immutable-proof:test-proof-id-0006",
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

		expect(result2.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));
		expect(execModuleMethodSpy).toHaveBeenCalledTimes(2);
		expect(startCount).toEqual(2);

		vi.restoreAllMocks();
	});

	test("Stops a partially started engine when the worker initialise fails", async () => {
		const engineCloneData = { isClone: true };
		const stopSpy = vi.fn(async () => {});
		vi.spyOn(ModuleHelper, "execModuleMethod").mockResolvedValue({
			start: async () => {
				throw new Error("component start failed");
			},
			stop: stopSpy
		});

		await expect(processProofTaskStart(engineCloneData)).rejects.toThrow("component start failed");

		expect(stopSpy).toHaveBeenCalledTimes(1);

		vi.restoreAllMocks();
	});

	test("Rebuilds the engine for the task when the worker initialise failed", async () => {
		const engineCloneData = { isClone: true };

		IdentityConnectorFactory.reset();
		NotarizationConnectorFactory.reset();
		VaultConnectorFactory.reset();
		LoggingConnectorFactory.reset();

		let stopCount = 0;
		const execModuleMethodSpy = vi
			.spyOn(ModuleHelper, "execModuleMethod")
			.mockResolvedValueOnce({
				start: async () => {
					throw new Error("component start failed");
				},
				stop: async () => {
					stopCount++;
				}
			})
			.mockResolvedValueOnce({
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
				stop: async () => {
					stopCount++;
				}
			});

		// The service ignores a failed initialise, so the task posted right after it is what
		// has to notice and rebuild the clone.
		let startError: unknown;
		const startPromise = (async () => {
			try {
				await processProofTaskStart(engineCloneData);
			} catch (error) {
				startError = error;
			}
		})();
		const result = await processProofTask(engineCloneData, {
			proofId: "immutable-proof:test-proof-id-0007",
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
		await startPromise;

		expect(startError).toBeInstanceOf(Error);
		expect(result.notarizationId).toEqual(expect.stringMatching(/^notarization:entity-storage:/));
		expect(execModuleMethodSpy).toHaveBeenCalledTimes(2);
		expect(stopCount).toEqual(1);

		vi.restoreAllMocks();
	});
});
