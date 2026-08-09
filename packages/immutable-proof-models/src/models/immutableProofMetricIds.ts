// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * Metric IDs for the immutable proof service.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofMetricIds = {
	/**
	 * Number of proofs created.
	 */
	ProofsCreated: "ip_proofs_created",

	/**
	 * Number of proof verifications succeeded.
	 */
	VerificationsSucceeded: "ip_verifications_succeeded",

	/**
	 * Number of proof verifications failed.
	 */
	VerificationsFailed: "ip_verifications_failed",

	/**
	 * Number of proofs removed.
	 */
	ProofsRemoved: "ip_proofs_removed",

	/**
	 * Number of notarizations removed.
	 */
	NotarizationsRemoved: "ip_notarizations_removed"
} as const;

/**
 * Union type of all immutable proof service metric ID string values.
 */
export type ImmutableProofMetricIds =
	(typeof ImmutableProofMetricIds)[keyof typeof ImmutableProofMetricIds];
