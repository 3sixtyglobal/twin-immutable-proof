// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential, IProof } from "@3sixty/standards-w3c-did";
import type { IImmutableProofDataIntegrity } from "./IImmutableProofDataIntegrity.js";

/**
 * Interface describing an immutable proof credential.
 */
export interface IImmutableProofCredential extends Omit<IDidVerifiableCredential, "proof"> {
	/**
	 * The proof of the verifiable credential, which includes the data integrity information.
	 */
	proof?: IProof & IImmutableProofDataIntegrity;
}
