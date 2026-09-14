# Function: processProofTaskStart()

> **processProofTaskStart**(`engineCloneData`, `loggingComponentType?`): `Promise`\<`void`\>

Build and start the worker's engine clone. Registered as the background task handler's
initialiseMethod, so it runs once per worker instead of once per task.

## Parameters

### engineCloneData

`unknown`

The engine clone data used to initialize a cloned engine instance when
running in a separate thread. Empty when not running in a worker thread (e.g. in tests).

### loggingComponentType?

`string`

The logging component type to use for step logging, if configured.

## Returns

`Promise`\<`void`\>

A promise that resolves once the engine has started.
