# Interface: IImmutableProofServiceConstructorOptions

Options for the immutable proof service constructor.

## Properties

### immutableProofEntityStorageType? {#immutableproofentitystoragetype}

> `optional` **immutableProofEntityStorageType**: `string`

The entity storage for proofs.

***

### verifiableStorageType? {#verifiablestoragetype}

> `optional` **verifiableStorageType**: `string`

The verifiable storage.

***

### loggingComponentType? {#loggingcomponenttype}

> `optional` **loggingComponentType**: `string`

The logging component type.

***

### identityConnectorType? {#identityconnectortype}

> `optional` **identityConnectorType**: `string`

The identity connector type.

***

### backgroundTaskComponentType? {#backgroundtaskcomponenttype}

> `optional` **backgroundTaskComponentType**: `string`

The background task component type.

***

### eventBusComponentType? {#eventbuscomponenttype}

> `optional` **eventBusComponentType**: `string`

The event bus component type, defaults to no event bus.

***

### config? {#config}

> `optional` **config**: [`IImmutableProofServiceConfig`](IImmutableProofServiceConfig.md)

The configuration for the connector.
