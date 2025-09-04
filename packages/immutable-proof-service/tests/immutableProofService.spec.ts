// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	EntityStorageBackgroundTaskConnector,
	type BackgroundTask,
	initSchema as initSchemaBackgroundTask
} from "@twin.org/background-task-connector-entity-storage";
import { BackgroundTaskConnectorFactory } from "@twin.org/background-task-models";
import { RandomHelper } from "@twin.org/core";
import { JsonLdProcessor } from "@twin.org/data-json-ld";
import { MemoryEntityStorageConnector } from "@twin.org/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@twin.org/entity-storage-models";
import { ModuleHelper } from "@twin.org/modules";
import { nameof } from "@twin.org/nameof";
import {
	EntityStorageVerifiableStorageConnector,
	type VerifiableItem,
	initSchema as initSchemaVerifiableStorage
} from "@twin.org/verifiable-storage-connector-entity-storage";
import { VerifiableStorageConnectorFactory } from "@twin.org/verifiable-storage-models";
import {
	cleanupTestEnv,
	setupTestEnv,
	TEST_NODE_IDENTITY,
	TEST_USER_IDENTITY
} from "./setupTestEnv";
import type { ImmutableProof } from "../src/entities/immutableProof";
import { ImmutableProofService } from "../src/immutableProofService";
import { initSchema } from "../src/schema";

