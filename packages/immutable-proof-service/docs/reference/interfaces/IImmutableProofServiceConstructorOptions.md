# Interface: IImmutableProofServiceConstructorOptions

Options for the immutable proof service constructor.

## Properties

### immutableProofEntityStorageType?

> `optional` **immutableProofEntityStorageType**: `string`

The entity storage for proofs.

#### Default

```ts
immutable-proof
```

***

### verifiableStorageType?

> `optional` **verifiableStorageType**: `string`

The verifiable storage.

#### Default

```ts
verifiable-storage
```

***

### loggingComponentType?

> `optional` **loggingComponentType**: `string`

The logging component type.

#### Default

```ts
logging
```

***

### identityConnectorType?

> `optional` **identityConnectorType**: `string`

The identity connector type.

#### Default

```ts
identity
```

***

### backgroundTaskComponentType?

> `optional` **backgroundTaskComponentType**: `string`

The background task component type.

#### Default

```ts
background-task
```

***

### eventBusComponentType?

> `optional` **eventBusComponentType**: `string`

The event bus component type, defaults to no event bus.

***

### config?

> `optional` **config**: [`IImmutableProofServiceConfig`](IImmutableProofServiceConfig.md)

The configuration for the connector.
