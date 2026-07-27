// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { GuardError } from "@twin.org/core";
import type {
	IImmutableProofCredential,
	IImmutableProofVerification
} from "@twin.org/immutable-proof-models";
import {
	ImmutableProofContexts,
	ImmutableProofFailure,
	ImmutableProofTypes
} from "@twin.org/immutable-proof-models";
import { DidContexts, ProofTypes } from "@twin.org/standards-w3c-did";
import { HttpMethod } from "@twin.org/web";
import { ImmutableProofRestClient } from "../src/immutableProofRestClient.js";
import {
	createdResponse,
	jsonResponse,
	noContentResponse,
	setupFetchMock,
	teardownFetchMock
} from "./helpers/restClientTestHelpers.js";

// OpenAPI spec: ../../immutable-proof-service/docs/open-api/spec.json
const ENDPOINT = "http://localhost:8080";
const PREFIX = "immutable-proof";

const PROOF_ID = "immutable-proof:default:abc123";

const LOCATION = `${ENDPOINT}/${PREFIX}/${PROOF_ID}`;

const TEST_DOCUMENT = {
	"@type": "https://schema.org/Thing",
	name: "Test document"
};

const TEST_CREDENTIAL: IImmutableProofCredential = {
	"@context": DidContexts.ContextVCv2,
	type: "VerifiableCredential",
	issuer: "did:iota:example:issuer",
	credentialSubject: { id: PROOF_ID },
	proof: {
		type: ProofTypes.DataIntegrityProof,
		cryptosuite: "eddsa-jcs-2022",
		proofPurpose: "assertionMethod",
		proofValue: "z3MvGcVxzr1",
		verificationMethod: "did:iota:example:issuer#key-1",
		notarizationId: "notarization:default:xyz789"
	}
};

const TEST_VERIFICATION: IImmutableProofVerification = {
	"@context": ImmutableProofContexts.Context,
	type: ImmutableProofTypes.ImmutableProofVerification,
	verified: true
};

const TEST_VERIFICATION_FAILED: IImmutableProofVerification = {
	"@context": ImmutableProofContexts.Context,
	type: ImmutableProofTypes.ImmutableProofVerification,
	verified: false,
	failure: ImmutableProofFailure.VerificationFailure
};

const fetchMock = vi.fn();

describe("ImmutableProofRestClient", () => {
	let client: ImmutableProofRestClient;

	beforeEach(() => {
		setupFetchMock(fetchMock);
		client = new ImmutableProofRestClient({ endpoint: ENDPOINT });
	});

	afterEach(() => {
		teardownFetchMock(fetchMock);
	});

	describe("create", () => {
		test("throws when document is undefined", async () => {
			await expect(client.create(undefined as never)).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.objectUndefined"
			});
		});

		test("sends POST to /{prefix}", async () => {
			fetchMock.mockResolvedValueOnce(createdResponse(LOCATION));

			await client.create(TEST_DOCUMENT);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}`);
			expect(options.method).toBe(HttpMethod.POST);
		});

		test("sends the document in the request body", async () => {
			fetchMock.mockResolvedValueOnce(createdResponse(LOCATION));

			await client.create(TEST_DOCUMENT);

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.document).toEqual(TEST_DOCUMENT);
		});

		test("sends options in the request body when provided", async () => {
			fetchMock.mockResolvedValueOnce(createdResponse(LOCATION));

			await client.create(TEST_DOCUMENT, { deleteLock: "2025-01-01T00:00:00Z" });

			const [, options] = fetchMock.mock.calls[0];
			const body = JSON.parse(options.body);
			expect(body.options.deleteLock).toBe("2025-01-01T00:00:00Z");
		});

		test("returns the Location header value as the new proof id", async () => {
			fetchMock.mockResolvedValueOnce(createdResponse(LOCATION));

			const id = await client.create(TEST_DOCUMENT);

			expect(id).toBe(PROOF_ID);
		});
	});

	describe("get", () => {
		test("throws when id is empty", async () => {
			await expect(client.get("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends GET to /{prefix}/:id", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_CREDENTIAL));

			await client.get(PROOF_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${PROOF_ID}`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns the credential from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_CREDENTIAL));

			const result = await client.get(PROOF_ID);

			expect(result).toEqual(TEST_CREDENTIAL);
		});
	});

	describe("verify", () => {
		test("throws when id is empty", async () => {
			await expect(client.verify("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends GET to /{prefix}/:id/verify", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION));

			await client.verify(PROOF_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${PROOF_ID}/verify`);
			expect(options.method).toBe(HttpMethod.GET);
		});

		test("returns the verification result from the response body", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION));

			const result = await client.verify(PROOF_ID);

			expect(result).toEqual(TEST_VERIFICATION);
		});

		test("returns a failed verification result with failure reason", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse(TEST_VERIFICATION_FAILED));

			const result = await client.verify(PROOF_ID);

			expect(result.verified).toBe(false);
			expect(result.failure).toBe(ImmutableProofFailure.VerificationFailure);
		});
	});

	describe("remove", () => {
		test("throws when id is empty", async () => {
			await expect(client.remove("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:id", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.remove(PROOF_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${PROOF_ID}`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await expect(client.remove(PROOF_ID)).resolves.toBeUndefined();
		});
	});

	describe("removeNotarization", () => {
		test("throws when id is empty", async () => {
			await expect(client.removeNotarization("")).rejects.toMatchObject({
				name: GuardError.CLASS_NAME,
				message: "guard.stringEmpty"
			});
		});

		test("sends DELETE to /{prefix}/:id/notarization", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await client.removeNotarization(PROOF_ID);

			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe(`${ENDPOINT}/${PREFIX}/${PROOF_ID}/notarization`);
			expect(options.method).toBe(HttpMethod.DELETE);
		});

		test("resolves without a return value", async () => {
			fetchMock.mockResolvedValueOnce(noContentResponse());

			await expect(client.removeNotarization(PROOF_ID)).resolves.toBeUndefined();
		});
	});
});
