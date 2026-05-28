// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";

/**
 * Create a proof.
 */
export interface IImmutableProofCreateRequest {
	/**
	 * The parameters from the body.
	 */
	body: {
		/**
		 * The document to create the proof for.
		 */
		document: IJsonLdNodeObject;

		/**
		 * Optional settings for the proof.
		 */
		options?: {
			/**
			 * An ISO 8601 date-time string specifying when the notarization lock expires.
			 * If omitted, no deletion lock is applied.
			 */
			deleteLock?: string;
		};
	};
}
