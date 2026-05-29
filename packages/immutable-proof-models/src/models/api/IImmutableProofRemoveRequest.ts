// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Remove a proof.
 */
export interface IImmutableProofRemoveRequest {
	/**
	 * The parameters from the path.
	 */
	pathParams: {
		/**
		 * The id of the immutable proof to remove.
		 */
		id: string;
	};
}
