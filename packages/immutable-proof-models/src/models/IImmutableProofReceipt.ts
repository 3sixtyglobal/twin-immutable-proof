// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { ImmutableProofContexts } from "./immutableProofContexts.js";
import type { ImmutableProofTypes } from "./immutableProofTypes.js";

/**
 * Interface describing an immutable proof receipt.
 */
export interface IImmutableProofReceipt {
	/**
	 * JSON-LD Context.
	 */
	"@context"?: [typeof ImmutableProofContexts.Context, typeof ImmutableProofContexts.ContextCommon];

	/**
	 * JSON-LD Type.
	 */
	type: typeof ImmutableProofTypes.ImmutableProofReceipt;

	/**
	 * The immutable receipt detail for where the proof is stored.
	 * @json-ld id
	 */
	immutableReceipt?: IJsonLdNodeObject;

	/**
	 * The verifiable storage id for where the proof is stored.
	 * @json-ld id
	 */
	verifiableStorageId?: string;
}
