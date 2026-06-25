// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import type { IRestRouteEntryPoint } from "@twin.org/api-models";
import { generateRestRoutesImmutableProof, tagsImmutableProof } from "./immutableProofRoutes.js";

/**
 * The REST entry points for the immutable proof service.
 */
export const restEntryPoints: IRestRouteEntryPoint[] = [
	{
		name: "immutable-proof",
		defaultBaseRoute: "immutable-proof",
		tags: tagsImmutableProof,
		generateRoutes: generateRestRoutesImmutableProof
	}
];
