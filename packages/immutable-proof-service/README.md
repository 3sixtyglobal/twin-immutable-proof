# 3Sixty Immutable Proof Service

This package implements the core immutable proof lifecycle, including proof creation, retrieval, verification, and storage coordination. It also exposes route and schema helpers so API hosts can register endpoints and entity schemas with consistent behaviour.

## Installation

```shell
npm install @3sixty/immutable-proof-service
```

## Examples

Usage of the APIs is shown in the examples [docs/examples.md](docs/examples.md)

## Reference

Detailed reference documentation for the API can be found in [docs/reference/index.md](docs/reference/index.md)

## Schema history

`ImmutableProof` has been `@entity({ version: 1 })` since 0.9.2, with a version record tracking it.

`ImmutableProofV0` covers every row written by an earlier release, including proofs from before February 2026 that carry `proofObjectHash` and no `organizationId`.

Migrating those rows needs a host-registered `ImmutableProof_0_1` step that supplies `organizationId` and derives `proofObjectIntegrity` from `proofObjectHash` (`sha256:` becomes `sha256-`, same digest).

A host without that step must repair the rows by hand before enabling migration (MySQL shown, adapt for other connectors):

```sql
UPDATE `<prefix>immutable-proof`
   SET proofObjectIntegrity = REPLACE(proofObjectHash, 'sha256:', 'sha256-')
 WHERE proofObjectIntegrity IS NULL AND proofObjectHash LIKE 'sha256:%';
```

`organizationId` has to be set per partition by hand, since nothing in the row can supply it.

## Changelog

The changes between each version can be found in [docs/changelog.md](docs/changelog.md)

## Origin

This package is derived from the original [iotaledger/twin-immutable-proof](https://github.com/iotaledger/twin-immutable-proof/tree/next/packages/immutable-proof-service) repository.
