# Interface: IImmutableProofComponent

Interface describing an immutable proof contract.

## Extends

- `IComponent`

## Methods

### create() {#create}

> **create**(`document`, `options?`): `Promise`\<`string`\>

Create a new proof.

#### Parameters

##### document

`IJsonLdNodeObject`

The document to create the proof for.

##### options?

Optional settings for the proof.

###### deleteLock?

`string`

An ISO 8601 date-time string specifying when the notarization lock expires; if omitted no lock is applied.

#### Returns

`Promise`\<`string`\>

The id of the new proof.

***

### get() {#get}

> **get**(`id`): `Promise`\<[`IImmutableProofCredential`](IImmutableProofCredential.md)\>

Get a proof.

#### Parameters

##### id

`string`

The id of the proof to get.

#### Returns

`Promise`\<[`IImmutableProofCredential`](IImmutableProofCredential.md)\>

The proof.

#### Throws

NotFoundError if the proof is not found.

***

### verify() {#verify}

> **verify**(`id`): `Promise`\<[`IImmutableProofVerification`](IImmutableProofVerification.md)\>

Verify a proof.

#### Parameters

##### id

`string`

The id of the proof to verify.

#### Returns

`Promise`\<[`IImmutableProofVerification`](IImmutableProofVerification.md)\>

The result of the verification and any failures.

#### Throws

NotFoundError if the proof is not found.

***

### remove() {#remove}

> **remove**(`id`): `Promise`\<`void`\>

Remove the proof and its notarization.

#### Parameters

##### id

`string`

The id of the proof to remove.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the proof and its notarization have been removed.

#### Throws

NotFoundError if the proof is not found.

***

### removeNotarization() {#removenotarization}

> **removeNotarization**(`id`): `Promise`\<`void`\>

Remove only the notarization for the proof, keeping the proof entity.

#### Parameters

##### id

`string`

The id of the proof to remove the notarization from.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the notarization has been removed.

#### Throws

NotFoundError if the proof is not found.
