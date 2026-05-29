// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type {
	ICreatedResponse,
	IHttpRequestContext,
	INoContentResponse,
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
	type IImmutableProofRemoveNotarizationRequest,
	type IImmutableProofRemoveRequest,
	type IImmutableProofVerifyRequest,
	type IImmutableProofVerifyResponse,
	ImmutableProofContexts,
	ImmutableProofFailure,
	ImmutableProofTypes
} from "@twin.org/immutable-proof-models";
import { nameof } from "@twin.org/nameof";
import {
	DidContexts,
	DidCryptoSuites,
	ProofTypes,
	DidTypes,
	type IProof
} from "@twin.org/standards-w3c-did";
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
								[HeaderTypes.Location]: "test%3A1234567890"
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
							id: "immutable-proof:1234567890"
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
									DidContexts.ContextVCv1,
									ImmutableProofContexts.Context,
									ImmutableProofContexts.ContextCommon
								],
								type: [DidTypes.VerifiableCredential, ImmutableProofTypes.ImmutableProof],
								id: "immutable-proof:1234567890",
								credentialSubject: {
									id: "ais:1234567890",
									proofIntegrity: "EAOKyDN0mYQbBh91eMdVeroxQx1H4GfnRbmt6n/2L/Y="
								},
								proof: {
									type: ProofTypes.DataIntegrityProof,
									cryptosuite: DidCryptoSuites.EdDSAJcs2022,
									created: "2024-08-22T11:56:56.272Z",
									proofPurpose: "assertionMethod",
									proofValue: "7DdiPPYtxLjCD3wA1po2rv...",
									verificationMethod:
										"did:iota:testnet:0xcb07cabaa2f23b7e53d8cdc4228efb351ebb270554d13bc382e4f94ca8d3136b#immutable-proof-assertion",
									notarizationId: "notarization:iota:0xabcdef1234567890"
								} as IProof
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
									DidContexts.ContextVCv1,
									ImmutableProofContexts.Context,
									ImmutableProofContexts.ContextCommon
								],
								type: [DidTypes.VerifiableCredential, ImmutableProofTypes.ImmutableProof],
								id: "immutable-proof:1234567890",
								credentialSubject: {
									id: "ais:1234567890",
									proofIntegrity: "EAOKyDN0mYQbBh91eMdVeroxQx1H4GfnRbmt6n/2L/Y="
								},
								proof: {
									type: ProofTypes.DataIntegrityProof,
									cryptosuite: DidCryptoSuites.EdDSAJcs2022,
									created: "2024-08-22T11:56:56.272Z",
									proofPurpose: "assertionMethod",
									proofValue: "7DdiPPYtxLjCD3wA1po2rv...",
									verificationMethod:
										"did:iota:testnet:0xcb07cabaa2f23b7e53d8cdc4228efb351ebb270554d13bc382e4f94ca8d3136b#immutable-proof-assertion",
									notarizationId: "notarization:iota:0xabcdef1234567890"
								} as IProof
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
							id: "immutable-proof:1234567890"
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
								"@context": ImmutableProofContexts.Context,
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
								"@context": ImmutableProofContexts.Context,
								type: ImmutableProofTypes.ImmutableProofVerification,
								verified: false,
								failure: ImmutableProofFailure.VerificationFailure
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

	const removeRoute: IRestRoute<IImmutableProofRemoveRequest, INoContentResponse> = {
		operationId: "immutableProofRemove",
		summary: "Remove a proof",
		tag: tagsImmutableProof[0].name,
		method: "DELETE",
		path: `${baseRouteName}/:id`,
		handler: async (httpRequestContext, request) =>
			immutableProofRemove(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IImmutableProofRemoveRequest>(),
			examples: [
				{
					id: "immutableProofRemoveRequestExample",
					request: {
						pathParams: {
							id: "immutable-proof:1234567890"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	const removeNotarizationRoute: IRestRoute<
		IImmutableProofRemoveNotarizationRequest,
		INoContentResponse
	> = {
		operationId: "immutableProofRemoveNotarization",
		summary: "Remove the notarization for a proof",
		tag: tagsImmutableProof[0].name,
		method: "DELETE",
		path: `${baseRouteName}/:id/notarization`,
		handler: async (httpRequestContext, request) =>
			immutableProofRemoveNotarization(httpRequestContext, componentName, request),
		requestType: {
			type: nameof<IImmutableProofRemoveNotarizationRequest>(),
			examples: [
				{
					id: "immutableProofRemoveNotarizationRequestExample",
					request: {
						pathParams: {
							id: "immutable-proof:1234567890"
						}
					}
				}
			]
		},
		responseType: [
			{
				type: nameof<INoContentResponse>()
			},
			{
				type: nameof<INotFoundResponse>()
			}
		]
	};

	return [createRoute, getRoute, verifyRoute, removeRoute, removeNotarizationRoute];
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
	const result = await component.create(request.body.document, request.body.options);

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

/**
 * Remove the proof and its notarization.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function immutableProofRemove(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IImmutableProofRemoveRequest
): Promise<INoContentResponse> {
	Guards.object<IImmutableProofRemoveRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IImmutableProofRemoveRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.pathParams.id), request.pathParams.id);

	const component = ComponentFactory.get<IImmutableProofComponent>(componentName);
	await component.remove(request.pathParams.id);

	return {
		statusCode: HttpStatusCode.noContent
	};
}

/**
 * Remove the notarization for a proof, keeping the proof entity.
 * @param httpRequestContext The request context for the API.
 * @param componentName The name of the component to use in the routes.
 * @param request The request.
 * @returns The response object with additional http response properties.
 */
export async function immutableProofRemoveNotarization(
	httpRequestContext: IHttpRequestContext,
	componentName: string,
	request: IImmutableProofRemoveNotarizationRequest
): Promise<INoContentResponse> {
	Guards.object<IImmutableProofRemoveNotarizationRequest>(ROUTES_SOURCE, nameof(request), request);
	Guards.object<IImmutableProofRemoveNotarizationRequest["pathParams"]>(
		ROUTES_SOURCE,
		nameof(request.pathParams),
		request.pathParams
	);
	Guards.stringValue(ROUTES_SOURCE, nameof(request.pathParams.id), request.pathParams.id);

	const component = ComponentFactory.get<IImmutableProofComponent>(componentName);
	await component.removeNotarization(request.pathParams.id);

	return {
		statusCode: HttpStatusCode.noContent
	};
}
