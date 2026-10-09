// Copyright 2026 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property, SortDirection } from "@3sixty/entity";
import type { DidContexts } from "@3sixty/standards-w3c-did";

/**
 * Class describing the immutable proof, version 0. Covers every row written before the
 * version record existed, including rows that predate organizationId and carry
 * proofObjectHash instead of proofObjectIntegrity.
 */
@entity({ version: 0 })
export class ImmutableProofV0 {
	/**
	 * The id of the proof.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The organization id.
	 */
	@property({ type: "string", optional: true })
	public organizationId?: string;

	/**
	 * The date/time of when the proof was created.
	 */
	@property({ type: "string", format: "date-time", sortDirection: SortDirection.Descending })
	public dateCreated!: string;

	/**
	 * The associated id for the item.
	 */
	@property({ type: "string", optional: true })
	public proofObjectId?: string;

	/**
	 * The associated integrity for the item.
	 */
	@property({ type: "string", optional: true })
	public proofObjectIntegrity?: string;

	/**
	 * The digest as stored before proofObjectIntegrity existed, "sha256:" followed by base64.
	 */
	@property({ type: "string", optional: true })
	public proofObjectHash?: string;

	/**
	 * The verifiable storage id, as stored before this property was dropped from the entity.
	 */
	@property({ type: "string", optional: true })
	public verifiableStorageId?: string;

	/**
	 * The node identity, as stored before this property was dropped from the entity.
	 */
	@property({ type: "string", optional: true })
	public nodeIdentity?: string;

	/**
	 * The user identity, as stored before this property was dropped from the entity.
	 */
	@property({ type: "string", optional: true })
	public userIdentity?: string;

	/**
	 * The notarization id.
	 */
	@property({ type: "string", optional: true })
	public notarizationId?: string;

	/**
	 * The verifiable credential context.
	 */
	@property({ type: "string", optional: true })
	public vcContext?: typeof DidContexts.ContextVCv1 | typeof DidContexts.ContextVCv2;
}
