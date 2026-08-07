// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { HealthCategory, HealthStatus } from "@twin.org/api-models";
import { TaskStatus } from "@twin.org/background-task-models";
import {
	type BackgroundTask,
	BackgroundTaskService,
	initSchema as initSchemaBackgroundTask
} from "@twin.org/background-task-service";
import { ContextIdKeys, ContextIdStore } from "@twin.org/context";
import {
	ComponentFactory,
	Converter,
	Factory,
	Is,
	ObjectHelper,
	RandomHelper
} from "@twin.org/core";
import { JsonLdProcessor } from "@twin.org/data-json-ld";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import {
	EntityStorageLoggingConnector,
	initSchema as initSchemaLogging,
	type LogEntry
} from "@twin.org/logging-connector-entity-storage";
import { LoggingConnectorFactory } from "@twin.org/logging-models";
import { ModuleHelper } from "@twin.org/modules";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageNotarizationConnector,
	initSchema as initSchemaNotarization,
	type Notarization
} from "@twin.org/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@twin.org/notarization-models";
import {
	cleanupTestEnv,
	setupTestEnv,
	TEST_IDENTITY_CONNECTOR,
	TEST_ORGANIZATION_IDENTITY
} from "./setupTestEnv.js";
import type { ImmutableProof } from "../src/entities/immutableProof.js";
import { ImmutableProofService } from "../src/immutableProofService.js";
import { initSchema } from "../src/schema.js";

let proofStorage: MemoryEntityStorageConnector<ImmutableProof>;
let notarizationStorage: MemoryEntityStorageConnector<Notarization>;
let backgroundTaskStorage: MemoryEntityStorageConnector<BackgroundTask>;
let backgroundTaskService: BackgroundTaskService;
let memoryLoggingEntityStorage: MemoryEntityStorageConnector<LogEntry>;

// Captured before beforeEach overrides ContextIdStore.getContextIds with a fixed-value mock,
// so the multi-tenant tests can restore real AsyncLocalStorage-backed behaviour and actually
// observe the tenant context that ContextIdStore.run() establishes.
const realGetContextIds = ContextIdStore.getContextIds.bind(ContextIdStore);

const FIRST_TICK = 1724327716271;

/**
 * Wait for the proof to be generated.
 * @param proofCount The number of proofs to wait for.
 * @param showFail Whether to show debug information on failure.
 */
async function waitForProofGeneration(
	proofCount: number = 1,
	showFail: boolean = true
): Promise<void> {
	let count = 0;
	let generated;
	do {
		generated =
			(await notarizationStorage.getStore()).length === proofCount || count++ === proofCount * 40;
		if (generated) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 200));
	} while (!generated && count < 20);

	if (showFail) {
		console.debug(
			"backgroundTasks",
			JSON.stringify(await backgroundTaskStorage.getStore(), null, 2)
		);
		console.debug(
			"logEntries",
			JSON.stringify(await memoryLoggingEntityStorage.getStore(), null, 2)
		);
		throw new Error("Proof generation timed out");
	}
}

/**
 * Build a proof entity fixture for sweep tests, stuck without a notarization and stale by
 * default (older than the 60000ms minimum sweepStaleThresholdMs used throughout these tests).
 * @param overrides Properties to override on the fixture.
 * @returns The proof entity fixture.
 */
function makeStuckProofEntity(overrides: Partial<ImmutableProof> = {}): ImmutableProof {
	return {
		id: "proof-1",
		organizationId: TEST_ORGANIZATION_IDENTITY,
		dateCreated: new Date(FIRST_TICK - 61000).toISOString(),
		proofObjectId: "uuid:1234567890",
		proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
		...overrides
	};
}

/**
 * Build a background task entity fixture for sweep tests, of type "immutable-proof" and
 * terminally failed by default.
 * @param overrides Properties to override on the fixture.
 * @returns The background task entity fixture.
 */
function makeSweepTaskEntity(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
	return {
		id: "task-1",
		type: "immutable-proof",
		threadId: "main",
		dateCreated: new Date(FIRST_TICK - 61000).toISOString(),
		dateModified: new Date(FIRST_TICK - 61000).toISOString(),
		status: TaskStatus.Failed,
		...overrides
	};
}

