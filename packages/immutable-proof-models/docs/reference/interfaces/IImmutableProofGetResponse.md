# Interface: IImmutableProofGetResponse

Response to getting an immutable proof.

## Properties

### headers? {#headers}

> `optional` **headers?**: `object`

The headers which can be used to determine the response data type.

#### content-type

> **content-type**: `"application/json"` \| `"application/ld+json"`

***

### body {#body}

> **body**: [`IImmutableProofCredential`](IImmutableProofCredential.md)

The response body.
