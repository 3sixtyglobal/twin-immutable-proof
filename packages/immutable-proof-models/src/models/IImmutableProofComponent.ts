// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type { IImmutableProof } from "./IImmutableProof.js";
import type { IImmutableProofVerification } from "./IImmutableProofVerification.js";

/**
 * Interface describing an immutable proof contract.
 */
export interface IImmutableProofComponent extends IComponent {
	/**
	 * Create a new proof.
	 * @param document The document to create the proof for.
	 * @returns The id of the new proof.
	 */
	create(document: IJsonLdNodeObject): Promise<string>;

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	get(id: string): Promise<IImmutableProof>;

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	verify(id: string): Promise<IImmutableProofVerification>;

	/**
	 * Remove the verifiable storage for the proof.
	 * @param id The id of the proof to remove the storage from.
	 * @returns Nothing.
	 * @throws NotFoundError if the proof is not found.
	 */
	removeVerifiable(id: string): Promise<void>;
}
