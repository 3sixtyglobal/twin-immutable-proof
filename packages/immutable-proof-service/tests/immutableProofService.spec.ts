// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import {
	type BackgroundTask,
	BackgroundTaskService,
	initSchema as initSchemaBackgroundTask
} from "@twin.org/background-task-service";
import { ContextIdStore, type IContextIds } from "@twin.org/context";
import { ComponentFactory, Converter, ObjectHelper, RandomHelper } from "@twin.org/core";
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
let memoryLoggingEntityStorage: MemoryEntityStorageConnector<LogEntry>;

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
		generated = verifiableStorage.getStore().length === proofCount || count++ === proofCount * 40;
		if (generated) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 200));
	} while (!generated && count < 20);

	if (showFail) {
		console.debug("backgroundTasks", JSON.stringify(backgroundTaskStorage.getStore(), null, 2));
		console.debug("logEntries", JSON.stringify(memoryLoggingEntityStorage.getStore(), null, 2));
		throw new Error("Proof generation timed out");
	}
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
		initSchemaVerifiableStorage();
		initSchemaBackgroundTask();

		ContextIdStore.getContextIds = vi
			.fn()
			.mockImplementation(() => ({ organization: TEST_ORGANIZATION_IDENTITY }));

		memoryLoggingEntityStorage = new MemoryEntityStorageConnector<LogEntry>({
			entitySchema: nameof<LogEntry>()
		});
		EntityStorageConnectorFactory.register("log-entry", () => memoryLoggingEntityStorage);
		const loggingConnector = new EntityStorageLoggingConnector();
		LoggingConnectorFactory.register("logging", () => loggingConnector);
		ComponentFactory.register("logging", () => loggingConnector);

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
		// RandomHelper.generate = vi
		// 	.fn()
		// 	.mockImplementation(length => new Uint8Array(length).fill(counter++));

		RandomHelper.generateUuidV7 = vi
			.fn()
			.mockImplementation((format: string) =>
				Converter.bytesToHex(new Uint8Array(16).fill(counter++))
			);
	});

	afterAll(async () => {
		await cleanupTestEnv();
	});

	// test("Can create an instance of the service", async () => {
	// 	const service = new ImmutableProofService();
	// 	expect(service).toBeDefined();
	// });

	// test("Can create a proof that is pending", async () => {
	// 	const service = new ImmutableProofService();
	// 	await service.start();

	// 	const proofId = await service.create({
	// 		"@context": "https://schema.org",
	// 		type: "Person",
	// 		id: "uuid:1234567890",
	// 		name: "John Smith"
	// 	});
	// 	expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

	// 	const proofStore = proofStorage.getStore();
	// 	expect(proofStore).toEqual([
	// 		{
	// 			id: "01010101010101010101010101010101",
	// 			dateCreated: "2024-08-22T11:55:16.271Z",
	// 			proofObjectId: "uuid:1234567890",
	// 			proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
	// 		}
	// 	]);
	// });

	// test("Can get a proof that has not been issued", async () => {
	// 	const service = new ImmutableProofService();
	// 	await service.start();

	// 	const proofId = await service.create({
	// 		"@context": "https://schema.org",
	// 		type: "Person",
	// 		id: "uuid:1234567890",
	// 		name: "John Smith"
	// 	});
	// 	expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

	// 	const proofStore = proofStorage.getStore();
	// 	expect(proofStore).toEqual([
	// 		{
	// 			id: "01010101010101010101010101010101",
	// 			proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
	// 			dateCreated: "2024-08-22T11:55:16.271Z",
	// 			proofObjectId: "uuid:1234567890"
	// 		}
	// 	]);

	// 	const proof = await service.get(proofId);
	// 	expect(proof).toEqual({
	// 		"@context": [
	// 			"https://schema.twindev.org/immutable-proof/",
	// 			"https://schema.twindev.org/common/",
	// 			"https://www.w3.org/2018/credentials/v1"
	// 		],
	// 		type: ["VerifiableCredential", "ImmutableProof"],
	// 		id: "immutable-proof:01010101010101010101010101010101",
	// 		credentialSubject: {
	// 			id: "uuid:1234567890",
	// 			proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
	// 		}
	// 	});
	// });

	// test("Can fail to get a proof when there is no identity connector", async () => {
	// 	await backgroundTaskService.start();

	// 	const service = new ImmutableProofService();
	// 	await service.start();

	// 	const proofId = await service.create({
	// 		"@context": "https://schema.org",
	// 		type: "Person",
	// 		id: "uuid:1234567890",
	// 		name: "John Smith"
	// 	});
	// 	expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

	// 	await waitForProofGeneration(1, false);

	// 	const failLogEntry = memoryLoggingEntityStorage
	// 		.getStore()
	// 		.find(entry => entry.message === "createProofFailed");
	// 	expect(failLogEntry).toBeDefined();

	// 	expect(failLogEntry?.error?.[0].message).toEqual("factory.noGet");
	// 	expect(failLogEntry?.error?.[0].properties).toEqual({
	// 		typeName: "identity-connector",
	// 		name: "identity"
	// 	});
	// });

	test("Can get a proof that has been issued", async () => {
		// Mock the module helper to execute the method in the same thread, so we don't have to create an engine
		ModuleHelper.execModuleMethodThreadMessage = vi
			.fn()
			.mockImplementation((module, completed) => ({
				executeMethod: async (method: string, args?: unknown, contextIds?: IContextIds) => {
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

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				organizationId:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				verifiableStorageId:
					"verifiable:entity-storage:5858585858585858585858585858585858585858585858585858585858585858",
				dateCreated: "2024-08-22T11:55:16.271Z",
				vcContext: "https://www.w3.org/2018/credentials/v1"
			}
		]);

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				allowList: [TEST_ORGANIZATION_IDENTITY],
				creator: TEST_ORGANIZATION_IDENTITY,
				data: expect.any(String),
				id: "5858585858585858585858585858585858585858585858585858585858585858",
				maxAllowListSize: 100
			}
		]);

		expect(ObjectHelper.fromBytes(Converter.base64ToBytes(verifiableStore[0].data))).toEqual({
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
				"https://w3id.org/security/data-integrity/v2",
				"https://schema.twindev.org/verifiable-storage/"
			],
			id: "immutable-proof:01010101010101010101010101010101",
			issuanceDate: "2024-08-22T11:55:16.271Z",
			issuer:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
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
				immutableReceipt: {
					type: "VerifiableStorageEntityStorageReceipt",
					entityStorageId: "5858585858585858585858585858585858585858585858585858585858585858"
				},
				verifiableStorageId:
					"verifiable:entity-storage:5858585858585858585858585858585858585858585858585858585858585858"
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
			issuer:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			issuanceDate: "2024-08-22T11:55:16.271Z",
			type: ["VerifiableCredential", "ImmutableProof"],
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				dateCreated: "2024-08-22T11:55:16.271Z",
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				organizationId:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363"
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
			id: "uuid:1234567890",
			name: "John Smith"
		};

		const proofId = await service.create(proofObject);
		expect(proofId).toEqual("immutable-proof:01010101010101010101010101010101");

		await waitForProofGeneration();

		const proof = await service.get(proofId);
		expect(proof).toEqual({
			"@context": [
				"https://www.w3.org/2018/credentials/v1",
				"https://schema.twindev.org/immutable-proof/",
				"https://schema.twindev.org/common/",
				"https://w3id.org/security/data-integrity/v2",
				"https://schema.twindev.org/verifiable-storage/"
			],
			id: "immutable-proof:01010101010101010101010101010101",
			type: ["VerifiableCredential", "ImmutableProof"],
			issuanceDate: "2024-08-22T11:55:16.271Z",
			issuer:
				"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
			proof: {
				type: "DataIntegrityProof",
				created: "2024-08-22T11:55:16.271Z",
				cryptosuite: "eddsa-jcs-2022",
				proofPurpose: "assertionMethod",
				proofValue: expect.any(String),
				verificationMethod: expect.any(String),
				immutableReceipt: {
					type: "VerifiableStorageEntityStorageReceipt",
					entityStorageId: "5858585858585858585858585858585858585858585858585858585858585858"
				},
				verifiableStorageId:
					"verifiable:entity-storage:5858585858585858585858585858585858585858585858585858585858585858"
			},
			credentialSubject: {
				id: "uuid:1234567890",
				proofIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ="
			}
		});

		const proofStore = proofStorage.getStore();
		expect(proofStore).toEqual([
			{
				id: "01010101010101010101010101010101",
				proofObjectId: "uuid:1234567890",
				proofObjectIntegrity: "sha256-cou0p7fk7LU5tcc/Hy6qIws8YKV9GAFI13ZNFMwmlEQ=",
				verifiableStorageId:
					"verifiable:entity-storage:5858585858585858585858585858585858585858585858585858585858585858",
				dateCreated: "2024-08-22T11:55:16.271Z",
				organizationId:
					"did:entity-storage:0x6363636363636363636363636363636363636363636363636363636363636363",
				vcContext: "https://www.w3.org/2018/credentials/v1"
			}
		]);

		const verifiableStore = verifiableStorage.getStore();
		expect(verifiableStore).toEqual([
			{
				allowList: [TEST_ORGANIZATION_IDENTITY],
				creator: TEST_ORGANIZATION_IDENTITY,
				data: expect.any(String),
				id: "5858585858585858585858585858585858585858585858585858585858585858",
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
