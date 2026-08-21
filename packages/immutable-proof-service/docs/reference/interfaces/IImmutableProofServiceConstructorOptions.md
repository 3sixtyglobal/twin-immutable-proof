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

### platformComponentType? {#platformcomponenttype}

> `optional` **platformComponentType?**: `string`

The platform component type, used to fan the reconciliation sweep out across every
tenant.

#### Default

```ts
platform
```

***

### taskSchedulerComponentType? {#taskschedulercomponenttype}

> `optional` **taskSchedulerComponentType?**: `string`

The task scheduler component type, used to run the reconciliation sweep on a schedule.

#### Default

```ts
task-scheduler
```

***

### telemetryComponentType? {#telemetrycomponenttype}

> `optional` **telemetryComponentType?**: `string`

The component type for the optional telemetry component used for event metrics.

***

### tracingComponentType? {#tracingcomponenttype}

> `optional` **tracingComponentType?**: `string`

The component type for the optional tracing component used for spans.

***

### config? {#config}

> `optional` **config?**: [`IImmutableProofServiceConfig`](IImmutableProofServiceConfig.md)

The configuration for the connector.
