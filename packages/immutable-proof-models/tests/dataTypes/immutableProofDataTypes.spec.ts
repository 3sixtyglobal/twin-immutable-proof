// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IValidationFailure } from "@3sixty/core";
import { DataTypeHelper } from "@3sixty/data-core";
import { JsonLdDataTypes } from "@3sixty/data-json-ld";
import { DidDataTypes } from "@3sixty/standards-w3c-did";
import { ImmutableProofDataTypes } from "../../src/dataTypes/immutableProofDataTypes.js";
import { ImmutableProofContexts } from "../../src/models/immutableProofContexts.js";
import { ImmutableProofTypes } from "../../src/models/immutableProofTypes.js";

describe("ImmutableDataTypes", () => {
	beforeAll(async () => {
		JsonLdDataTypes.registerTypes();
		DidDataTypes.registerTypes();
		ImmutableProofDataTypes.registerTypes();
	});

	test("Can fail to validate an empty proof", async () => {
		const validationFailures: IValidationFailure[] = [];
		const isValid = await DataTypeHelper.validate(
			"",
			`${ImmutableProofContexts.Namespace}${ImmutableProofTypes.ImmutableProof}`,
			{},
			validationFailures
		);
		expect(validationFailures.length).toEqual(1);
		expect(isValid).toEqual(false);
	});

	test("Can validate a proof", async () => {
		const validationFailures: IValidationFailure[] = [];
		const isValid = await DataTypeHelper.validate(
			"",
			`${ImmutableProofContexts.Namespace}${ImmutableProofTypes.ImmutableProof}`,
			{
				id: "test:23456",
				proofIntegrity: "aaabbbcccddd"
			},
			validationFailures
		);
		expect(validationFailures.length).toEqual(0);
		expect(isValid).toEqual(true);
	});
});
