# Class: ImmutableProofV0

Class describing the immutable proof, version 0.

## Constructors

### Constructor

> **new ImmutableProofV0**(): `ImmutableProofV0`

#### Returns

`ImmutableProofV0`

## Properties

### id {#id}

> **id**: `string`

The id of the proof.

***

### organizationId {#organizationid}

> **organizationId**: `string`

The organization id.

***

### dateCreated {#datecreated}

> **dateCreated**: `string`

The date/time of when the proof was created.

***

### proofObjectId? {#proofobjectid}

> `optional` **proofObjectId?**: `string`

The associated id for the item.

***

### proofObjectIntegrity {#proofobjectintegrity}

> **proofObjectIntegrity**: `string`

The associated integrity for the item.

***

### notarizationId? {#notarizationid}

> `optional` **notarizationId?**: `string`

The notarization id.

***

### vcContext? {#vccontext}

> `optional` **vcContext?**: `"https://www.w3.org/2018/credentials/v1"` \| `"https://www.w3.org/ns/credentials/v2"`

The verifiable credential context.
