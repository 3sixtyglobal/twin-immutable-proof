// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IComponent } from "@3sixty/core";
import type { IJsonLdNodeObject } from "@3sixty/data-json-ld";
import type { IImmutableProofCredential } from "./IImmutableProofCredential.js";
import type { IImmutableProofVerification } from "./IImmutableProofVerification.js";

/**
 * Interface describing an immutable proof contract.
 */
export interface IImmutableProofComponent extends IComponent {
	/**
	 * Create a new proof.
	 * @param document The document to create the proof for.
	 * @param options Optional settings for the proof.
	 * @param options.deleteLock An ISO 8601 date-time string specifying when the notarization lock expires; if omitted no lock is applied.
	 * @returns The id of the new proof.
	 */
	create(document: IJsonLdNodeObject, options?: { deleteLock?: string }): Promise<string>;

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	get(id: string): Promise<IImmutableProofCredential>;

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	verify(id: string): Promise<IImmutableProofVerification>;

	/**
	 * Remove the proof and its notarization.
	 * @param id The id of the proof to remove.
	 * @returns A promise that resolves when the proof and its notarization have been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	remove(id: string): Promise<void>;

	/**
	 * Remove only the notarization for the proof, keeping the proof entity.
	 * @param id The id of the proof to remove the notarization from.
	 * @returns A promise that resolves when the notarization has been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	removeNotarization(id: string): Promise<void>;
}