let proofStorage: MemoryEntityStorageConnector<ImmutableProof>;
let verifiableStorage: MemoryEntityStorageConnector<VerifiableItem>;
let backgroundTaskStorage: MemoryEntityStorageConnector<BackgroundTask>;
let backgroundTaskConnectorEntityStorage: EntityStorageBackgroundTaskConnector;

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
	} while (!generated);
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

		proofStorage = new MemoryEntityStorageConnector<ImmutableProof>({
			entitySchema: nameof<ImmutableProof>()
		});
		EntityStorageConnectorFactory.register("immutable-proof", () => proofStorage);

		backgroundTaskStorage = new MemoryEntityStorageConnector<BackgroundTask>({
			entitySchema: nameof<BackgroundTask>()
		});
		EntityStorageConnectorFactory.register("background-task", () => backgroundTaskStorage);

		backgroundTaskConnectorEntityStorage = new EntityStorageBackgroundTaskConnector();
		BackgroundTaskConnectorFactory.register(
			"background-task",
			() => backgroundTaskConnectorEntityStorage
		);

		verifiableStorage = new MemoryEntityStorageConnector<VerifiableItem>({
			entitySchema: nameof<VerifiableItem>()
		});
		EntityStorageConnectorFactory.register("verifiable-item", () => verifiableStorage);

		VerifiableStorageConnectorFactory.register(
			"verifiable-storage",
			() => new EntityStorageVerifiableStorageConnector()
		);

		Date.now = vi.fn().mockImplementation(() => FIRST_TICK);
		RandomHelper.generate = vi
			.fn()
			.mockImplementationOnce(length => new Uint8Array(length).fill(1))
			.mockImplementationOnce(length => new Uint8Array(length).fill(2))
			.mockImplementationOnce(length => new Uint8Array(length).fill(3))
			.mockImplementationOnce(length => new Uint8Array(length).fill(4))
			.mockImplementationOnce(length => new Uint8Array(length).fill(5))
			.mockImplementationOnce(length => new Uint8Array(length).fill(6))
			.mockImplementationOnce(length => new Uint8Array(length).fill(7))
			.mockImplementationOnce(length => new Uint8Array(length).fill(8))
			.mockImplementationOnce(length => new Uint8Array(length).fill(9))
			.mockImplementationOnce(length => new Uint8Array(length).fill(10))
			.mockImplementationOnce(length => new Uint8Array(length).fill(11))
			.mockImplementationOnce(length => new Uint8Array(length).fill(12))
			.mockImplementationOnce(length => new Uint8Array(length).fill(13))
			.mockImplementationOnce(length => new Uint8Array(length).fill(14))
			.mockImplementation(length => new Uint8Array(length).fill(15));

		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThread = vi
			.fn()
			.mockImplementation(async (module, method, args) =>
				ModuleHelper.execModuleMethod(module, method, args)
			);
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

		const proofId = await service.create(
			{
				"@context": "https://schema.org",
				type: "Person",
				id: "123",
				name: "John Smith"
			},
			TEST_USER_IDENTITY,
			TEST_NODE_IDENTITY
		);
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				nodeIdentity:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				userIdentity:
					"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc="
			}
		]);
	});

	test("Can get a proof that has not been issued", async () => {
		const service = new ImmutableProofService();

		const proofId = await service.create(
			{
				"@context": "https://schema.org",
				type: "Person",
				id: "123",
				name: "John Smith"
			},
			TEST_USER_IDENTITY,
			TEST_NODE_IDENTITY
		);
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				nodeIdentity:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				userIdentity:
					"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
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
			nodeIdentity:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			userIdentity:
				"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
			proofObjectId: "123",
			proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc="
		});
	});

	test("Can get a proof that has been issued", async () => {
		await backgroundTaskConnectorEntityStorage.start("");

		const service = new ImmutableProofService();

		const proofId = await service.create(
			{
				"@context": "https://schema.org",
				type: "Person",
				id: "123",
				name: "John Smith"
			},
			TEST_USER_IDENTITY,
			TEST_NODE_IDENTITY
		);
		expect(proofId).toEqual(
			"immutable-proof:0101010101010101010101010101010101010101010101010101010101010101"
		);

		await waitForProofGeneration();

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				nodeIdentity:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				userIdentity:
					"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
				verifiableStorageId:
					"verifiable:entity-storage:0303030303030303030303030303030303030303030303030303030303030303",
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
			nodeIdentity:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			userIdentity:
				"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
			proof: {
				created: "2024-08-22T11:55:16.271Z",
				type: "DataIntegrityProof",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z4usf9wC8XVqxdtuvfSnijvWGh7xFr5A9zR2SmQUY2H7s9sTJetUZcYk34HoLC7UQs7ayxDEQRUDY8w1rUhE9zqw9",
				verificationMethod:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363#immutable-proof-assertion"
			},
			immutableReceipt: {
				type: "VerifiableStorageEntityStorageReceipt",
				entityStorageId: "0303030303030303030303030303030303030303030303030303030303030303"
			},
			verifiableStorageId:
				"verifiable:entity-storage:0303030303030303030303030303030303030303030303030303030303030303"
		});

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				allowList: [
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363"
				],
				creator:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				data: "eyJAY29udGV4dCI6WyJodHRwczovL3NjaGVtYS50d2luZGV2Lm9yZy9pbW11dGFibGUtcHJvb2YvIiwiaHR0cHM6Ly9zY2hlbWEudHdpbmRldi5vcmcvY29tbW9uLyIsImh0dHBzOi8vd3d3LnczLm9yZy9ucy9jcmVkZW50aWFscy92MiJdLCJpZCI6IjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEiLCJ0eXBlIjoiSW1tdXRhYmxlUHJvb2YiLCJub2RlSWRlbnRpdHkiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHg2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzIiwidXNlcklkZW50aXR5IjoiZGlkOmVudGl0eS1zdG9yYWdlOjB4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1OCIsInByb29mIjp7InR5cGUiOiJEYXRhSW50ZWdyaXR5UHJvb2YiLCJjcmVhdGVkIjoiMjAyNC0wOC0yMlQxMTo1NToxNi4yNzFaIiwiY3J5cHRvc3VpdGUiOiJlZGRzYS1qY3MtMjAyMiIsInByb29mUHVycG9zZSI6ImFzc2VydGlvbk1ldGhvZCIsInByb29mVmFsdWUiOiJ6NHVzZjl3QzhYVnF4ZHR1dmZTbmlqdldHaDd4RnI1QTl6UjJTbVFVWTJIN3M5c1RKZXRVWmNZazM0SG9MQzdVUXM3YXl4REVRUlVEWTh3MXJVaEU5enF3OSIsInZlcmlmaWNhdGlvbk1ldGhvZCI6ImRpZDplbnRpdHktc3RvcmFnZToweDYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjMjaW1tdXRhYmxlLXByb29mLWFzc2VydGlvbiJ9LCJwcm9vZk9iamVjdEhhc2giOiJzaGEyNTY6WjVrNDNFVk0zZU9CcWNLNnZ0Mm9od3RKRFVzalpYelp1V1pGaDJLM3p2Yz0iLCJwcm9vZk9iamVjdElkIjoiMTIzIn0=",
				id: "0303030303030303030303030303030303030303030303030303030303030303",
				maxAllowListSize: 100
			}
		]);
	});

	test("Can verify a proof that has not been issued", async () => {
		const service = new ImmutableProofService();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject, TEST_USER_IDENTITY, TEST_NODE_IDENTITY);
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
			proofObjectId: "123",
			nodeIdentity:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			userIdentity:
				"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858"
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				nodeIdentity:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				userIdentity:
					"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
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
		await backgroundTaskConnectorEntityStorage.start("");

		const service = new ImmutableProofService();

		const proofObject = {
			"@context": "https://schema.org",
			type: "Person",
			id: "123",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject, TEST_USER_IDENTITY, TEST_NODE_IDENTITY);
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
			userIdentity:
				"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
			nodeIdentity:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			proof: {
				created: "2024-08-22T11:55:16.271Z",
				type: "DataIntegrityProof",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue:
					"z4usf9wC8XVqxdtuvfSnijvWGh7xFr5A9zR2SmQUY2H7s9sTJetUZcYk34HoLC7UQs7ayxDEQRUDY8w1rUhE9zqw9",
				verificationMethod:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363#immutable-proof-assertion"
			},
			immutableReceipt: {
				type: "VerifiableStorageEntityStorageReceipt",
				entityStorageId: "0303030303030303030303030303030303030303030303030303030303030303"
			},
			verifiableStorageId:
				"verifiable:entity-storage:0303030303030303030303030303030303030303030303030303030303030303"
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "0101010101010101010101010101010101010101010101010101010101010101",
				nodeIdentity:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				userIdentity:
					"did:entity-storage:0x5858585858585858585858585858585858585858585858585858585858585858",
				proofObjectId: "123",
				proofObjectHash: "sha256:Z5k43EVM3eOBqcK6vt2ohwtJDUsjZXzZuWZFh2K3zvc=",
				verifiableStorageId:
					"verifiable:entity-storage:0303030303030303030303030303030303030303030303030303030303030303",
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
				data: "eyJAY29udGV4dCI6WyJodHRwczovL3NjaGVtYS50d2luZGV2Lm9yZy9pbW11dGFibGUtcHJvb2YvIiwiaHR0cHM6Ly9zY2hlbWEudHdpbmRldi5vcmcvY29tbW9uLyIsImh0dHBzOi8vd3d3LnczLm9yZy9ucy9jcmVkZW50aWFscy92MiJdLCJpZCI6IjAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEwMTAxMDEiLCJ0eXBlIjoiSW1tdXRhYmxlUHJvb2YiLCJub2RlSWRlbnRpdHkiOiJkaWQ6ZW50aXR5LXN0b3JhZ2U6MHg2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzIiwidXNlcklkZW50aXR5IjoiZGlkOmVudGl0eS1zdG9yYWdlOjB4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1ODU4NTg1OCIsInByb29mIjp7InR5cGUiOiJEYXRhSW50ZWdyaXR5UHJvb2YiLCJjcmVhdGVkIjoiMjAyNC0wOC0yMlQxMTo1NToxNi4yNzFaIiwiY3J5cHRvc3VpdGUiOiJlZGRzYS1qY3MtMjAyMiIsInByb29mUHVycG9zZSI6ImFzc2VydGlvbk1ldGhvZCIsInByb29mVmFsdWUiOiJ6NHVzZjl3QzhYVnF4ZHR1dmZTbmlqdldHaDd4RnI1QTl6UjJTbVFVWTJIN3M5c1RKZXRVWmNZazM0SG9MQzdVUXM3YXl4REVRUlVEWTh3MXJVaEU5enF3OSIsInZlcmlmaWNhdGlvbk1ldGhvZCI6ImRpZDplbnRpdHktc3RvcmFnZToweDYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjM2MzYzNjMjaW1tdXRhYmxlLXByb29mLWFzc2VydGlvbiJ9LCJwcm9vZk9iamVjdEhhc2giOiJzaGEyNTY6WjVrNDNFVk0zZU9CcWNLNnZ0Mm9od3RKRFVzalpYelp1V1pGaDJLM3p2Yz0iLCJwcm9vZk9iamVjdElkIjoiMTIzIn0=",
				id: "0303030303030303030303030303030303030303030303030303030303030303",
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
