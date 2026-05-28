// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The types of immutable proof data.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofTypes = {
	/**
	 * Represents Immutable Proof.
	 */
	ImmutableProof: "ImmutableProof",

	/**
	 * Represents Immutable Proof Verification.
	 */
	ImmutableProofVerification: "ImmutableProofVerification",

	/**
	 * Represents Immutable Proof Failure.
	 */
	ImmutableProofFailure: "ImmutableProofFailure"
} as const;

/**
 * The types of immutable proof data.
 */
export type ImmutableProofTypes = (typeof ImmutableProofTypes)[keyof typeof ImmutableProofTypes];
