# Class: ImmutableProof

Class describing the immutable proof.

## Constructors

### Constructor

> **new ImmutableProof**(): `ImmutableProof`

#### Returns

`ImmutableProof`

## Properties

### id {#id}

> **id**: `string`

The id of the proof.

***

### organizationId {#organizationid}

> **organizationId**: `string`

The organization id.

***

### dateCreated {#datecreated}

> **dateCreated**: `string`

The date/time of when the proof was created.

***

### proofObjectId? {#proofobjectid}

> `optional` **proofObjectId?**: `string`

The associated id for the item.

***

### proofObjectIntegrity {#proofobjectintegrity}

> **proofObjectIntegrity**: `string`

The associated integrity for the item.

***

### notarizationId? {#notarizationid}

> `optional` **notarizationId?**: `string`

The notarization id.

***

### vcContext? {#vccontext}

> `optional` **vcContext?**: `"https://www.w3.org/2018/credentials/v1"` \| `"https://www.w3.org/ns/credentials/v2"`

The verifiable credential context.

***

### taskId? {#taskid}

> `optional` **taskId?**: `string`

The id of the most recently enqueued background task for this proof.

***

### deleteLock? {#deletelock}

> `optional` **deleteLock?**: `string`

The date/time the notarization lock expires, persisted so a reconciliation sweep can
rebuild the original task payload without losing the caller's requested delete lock.

***

### sweepAttempts? {#sweepattempts}

> `optional` **sweepAttempts?**: `number`

The number of reconciliation sweep attempts made for this proof.

***

### lastSweepAttempt? {#lastsweepattempt}

> `optional` **lastSweepAttempt?**: `string`

The date/time of the most recent reconciliation sweep attempt.

***

### isParked? {#isparked}

> `optional` **isParked?**: `boolean`

Set to true when the reconciliation sweep has exhausted its attempts; absent otherwise.
