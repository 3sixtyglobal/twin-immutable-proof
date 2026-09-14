# Function: processProofTaskEnd()

> **processProofTaskEnd**(`loggingComponentType?`): `Promise`\<`void`\>

Stop the worker's engine clone. Registered as the background task handler's shutdownMethod.

## Parameters

### loggingComponentType?

`string`

The logging component type to use for step logging, if configured.

## Returns

`Promise`\<`void`\>

A promise that resolves once the engine has stopped, even if stopping failed.
