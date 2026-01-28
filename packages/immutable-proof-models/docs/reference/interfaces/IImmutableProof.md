# Interface: IImmutableProof

Interface describing an immutable proof state.

## Properties

### @context

> **@context**: \[`"https://schema.twindev.org/immutable-proof/"`, `"https://schema.twindev.org/common/"`, `...IJsonLdContextDefinitionElement[]`\]

JSON-LD Context.

***

### type

> **type**: `"ImmutableProof"`

JSON-LD Type.

***

### id

> **id**: `string`

The id of the proof.

***

### proofObjectId?

> `optional` **proofObjectId**: `string`

The id of the object associated with the proof.
json-ld type:schema:identifier

***

### proofObjectHash

> **proofObjectHash**: `string`

The hash of the object associated with the proof.
json-ld type:schema:Text

***

### verifiableStorageId?

> `optional` **verifiableStorageId**: `string`

The verifiable storage id for where the proof is stored.
json-ld type:schema:identifier

***

### proof?

> `optional` **proof**: `IDataIntegrityProof`

The proof which can be undefined if it has not yet been issued.
json-ld id

***

### immutableReceipt?

> `optional` **immutableReceipt**: `IJsonLdNodeObject`

The immutable receipt detail for where the proof is stored.
json-ld id
