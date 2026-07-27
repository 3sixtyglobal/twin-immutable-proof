// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Configuration for the immutable proof service.
 */
export interface IImmutableProofServiceConfig {
	/**
	 * The verification method id to use for the proof.
	 * @default immutable-proof-assertion
	 */
	verificationMethodId?: string;

	/**
	 * The number of times to retry a proof task when it fails before the
	 * notarization phase. Notarization phase failures are never retried
	 * automatically as the notarization may already have reached the ledger.
	 * Set to 0 to disable automatic retries, the minimum value is 0.
	 * @default 5
	 */
	taskRetryCount?: number;

	/**
	 * The interval in milliseconds to wait between proof task retries,
	 * the minimum value is 1.
	 * @default 5000
	 */
	taskRetryInterval?: number;

	/**
	 * The time in milliseconds to retain the record of a failed proof task so
	 * the failure can be inspected. Successful task records are removed as soon
	 * as their result has been processed. Set to -1 to retain failures forever,
	 * the minimum value is -1.
	 * @default 604800000 (7 days)
	 */
	taskFailureRetainFor?: number;
}
