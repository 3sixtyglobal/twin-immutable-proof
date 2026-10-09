// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IError } from "@3sixty/core";
import type { IDidVerifiableCredential } from "@3sixty/standards-w3c-did";

/**
 * The result for the immutable proof task.
 */
export interface IImmutableProofTaskResult {
	/**
	 * The proof id.
	 */
	proofId: string;

	/**
	 * The verifiable credential produced by the proof task.
	 */
	verifiableCredential: IDidVerifiableCredential;

	/**
	 * The notarization id returned after storing the proof.
	 * Not set when the notarization phase failed, see notarizationError.
	 */
	notarizationId?: string;

	/**
	 * Set when the notarization phase failed. The failure is returned in the result
	 * instead of being thrown, because the notarization may have reached the ledger
	 * even though the call failed, and a retry could create a duplicate on-chain object.
	 */
	notarizationError?: IError;
}
