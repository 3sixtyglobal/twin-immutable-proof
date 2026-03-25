// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DataTypeHelper } from "@twin.org/data-core";
import { ImmutableProofContexts } from "../models/immutableProofContexts.js";
import { ImmutableProofTypes } from "../models/immutableProofTypes.js";
import ImmutableProofSchema from "../schemas/ImmutableProof.json" with { type: "json" };
import ImmutableProofFailureSchema from "../schemas/ImmutableProofFailure.json" with { type: "json" };
import ImmutableProofReceiptSchema from "../schemas/ImmutableProofReceipt.json" with { type: "json" };
import ImmutableProofVerificationSchema from "../schemas/ImmutableProofVerification.json" with { type: "json" };

/**
 * Handle all the data types for immutable proof.
 */
export class ImmutableProofDataTypes {
	/**
	 * Register all the data types.
	 */
	public static registerTypes(): void {
		const types = [
			{
				type: ImmutableProofTypes.ImmutableProof,
				schema: ImmutableProofSchema
			},
			{
				type: ImmutableProofTypes.ImmutableProofReceipt,
				schema: ImmutableProofReceiptSchema
			},
			{
				type: ImmutableProofTypes.ImmutableProofVerification,
				schema: ImmutableProofVerificationSchema
			},
			{
				type: ImmutableProofTypes.ImmutableProofFailure,
				schema: ImmutableProofFailureSchema
			}
		];

		DataTypeHelper.registerTypes(
			ImmutableProofContexts.Namespace,
			ImmutableProofContexts.JsonLdContext,
			types.map(t => ({ type: t.type, schema: t.schema }))
		);
	}
}
