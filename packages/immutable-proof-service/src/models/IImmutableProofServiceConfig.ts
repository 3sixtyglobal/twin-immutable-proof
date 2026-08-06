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

	/**
	 * How often, in minutes, the reconciliation sweep runs. The sweep re-enqueues proofs
	 * whose task exhausted its retries or was never created, so they self-heal without
	 * operator action, running on a schedule via the task scheduler component and fanning
	 * out across every tenant via the platform component. Minute granularity is a
	 * constraint of the task scheduler component, the minimum value is 1.
	 * @default 30
	 */
	sweepIntervalMinutes?: number;

	/**
	 * The minimum age in milliseconds, based on dateCreated, before a proof with no
	 * notarizationId is considered stuck and eligible for the sweep. Must stay comfortably
	 * above the real in-flight window (task retries plus their attempt duration) so the
	 * sweep never races a proof still being processed, the minimum value is 60000.
	 * @default 10800000 (3 hours)
	 */
	sweepStaleThresholdMs?: number;

	/**
	 * The number of sweep attempts made for a proof before it is parked and stops
	 * retrying automatically, the minimum value is 1.
	 * @default 5
	 */
	sweepMaxAttempts?: number;

	/**
	 * The maximum number of proofs the sweep re-enqueues per tenant per cycle, oldest
	 * first, so a large backlog drains without starving proofs created after it, the
	 * minimum value is 1.
	 * @default 10
	 */
	sweepBatchLimit?: number;

	/**
	 * The minimum time in milliseconds between sweep attempts for the same proof, applied
	 * only after its previously enqueued task has reached a terminal state. Doubles with
	 * each attempt up to a cap of 24 hours, the minimum value is 1.
	 * @default 3600000 (1 hour)
	 */
	sweepBackoffMs?: number;

	/**
	 * An ISO 8601 date-time; proofs created before this date with no interpretable task
	 * record are treated as pre-submission failures and re-enqueued instead of parked.
	 * Intended as an explicit, auditable, time-bounded authorisation for draining a known
	 * backlog whose era guarantees every failure happened before ledger submission, not a
	 * general classification mechanism. Leave unset to always park in the absence of a
	 * usable task record.
	 */
	sweepAssumeRetryableBefore?: string;
}
