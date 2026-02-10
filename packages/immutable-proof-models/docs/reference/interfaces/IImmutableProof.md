# Interface: IImmutableProof

Interface describing an immutable proof state.

## Properties

### @context?

> `optional` **@context**: \[`"https://schema.twindev.org/immutable-proof/"`, `"https://schema.twindev.org/common/"`\]

JSON-LD Context.

***

### type?

> `optional` **type**: `"ImmutableProof"`

JSON-LD Type.

***

### id?

> `optional` **id**: `string`

The id of the object associated with the proof.

***

### proofIntegrity

> **proofIntegrity**: `string`

The integrity hash of the object associated with the proof.
json-ld namespace:twin-common
