// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	ICreatedResponse,
	IHttpRequestContext,
	INotFoundResponse,
	IRestRoute,
	ITag
} from "@twin.org/api-models";
import { ComponentFactory, Guards } from "@twin.org/core";
import {
	type IImmutableProofComponent,
	type IImmutableProofCreateRequest,
	type IImmutableProofGetRequest,
	type IImmutableProofGetResponse,
	type IImmutableProofVerifyRequest,
	type IImmutableProofVerifyResponse,
	ImmutableProofContexts,
	ImmutableProofFailure,
	ImmutableProofTypes
} from "@twin.org/immutable-proof-models";
import { nameof } from "@twin.org/nameof";
import { DidContexts, DidCryptoSuites, ProofTypes } from "@twin.org/standards-w3c-did";
import { HeaderTypes, HttpStatusCode, MimeTypes } from "@twin.org/web";

/**
 * The source used when communicating about these routes.
 */
const ROUTES_SOURCE = "immutableProofRoutes";

/**
 * The tag to associate with the routes.
 */
export const tagsImmutableProof: ITag[] = [
	{
		name: "Immutable Proof",
		description: "Endpoints which are modelled to access an immutable proof contract."
	}
];

/**
 * The REST routes for immutable proof.
 * @param baseRouteName Prefix to prepend to the paths.
 * @param componentName The name of the component to use in the routes stored in the ComponentFactory.
 * @returns The generated routes.
 */
