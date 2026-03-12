# Class: ImmutableProofRestClient

Client for performing immutable proof through to REST endpoints.

## Extends

- `BaseRestClient`

## Implements

- `IImmutableProofComponent`

## Constructors

### Constructor

> **new ImmutableProofRestClient**(`config`): `ImmutableProofRestClient`

Create a new instance of ImmutableProofRestClient.

#### Parameters

##### config

`IBaseRestClientConfig`

The configuration for the client.

#### Returns

`ImmutableProofRestClient`

#### Overrides

`BaseRestClient.constructor`

## Properties

### CLASS\_NAME {#class_name}

> `readonly` `static` **CLASS\_NAME**: `string`

Runtime name for the class.

## Methods

### className() {#classname}

> **className**(): `string`

Returns the class name of the component.

#### Returns

`string`

The class name of the component.

#### Implementation of

`IImmutableProofComponent.className`

***

### create() {#create}

> **create**(`document`): `Promise`\<`string`\>

Create a new proof.

#### Parameters

##### document

`IJsonLdNodeObject`

The document to create the proof for.

#### Returns

`Promise`\<`string`\>

The id of the new proof.

#### Implementation of

`IImmutableProofComponent.create`

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

#### Implementation of

`IImmutableProofComponent.get`

***

### verify() {#verify}

> **verify**(`id`): `Promise`\<`IImmutableProofVerification`\>

Verify a proof.

#### Parameters

##### id

`string`

The id of the proof to verify.

#### Returns

`Promise`\<`IImmutableProofVerification`\>

The result of the verification and any failures.

#### Throws

NotFoundError if the proof is not found.

#### Implementation of

`IImmutableProofComponent.verify`

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

#### Implementation of

`IImmutableProofComponent.removeVerifiable`
