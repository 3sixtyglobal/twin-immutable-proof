// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { nameof } from "@twin.org/nameof";

/**
 * The source context for guards and logging in the immutable proof task.
 */
export class ImmutableProofTask {
	/**
	 * Runtime name for the class.
	 */
	public static readonly CLASS_NAME: string = nameof<ImmutableProofTask>();
}
