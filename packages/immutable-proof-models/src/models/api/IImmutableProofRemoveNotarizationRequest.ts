// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Remove the notarization for a proof.
 */
export interface IImmutableProofRemoveNotarizationRequest {
	/**
	 * The parameters from the path.
	 */
	pathParams: {
		/**
		 * The id of the immutable proof to remove the notarization from.
		 */
		id: string;
	};
}
