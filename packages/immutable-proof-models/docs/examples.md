# Immutable Proof Models Examples

These snippets show how to register data types and then use the immutable proof model contracts in request and response flows.

## ImmutableProofDataTypes

```typescript
import { DataTypeHandlerFactory } from '@3sixty/data-core';
import { ImmutableProofDataTypes, ImmutableProofTypes } from '@3sixty/immutable-proof-models';

ImmutableProofDataTypes.registerTypes();

const handler = DataTypeHandlerFactory.get(
  'https://schema.3sixty.global/immutable-proof/ImmutableProof'
);
console.log(handler.type === ImmutableProofTypes.ImmutableProof); // true
```

## Model Contracts

```typescript
import type {
  IImmutableProofCreateRequest,
  IImmutableProofGetResponse,
  IImmutableProofVerifyResponse
} from '@3sixty/immutable-proof-models';

const createRequest: IImmutableProofCreateRequest = {
  body: {
    document: {
      '@context': 'https://schema.org',
      type: 'Person',
      name: 'Alice Example'
    }
  }
};

console.log(createRequest.body.document.type); // Person
```

```typescript
import { ImmutableProofFailure, ImmutableProofTypes } from '@3sixty/immutable-proof-models';
import type {
  IImmutableProofGetResponse,
  IImmutableProofVerifyResponse
} from '@3sixty/immutable-proof-models';

const getResponse: IImmutableProofGetResponse = {
  body: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', ImmutableProofTypes.ImmutableProof],
    issuer: 'did:iota:tst:issuer',
    id: 'immutable-proof:01JABCDEF1234567890',
    credentialSubject: {
      id: 'https://example.org/documents/100',
      proofIntegrity: 'yEr9VvYCGDh2Ww1YwQMehUy4LlW35mLhX8j8R8U6x0g='
    }
  }
};

const verifyResponse: IImmutableProofVerifyResponse = {
  body: {
    '@context': 'https://schema.3sixty.global/immutable-proof',
    type: ImmutableProofTypes.ImmutableProofVerification,
    verified: false,
    failure: ImmutableProofFailure.ProofMissing
  }
};

console.log(getResponse.body.id); // immutable-proof:01JABCDEF1234567890
console.log(verifyResponse.body.failure); // proof-missing
```
