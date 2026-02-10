// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IDidVerifiableCredential } from "@twin.org/standards-w3c-did";
import type { HeaderTypes, MimeTypes } from "@twin.org/web";

/**
 * Response to getting an immutable proof.
 */
export interface IImmutableProofGetResponse {
	/**
	 * The headers which can be used to determine the response data type.
	 */
	headers?: {
		[HeaderTypes.ContentType]: typeof MimeTypes.Json | typeof MimeTypes.JsonLd;
	};

	/**
	 * The response body.
	 */
	body: IDidVerifiableCredential;
}
