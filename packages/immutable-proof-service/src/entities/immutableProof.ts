// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property, SortDirection } from "@twin.org/entity";
import type { DidContexts } from "@twin.org/standards-w3c-did";

/**
 * Class describing the immutable proof.
 */
@entity()
export class ImmutableProof {
	/**
	 * The id of the proof.
	 */
	@property({ type: "string", isPrimary: true })
	public id!: string;

	/**
	 * The organization id.
	 */
	@property({ type: "string" })
	public organizationId!: string;

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
	@property({ type: "string" })
	public proofObjectIntegrity!: string;

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
