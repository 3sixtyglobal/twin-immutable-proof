// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	type BackgroundTask,
	BackgroundTaskService,
	initSchema as initSchemaBackgroundTask
} from "@twin.org/background-task-service";
import { ContextIdStore, type IContextIds } from "@twin.org/context";
import { ComponentFactory, RandomHelper } from "@twin.org/core";
import { JsonLdProcessor } from "@twin.org/data-json-ld";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { ModuleHelper } from "@twin.org/modules";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVerifiableStorageConnector,
	initSchema as initSchemaVerifiableStorage,
	type VerifiableItem
} from "@twin.org/verifiable-storage-connector-entity-storage";
import { VerifiableStorageConnectorFactory } from "@twin.org/verifiable-storage-models";
import { cleanupTestEnv, setupTestEnv, TEST_ORGANIZATION_IDENTITY } from "./setupTestEnv.js";
import type { ImmutableProof } from "../src/entities/immutableProof.js";
import { ImmutableProofService } from "../src/immutableProofService.js";
import { initSchema } from "../src/schema.js";

let proofStorage: MemoryEntityStorageConnector<ImmutableProof>;
let verifiableStorage: MemoryEntityStorageConnector<VerifiableItem>;
let backgroundTaskStorage: MemoryEntityStorageConnector<BackgroundTask>;
let backgroundTaskService: BackgroundTaskService;

const FIRST_TICK = 1724327716271;

/**
 * Wait for the proof to be generated.
 * @param proofCount The number of proofs to wait for.
 */
