// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import { ImmutableProofRestClient } from "../src/immutableProofRestClient.js";

describe("ImmutableProofRestClient", () => {
	test("Can create an instance", async () => {
		const client = new ImmutableProofRestClient({ endpoint: "http://localhost:8080" });
		expect(client).toBeDefined();
	});
});
