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

### deleteLockYears? {#deletelockyears}

> `optional` **deleteLockYears?**: `number`

The number of years to lock the notarization against deletion.

#### Default

```ts
50
```
