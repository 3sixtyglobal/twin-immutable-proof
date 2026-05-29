# Function: immutableProofRemoveNotarization()

> **immutableProofRemoveNotarization**(`httpRequestContext`, `componentName`, `request`): `Promise`\<`INoContentResponse`\>

Remove the notarization for a proof, keeping the proof entity.

## Parameters

### httpRequestContext

`IHttpRequestContext`

The request context for the API.

### componentName

`string`

The name of the component to use in the routes.

### request

`IImmutableProofRemoveNotarizationRequest`

The request.

## Returns

`Promise`\<`INoContentResponse`\>

The response object with additional http response properties.
