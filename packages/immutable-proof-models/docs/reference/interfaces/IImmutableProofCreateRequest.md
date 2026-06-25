# Interface: IImmutableProofCreateRequest

Create a proof.

## Properties

### body {#body}

> **body**: `object`

The parameters from the body.

#### document

> **document**: `IJsonLdNodeObject`

The document to create the proof for.

#### options?

> `optional` **options?**: `object`

Optional settings for the proof.

##### options.deleteLock?

> `optional` **deleteLock?**: `string`

An ISO 8601 date-time string specifying when the notarization lock expires.
If omitted, no deletion lock is applied.
