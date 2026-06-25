# Immutable Proof Task Examples

These snippets show how to prepare payloads and execute background task processing for immutable proof generation.

## processProofTask

```typescript
import type { IImmutableProofTaskPayload } from '@twin.org/immutable-proof-task';

const payload: IImmutableProofTaskPayload = {
  proofId: 'immutable-proof:01JABCDEF1234567890',
  identity: 'did:iota:tst:issuer',
  identityConnectorType: 'identity',
  verificationMethodId: 'immutable-proof-assertion',
  credentialSubject: {
    '@context': ['https://schema.twindev.org/immutable-proof', 'https://schema.twindev.org/common'],
    type: 'ImmutableProof',
    id: 'https://example.org/documents/100',
    proofIntegrity: 'yEr9VvYCGDh2Ww1YwQMehUy4LlW35mLhX8j8R8U6x0g='
  }
};

console.log(payload.identity); // did:iota:tst:issuer
```

```typescript
import { processProofTask } from '@twin.org/immutable-proof-task';
import type { IEngineCoreClone } from '@twin.org/engine-models';

const engineCloneData: IEngineCoreClone = {
  factories: {},
  components: {}
};

const result = await processProofTask(engineCloneData, {
  proofId: 'immutable-proof:01JABCDEF1234567890',
  identity: 'did:iota:tst:issuer',
  identityConnectorType: 'identity',
  verificationMethodId: 'immutable-proof-assertion',
  credentialSubject: {
    '@context': ['https://schema.twindev.org/immutable-proof', 'https://schema.twindev.org/common'],
    type: 'ImmutableProof',
    id: 'https://example.org/documents/100',
    proofIntegrity: 'yEr9VvYCGDh2Ww1YwQMehUy4LlW35mLhX8j8R8U6x0g='
  }
});

console.log(result.proofId); // immutable-proof:01JABCDEF1234567890
```
