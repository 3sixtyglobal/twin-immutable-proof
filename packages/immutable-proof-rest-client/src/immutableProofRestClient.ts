// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { BaseRestClient } from "@twin.org/api-core";
import {
	type IBaseRestClientConfig,
	type ICreatedResponse,
	type INoContentResponse,
	HttpHeaderHelper
} from "@twin.org/api-models";
import { Guards } from "@twin.org/core";
import type { IJsonLdNodeObject } from "@twin.org/data-json-ld";
import type {
	IImmutableProofComponent,
	IImmutableProofCreateRequest,
	IImmutableProofCredential,
	IImmutableProofGetRequest,
	IImmutableProofGetResponse,
	IImmutableProofRemoveNotarizationRequest,
	IImmutableProofRemoveRequest,
	IImmutableProofVerification,
	IImmutableProofVerifyRequest,
	IImmutableProofVerifyResponse
} from "@twin.org/immutable-proof-models";
import { nameof } from "@twin.org/nameof";
import { HeaderTypes, HttpMethod, MimeTypes } from "@twin.org/web";

/**
 * Client for performing immutable proof through to REST endpoints.
 */
export class ImmutableProofRestClient extends BaseRestClient implements IImmutableProofComponent {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<ImmutableProofRestClient>();

	/**
	 * Creates an instance of ImmutableProofRestClient.
	 * @param config The configuration for the client.
	 */
	constructor(config: IBaseRestClientConfig) {
		super(nameof<ImmutableProofRestClient>(), config, "immutable-proof");
	}

	/**
	 * Returns the class name of the component.
	 * @returns The class name of the component.
	 */
	public className(): string {
		return ImmutableProofRestClient.CLASS_NAME;
	}

	/**
	 * Create a new proof.
	 * @param document The document to create the proof for.
	 * @param options Optional settings for the proof.
	 * @param options.deleteLock An ISO 8601 date-time string specifying when the notarization lock expires; if omitted no lock is applied.
	 * @returns The id of the new proof.
	 */
	public async create(
		document: IJsonLdNodeObject,
		options?: { deleteLock?: string }
	): Promise<string> {
		Guards.object(ImmutableProofRestClient.CLASS_NAME, nameof(document), document);

		const response = await this.fetch<IImmutableProofCreateRequest, ICreatedResponse>(
			"/",
			HttpMethod.POST,
			{
				body: {
					document,
					options
				}
			}
		);

		return HttpHeaderHelper.extractId(response.headers, `${this.getPathPrefix()}/:id`);
	}

	/**
	 * Get a proof.
	 * @param id The id of the proof to get.
	 * @returns The proof.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async get(id: string): Promise<IImmutableProofCredential> {
		Guards.stringValue(ImmutableProofRestClient.CLASS_NAME, nameof(id), id);

		const response = await this.fetch<IImmutableProofGetRequest, IImmutableProofGetResponse>(
			"/:id",
			HttpMethod.GET,
			{
				headers: {
					[HeaderTypes.Accept]: MimeTypes.JsonLd
				},
				pathParams: {
					id
				}
			}
		);

		return response.body;
	}

	/**
	 * Verify a proof.
	 * @param id The id of the proof to verify.
	 * @returns The result of the verification and any failures.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async verify(id: string): Promise<IImmutableProofVerification> {
		Guards.stringValue(ImmutableProofRestClient.CLASS_NAME, nameof(id), id);

		const response = await this.fetch<IImmutableProofVerifyRequest, IImmutableProofVerifyResponse>(
			"/:id/verify",
			HttpMethod.GET,
			{
				headers: {
					[HeaderTypes.Accept]: MimeTypes.JsonLd
				},
				pathParams: {
					id
				}
			}
		);

		return response.body;
	}

	/**
	 * Remove the proof and its notarization.
	 * @param id The id of the proof to remove.
	 * @returns A promise that resolves when the proof and its notarization have been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async remove(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofRestClient.CLASS_NAME, nameof(id), id);

		await this.fetch<IImmutableProofRemoveRequest, INoContentResponse>("/:id", HttpMethod.DELETE, {
			pathParams: {
				id
			}
		});
	}

	/**
	 * Remove only the notarization for the proof, keeping the proof entity.
	 * @param id The id of the proof to remove the notarization from.
	 * @returns A promise that resolves when the notarization has been removed.
	 * @throws NotFoundError if the proof is not found.
	 */
	public async removeNotarization(id: string): Promise<void> {
		Guards.stringValue(ImmutableProofRestClient.CLASS_NAME, nameof(id), id);

		await this.fetch<IImmutableProofRemoveNotarizationRequest, INoContentResponse>(
			"/:id/notarization",
			HttpMethod.DELETE,
			{
				pathParams: {
					id
				}
			}
		);
	}
}
