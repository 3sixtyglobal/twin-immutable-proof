// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	type BackgroundTask,
	BackgroundTaskService,
	initSchema as initSchemaBackgroundTask
} from "@3sixty/background-task-service";
import { ContextIdStore } from "@3sixty/context";
import {
	AlreadyExistsError,
	ComponentFactory,
	Converter,
	Factory,
	Is,
	RandomHelper
} from "@3sixty/core";
import { JsonLdProcessor } from "@3sixty/data-json-ld";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	EntityStorageLoggingConnector,
	initSchema as initSchemaLogging,
	type LogEntry
} from "@3sixty/logging-connector-entity-storage";
import { LoggingConnectorFactory } from "@3sixty/logging-models";
import { ModuleHelper } from "@3sixty/modules";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageNotarizationConnector,
	initSchema as initSchemaNotarization,
	type Notarization
} from "@3sixty/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@3sixty/notarization-models";
import {
	MetricType,
	type ITelemetryComponent,
	type ITelemetryMetric
} from "@3sixty/telemetry-models";
import { cleanupTestEnv, setupTestEnv, TEST_ORGANIZATION_IDENTITY } from "./setupTestEnv.js";
import type { ImmutableProof } from "../src/entities/immutableProof.js";
import { ImmutableProofService } from "../src/immutableProofService.js";
import { initSchema } from "../src/schema.js";

let proofStorage: MemoryEntityStorageConnector<ImmutableProof>;
let notarizationStorage: MemoryEntityStorageConnector<Notarization>;
let backgroundTaskStorage: MemoryEntityStorageConnector<BackgroundTask>;
let backgroundTaskService: BackgroundTaskService;
let memoryLoggingEntityStorage: MemoryEntityStorageConnector<LogEntry>;

const FIRST_TICK = 1724327716271;

interface MetricValueEntry {
	id: string;
	value: "inc" | "dec" | number;
	customData?: { [key: string]: unknown };
}

function makeMockTelemetry(): {
	component: ITelemetryComponent;
	created: ITelemetryMetric[];
	values: MetricValueEntry[];
} {
	const created: ITelemetryMetric[] = [];
	const values: MetricValueEntry[] = [];
	const component: ITelemetryComponent = {
		className: () => "MockTelemetry",
		start: async () => {},
		stop: async () => {},
		createMetric: async m => {
			for (const metric of Is.array(m) ? m : [m]) {
				created.push({ ...metric });
			}
		},
		getMetric: async () => ({ metric: {} as never, value: {} as never }),
		updateMetric: async () => {},
		addMetricValue: async (id, value, customData) => {
			values.push({ id, value, customData });
			return "v";
		},
		addMetricValues: async entries => {
			values.push(...entries);
			return entries.map(() => "v");
		},
		getMetricValue: async (id, valueId) => ({
			id: valueId,
			metricId: id,
			value: 0,
			ts: Date.now()
		}),
		removeMetric: async () => {},
		query: async () => ({ entities: [] }),
		queryValues: async () => ({ metric: {} as never, entities: [] })
	};
	return { component, created, values };
}

/**
 * Wait for the proof to be generated.
 * @param proofCount The number of proofs to wait for.
 * @throws Error if generation does not complete before the timeout.
 */
async function waitForProofGeneration(proofCount: number = 1): Promise<void> {
	const maxAttempts = proofCount * 40;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		if ((await notarizationStorage.getStore()).length === proofCount) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 200));
	}
	throw new Error("Proof generation timed out");
}

const PROOF_OBJECT = {
	"@context": "https://schema.org",
	type: "Person",
	id: "uuid:1234567890",
	name: "John Smith"
};

