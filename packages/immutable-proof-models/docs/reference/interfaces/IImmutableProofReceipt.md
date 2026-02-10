# Interface: IImmutableProofReceipt

Interface describing an immutable proof receipt.

## Properties

### @context?

> `optional` **@context**: \[`"https://schema.twindev.org/immutable-proof/"`, `"https://schema.twindev.org/common/"`\]

JSON-LD Context.

***

### type

> **type**: `"ImmutableProofReceipt"`

JSON-LD Type.

***

### immutableReceipt?

> `optional` **immutableReceipt**: `IJsonLdNodeObject`

The immutable receipt detail for where the proof is stored.
json-ld id

***

### verifiableStorageId?

> `optional` **verifiableStorageId**: `string`

The verifiable storage id for where the proof is stored.
json-ld id
