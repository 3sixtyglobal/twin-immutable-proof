# Interface: IImmutableProofVerification

Interface describing an immutable proof verification.

## Properties

### @context {#context}

> **@context**: `"https://schema.3sixty.global/immutable-proof/"`

JSON-LD Context.

***

### type {#type}

> **type**: `"ImmutableProofVerification"`

JSON-LD Type.

***

### verified {#verified}

> **verified**: `boolean`

Was the verification successful.

***

### failure? {#failure}

> `optional` **failure?**: [`ImmutableProofFailure`](../type-aliases/ImmutableProofFailure.md)

If the verification was unsuccessful the failure reason.
