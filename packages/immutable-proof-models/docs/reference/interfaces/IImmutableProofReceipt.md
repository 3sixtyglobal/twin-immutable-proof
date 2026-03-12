# Interface: IImmutableProofReceipt

Interface describing an immutable proof receipt.

## Properties

### @context? {#context}

> `optional` **@context**: \[`"https://schema.twindev.org/immutable-proof/"`, `"https://schema.twindev.org/common/"`\]

JSON-LD Context.

***

### type {#type}

> **type**: `"ImmutableProofReceipt"`

JSON-LD Type.

***

### immutableReceipt? {#immutablereceipt}

> `optional` **immutableReceipt**: `IJsonLdNodeObject`

The immutable receipt detail for where the proof is stored.

***

### verifiableStorageId? {#verifiablestorageid}

> `optional` **verifiableStorageId**: `string`

The verifiable storage id for where the proof is stored.
