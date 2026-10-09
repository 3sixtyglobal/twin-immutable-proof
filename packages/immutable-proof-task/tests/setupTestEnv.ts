// Copyright 2024 IOTA Stiftung.
// SPDX-License-Identifier: Apache-2.0.
import path from "node:path";
import { Converter, RandomHelper } from "@3sixty/core";
import { Bip39 } from "@3sixty/crypto";
import { MemoryEntityStorageConnector } from "@3sixty/entity-storage-connector-memory";
import { EntityStorageConnectorFactory } from "@3sixty/entity-storage-models";
import {
	EntityStorageIdentityConnector,
	type IdentityDocument,
	initSchema as initSchemaIdentity
} from "@3sixty/identity-connector-entity-storage";
import { IdentityConnectorFactory } from "@3sixty/identity-models";
import { nameof } from "@3sixty/nameof";
import {
	EntityStorageVaultConnector,
	type VaultKey,
	type VaultSecret,
	initSchema as initSchemaVault
} from "@3sixty/vault-connector-entity-storage";
import { VaultConnectorFactory, VaultKeyType } from "@3sixty/vault-models";
import * as dotenv from "dotenv";

console.debug("Setting up test environment from .env and .env.dev files");

dotenv.config({
	path: [path.join(__dirname, ".env.dev"), path.join(__dirname, ".env")],
	quiet: true
});

initSchemaVault();
initSchemaIdentity();

const keyEntityStorage = new MemoryEntityStorageConnector<VaultKey>({
	entitySchema: nameof<VaultKey>(),
	config: { storageKey: "vault-key" }
});
EntityStorageConnectorFactory.register("vault-key", () => keyEntityStorage);
const secretEntityStorage = new MemoryEntityStorageConnector<VaultSecret>({
	entitySchema: nameof<VaultSecret>(),
	config: { storageKey: "vault-secret" }
});
EntityStorageConnectorFactory.register("vault-secret", () => secretEntityStorage);

export const TEST_VAULT_CONNECTOR = new EntityStorageVaultConnector();
VaultConnectorFactory.register("vault", () => TEST_VAULT_CONNECTOR);

const identityEntityStorage = new MemoryEntityStorageConnector<IdentityDocument>({
	entitySchema: nameof<IdentityDocument>(),
	config: { storageKey: "identity-document" }
});
EntityStorageConnectorFactory.register("identity-document", () => identityEntityStorage);

export const TEST_IDENTITY_CONNECTOR = new EntityStorageIdentityConnector();
IdentityConnectorFactory.register("identity", () => TEST_IDENTITY_CONNECTOR);

export let TEST_NODE_IDENTITY: string;
export let TEST_USER_IDENTITY: string;
export let TEST_HASH_KEY: string;

/**
 * Setup the test environment.
 */
export async function setupTestEnv(): Promise<void> {
	RandomHelper.generate = vi
		.fn()
		.mockImplementationOnce(length => new Uint8Array(length).fill(99))
		.mockImplementation(length => new Uint8Array(length).fill(88));
	Bip39.randomMnemonic = vi
		.fn()
		.mockImplementation(
			() =>
				"elder blur tip exact organ pipe other same minute grace conduct father brother prosper tide icon pony suggest joy provide dignity domain nominee liquid"
		);

	// Proofs are signed with the node identity as both controller and issuer, so the document
	// must control itself. The mocked RandomHelper makes its DID known up front.
	const nodeIdentity = `did:entity-storage:${Converter.bytesToHex(new Uint8Array(32).fill(99), true)}`;
	const didNode = await TEST_IDENTITY_CONNECTOR.createDocument(nodeIdentity);
	await TEST_IDENTITY_CONNECTOR.addVerificationMethod(
		nodeIdentity,
		didNode.id,
		"assertionMethod",
		"immutable-proof-assertion"
	);
	const didUser = await TEST_IDENTITY_CONNECTOR.createDocument("test-user-identity");

	TEST_NODE_IDENTITY = didNode.id;
	TEST_USER_IDENTITY = didUser.id;
	TEST_HASH_KEY = `${TEST_NODE_IDENTITY}/immutable-proof-hash`;

	await TEST_VAULT_CONNECTOR.addKey(
		TEST_HASH_KEY,
		VaultKeyType.Ed25519,
		Converter.base64ToBytes("p519gRazpBYvzqviRrFRBUT+ZNRZ24FYgOLcGO+Nj4Q="),
		Converter.base64ToBytes("DzFGb9pwkyom+MGrKeVCAV2CMEiy04z9bJLj48XGjWw=")
	);
}
