# Class: ImmutableProof

Class describing the immutable proof.

## Constructors

### Constructor

> **new ImmutableProof**(): `ImmutableProof`

#### Returns

`ImmutableProof`

## Properties

### id

> **id**: `string`

The id of the proof.

***

### organizationId

> **organizationId**: `string`

The organization id.

***

### dateCreated

> **dateCreated**: `string`

The date/time of when the proof was created.

***

### proofObjectId?

> `optional` **proofObjectId**: `string`

The associated id for the item.

***

### proofObjectIntegrity

> **proofObjectIntegrity**: `string`

The associated integrity for the item.

***

### verifiableStorageId?

> `optional` **verifiableStorageId**: `string`

The verifiable storage id.

***

### vcContext?

> `optional` **vcContext**: `"https://www.w3.org/2018/credentials/v1"` \| `"https://www.w3.org/ns/credentials/v2"`

The verifiable credential context.
