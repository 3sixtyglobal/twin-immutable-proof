// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IImmutableProof } from "@twin.org/immutable-proof-models";

/**
 * The payload for the immutable proof task.
 */
export interface IImmutableProofTaskPayload {
	/**
	 * The proof id.
	 */
	proofId: string;

	/**
	 * The identity to create the proof for.
	 */
	identity: string;

	/**
	 * The identity connector type.
	 */
	identityConnectorType: string;

	/**
	 * The assertion method id.
	 */
	verificationMethodId: string;

	/**
	 * The subject to create the proof for.
	 */
	credentialSubject: IImmutableProof;

	/**
	 * The notarization connector type.
	 */
	notarizationConnectorType: string;

	/**
	 * An ISO 8601 date-time string specifying when the notarization lock expires.
	 * If omitted, no deletion lock is applied.
	 */
	deleteLockDateTime?: string;
}
