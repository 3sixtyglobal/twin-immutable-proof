# Interface: IImmutableProof

Interface describing an immutable proof state.

## Properties

### @context? {#context}

> `optional` **@context**: \[`"https://schema.twindev.org/immutable-proof/"`, `"https://schema.twindev.org/common/"`\]

JSON-LD Context.

***

### type? {#type}

> `optional` **type**: `"ImmutableProof"`

JSON-LD Type.

***

### id? {#id}

> `optional` **id**: `string`

The id of the object associated with the proof.

***

### proofIntegrity {#proofintegrity}

> **proofIntegrity**: `string`

The integrity hash of the object associated with the proof.
