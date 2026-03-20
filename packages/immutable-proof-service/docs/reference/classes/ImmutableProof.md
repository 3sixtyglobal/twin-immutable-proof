# Class: ImmutableProof

Class describing the immutable proof.

## Constructors

### Constructor

> **new ImmutableProof**(): `ImmutableProof`

#### Returns

`ImmutableProof`

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

### verifiableStorageId? {#verifiablestorageid}

> `optional` **verifiableStorageId?**: `string`

The verifiable storage id.

***

### vcContext? {#vccontext}

> `optional` **vcContext?**: `"https://www.w3.org/2018/credentials/v1"` \| `"https://www.w3.org/ns/credentials/v2"`

The verifiable credential context.
