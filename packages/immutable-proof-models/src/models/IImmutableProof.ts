// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { ImmutableProofContexts } from "./immutableProofContexts.js";
import type { ImmutableProofTypes } from "./immutableProofTypes.js";

/**
 * Interface describing an immutable proof state.
 */
export interface IImmutableProof {
	/**
	 * JSON-LD Context.
	 */
	"@context"?: [typeof ImmutableProofContexts.Context, typeof ImmutableProofContexts.ContextCommon];

	/**
	 * JSON-LD Type.
	 */
	type?: typeof ImmutableProofTypes.ImmutableProof;

	/**
	 * The id of the object associated with the proof.
	 */
	id?: string;

	/**
	 * The integrity hash of the object associated with the proof.
	 * @json-ld namespace:twin-common
	 */
	proofIntegrity: string;
}
