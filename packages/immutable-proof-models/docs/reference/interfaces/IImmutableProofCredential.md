# Interface: IImmutableProofCredential

Interface describing an immutable proof credential.

## Extends

- `Omit`\<`IDidVerifiableCredential`, `"proof"`\>

## Properties

### proof? {#proof}

> `optional` **proof?**: IProof & IImmutableProofDataIntegrity

The proof of the verifiable credential, which includes the data integrity information.
