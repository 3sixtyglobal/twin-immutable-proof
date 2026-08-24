// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { EntitySchemaFactory, EntitySchemaHelper } from "@twin.org/entity";
import { nameof } from "@twin.org/nameof";
import { ImmutableProof } from "./entities/immutableProof.js";
import { ImmutableProofV0 } from "./entities/immutableProofV0.js";

/**
 * Initialize the schema for the immutable proof entity storage connector.
 */
export function initSchema(): void {
	EntitySchemaFactory.register(nameof<ImmutableProof>(), () =>
		EntitySchemaHelper.getSchema(ImmutableProof)
	);
	EntitySchemaFactory.register(nameof<ImmutableProofV0>(), () =>
		EntitySchemaHelper.getSchema(ImmutableProofV0)
	);
}
