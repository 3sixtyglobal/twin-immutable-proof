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
	 * The proof, we only generate a single proof, so restrict to a single proof.
	 */
	verifiableCredential: IDidVerifiableCredential;
}