describe("ImmutableProofService", () => {
	beforeAll(async () => {
		await setupTestEnv();

		JsonLdProcessor.addRedirect(
			/https?:\/\/schema.org\/?/,
			"https://schema.org/docs/jsonldcontext.jsonld"
		);
	});

	beforeEach(async () => {
		initSchema();
		initSchemaLogging();
		initSchemaNotarization();
		initSchemaBackgroundTask();

		ContextIdStore.getContextIds = vi
			.fn()
			.mockImplementation(() => ({ organization: TEST_ORGANIZATION_IDENTITY }));

		memoryLoggingEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>(),
			config: { storageKey: "log-entry" }
		});
		EntityStorageConnectorFactory.register("log-entry", () => memoryLoggingEntityStorage);
		ComponentFactory.register("platform", () => ({
			className: () => "platform",
			isMultiTenant: () => false,
			execute: async (method: () => Promise<void>) => method(),
			getLocalOriginContext: async () => undefined
		}));

		// Not a clone by default, matching a normal running node, so the sweep's clone guard
		// doesn't skip scheduling. getCloneData is required too: BackgroundTaskService's
		// workerProcessTasks() reads it unconditionally for every dispatched task, not just
		// sweep-related ones, so any test spawning a real (unmocked) worker thread would
		// otherwise crash on a missing method.
		Factory.createFactory("engine-core").register("engine", () => ({
			className: () => "MockEngineCore",
			isClone: () => false,
			getCloneData: () => undefined
		}));

		// A minimal scheduler stub that runs the sweep once, synchronously, when start()
		// registers it — real periodic re-triggering isn't exercised at the unit level.
		ComponentFactory.register("task-scheduler", () => ({
			className: () => "task-scheduler",
			addTask: async (taskId: string, times: unknown, taskCallback: () => Promise<void>) => {
				await taskCallback();
			},
			removeTask: async () => {},
			tasksInfo: async () => ({ tasks: {} })
		}));

		const loggingConnector = new EntityStorageLoggingConnector({
			config: { batchSize: 0, batchIntervalMs: 0 }
		});
		LoggingConnectorFactory.register("logging", () => loggingConnector);
		ComponentFactory.register("logging", () => loggingConnector);

		proofStorage = new MemoryEntityStorageConnector<ImmutableProof>({
			entitySchema: nameof<ImmutableProof>(),
			config: { storageKey: "immutable-proof" }
		});
		EntityStorageConnectorFactory.register("immutable-proof", () => proofStorage);

		backgroundTaskStorage = new MemoryEntityStorageConnector<BackgroundTask>({
			entitySchema: nameof<BackgroundTask>(),
			config: { storageKey: "background-task" }
		});
		EntityStorageConnectorFactory.register("background-task", () => backgroundTaskStorage);

		backgroundTaskService = new BackgroundTaskService();
		ComponentFactory.register("background-task", () => backgroundTaskService);

		notarizationStorage = new MemoryEntityStorageConnector<Notarization>({
			entitySchema: nameof<Notarization>(),
			config: { storageKey: "notarization" }
		});
		EntityStorageConnectorFactory.register("notarization", () => notarizationStorage);

		NotarizationConnectorFactory.register(
			"notarization",
			() => new EntityStorageNotarizationConnector()
		);

		Date.now = vi.fn().mockImplementation(() => FIRST_TICK);
		let counter = 1;
		RandomHelper.generateUuidV7 = vi
			.fn()
			.mockImplementation((format: string) =>
				Converter.bytesToHex(new Uint8Array(16).fill(counter++))
			);
	});

	afterAll(async () => {
		await cleanupTestEnv();
	});

	afterEach(async () => {
		await proofStorage.teardown();
		await notarizationStorage.teardown();
		await backgroundTaskStorage.teardown();
		await memoryLoggingEntityStorage.teardown();
	});

	test("Can create an instance of the service", async () => {
		const service = new ImmutableProofService();
		expect(service).toBeDefined();
	});

	test("Can fail to create an instance of the service with out of range task options", async () => {
		expect(() => new ImmutableProofService({ config: { taskRetryCount: -1 } })).toThrow();
		expect(() => new ImmutableProofService({ config: { taskRetryInterval: 0 } })).toThrow();
		expect(() => new ImmutableProofService({ config: { taskFailureRetainFor: -2 } })).toThrow();
	});

	test("Can fail to create an instance of the service with out of range sweep options", async () => {
		expect(() => new ImmutableProofService({ config: { sweepStaleThresholdMs: 59999 } })).toThrow();
		expect(() => new ImmutableProofService({ config: { sweepMaxAttempts: 0 } })).toThrow();
		expect(() => new ImmutableProofService({ config: { sweepBatchLimit: 0 } })).toThrow();
		expect(() => new ImmutableProofService({ config: { sweepBackoffMs: 0 } })).toThrow();
		expect(
			() => new ImmutableProofService({ config: { sweepAssumeRetryableBefore: "not-a-date" } })
		).toThrow();
	});

	test("Can create an instance of the service with boundary sweep options", async () => {
		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepMaxAttempts: 1,
				sweepBatchLimit: 1,
				sweepBackoffMs: 1,
				sweepAssumeRetryableBefore: "2026-07-24T00:00:00.000Z"
			}
		});
		expect(service).toBeDefined();
	});

	test("Can create a proof that is pending", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		const proofStore = await proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				taskId: "background-task:entity-storage:02020202020202020202020202020202"
			}
		]);
	});

	test("Can fail to create a proof and leave no orphaned entity when the task cannot be created", async () => {
		// The task is created before the entity is persisted, so a failure here must never
		// leave a proof entity with nothing enqueued to notarize it.
		vi.spyOn(backgroundTaskService, "create").mockRejectedValueOnce(
			new Error("background task storage unavailable")
		);

		const service = new ImmutableProofService();
		await service.start();

		await expect(
			service.create({
				"@context": "https://schema.org",
				type: "Person",
				id: "uuid:1234567890",
				name: "John Smith"
			})
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "immutableProofService.createFailed"
		});

		expect(await proofStorage.getStore()).toHaveLength(0);
	});

	test("Can remove the orphaned background task when the proof entity fails to persist", async () => {
		const service = new ImmutableProofService();
		await service.start();

		vi.spyOn(proofStorage, "set").mockRejectedValueOnce(new Error("entity storage unavailable"));

		await expect(
			service.create({
				"@context": "https://schema.org",
				type: "Person",
				id: "uuid:1234567890",
				name: "John Smith"
			})
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "immutableProofService.createFailed"
		});

		expect(await proofStorage.getStore()).toHaveLength(0);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(0);
	});

	test("Can fail to create a proof when both the entity persist and the orphaned task removal fail", async () => {
		const service = new ImmutableProofService();
		await service.start();

		vi.spyOn(proofStorage, "set").mockRejectedValueOnce(new Error("entity storage unavailable"));
		vi.spyOn(backgroundTaskService, "remove").mockRejectedValueOnce(
			new Error("background task storage unavailable")
		);

		await expect(
			service.create({
				"@context": "https://schema.org",
				type: "Person",
				id: "uuid:1234567890",
				name: "John Smith"
			})
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "immutableProofService.createFailed"
		});

		expect(await proofStorage.getStore()).toHaveLength(0);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Can get a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		const proofStore = await proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				dateCreated: "2024-08-22T11:55:16.271Z",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				proofObjectId: "uuid:1234567890",
				taskId: "background-task:entity-storage:02020202020202020202020202020202"
			}
		]);

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/"
			],
			type: ["VerifiableCredential", "ImmutableProof"],
			id: "immutable-proof:01010101010101010101010101010101",
			issuer: TEST_ORGANIZATION_IDENTITY,
			issuanceDate: "2024-08-22T11:55:16.271Z",
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});
	});

	test("Can fail to get a proof when there is no identity connector", async () => {
		await backgroundTaskService.start();

		// Retries are disabled so the first failure is terminal, the mocked clock
		// is frozen so a scheduled retry would otherwise never become due.
		const service = new ImmutableProofService({ config: { taskRetryCount: 0 } });
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		// Poll the background task store for a failed task. The task runs in a worker thread
		// that has its own globalThis, so factory registrations from the main thread are not
		// visible - IdentityConnectorFactory.get("identity") throws factory.noGet.
		let failedTask;
		for (let i = 0; i < 40; i++) {
			failedTask = (await backgroundTaskStorage.getStore()).find(t => t.status === "failed");
			if (failedTask) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		expect(failedTask).toBeDefined();

		expect(failedTask?.error?.message).toEqual("factory.noGet");
		expect(failedTask?.error?.properties).toEqual({
			typeName: "identity-connector",
			name: "identity"
		});
	});

	test("Can get a proof that has been issued", async () => {
		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		await waitForProofGeneration();

		const proofStore = await proofStorage.getStore();
		const notarizationId = proofStore[0]?.notarizationId ?? "";
		const notarizationUUID = notarizationId.split(":").pop() ?? "";

		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				notarizationId,
				dateCreated: "2024-08-22T11:55:16.271Z",
				vcContext: "https://www.w3.org/2018/credentials/v1",
				taskId: "background-task:entity-storage:02020202020202020202020202020202"
			}
		]);

		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toEqual([
			{
				id: notarizationUUID,
				mode: "locked",
				dateCreated: expect.any(String),
				data: expect.any(String),
				transferLockUntilDestroyed: true,
				controllerIdentity: TEST_ORGANIZATION_IDENTITY,
				owner: TEST_ORGANIZATION_IDENTITY
			}
		]);

		expect(ObjectHelper.fromBytes(Converter.base64ToBytes(notarizationStore[0].data))).toEqual({
			"@context": "https://w3id.org/security/data-integrity/v2",
			type: "DataIntegrityProof",
			created: "2024-08-22T11:55:16.271Z",
			cryptosuite: "eddsa-jcs-2022",
			proofPurpose: "assertionMethod",
			proofValue: expect.any(String)
		});

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/",
				"https://w3id.org/security/data-integrity/v2"
			],
			id: "immutable-proof:01010101010101010101010101010101",
			issuanceDate: "2024-08-22T11:55:16.271Z",
			issuer: TEST_ORGANIZATION_IDENTITY,
			type: ["VerifiableCredential", "ImmutableProof"],
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			},
			proof: {
				created: "2024-08-22T11:55:16.271Z",
				type: "DataIntegrityProof",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue: expect.any(String),
				verificationMethod: expect.any(String),
				notarizationId
			}
		});
	});

	test("Can verify a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject);
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/"
			],
			id: "immutable-proof:01010101010101010101010101010101",
			issuer: TEST_ORGANIZATION_IDENTITY,
			issuanceDate: "2024-08-22T11:55:16.271Z",
			type: ["VerifiableCredential", "ImmutableProof"],
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});

		const proofStore = await proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				taskId: "background-task:entity-storage:02020202020202020202020202020202"
			}
		]);

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: false,
			failure: "notIssued"
		});
	});

	test("Can create a proof with a delete lock", async () => {
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create(
			{
				"@context": "https://schema.org",
				type: "Person",
				id: "uuid:1234567890",
				name: "John Smith"
			},
			{ deleteLock: "2030-01-01T00:00:00.000Z" }
		);
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		// The entity is written in a single set() call that already includes taskId and
		// deleteLock, both populated from the same create() invocation that created the task.
		const proofStore = await proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				taskId: "background-task:entity-storage:02020202020202020202020202020202",
				deleteLock: "2030-01-01T00:00:00.000Z"
			}
		]);

		await waitForProofGeneration();

		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toEqual([
			{
				id: expect.any(String),
				mode: "locked",
				dateCreated: expect.any(String),
				data: expect.any(String),
				deleteLockDateTime: "2030-01-01T00:00:00.000Z",
				transferLockUntilDestroyed: true,
				controllerIdentity: TEST_ORGANIZATION_IDENTITY,
				owner: TEST_ORGANIZATION_IDENTITY
			}
		]);
	});

	test("Can verify a proof that has been issued", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject);
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		await waitForProofGeneration();

		const proofStore = await proofStorage.getStore();
		const notarizationId = proofStore[0]?.notarizationId ?? "";
		const notarizationUUID = notarizationId.split(":").pop() ?? "";

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/",
				"https://w3id.org/security/data-integrity/v2"
			],
			id: "immutable-proof:01010101010101010101010101010101",
			type: ["VerifiableCredential", "ImmutableProof"],
			issuanceDate: "2024-08-22T11:55:16.271Z",
			issuer: TEST_ORGANIZATION_IDENTITY,
			proof: {
				type: "DataIntegrityProof",
				created: "2024-08-22T11:55:16.271Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue: expect.any(String),
				verificationMethod: expect.any(String),
				notarizationId
			},
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});

		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				notarizationId,
				dateCreated: "2024-08-22T11:55:16.271Z",
				organizationId: TEST_ORGANIZATION_IDENTITY,
				vcContext: "https://www.w3.org/2018/credentials/v1",
				taskId: "background-task:entity-storage:02020202020202020202020202020202"
			}
		]);

		const notarizationStore = await notarizationStorage.getStore();
		expect(notarizationStore).toEqual([
			{
				id: notarizationUUID,
				mode: "locked",
				dateCreated: expect.any(String),
				data: expect.any(String),
				transferLockUntilDestroyed: true,
				controllerIdentity: TEST_ORGANIZATION_IDENTITY,
				owner: TEST_ORGANIZATION_IDENTITY
			}
		]);

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: true
		});
	});

	test("Does not include notarizationId in the proof passed to checkVerifiableCredential", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		const checkSpy = vi.spyOn(TEST_IDENTITY_CONNECTOR, "checkVerifiableCredential");

		await service.verify(proofId);

		expect(checkSpy).toHaveBeenCalledOnce();
		const credential = checkSpy.mock.calls[0][0] as unknown as { [key: string]: unknown };
		expect((credential.proof as { [key: string]: unknown }).notarizationId).toBeUndefined();
		checkSpy.mockRestore();
	});

	test("Reconstitutes signed credential with string type and credentialSubject type for verification", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		const checkSpy = vi.spyOn(TEST_IDENTITY_CONNECTOR, "checkVerifiableCredential");

		await service.verify(proofId);

		expect(checkSpy).toHaveBeenCalledOnce();
		const credential = checkSpy.mock.calls[0][0] as unknown as { [key: string]: unknown };

		// createVerifiableCredential sets type as a plain string, not an array
		expect(credential.type).toBe("VerifiableCredential");

		// the original credentialSubject carried type; the entity rebuild omits it
		expect((credential.credentialSubject as { [key: string]: unknown }).type).toBe(
			"ImmutableProof"
		);
		checkSpy.mockRestore();
	});

	test("Reinstates verificationMethod in the proof passed to checkVerifiableCredential", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		const checkSpy = vi.spyOn(TEST_IDENTITY_CONNECTOR, "checkVerifiableCredential");

		await service.verify(proofId);

		expect(checkSpy).toHaveBeenCalledOnce();
		const credential = checkSpy.mock.calls[0][0] as unknown as { [key: string]: unknown };
		// verificationMethod is stripped from the proof at signing time and must be reinstated
		expect((credential.proof as { [key: string]: unknown }).verificationMethod).toBe(
			`${TEST_ORGANIZATION_IDENTITY}#immutable-proof-assertion`
		);
		checkSpy.mockRestore();
	});

	test("Returns verificationFailure when checkVerifiableCredential throws", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		vi.spyOn(TEST_IDENTITY_CONNECTOR, "checkVerifiableCredential").mockRejectedValueOnce(
			new Error("signature verification failed")
		);

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: false,
			failure: "verificationFailure"
		});
	});

	test("Returns revoked failure when the verifiable credential is revoked", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		vi.spyOn(TEST_IDENTITY_CONNECTOR, "checkVerifiableCredential").mockResolvedValueOnce({
			revoked: true
		});

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: false,
			failure: "revoked"
		});
	});

	test("Returns verificationFailure when the stored proofObjectIntegrity has been tampered with", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		// Simulate payload substitution: replace the stored hash with a different value.
		// The signed credential locked in the original hash, so the Ed25519 check fails.
		const store = await proofStorage.getStore();
		await proofStorage.set({
			...store[0],
			proofObjectIntegrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
		});

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: false,
			failure: "verificationFailure"
		});
	});

	test("Can remove notarization from a proof that has been issued", async () => {
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		expect(await notarizationStorage.getStore()).toHaveLength(1);
		expect((await proofStorage.getStore())[0].notarizationId).toBeDefined();

		await service.removeNotarization(proofId);

		expect(await notarizationStorage.getStore()).toHaveLength(0);
		expect(await proofStorage.getStore()).toHaveLength(1);
		expect((await proofStorage.getStore())[0].notarizationId).toBeUndefined();
	});

	test("Can remove notarization from a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await service.removeNotarization(proofId);

		expect(await notarizationStorage.getStore()).toHaveLength(0);
		expect(await proofStorage.getStore()).toHaveLength(1);
	});

	test("Can fail to remove notarization when proof is not found", async () => {
		const service = new ImmutableProofService();
		await service.start();

		await expect(
			service.removeNotarization("immutable-proof:ffffffffffffffffffffffffffffffff")
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "immutableProofService.removeNotarizationFailed"
		});
	});

	test("Can remove a proof and its notarization", async () => {
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		expect(await notarizationStorage.getStore()).toHaveLength(1);
		expect(await proofStorage.getStore()).toHaveLength(1);

		await service.remove(proofId);

		expect(await notarizationStorage.getStore()).toHaveLength(0);
		expect(await proofStorage.getStore()).toHaveLength(0);
	});

	test("Can remove a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		expect(await proofStorage.getStore()).toHaveLength(1);

		await service.remove(proofId);

		expect(await notarizationStorage.getStore()).toHaveLength(0);
		expect(await proofStorage.getStore()).toHaveLength(0);
	});

	test("Can fail to remove a proof when it is not found", async () => {
		const service = new ImmutableProofService();
		await service.start();

		await expect(
			service.remove("immutable-proof:ffffffffffffffffffffffffffffffff")
		).rejects.toMatchObject({
			name: "GeneralError",
			message: "immutableProofService.removeFailed"
		});
	});

	test("Can clean up orphaned notarization when proof is removed before background task completes", async () => {
		let resolveTask: () => void = () => {};
		const taskGate = new Promise<void>(resolve => {
			resolveTask = resolve;
		});

		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					// Hold the task until the gate is released
					await taskGate;
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		// Remove the proof while the background task is still blocked
		await service.remove(proofId);

		expect(await proofStorage.getStore()).toHaveLength(0);
		expect(await notarizationStorage.getStore()).toHaveLength(0);

		// Release the background task so it runs to completion
		resolveTask();
		await waitForProofGeneration(1, false);

		// The task created a notarization but should have cleaned it up since the proof is gone
		expect(await notarizationStorage.getStore()).toHaveLength(0);
		expect(await proofStorage.getStore()).toHaveLength(0);
	});

	test("Can create a proof task with retry and retention options", async () => {
		const service = new ImmutableProofService();
		await service.start();

		await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		const taskStore = await backgroundTaskStorage.getStore();
		expect(taskStore).toHaveLength(1);
		expect(taskStore[0].retriesRemaining).toEqual(5);
		expect(taskStore[0].retryInterval).toEqual(5000);
		expect(taskStore[0].retainFor).toEqual(604800000);
	});

	test("Can create a proof task with configured retry and retention options", async () => {
		const service = new ImmutableProofService({
			config: { taskRetryCount: 2, taskRetryInterval: 1000, taskFailureRetainFor: 60000 }
		});
		await service.start();

		await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		const taskStore = await backgroundTaskStorage.getStore();
		expect(taskStore).toHaveLength(1);
		expect(taskStore[0].retriesRemaining).toEqual(2);
		expect(taskStore[0].retryInterval).toEqual(1000);
		expect(taskStore[0].retainFor).toEqual(60000);
	});

	test("Removes the task record once a proof has been issued", async () => {
		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		await waitForProofGeneration();

		// The task record is removed by finaliseTask once the result has been processed.
		let taskStore;
		for (let i = 0; i < 40; i++) {
			taskStore = await backgroundTaskStorage.getStore();
			if (taskStore.length === 0) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		expect(taskStore).toHaveLength(0);
	});

	test("Retains the task record and leaves the proof unissued when the notarization fails", async () => {
		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));

		NotarizationConnectorFactory.register(
			"notarization",
			() =>
				({
					className: () => "failing-notarization",
					create: async () => {
						throw new Error("ledger unavailable");
					}
				}) as never
		);

		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "uuid:1234567890",
			name: "John Smith"
		});

		// The failure is reported in the task result instead of a thrown error, so the
		// task engine does not retry, the record is retained for later inspection.
		let failedResultTask;
		for (let i = 0; i < 40; i++) {
			failedResultTask = (await backgroundTaskStorage.getStore()).find(
				t =>
					t.status === "success" &&
					Is.object<{ notarizationError?: unknown }>(t.result) &&
					Is.object(t.result.notarizationError)
			);
			if (failedResultTask) {
				break;
			}
			await new Promise(resolve => setTimeout(resolve, 200));
		}
		expect(failedResultTask).toBeDefined();

		// The proof remains unissued and no notarization was stored.
		expect(await notarizationStorage.getStore()).toHaveLength(0);
		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].notarizationId).toBeUndefined();

		const result = await service.verify(proofId);
		expect(result).toMatchObject({ verified: false, failure: "notIssued" });

		// The passive create() path never touches sweep bookkeeping, only taskId, which it
		// always sets.
		expect(proofStore[0].taskId).toBeDefined();
		expect(proofStore[0].sweepAttempts).toBeUndefined();
		expect(proofStore[0].lastSweepAttempt).toBeUndefined();
		expect(proofStore[0].isParked).toBeUndefined();
	});

	test("Sweep re-enqueues a stuck proof whose task failed, updating taskId, sweepAttempts and lastSweepAttempt", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:task-1" })
		);
		await backgroundTaskStorage.set(makeSweepTaskEntity({ status: TaskStatus.Failed }));

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore).toHaveLength(1);
		expect(proofStore[0].taskId).toEqual(
			"background-task:entity-storage:01010101010101010101010101010101"
		);
		expect(proofStore[0].sweepAttempts).toEqual(1);
		expect(proofStore[0].lastSweepAttempt).toEqual("2024-08-22T11:55:16.271Z");

		const taskStore = await backgroundTaskStorage.getStore();
		expect(taskStore).toHaveLength(2);
		const newTask = taskStore.find(t => t.id !== "task-1");
		expect(newTask?.payload).toMatchObject({
			proofId: "immutable-proof:proof-1",
			identity: TEST_ORGANIZATION_IDENTITY,
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});
	});

	test("Sweep leaves a proof untouched when its task is still in flight", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:task-1" })
		);
		await backgroundTaskStorage.set(makeSweepTaskEntity({ status: TaskStatus.Processing }));

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].taskId).toEqual("background-task:entity-storage:task-1");
		expect(proofStore[0].sweepAttempts).toBeUndefined();
		expect(proofStore[0].lastSweepAttempt).toBeUndefined();
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep leaves a fresh proof untouched when it is younger than the staleness threshold", async () => {
		await proofStorage.set(
			makeStuckProofEntity({
				taskId: "background-task:entity-storage:task-1",
				dateCreated: new Date(FIRST_TICK - 1000).toISOString()
			})
		);
		await backgroundTaskStorage.set(makeSweepTaskEntity({ status: TaskStatus.Failed }));

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		expect((await proofStorage.getStore())[0].sweepAttempts).toBeUndefined();
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep leaves a proof untouched while its backoff has not elapsed", async () => {
		await proofStorage.set(
			makeStuckProofEntity({
				taskId: "background-task:entity-storage:task-1",
				sweepAttempts: 1,
				lastSweepAttempt: new Date(FIRST_TICK - 1000).toISOString()
			})
		);
		await backgroundTaskStorage.set(makeSweepTaskEntity({ status: TaskStatus.Failed }));

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000, sweepBackoffMs: 60000 }
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].sweepAttempts).toEqual(1);
		expect(proofStore[0].taskId).toEqual("background-task:entity-storage:task-1");
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep parks a proof once its attempts reach the configured cap", async () => {
		await proofStorage.set(
			makeStuckProofEntity({
				taskId: "background-task:entity-storage:task-1",
				sweepAttempts: 3,
				lastSweepAttempt: new Date(FIRST_TICK - 300000).toISOString()
			})
		);
		await backgroundTaskStorage.set(makeSweepTaskEntity({ status: TaskStatus.Failed }));

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepBackoffMs: 60000,
				sweepMaxAttempts: 3
			}
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].isParked).toEqual(true);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep parks a proof whose task succeeded with a notarization error and no era override is configured", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:task-1" })
		);
		await backgroundTaskStorage.set(
			makeSweepTaskEntity({
				status: TaskStatus.Success,
				result: { notarizationError: { name: "GeneralError", message: "ledger unavailable" } }
			})
		);

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		expect((await proofStorage.getStore())[0].isParked).toEqual(true);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep re-enqueues a notarization-error task when its era is explicitly authorised", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:task-1" })
		);
		await backgroundTaskStorage.set(
			makeSweepTaskEntity({
				status: TaskStatus.Success,
				result: { notarizationError: { name: "GeneralError", message: "ledger unavailable" } }
			})
		);

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepAssumeRetryableBefore: new Date(FIRST_TICK).toISOString()
			}
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].isParked).toBeUndefined();
		expect(proofStore[0].sweepAttempts).toEqual(1);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(2);
	});

	test("Sweep parks a proof with a missing task record and no era override configured", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:missing-task" })
		);

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		expect((await proofStorage.getStore())[0].isParked).toEqual(true);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(0);
	});

	test("Sweep re-enqueues a proof with a missing task record when its era is explicitly authorised", async () => {
		await proofStorage.set(
			makeStuckProofEntity({ taskId: "background-task:entity-storage:missing-task" })
		);

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepAssumeRetryableBefore: new Date(FIRST_TICK).toISOString()
			}
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].isParked).toBeUndefined();
		expect(proofStore[0].sweepAttempts).toEqual(1);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep skips a legacy proof with no taskId when the page-scan finds its task still in flight", async () => {
		const proofEntity = makeStuckProofEntity();
		await proofStorage.set(proofEntity);
		await backgroundTaskStorage.set(
			makeSweepTaskEntity({
				status: TaskStatus.Processing,
				payload: { proofId: `immutable-proof:${proofEntity.id}` }
			})
		);

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].taskId).toBeUndefined();
		expect(proofStore[0].sweepAttempts).toBeUndefined();
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep treats a legacy proof as in-flight when its newer task is Processing, removing the superseded Failed record", async () => {
		const proofEntity = makeStuckProofEntity();
		await proofStorage.set(proofEntity);
		await backgroundTaskStorage.set(
			makeSweepTaskEntity({
				id: "task-old",
				status: TaskStatus.Failed,
				dateCreated: new Date(FIRST_TICK - 120000).toISOString(),
				dateModified: new Date(FIRST_TICK - 120000).toISOString(),
				payload: { proofId: `immutable-proof:${proofEntity.id}` }
			})
		);
		await backgroundTaskStorage.set(
			makeSweepTaskEntity({
				id: "task-new",
				status: TaskStatus.Processing,
				dateCreated: new Date(FIRST_TICK - 30000).toISOString(),
				dateModified: new Date(FIRST_TICK - 30000).toISOString(),
				payload: { proofId: `immutable-proof:${proofEntity.id}` }
			})
		);

		const service = new ImmutableProofService({
			config: { sweepStaleThresholdMs: 60000 }
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].taskId).toBeUndefined();
		expect(proofStore[0].sweepAttempts).toBeUndefined();

		const remainingTasks = await backgroundTaskStorage.getStore();
		expect(remainingTasks).toHaveLength(1);
		expect(remainingTasks[0].id).toEqual("task-new");
	});

	test("Sweep heals a truly orphaned proof with no taskId and no matching task record when its era is explicitly authorised", async () => {
		await proofStorage.set(makeStuckProofEntity());

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepAssumeRetryableBefore: new Date(FIRST_TICK).toISOString()
			}
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		expect(proofStore[0].isParked).toBeUndefined();
		expect(proofStore[0].taskId).toBeDefined();
		expect(proofStore[0].sweepAttempts).toEqual(1);
		expect(await backgroundTaskStorage.getStore()).toHaveLength(1);
	});

	test("Sweep respects the batch limit and re-enqueues the oldest eligible proofs first", async () => {
		await proofStorage.set(
			makeStuckProofEntity({
				id: "proof-a",
				dateCreated: new Date(FIRST_TICK - 90000).toISOString()
			})
		);
		await proofStorage.set(
			makeStuckProofEntity({
				id: "proof-b",
				dateCreated: new Date(FIRST_TICK - 80000).toISOString()
			})
		);
		await proofStorage.set(
			makeStuckProofEntity({
				id: "proof-c",
				dateCreated: new Date(FIRST_TICK - 70000).toISOString()
			})
		);

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepBatchLimit: 2,
				sweepAssumeRetryableBefore: new Date(FIRST_TICK).toISOString()
			}
		});
		await service.start();

		const proofStore = await proofStorage.getStore();
		const byId = new Map(proofStore.map(p => [p.id, p]));
		expect(byId.get("proof-a")?.sweepAttempts).toEqual(1);
		expect(byId.get("proof-b")?.sweepAttempts).toEqual(1);
		expect(byId.get("proof-c")?.sweepAttempts).toBeUndefined();
		expect(await backgroundTaskStorage.getStore()).toHaveLength(2);
	});

	test("Sweep throws contextIdMissing on a tenant-partitioned store when no tenant is in ambient context", async () => {
		const tenantPartitionedProofStorage = new MemoryEntityStorageConnector<ImmutableProof>({
			entitySchema: nameof<ImmutableProof>(),
			config: { storageKey: "immutable-proof-tenant-canary" },
			partitionContextIds: [ContextIdKeys.Tenant]
		});
		EntityStorageConnectorFactory.register("immutable-proof", () => tenantPartitionedProofStorage);

		ContextIdStore.getContextIds = realGetContextIds;

		await ContextIdStore.run({ organization: TEST_ORGANIZATION_IDENTITY }, async () => {
			await expect(tenantPartitionedProofStorage.set(makeStuckProofEntity())).rejects.toMatchObject(
				{
					name: "GeneralError",
					message: expect.stringContaining("contextIdMissing")
				}
			);
		});
	});

	test("Sweep fans out across tenants via the platform component, healing a stuck proof in each", async () => {
		const tenantPartitionedProofStorage = new MemoryEntityStorageConnector<ImmutableProof>({
			entitySchema: nameof<ImmutableProof>(),
			config: { storageKey: "immutable-proof-multi-tenant" },
			partitionContextIds: [ContextIdKeys.Tenant]
		});
		EntityStorageConnectorFactory.register("immutable-proof", () => tenantPartitionedProofStorage);

		ContextIdStore.getContextIds = realGetContextIds;

		const tenants = ["tenant-a", "tenant-b"];
		ComponentFactory.register("platform", () => ({
			className: () => "platform",
			isMultiTenant: () => true,
			execute: async (method: () => Promise<void>) => {
				const baseContextIds = (await ContextIdStore.getContextIds()) ?? {};
				for (const tenant of tenants) {
					await ContextIdStore.run({ ...baseContextIds, [ContextIdKeys.Tenant]: tenant }, method);
				}
			},
			getLocalOriginContext: async () => undefined
		}));

		for (const tenant of tenants) {
			await ContextIdStore.run(
				{ [ContextIdKeys.Tenant]: tenant, [ContextIdKeys.Organization]: `org-${tenant}` },
				async () => {
					await tenantPartitionedProofStorage.set(
						makeStuckProofEntity({ id: `proof-${tenant}`, organizationId: `org-${tenant}` })
					);
				}
			);
		}

		const service = new ImmutableProofService({
			config: {
				sweepStaleThresholdMs: 60000,
				sweepAssumeRetryableBefore: new Date(FIRST_TICK).toISOString()
			}
		});
		await service.start();

		for (const tenant of tenants) {
			const proofEntity = await ContextIdStore.run({ [ContextIdKeys.Tenant]: tenant }, async () =>
				tenantPartitionedProofStorage.get(`proof-${tenant}`)
			);
			expect(proofEntity?.sweepAttempts).toEqual(1);
			expect(proofEntity?.taskId).toBeDefined();
		}

		const taskStore = await backgroundTaskStorage.getStore();
		for (const tenant of tenants) {
			const task = taskStore.find(t => t.contextIds?.[ContextIdKeys.Tenant] === tenant);
			expect(task).toBeDefined();
			expect(task?.contextIds?.[ContextIdKeys.Organization]).toEqual(`org-${tenant}`);
		}
	});

	test("Stop removes the scheduled sweep only when this instance registered it", async () => {
		const calls = { added: 0, removed: 0 };
		ComponentFactory.register("task-scheduler", () => ({
			className: () => "task-scheduler",
			addTask: async () => {
				calls.added++;
			},
			removeTask: async () => {
				calls.removed++;
			},
			tasksInfo: async () => ({ tasks: {} })
		}));

		const service = new ImmutableProofService();
		await service.start();
		await service.stop();
		expect(calls.added).toEqual(1);
		expect(calls.removed).toEqual(1);

		Factory.createFactory("engine-core").register("engine", () => ({
			className: () => "MockEngineCore",
			isClone: () => true,
			getCloneData: () => undefined
		}));
		const cloneService = new ImmutableProofService();
		await cloneService.start();
		await cloneService.stop();
		expect(calls.added).toEqual(1);
		expect(calls.removed).toEqual(1);
	});

	describe("ImmutableProofService health checks", () => {
		test("health check returns ok status when notarization connector is accessible", async () => {
			const service = new ImmutableProofService();
			const results = await service.healthApplication(vi.fn());
			expect(results).toHaveLength(1);
			const result = results?.[0];
			expect(result?.category).toBe(HealthCategory.Application);
			expect(result?.status).toBe(HealthStatus.Ok);
		});

		test("health check returns empty results without org context", async () => {
			ContextIdStore.getContextIds = vi.fn().mockReturnValue({});
			const service = new ImmutableProofService();
			const results = await service.healthApplication(vi.fn());
			expect(results).toHaveLength(0);
		});
	});
});
