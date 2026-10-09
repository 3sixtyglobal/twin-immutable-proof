// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.

/**
 * The contexts of immutable proof data.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ImmutableProofContexts = {
	/**
	 * The canonical RDF namespace URI for Immutable Proof.
	 */
	Namespace: "https://schema.3sixty.global/immutable-proof/",

	/**
	 * The value to use in context for Immutable Proof.
	 */
	Context: "https://schema.3sixty.global/immutable-proof/",

	/**
	 * The JSON-LD Context URL for Immutable Proof.
	 */
	JsonLdContext: "https://schema.3sixty.global/immutable-proof/types.jsonld",

	/**
	 * The canonical RDF namespace URI for TWIN Common.
	 */
	NamespaceCommon: "https://schema.3sixty.global/common/",

	/**
	 * The value to use in JSON-LD context for TWIN Common.
	 */
	ContextCommon: "https://schema.3sixty.global/common/",

	/**
	 * The JSON-LD Context URL for TWIN Common.
	 */
	JsonLdContextCommon: "https://schema.3sixty.global/common/types.jsonld"
} as const;

/**
 * The contexts of immutable proof data.
 */
export type ImmutableProofContexts =
	(typeof ImmutableProofContexts)[keyof typeof ImmutableProofContexts];
