# Immutable Proof Service Examples

These examples show how to initialise storage and routes, create and retrieve proofs, verify them, and work with persisted entities.

## ImmutableProofService

```typescript
import { ImmutableProofService } from '@twin.org/immutable-proof-service';

const service = new ImmutableProofService({
  identityConnectorType: 'identity',
  config: {
    verificationMethodId: 'immutable-proof-assertion'
  }
});

console.log(service.className()); // ImmutableProofService
```

```typescript
import { ImmutableProofService } from '@twin.org/immutable-proof-service';

const service = new ImmutableProofService();
await service.start();

const proofId = await service.create({
  '@context': 'https://schema.org',
  type: 'Person',
  name: 'Alice Example'
});

console.log(proofId); // immutable-proof:01JABCDEF1234567890
```

```typescript
import { ImmutableProofService } from '@twin.org/immutable-proof-service';

const service = new ImmutableProofService();
const proofId = 'immutable-proof:01JABCDEF1234567890';

const credential = await service.get(proofId);
const verification = await service.verify(proofId);

console.log(credential.id); // immutable-proof:01JABCDEF1234567890
console.log(verification.verified); // true
```

```typescript
import { ImmutableProofService } from '@twin.org/immutable-proof-service';

const service = new ImmutableProofService();
const proofId = 'immutable-proof:01JABCDEF1234567890';

await service.removeVerifiable(proofId);
const verificationAfterRemoval = await service.verify(proofId);

console.log(verificationAfterRemoval.verified); // false
```

## ImmutableProof

```typescript
import { ImmutableProof } from '@twin.org/immutable-proof-service';

const entity: ImmutableProof = {
  id: '01JABCDEF1234567890',
  organizationId: 'did:iota:tst:issuer',
  dateCreated: '2026-03-10T09:30:00.000Z',
  proofObjectId: 'https://example.org/documents/100',
  proofObjectIntegrity: 'yEr9VvYCGDh2Ww1YwQMehUy4LlW35mLhX8j8R8U6x0g=',
  notarizationId: 'notarization:01JABCDE'
};

console.log(entity.organizationId); // did:iota:tst:issuer
```

## Route and Schema Helpers

```typescript
import {
  generateRestRoutesImmutableProof,
  initSchema,
  restEntryPoints
} from '@twin.org/immutable-proof-service';

initSchema();

const routes = generateRestRoutesImmutableProof('/immutable-proof', 'immutable-proof');
console.log(routes.length); // 3
console.log(restEntryPoints[0].name); // immutable-proof
```

```typescript
import {
  immutableProofCreate,
  immutableProofGet,
  immutableProofVerify
} from '@twin.org/immutable-proof-service';

const requestContext = {};

const createResponse = await immutableProofCreate(requestContext, 'immutable-proof', {
  body: {
    document: {
      '@context': 'https://schema.org',
      type: 'Person',
      name: 'Alice Example'
    }
  }
});

const getResponse = await immutableProofGet(requestContext, 'immutable-proof', {
  pathParams: {
    id: createResponse.headers.location
  }
});

const verifyResponse = await immutableProofVerify(requestContext, 'immutable-proof', {
  pathParams: {
    id: createResponse.headers.location
  }
});

console.log(createResponse.statusCode); // 201
console.log(getResponse.body.id); // immutable-proof:01JABCDEF1234567890
console.log(verifyResponse.body.verified); // true
```
