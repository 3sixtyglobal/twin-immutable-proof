# Interface: IImmutableProofServiceConstructorOptions

Options for the immutable proof service constructor.

## Properties

### immutableProofEntityStorageType? {#immutableproofentitystoragetype}

> `optional` **immutableProofEntityStorageType?**: `string`

The entity storage for proofs.

#### Default

```ts
immutable-proof
```

***

### notarizationConnectorType? {#notarizationconnectortype}

> `optional` **notarizationConnectorType?**: `string`

The notarization connector type.

#### Default

```ts
notarization
```

***

### loggingComponentType? {#loggingcomponenttype}

> `optional` **loggingComponentType?**: `string`

The logging component type.

#### Default

```ts
logging
```

***

### identityConnectorType? {#identityconnectortype}

> `optional` **identityConnectorType?**: `string`

The identity connector type.

#### Default

```ts
identity
```

***

### backgroundTaskComponentType? {#backgroundtaskcomponenttype}

> `optional` **backgroundTaskComponentType?**: `string`

The background task component type.

#### Default

```ts
background-task
```

***

### eventBusComponentType? {#eventbuscomponenttype}

> `optional` **eventBusComponentType?**: `string`

The event bus component type, defaults to no event bus.

***

### config? {#config}

> `optional` **config?**: [`IImmutableProofServiceConfig`](IImmutableProofServiceConfig.md)

The configuration for the connector.
