# Class: ImmutableProofService

Class for performing immutable proof operations.

## Implements

- `IImmutableProofComponent`

## Constructors

### Constructor

> **new ImmutableProofService**(`options?`): `ImmutableProofService`

Creates an instance of ImmutableProofService.

#### Parameters

##### options?

[`IImmutableProofServiceConstructorOptions`](../interfaces/IImmutableProofServiceConstructorOptions.md)

The dependencies for the immutable proof connector.

#### Returns

`ImmutableProofService`

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

### start() {#start}

> **start**(`nodeLoggingComponentType?`): `Promise`\<`void`\>

The component needs to be started when the node is initialized.

#### Parameters

##### nodeLoggingComponentType?

`string`

The node logging component type.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the background task handler has been registered.

#### Implementation of

`IImmutableProofComponent.start`

***

### stop() {#stop}

> **stop**(`nodeLoggingComponentType?`): `Promise`\<`void`\>

The component needs to be stopped when the node is closed.

#### Parameters

##### nodeLoggingComponentType?

`string`

The node logging component type.

#### Returns

`Promise`\<`void`\>

A promise that resolves when the scheduled sweep has been removed.

#### Implementation of

`IImmutableProofComponent.stop`

***

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

#### Implementation of

`IImmutableProofComponent.create`

***

### get() {#get}

> **get**(`id`): `Promise`\<`IImmutableProofCredential`\>

Get a proof.

#### Parameters

##### id

`string`

The id of the proof to get.

#### Returns

`Promise`\<`IImmutableProofCredential`\>

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

#### Implementation of

`IImmutableProofComponent.remove`

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

#### Implementation of

`IImmutableProofComponent.removeNotarization`
