// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The span names for the immutable proof domain.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofSpanNames = {
	/**
	 * Create an immutable proof.
	 */
	Create: "immutable-proof/create",

	/**
	 * Get an immutable proof.
	 */
	Get: "immutable-proof/get",

	/**
	 * Verify an immutable proof.
	 */
	Verify: "immutable-proof/verify",

	/**
	 * Remove an immutable proof.
	 */
	Remove: "immutable-proof/remove"
} as const;

/**
 * Union type of all immutable proof span name string values.
 */
export type ImmutableProofSpanNames =
	(typeof ImmutableProofSpanNames)[keyof typeof ImmutableProofSpanNames];
