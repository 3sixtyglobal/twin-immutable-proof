// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The span attribute keys for the immutable proof domain.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofSpanAttributes = {
	/**
	 * The id of the immutable proof the operation is for.
	 */
	Id: "immutable-proof.id"
} as const;

/**
 * Union type of all immutable proof span attribute key string values.
 */
export type ImmutableProofSpanAttributes =
	(typeof ImmutableProofSpanAttributes)[keyof typeof ImmutableProofSpanAttributes];