describe("ImmutableProofService — metrics", () => {
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

		Factory.createFactory("engine-core").register("engine", () => ({
			className: () => "MockEngineCore",
			isClone: () => false,
			getCloneData: () => undefined
		}));

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

	/**
	 * Mock the module helper so the background proof task executes inline, avoiding the need
	 * for a real worker thread / engine.
	 */
	function mockInlineTaskExecution(): void {
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));
	}

	test("start() registers the 5 counters and the completion lag gauge", async () => {
		const { component, created } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		expect(created).toHaveLength(6);

		const gauge = created.find(m => m.id === "ip_proof_completion_lag");
		expect(gauge?.type).toBe(MetricType.Gauge);
		expect(gauge?.unit).toBe("ms");

		const counters = created.filter(m => m.id !== "ip_proof_completion_lag");
		expect(counters).toHaveLength(5);
		for (const m of counters) {
			expect(m.type).toBe(MetricType.Counter);
		}

		const ids = created.map(m => m.id);
		expect(ids).toContain("ip_proofs_created");
		expect(ids).toContain("ip_verifications_succeeded");
		expect(ids).toContain("ip_verifications_failed");
		expect(ids).toContain("ip_proofs_removed");
		expect(ids).toContain("ip_notarizations_removed");
	});

	test("start() is idempotent — AlreadyExistsError is swallowed", async () => {
		let callCount = 0;
		const component: ITelemetryComponent = {
			...makeMockTelemetry().component,
			createMetric: async () => {
				if (callCount++ > 0) {
					throw new AlreadyExistsError("test", "metric", "id");
				}
			}
		};
		ComponentFactory.register("test-telemetry-idempotent", () => component);

		const service = new ImmutableProofService({
			telemetryComponentType: "test-telemetry-idempotent"
		});
		await service.start();
		await expect(service.start()).resolves.toBeUndefined();
	});

	test("create() emits ip_proofs_created with hasDeleteLock false by default", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await service.create(PROOF_OBJECT);

		const createdValues = values.filter(v => v.id === "ip_proofs_created");
		expect(createdValues).toHaveLength(1);
		expect(createdValues[0].value).toBe("inc");
		expect(createdValues[0].customData?.hasDeleteLock).toBe(false);
	});

	test("create() with deleteLock emits ip_proofs_created with hasDeleteLock true", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await service.create(PROOF_OBJECT, { deleteLock: "2030-01-01T00:00:00.000Z" });

		const createdValues = values.filter(v => v.id === "ip_proofs_created");
		expect(createdValues).toHaveLength(1);
		expect(createdValues[0].customData?.hasDeleteLock).toBe(true);
	});

	test("create() failure emits no counter", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		vi.spyOn(backgroundTaskService, "create").mockRejectedValueOnce(
			new Error("background task storage unavailable")
		);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await expect(service.create(PROOF_OBJECT)).rejects.toThrow();

		expect(values.filter(v => v.id === "ip_proofs_created")).toHaveLength(0);
	});

	test("verify() on a proof that has not been issued emits ip_verifications_failed with failureReason notIssued", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);

		const result = await service.verify(proofId);
		expect(result.verified).toBe(false);

		const failed = values.filter(v => v.id === "ip_verifications_failed");
		expect(failed).toHaveLength(1);
		expect(failed[0].customData?.failureReason).toBe("notIssued");
		expect(values.filter(v => v.id === "ip_verifications_succeeded")).toHaveLength(0);
	});

	test("verify() on a proof that has been issued emits ip_verifications_succeeded", async () => {
		mockInlineTaskExecution();
		await backgroundTaskService.start();

		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await waitForProofGeneration();

		const result = await service.verify(proofId);
		expect(result.verified).toBe(true);

		expect(values.filter(v => v.id === "ip_verifications_succeeded")).toHaveLength(1);
		expect(values.filter(v => v.id === "ip_verifications_failed")).toHaveLength(0);
	});

	test("a completed proof emits ip_proof_completion_lag as the time since it was requested", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await service.create(PROOF_OBJECT);

		// The proof is requested at FIRST_TICK and only processed once the clock has moved on.
		Date.now = vi.fn().mockImplementation(() => FIRST_TICK + 5000);
		mockInlineTaskExecution();
		await backgroundTaskService.start();
		await waitForProofGeneration();

		for (
			let attempt = 0;
			attempt < 40 && !values.some(v => v.id === "ip_proof_completion_lag");
			attempt++
		) {
			await new Promise(resolve => setTimeout(resolve, 200));
		}

		const lagValues = values.filter(v => v.id === "ip_proof_completion_lag");
		expect(lagValues).toHaveLength(1);
		expect(lagValues[0].value).toBe(5000);
	});

	test("a proof that has not completed emits no ip_proof_completion_lag", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await service.create(PROOF_OBJECT);

		expect(values.filter(v => v.id === "ip_proof_completion_lag")).toHaveLength(0);
	});

	test("verify() on a missing proof emits no counter", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await expect(
			service.verify("immutable-proof:ffffffffffffffffffffffffffffffff")
		).rejects.toThrow();

		expect(values.filter(v => v.id === "ip_verifications_succeeded")).toHaveLength(0);
		expect(values.filter(v => v.id === "ip_verifications_failed")).toHaveLength(0);
	});

	test("remove() emits ip_proofs_removed", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await service.remove(proofId);

		expect(values.filter(v => v.id === "ip_proofs_removed")).toHaveLength(1);
	});

	test("remove() of a non-existent proof emits no counter", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await expect(
			service.remove("immutable-proof:ffffffffffffffffffffffffffffffff")
		).rejects.toThrow();

		expect(values.filter(v => v.id === "ip_proofs_removed")).toHaveLength(0);
	});

	test("removeNotarization() with a notarization emits ip_notarizations_removed", async () => {
		mockInlineTaskExecution();
		await backgroundTaskService.start();

		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await waitForProofGeneration();

		await service.removeNotarization(proofId);

		expect(values.filter(v => v.id === "ip_notarizations_removed")).toHaveLength(1);
	});

	test("removeNotarization() no-op path (no notarizationId) emits no counter", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await service.removeNotarization(proofId);

		expect(values.filter(v => v.id === "ip_notarizations_removed")).toHaveLength(0);
	});

	test("removeNotarization() of a non-existent proof emits no counter", async () => {
		const { component, values } = makeMockTelemetry();
		ComponentFactory.register("test-telemetry", () => component);

		const service = new ImmutableProofService({ telemetryComponentType: "test-telemetry" });
		await service.start();

		await expect(
			service.removeNotarization("immutable-proof:ffffffffffffffffffffffffffffffff")
		).rejects.toThrow();

		expect(values.filter(v => v.id === "ip_notarizations_removed")).toHaveLength(0);
	});

	test("telemetry component that throws on addMetricValue does not break operations", async () => {
		const component: ITelemetryComponent = {
			...makeMockTelemetry().component,
			addMetricValue: async () => {
				throw new Error("telemetry outage");
			}
		};
		ComponentFactory.register("test-telemetry-broken", () => component);

		const service = new ImmutableProofService({
			telemetryComponentType: "test-telemetry-broken"
		});
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		expect(proofId).toBeDefined();

		const verified = await service.verify(proofId);
		expect(verified.verified).toBe(false);

		await service.removeNotarization(proofId);
		await service.remove(proofId);
	});

	test("service works without telemetryComponentType — no errors, all operations succeed", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		expect(proofId).toBeDefined();

		const verified = await service.verify(proofId);
		expect(verified.verified).toBe(false);

		await service.removeNotarization(proofId);
		await service.remove(proofId);
	});

	test("waitForProofGeneration() throws when generation never completes", async () => {
		await expect(waitForProofGeneration()).rejects.toThrow("Proof generation timed out");
	});
});