async function waitForProofGeneration(proofCount: number = 1): Promise<void> {
	let count = 0;
	let generated;
	do {
		generated = verifiableStorage.getStore().length === proofCount || count++ === proofCount * 40;
		if (generated) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 200));
	} while (!generated && count < 20);

	console.debug(JSON.stringify(backgroundTaskStorage.getStore(), null, 2));
	throw new Error("Proof generation timed out");
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
		initSchemaVerifiableStorage();
		initSchemaBackgroundTask();

		ContextIdStore.getContextIds = vi
			.fn()
			.mockImplementation(() => ({ organization: TEST_ORGANIZATION_IDENTITY }));

		proofStorage = new MemoryEntityStorageConnector<ImmutableProof>({
			entitySchema: nameof<ImmutableProof>()
		});
		EntityStorageConnectorFactory.register("immutable-proof", () => proofStorage);

		backgroundTaskStorage = new MemoryEntityStorageConnector<BackgroundTask>({
			entitySchema: nameof<BackgroundTask>()
		});
		EntityStorageConnectorFactory.register("background-task", () => backgroundTaskStorage);

		backgroundTaskService = new BackgroundTaskService();
		ComponentFactory.register("background-task", () => backgroundTaskService);

		verifiableStorage = new MemoryEntityStorageConnector<VerifiableItem>({
			entitySchema: nameof<VerifiableItem>()
		});
		EntityStorageConnectorFactory.register("verifiable-item", () => verifiableStorage);

		VerifiableStorageConnectorFactory.register(
			"verifiable-storage",
			() => new EntityStorageVerifiableStorageConnector()
		);

		Date.now = vi.fn().mockImplementation(() => FIRST_TICK);
		let counter = 1;
		RandomHelper.generate = vi
			.fn()
			.mockImplementation(length => new Uint8Array(length).fill(counter++));

		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown, contextIds?: IContextIds) => {
					const res = await ModuleHelper.execModuleMethod(module, method, args as unknown[]);
					completed(method, res);
				}
			}));
	});

	afterAll(async () => {
		await cleanupTestEnv();
	});

	test("Can create an instance of the service", async () => {
		const service = new ImmutableProofService();
		expect(service).toBeDefined();
	});

	test("Can create a proof that is pending", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		});
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc="
			}
		]);
	});

	test("Can get a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		});
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "123"
			}
		]);

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/"
			],
			type: "ImmutableProof",
			id: "0101010101010101010101010101010101010101010101010101010101010101",
			proofObjectId: "123",
			proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc="
		});
	});

	test("Can get a proof that has been issued", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofId = await service.create({
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		});
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		await waitForProofGeneration();

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
				verifiableStorageId:
					"verifiable:entity-storage:0404040404040404040404040404040404040404040404040404040404040404",
				dateCreated: "2024-08-22T11:55:16.271Z"
			}
		]);

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/",
				"https://www.w3.org/ns/credentials/v2",
				"https://schema.twindev.org/verifiable-storage/"
			],
			id: "0101010101010101010101010101010101010101010101010101010101010101",
			type: "ImmutableProof",
			proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
			proofObjectId: "123",
			proof: {
				created: "2024-08-22T11:55:16.271Z",
				type: "DataIntegrityProof",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z5BfYPPxyfZ1GrRAHfBcweRQZBDqhtmbBebouRzq8s18DLxTD1fDHJDf7WZHv5nbRKMoWqQw4GjUkVFWxQVhpqTR3",
				verificationMethod:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363#immutable-proof-assertion"
			},
			immutableReceipt: {
				type: "VerifiableStorageEntityStorageReceipt",
				entityStorageId: "0404040404040404040404040404040404040404040404040404040404040404"
			},
			verifiableStorageId:
				"verifiable:entity-storage:0404040404040404040404040404040404040404040404040404040404040404"
		});

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				allowList: [
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363"
				],
				creator:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				data: "eyJAY29udGV4dCI6WyJodHRwczovL3NjaGVtYS50d2luZGV2Lm9yZy9pbW11dGFibGUtcHJvb2YvIiwiaHR0cHM6Ly9zY2hlbWEudHdpbmRldi5vcmcvY29tbW9uLyIsImh0dHBzOi8vd3d3LnczLm9yZy9ucy9jcmVkZW50aWFscy92MiJdLCJpZCI6IjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEiLCJ0eXBlIjoiSW1tdXRhYmxlUHJvb2YiLCJwcm9vZiI6eyJ0eXBlIjoiRGF0YUludGVncml0eVByb29mIiwiY3JlYXRlZCI6IjIwMjQtMDgtMjJUMTE6NTU6MTYuMjcxWiIsImNyeXB0b3N1aXRlIjoiZWRkc2EtamNzLTIwMjIiLCJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJwcm9vZlZhbHVlIjoiejVCZllQUHh5ZloxR3JSQUhmQmN3ZVJRWkJEcWh0bWJCZWJvdVJ6cThzMThETHhURDFmREhKRGY3V1pIdjVuYlJLTW9XcVF3NEdqVWtWRld4UVZocHFUUjMiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHg2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzI2ltbXV0YWJsZS1wcm9vZi1hc3NlcnRpb24ifSwicHJvb2ZPYmplY3RIYXNoIjoic2hhMjU2Olo1azQzRVZNM2VPQnFjSzZ2dDJvaHd0SkRVc2paWHpadVdaRmgySzN6dmM9IiwicHJvb2ZPYmplY3RJZCI6IjEyMyJ9",
				id: "0404040404040404040404040404040404040404040404040404040404040404",
				maxAllowListSize: 100
			}
		]);
	});

	test("Can verify a proof that has not been issued", async () => {
		const service = new ImmutableProofService();
		await service.start();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject);
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/"
			],
			id: "0101010101010101010101010101010101010101010101010101010101010101",
			type: "ImmutableProof",
			proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
			proofObjectId: "123"
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc="
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

	test("Can verify a proof that has been issued", async () => {
		await backgroundTaskService.start();

		const service = new ImmutableProofService();
		await service.start();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject);
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		await waitForProofGeneration();

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/",
				"https://www.w3.org/ns/credentials/v2",
				"https://schema.twindev.org/verifiable-storage/"
			],
			id: "0101010101010101010101010101010101010101010101010101010101010101",
			type: "ImmutableProof",
			proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
			proofObjectId: "123",
			proof: {
				created: "2024-08-22T11:55:16.271Z",
				type: "DataIntegrityProof",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z5BfYPPxyfZ1GrRAHfBcweRQZBDqhtmbBebouRzq8s18DLxTD1fDHJDf7WZHv5nbRKMoWqQw4GjUkVFWxQVhpqTR3",
				verificationMethod:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363#immutable-proof-assertion"
			},
			immutableReceipt: {
				type: "VerifiableStorageEntityStorageReceipt",
				entityStorageId: "0404040404040404040404040404040404040404040404040404040404040404"
			},
			verifiableStorageId:
				"verifiable:entity-storage:0404040404040404040404040404040404040404040404040404040404040404"
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
				verifiableStorageId:
					"verifiable:entity-storage:0404040404040404040404040404040404040404040404040404040404040404",
				dateCreated: "2024-08-22T11:55:16.271Z"
			}
		]);

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				allowList: [
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363"
				],
				creator:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				data: "eyJAY29udGV4dCI6WyJodHRwczovL3NjaGVtYS50d2luZGV2Lm9yZy9pbW11dGFibGUtcHJvb2YvIiwiaHR0cHM6Ly9zY2hlbWEudHdpbmRldi5vcmcvY29tbW9uLyIsImh0dHBzOi8vd3d3LnczLm9yZy9ucy9jcmVkZW50aWFscy92MiJdLCJpZCI6IjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEiLCJ0eXBlIjoiSW1tdXRhYmxlUHJvb2YiLCJwcm9vZiI6eyJ0eXBlIjoiRGF0YUludGVncml0eVByb29mIiwiY3JlYXRlZCI6IjIwMjQtMDgtMjJUMTE6NTU6MTYuMjcxWiIsImNyeXB0b3N1aXRlIjoiZWRkc2EtamNzLTIwMjIiLCJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJwcm9vZlZhbHVlIjoiejVCZllQUHh5ZloxR3JSQUhmQmN3ZVJRWkJEcWh0bWJCZWJvdVJ6cThzMThETHhURDFmREhKRGY3V1pIdjVuYlJLTW9XcVF3NEdqVWtWRld4UVZocHFUUjMiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHg2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzI2ltbXV0YWJsZS1wcm9vZi1hc3NlcnRpb24ifSwicHJvb2ZPYmplY3RIYXNoIjoic2hhMjU2Olo1azQzRVZNM2VPQnFjSzZ2dDJvaHd0SkRVc2paWHpadVdaRmgySzN6dmM9IiwicHJvb2ZPYmplY3RJZCI6IjEyMyJ9",
				id: "0404040404040404040404040404040404040404040404040404040404040404",
				maxAllowListSize: 100
			}
		]);

		const result = await service.verify(proofId);
		expect(result).toEqual({
			"@context": "https://schema.twindev.org/immutable-proof/",
			type: "ImmutableProofVerification",
			verified: true
		});
	});
});
