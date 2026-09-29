// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DataTypeHelper } from "@twin.org/data-core";
import { JsonLdDataTypes } from "@twin.org/data-json-ld";
import { DidDataTypes } from "@twin.org/standards-w3c-did";
import * as CompiledValidators from "../compiled/validators.js";
import { ImmutableProofContexts } from "../models/immutableProofContexts.js";
import { ImmutableProofTypes } from "../models/immutableProofTypes.js";
import ImmutableProofSchema from "../schemas/ImmutableProof.json" with { type: "json" };
import ImmutableProofCredentialSchema from "../schemas/ImmutableProofCredential.json" with { type: "json" };
import ImmutableProofDataIntegritySchema from "../schemas/ImmutableProofDataIntegrity.json" with { type: "json" };
import ImmutableProofFailureSchema from "../schemas/ImmutableProofFailure.json" with { type: "json" };
import ImmutableProofVerificationSchema from "../schemas/ImmutableProofVerification.json" with { type: "json" };

/**
 * Handle all the data types for immutable proof.
 */
export class ImmutableProofDataTypes {
	/**
	 * Register all the data types.
	 */
	public static registerTypes(): void {
		// Register the types referenced by the schemas, which are only registered once.
		JsonLdDataTypes.registerTypes();
		DidDataTypes.registerTypes();

		const types = [
			{
				type: ImmutableProofTypes.ImmutableProof,
				schema: ImmutableProofSchema,
				compiledValidator: CompiledValidators.CompiledImmutableProof
			},
			{
				type: ImmutableProofTypes.ImmutableProofVerification,
				schema: ImmutableProofVerificationSchema,
				compiledValidator: CompiledValidators.CompiledImmutableProofVerification
			},
			{
				type: ImmutableProofTypes.ImmutableProofFailure,
				schema: ImmutableProofFailureSchema,
				compiledValidator: CompiledValidators.CompiledImmutableProofFailure
			},
			{
				type: "ImmutableProofCredential",
				schema: ImmutableProofCredentialSchema,
				compiledValidator: CompiledValidators.CompiledImmutableProofCredential
			},
			{
				type: "ImmutableProofDataIntegrity",
				schema: ImmutableProofDataIntegritySchema,
				compiledValidator: CompiledValidators.CompiledImmutableProofDataIntegrity
			}
		];

		DataTypeHelper.registerTypes(
			ImmutableProofContexts.Namespace,
			ImmutableProofContexts.JsonLdContext,
			types
		);
	}
}
