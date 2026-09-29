# Class: ImmutableProofV0

Class describing the immutable proof, version 0. Covers every row written before the
version record existed, including rows that predate organizationId and carry
proofObjectHash instead of proofObjectIntegrity.

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

### organizationId? {#organizationid}

> `optional` **organizationId?**: `string`

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

### proofObjectIntegrity? {#proofobjectintegrity}

> `optional` **proofObjectIntegrity?**: `string`

The associated integrity for the item.

***

### proofObjectHash? {#proofobjecthash}

> `optional` **proofObjectHash?**: `string`

The digest as stored before proofObjectIntegrity existed, "sha256:" followed by base64.

***

### verifiableStorageId? {#verifiablestorageid}

> `optional` **verifiableStorageId?**: `string`

The verifiable storage id, as stored before this property was dropped from the entity.

***

### nodeIdentity? {#nodeidentity}

> `optional` **nodeIdentity?**: `string`

The node identity, as stored before this property was dropped from the entity.

***

### userIdentity? {#useridentity}

> `optional` **userIdentity?**: `string`

The user identity, as stored before this property was dropped from the entity.

***

### notarizationId? {#notarizationid}

> `optional` **notarizationId?**: `string`

The notarization id.

***

### vcContext? {#vccontext}

> `optional` **vcContext?**: `"https://www.w3.org/2018/credentials/v1"` \| `"https://www.w3.org/ns/credentials/v2"`

The verifiable credential context.
