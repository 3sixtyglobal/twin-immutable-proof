# Interface: IImmutableProofServiceConfig

Configuration for the immutable proof service.

## Properties

### verificationMethodId? {#verificationmethodid}

> `optional` **verificationMethodId?**: `string`

The verification method id to use for the proof.

#### Default

```ts
immutable-proof-assertion
```

***

### taskRetryCount? {#taskretrycount}

> `optional` **taskRetryCount?**: `number`

The number of times to retry a proof task when it fails before the
notarization phase. Notarization phase failures are never retried
automatically as the notarization may already have reached the ledger.
Set to 0 to disable automatic retries, the minimum value is 0.

#### Default

```ts
5
```

***

### taskRetryInterval? {#taskretryinterval}

> `optional` **taskRetryInterval?**: `number`

The interval in milliseconds to wait between proof task retries,
the minimum value is 1.

#### Default

```ts
5000
```

***

### taskFailureRetainFor? {#taskfailureretainfor}

> `optional` **taskFailureRetainFor?**: `number`

The time in milliseconds to retain the record of a failed proof task so
the failure can be inspected. Successful task records are removed as soon
as their result has been processed. Set to -1 to retain failures forever,
the minimum value is -1.

#### Default

```ts
604800000 (7 days)
```
