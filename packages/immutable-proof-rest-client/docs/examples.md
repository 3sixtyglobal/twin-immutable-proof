# Immutable Proof REST Client Examples

Use these snippets to connect to an API, create and retrieve proofs, and validate proofs through REST endpoints.

## ImmutableProofRestClient

```typescript
import { ImmutableProofRestClient } from '@3sixty/immutable-proof-rest-client';

const client = new ImmutableProofRestClient({
  endpoint: 'http://localhost:8080'
});

console.log(client.className()); // ImmutableProofRestClient
```

```typescript
import { ImmutableProofRestClient } from '@3sixty/immutable-proof-rest-client';

const client = new ImmutableProofRestClient({
  endpoint: 'http://localhost:8080'
});

const proofId = await client.create({
  '@context': 'https://schema.org',
  type: 'Person',
  name: 'Alice Example'
});

console.log(proofId); // immutable-proof:01JABCDEF1234567890
```

```typescript
import { ImmutableProofRestClient } from '@3sixty/immutable-proof-rest-client';

const client = new ImmutableProofRestClient({
  endpoint: 'http://localhost:8080'
});

const proof = await client.get('immutable-proof:01JABCDEF1234567890');
const verification = await client.verify('immutable-proof:01JABCDEF1234567890');

console.log(proof.id); // immutable-proof:01JABCDEF1234567890
console.log(verification.verified); // true
```

```typescript
import { ImmutableProofRestClient } from '@3sixty/immutable-proof-rest-client';

const client = new ImmutableProofRestClient({
  endpoint: 'http://localhost:8080'
});

try {
  await client.removeVerifiable('immutable-proof:01JABCDEF1234567890');
} catch (error) {
  console.log(error instanceof Error); // true
}
```
