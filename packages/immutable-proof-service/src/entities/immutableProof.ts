// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property, SortDirection } from "@3sixty/entity";
import type { DidContexts } from "@3sixty/standards-w3c-did";

/**
 * Class describing the immutable proof.
 */
@entity({ version: 1 })
export class ImmutableProof {
	/**
	 * The id of the proof.
	 */
	@property({ type: "string", isPrimary: true, maxLength: 255 })
	public id!: string;

	/**
	 * The organization id.
	 */
	@property({ type: "string", maxLength: 255 })
	public organizationId!: string;

	/**
	 * The date/time of when the proof was created.
	 */
	@property({ type: "string", format: "date-time", sortDirection: SortDirection.Descending })
	public dateCreated!: string;

	/**
	 * The associated id for the item.
	 */
	@property({ type: "string", maxLength: 255, optional: true })
	public proofObjectId?: string;

	/**
	 * The associated integrity for the item.
	 */
	@property({ type: "string", maxLength: 255 })
	public proofObjectIntegrity!: string;

	/**
	 * The notarization id.
	 */
	@property({ type: "string", maxLength: 255, optional: true })
	public notarizationId?: string;

	/**
	 * The verifiable credential context.
	 */
	@property({ type: "string", optional: true })
	public vcContext?: typeof DidContexts.ContextVCv1 | typeof DidContexts.ContextVCv2;

	/**
	 * The id of the most recently enqueued background task for this proof.
	 */
	@property({ type: "string", maxLength: 255, optional: true })
	public taskId?: string;

	/**
	 * The date/time the notarization lock expires, persisted so a reconciliation sweep can
	 * rebuild the original task payload without losing the caller's requested delete lock.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public deleteLock?: string;

	/**
	 * The number of reconciliation sweep attempts made for this proof.
	 */
	@property({ type: "number", optional: true })
	public sweepAttempts?: number;

	/**
	 * The date/time of the most recent reconciliation sweep attempt.
	 */
	@property({ type: "string", format: "date-time", optional: true })
	public lastSweepAttempt?: string;

	/**
	 * Set to true when the reconciliation sweep has exhausted its attempts; absent otherwise.
	 */
	@property({ type: "boolean", optional: true })
	public isParked?: boolean;
}