export function generateRestRoutesImmutableProof(
	baseRouteName: string,
	componentName: string
): IRestRoute[] {
	const createRoute: IRestRoute<IImmutableProofCreateRequest, ICreatedResponse> = {
		operationId: "immutableProofCreate",
		summary: "Create a proof",
		tag: tagsImmutableProof[0].name,
		method: "POST",
		path: `${baseRouteName}/`,
		handler: async (httpRequestContext, request) =>
			immutableProofCreate(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IImmutableProofCreateRequest>(),
			examples: [
				{
					id: "immutableProofCreateRequestExample",
					request: {
						body: {
							document: {
								"@context": "https://schema.org",
								type: "Person",
								name: "John Smith"
							}
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<ICreatedResponse>(),
				examples: [
					{
						id: "immutableProofCreateResponseExample",
						response: {
							statusCode: HttpStatusCode.created,
							headers: {
								[HeaderTypes.Location]: "test:1234567890"
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const getRoute: IRestRoute<IImmutableProofGetRequest, IImmutableProofGetResponse> = {
		operationId: "immutableProofGet",
		summary: "Get a proof",
		tag: tagsImmutableProof[0].name,
		method: "GET",
		path: `${baseRouteName}/:id`,
		handler: async (httpRequestContext, request) =>
			immutableProofGet(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IImmutableProofGetRequest>(),
			examples: [
				{
					id: "immutableProofGetRequestExample",
					request: {
						headers: {
							[HeaderTypes.Accept]: MimeTypes.Json
						},
						pathParams: {
							id: "ais:1234567890"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IImmutableProofGetResponse>(),
				examples: [
					{
						id: "immutableProofGetResponseExample",
						response: {
							body: {
								"@context": [
									ImmutableProofContexts.ContextRoot,
									ImmutableProofContexts.ContextRootCommon
								],
								type: ImmutableProofTypes.ImmutableProof,
								id: "ais:1234567890",
								proofObjectId: "test:1234567890",
								proofObjectHash: "EAOKyDN0mYQbBh91eMdVeroxQx1H4GfnRbmt6n/2L/Y=",
								proof: {
									"@context": DidContexts.ContextDataIntegrity,
									type: ProofTypes.DataIntegrityProof,
									cryptosuite: DidCryptoSuites.EdDSAJcs2022,
									created: "2024-08-22T11:56:56.272Z",
									proofPurpose: "assertionMethod",
									proofValue: "7DdiPPYtxLjCD3wA1po2rv..."
								}
							}
						}
					}
				]
			},
			{
				type: nameof<IImmutableProofGetResponse>(),
				mimeType: MimeTypes.JsonLd,
				examples: [
					{
						id: "immutableProofJsonLdGetResponseExample",
						response: {
							headers: {
								[HeaderTypes.ContentType]: MimeTypes.JsonLd
							},
							body: {
								"@context": [
									ImmutableProofContexts.ContextRoot,
									ImmutableProofContexts.ContextRootCommon
								],
								type: ImmutableProofTypes.ImmutableProof,
								id: "ais:1234567890",
								proofObjectId: "test:1234567890",
								proofObjectHash: "EAOKyDN0mYQbBh91eMdVeroxQx1H4GfnRbmt6n/2L/Y=",
								proof: {
									"@context": DidContexts.ContextDataIntegrity,
									type: ProofTypes.DataIntegrityProof,
									cryptosuite: DidCryptoSuites.EdDSAJcs2022,
									created: "2024-08-22T11:56:56.272Z",
									proofPurpose: "assertionMethod",
									proofValue: "7DdiPPYtxLjCD3wA1po2rv..."
								}
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const verifyRoute: IRestRoute<IImmutableProofVerifyRequest, IImmutableProofVerifyResponse> = {
		operationId: "immutableProofVerify",
		summary: "Verify a proof",
		tag: tagsImmutableProof[0].name,
		method: "GET",
		path: `${baseRouteName}/:id/verify`,
		handler: async (httpRequestContext, request) =>
			immutableProofVerify(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IImmutableProofVerifyRequest>(),
			examples: [
				{
					id: "immutableProofVerifyRequestExample",
					request: {
						pathParams: {
							id: "ais:1234567890"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<IImmutableProofVerifyResponse>(),
				examples: [
					{
						id: "immutableProofVerifyResponseExample",
						response: {
							body: {
								"@context": ImmutableProofContexts.ContextRoot,
								type: ImmutableProofTypes.ImmutableProofVerification,
								verified: true
							}
						}
					}
				]
			},
			{
				type: nameof<IImmutableProofVerifyResponse>(),
				examples: [
					{
						id: "immutableProofVerifyResponseFailExample",
						response: {
							body: {
								"@context": ImmutableProofContexts.ContextRoot,
								type: ImmutableProofTypes.ImmutableProofVerification,
								verified: false,
								failure: ImmutableProofFailure.ProofTypeMismatch
							}
						}
					}
				]
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	return [createRoute, getRoute, verifyRoute];
}

/**
 * Create a proof.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function immutableProofCreate(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IImmutableProofCreateRequest
): Promise<ICreatedResponse> {
	Guards.object<IImmutableProofCreateRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object(ROUTES_SOURCE, nameof(request.body.document), request.body.document);

	const component = ComponentFactory.get<IImmutableProofComponent>(componentName);
	const result = await component.create(request.body.document);

	return {
		statusCode: HttpStatusCode.created,
		headers: {
			[HeaderTypes.Location]: result
		}
	};
}

/**
 * Get the proof.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function immutableProofGet(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IImmutableProofGetRequest
): Promise<IImmutableProofGetResponse> {
	Guards.object<IImmutableProofGetRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IImmutableProofGetRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.pathParams.id), request.pathParams.id);

	const mimeType = request.headers?.[HeaderTypes.Accept] === MimeTypes.JsonLd ? "jsonld" : "json";

	const component = ComponentFactory.get<IImmutableProofComponent>(componentName);
	const result = await component.get(request.pathParams.id);

	return {
		headers: {
			[HeaderTypes.ContentType]: mimeType === "json" ? MimeTypes.Json : MimeTypes.JsonLd
		},
		body: result
	};
}

/**
 * Verify the proof.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function immutableProofVerify(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IImmutableProofVerifyRequest
): Promise<IImmutableProofVerifyResponse> {
	Guards.object<IImmutableProofVerifyRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IImmutableProofVerifyRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.pathParams.id), request.pathParams.id);

	const mimeType = request.headers?.[HeaderTypes.Accept] === MimeTypes.JsonLd ? "jsonld" : "json";

	const component = ComponentFactory.get<IImmutableProofComponent>(componentName);
	const result = await component.verify(request.pathParams.id);

	return {
		headers: {
			[HeaderTypes.ContentType]: mimeType === "json" ? MimeTypes.Json : MimeTypes.JsonLd
		},
		body: result
	};
}
