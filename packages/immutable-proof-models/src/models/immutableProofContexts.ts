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
	Namespace: "https://schema.twindev.org/immutable-proof/",

	/**
	 * The value to use in context for Immutable Proof.
	 */
	Context: "https://schema.twindev.org/immutable-proof/",

	/**
	 * The JSON-LD Context URL for Immutable Proof.
	 */
	JsonLdContext: "https://schema.twindev.org/immutable-proof/types.jsonld",

	/**
	 * The canonical RDF namespace URI for TWIN Common.
	 */
	NamespaceCommon: "https://schema.twindev.org/common/",

	/**
	 * The value to use in JSON-LD context for TWIN Common.
	 */
	ContextCommon: "https://schema.twindev.org/common/",

	/**
	 * The JSON-LD Context URL for TWIN Common.
	 */
	JsonLdContextCommon: "https://schema.twindev.org/common/types.jsonld"
} as const;

/**
 * The contexts of immutable proof data.
 */
export type ImmutableProofContexts =
	(typeof ImmutableProofContexts)[keyof typeof ImmutableProofContexts];
