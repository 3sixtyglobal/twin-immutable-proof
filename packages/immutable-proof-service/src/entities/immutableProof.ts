// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { entity, property, SortDirection } from "@twin.org/entity";

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
	 * The associated hash for the item.
	 */
	@property({ type: "string" })
	public proofObjectHash!: string;

	/**
	 * The verifiable storage id.
	 */
	@property({ type: "string", optional: true })
	public verifiableStorageId?: string;
}
