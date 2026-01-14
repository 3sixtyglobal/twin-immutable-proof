// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IValidationFailure } from "@twin.org/core";
import { DataTypeHelper } from "@twin.org/data-core";
import { JsonLdDataTypes } from "@twin.org/data-json-ld";
import { DidContexts, DidCryptoSuites, ProofTypes } from "@twin.org/standards-w3c-did";
import { ImmutableProofDataTypes } from "../../src/dataTypes/immutableProofDataTypes.js";
import { ImmutableProofContexts } from "../../src/models/immutableProofContexts.js";
import { ImmutableProofTypes } from "../../src/models/immutableProofTypes.js";

describe("ImmutableDataTypes", () => {
	beforeAll(async () => {
		JsonLdDataTypes.registerTypes();
		ImmutableProofDataTypes.registerTypes();
	});

	test("Can fail to validate an empty proof", async () => {
		const validationFailures: IValidationFailure[] = [];
		const isValid = await DataTypeHelper.validate(
			"",
			`${ImmutableProofContexts.Namespace}${ImmutableProofTypes.ImmutableProof}`,
			{
				id: "foo",
				dateCreated: new Date().toISOString()
			},
			validationFailures
		);
		expect(validationFailures.length).toEqual(1);
		expect(isValid).toEqual(false);
	});

	test("Can validate a pending proof", async () => {
		const validationFailures: IValidationFailure[] = [];
		const isValid = await DataTypeHelper.validate(
			"",
			`${ImmutableProofContexts.Namespace}${ImmutableProofTypes.ImmutableProof}`,
			{
				"@context": [ImmutableProofContexts.Namespace, ImmutableProofContexts.NamespaceCommon],
				type: ImmutableProofTypes.ImmutableProof,
				id: "proof:123456",
				proofObjectId: "test:23456",
				proofObjectHash: "aaabbbcccddd"
			},
			validationFailures
		);
		expect(validationFailures.length).toEqual(0);
		expect(isValid).toEqual(true);
	});

	test("Can validate a verified proof", async () => {
		const validationFailures: IValidationFailure[] = [];
		const isValid = await DataTypeHelper.validate(
			"",
			ImmutableProofTypes.ImmutableProof,
			{
				"@context": [ImmutableProofContexts.Namespace, ImmutableProofContexts.NamespaceCommon],
				type: ImmutableProofTypes.ImmutableProof,
				id: "proof:123456",
				proofObjectId: "test:23456",
				proofObjectHash: "aaabbbcccddd",
				proof: {
					"@context": [DidContexts.NamespaceDataIntegrity],
					type: ProofTypes.DataIntegrityProof,
					cryptosuite: DidCryptoSuites.EdDSAJcs2022,
					proofPurpose: "assertionMethod",
					proofValue: "7DdiPPYtxLjCD3wA1po2rvZHTDYjkZYiEtazrfiwJcwnKCizhGFhBGHeRdx"
				}
			},
			validationFailures
		);
		expect(validationFailures.length).toEqual(0);
		expect(isValid).toEqual(true);
	});
});
