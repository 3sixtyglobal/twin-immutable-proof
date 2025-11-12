// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { DataTypeHandlerFactory, type IJsonSchema } from "@twin.org/data-core";
import { ImmutableProofContexts } from "../models/immutableProofContexts.js";
import { ImmutableProofTypes } from "../models/immutableProofTypes.js";
import ImmutableProofSchema from "../schemas/ImmutableProof.json" with { type: "json" };

/**
 * Handle all the data types for immutable proof.
 */
export class ImmutableProofDataTypes {
	/**
	 * Register all the data types.
	 */
	public static registerTypes(): void {
		DataTypeHandlerFactory.register(
			`${ImmutableProofContexts.ContextRoot}${ImmutableProofTypes.ImmutableProof}`,
			() => ({
				context: ImmutableProofContexts.ContextRoot,
				type: ImmutableProofTypes.ImmutableProof,
				defaultValue: {},
				jsonSchema: async () => ImmutableProofSchema as IJsonSchema
			})
		);
	}
}
