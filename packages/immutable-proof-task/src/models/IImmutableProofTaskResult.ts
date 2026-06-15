// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@twin.org/standards-w3c-did";

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
	 */
	notarizationId: string;
}
