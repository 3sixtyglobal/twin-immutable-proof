# Function: processProofTask()

> **processProofTask**(`engineCloneData`, `payload`): `Promise`\<[`IImmutableProofTaskResult`](../interfaces/IImmutableProofTaskResult.md)\>

Process a proof task by creating a verifiable credential and notarizing it.

## Parameters

### engineCloneData

`unknown`

The engine clone data used to initialize a cloned engine instance when running in a separate thread.

### payload

[`IImmutableProofTaskPayload`](../interfaces/IImmutableProofTaskPayload.md)

The payload containing the proof parameters.

## Returns

`Promise`\<[`IImmutableProofTaskResult`](../interfaces/IImmutableProofTaskResult.md)\>

The task result containing the verifiable credential and notarization id.
