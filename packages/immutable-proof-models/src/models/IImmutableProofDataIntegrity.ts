// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Interface describing additional data integrity fields attached to an immutable proof.
 */
export interface IImmutableProofDataIntegrity {
	/**
	 * The notarization id.
	 * @json-ld id
	 */
	notarizationId?: string;
}
