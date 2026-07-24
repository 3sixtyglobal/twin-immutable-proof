# Interface: IImmutableProofTaskResult

The result for the immutable proof task.

## Properties

### proofId {#proofid}

> **proofId**: `string`

The proof id.

***

### verifiableCredential {#verifiablecredential}

> **verifiableCredential**: `IDidVerifiableCredential`

The verifiable credential produced by the proof task.

***

### notarizationId? {#notarizationid}

> `optional` **notarizationId?**: `string`

The notarization id returned after storing the proof.
Not set when the notarization phase failed, see notarizationError.

***

### notarizationError? {#notarizationerror}

> `optional` **notarizationError?**: `IError`

Set when the notarization phase failed. The failure is returned in the result
instead of being thrown, because the notarization may have reached the ledger
even though the call failed, and a retry could create a duplicate on-chain object.
