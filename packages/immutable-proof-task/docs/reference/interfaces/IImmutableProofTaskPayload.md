# Interface: IImmutableProofTaskPayload

The payload for the immutable proof task.

## Properties

### proofId {#proofid}

> **proofId**: `string`

The proof id.

***

### identity {#identity}

> **identity**: `string`

The identity to create the proof for.

***

### identityConnectorType {#identityconnectortype}

> **identityConnectorType**: `string`

The identity connector type.

***

### verificationMethodId {#verificationmethodid}

> **verificationMethodId**: `string`

The assertion method id.

***

### credentialSubject {#credentialsubject}

> **credentialSubject**: `IImmutableProof`

The subject to create the proof for.

***

### notarizationConnectorType {#notarizationconnectortype}

> **notarizationConnectorType**: `string`

The notarization connector type.

***

### deleteLockDateTime? {#deletelockdatetime}

> `optional` **deleteLockDateTime?**: `string`

An ISO 8601 date-time string specifying when the notarization lock expires.
If omitted, no deletion lock is applied.
