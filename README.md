# 3Sixty Immutable Proof

This repository provides a focused set of components for creating, storing, and validating immutable proof records across distributed systems. The modules are designed to work together so teams can model proof data, run background processing, expose service endpoints, and integrate through a dedicated client.

Together, the packages support consistent proof lifecycles from initial document hashing through verification and retrieval. This keeps implementations aligned across services while making it easier to adopt immutable proof capabilities in new environments.

## Packages

- [immutable-proof-models](packages/immutable-proof-models/README.md) - Shared model contracts, schema types, and context constants for immutable proof workflows.
- [immutable-proof-task](packages/immutable-proof-task/README.md) - Background proof processing that creates verifiable credentials from prepared payloads.
- [immutable-proof-service](packages/immutable-proof-service/README.md) - Core proof lifecycle service with route helpers for create, get, and verify operations.
- [immutable-proof-rest-client](packages/immutable-proof-rest-client/README.md) - HTTP client for calling immutable proof service endpoints from external components.

## Contributing

To contribute to this package see the guidelines for building and publishing in [CONTRIBUTING](./CONTRIBUTING.md)

## Origin

This repository is derived from the original [iotaledger/twin-immutable-proof](https://github.com/iotaledger/twin-immutable-proof) repository.
