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

> **get**(`id`): `Promise`\<`IDidVerifiableCredential`\>

Get a proof.

#### Parameters

##### id

`string`

The id of the proof to get.

#### Returns

`Promise`\<`IDidVerifiableCredential`\>

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

### removeVerifiable() {#removeverifiable}

> **removeVerifiable**(`id`): `Promise`\<`void`\>

Remove the verifiable storage for the proof.

#### Parameters

##### id

`string`

The id of the proof to remove the storage from.

#### Returns

`Promise`\<`void`\>

Nothing.

#### Throws

NotFoundError if the proof is not found.
