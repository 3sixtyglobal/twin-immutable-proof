// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	type BackgroundTask,
	BackgroundTaskService,
	initSchema as initSchemaBackgroundTask
} from "@twin.org/background-task-service";
import { ContextIdStore } from "@twin.org/context";
import { ComponentFactory, Converter, Factory, GeneralError, RandomHelper } from "@twin.org/core";
import { JsonLdProcessor } from "@twin.org/data-json-ld";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import {
	ImmutableProofSpanAttributes,
	ImmutableProofSpanNames
} from "@twin.org/immutable-proof-models";
import {
	EntityStorageLoggingConnector,
	initSchema as initSchemaLogging,
	type LogEntry
} from "@twin.org/logging-connector-entity-storage";
import { LoggingConnectorFactory } from "@twin.org/logging-models";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageNotarizationConnector,
	initSchema as initSchemaNotarization,
	type Notarization
} from "@twin.org/notarization-connector-entity-storage";
import { NotarizationConnectorFactory } from "@twin.org/notarization-models";
import {
	SpanHelper,
	SpanStatus,
	type ISpan,
	type ISpanOptions,
	type ITracingComponent
} from "@twin.org/tracing-models";
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

function makeMockTracing(): { component: ITracingComponent; ended: ISpan[] } {
	const ended: ISpan[] = [];
	const component: ITracingComponent = {
		className: () => "MockTracing",
		startSpan: async (name: string, options?: ISpanOptions) => SpanHelper.startSpan(name, options),
		endSpan: async (span: ISpan, status?: SpanStatus) => {
			SpanHelper.endSpan(span, status);
			ended.push(span);
		},
		query: async () => ({ entities: [] }),
		getTrace: async () => []
	};
	return { component, ended };
}

const PROOF_OBJECT = {
	"@context": "https://schema.org",
	type: "Person",
	id: "uuid:1234567890",
	name: "John Smith"
};

describe("ImmutableProofService — tracing", () => {
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

	test("create() records a span", async () => {
		const { component, ended } = makeMockTracing();
		ComponentFactory.register("test-tracing", () => component);

		const service = new ImmutableProofService({ tracingComponentType: "test-tracing" });
		await service.start();

		await service.create(PROOF_OBJECT);

		const created = ended.filter(s => s.name === ImmutableProofSpanNames.Create);
		expect(created).toHaveLength(1);
		expect(created[0].status).toEqual(SpanStatus.Ok);
	});

	test("get() records a span carrying the id", async () => {
		const { component, ended } = makeMockTracing();
		ComponentFactory.register("test-tracing", () => component);

		const service = new ImmutableProofService({ tracingComponentType: "test-tracing" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await service.get(proofId);

		const got = ended.filter(s => s.name === ImmutableProofSpanNames.Get);
		expect(got).toHaveLength(1);
		expect(got[0].attributes?.[ImmutableProofSpanAttributes.Id]).toEqual(proofId);
	});

	test("verify() records a span carrying the id", async () => {
		const { component, ended } = makeMockTracing();
		ComponentFactory.register("test-tracing", () => component);

		const service = new ImmutableProofService({ tracingComponentType: "test-tracing" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await service.verify(proofId);

		const verified = ended.filter(s => s.name === ImmutableProofSpanNames.Verify);
		expect(verified).toHaveLength(1);
		expect(verified[0].attributes?.[ImmutableProofSpanAttributes.Id]).toEqual(proofId);
	});

	test("remove() records a span carrying the id", async () => {
		const { component, ended } = makeMockTracing();
		ComponentFactory.register("test-tracing", () => component);

		const service = new ImmutableProofService({ tracingComponentType: "test-tracing" });
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await service.remove(proofId);

		const removed = ended.filter(s => s.name === ImmutableProofSpanNames.Remove);
		expect(removed).toHaveLength(1);
		expect(removed[0].status).toEqual(SpanStatus.Ok);
	});

	test("a failure ends the span with an error and records the domain error", async () => {
		const { component, ended } = makeMockTracing();
		ComponentFactory.register("test-tracing", () => component);

		const service = new ImmutableProofService({ tracingComponentType: "test-tracing" });
		await service.start();

		await expect(service.get("urn:immutable-proof:0101010101010101")).rejects.toThrow(GeneralError);

		const got = ended.filter(s => s.name === ImmutableProofSpanNames.Get);
		expect(got).toHaveLength(1);
		expect(got[0].status).toEqual(SpanStatus.Error);
		expect(got[0].attributes?.["exception.message"]).toEqual("immutableProofService.getFailed");
	});

	test("operations behave unchanged with no tracing component configured", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create(PROOF_OBJECT);
		await expect(service.get(proofId)).resolves.toBeDefined();
	});

	test("an unresolvable tracing component type is ignored", async () => {
		const service = new ImmutableProofService({ tracingComponentType: "not-registered" });
		await service.start();

		await expect(service.create(PROOF_OBJECT)).resolves.toBeDefined();
	});
});
