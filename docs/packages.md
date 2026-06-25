# Immutable Proof Packages

## immutable-proof-models

This package defines shared contracts, contexts, and schema mappings for immutable proof data exchanged between components. It helps keep payloads and verification structures consistent across service boundaries, reducing integration drift and improving reliability as implementations evolve.

- [README](../packages/immutable-proof-models/README.md)
- [Examples](../packages/immutable-proof-models/docs/examples.md)
- [Changelog](../packages/immutable-proof-models/docs/changelog.md)

## immutable-proof-task

This package handles asynchronous proof processing by turning prepared task payloads into verifiable credential output. It supports scalable orchestration by separating proof generation from synchronous request paths while preserving clear, repeatable execution behaviour.

- [README](../packages/immutable-proof-task/README.md)
- [Examples](../packages/immutable-proof-task/docs/examples.md)
- [Changelog](../packages/immutable-proof-task/docs/changelog.md)

## immutable-proof-service

This package implements the main proof lifecycle and coordinates identity, storage, validation, and verification concerns. It includes helpers for route and schema registration so hosts can expose stable API behaviour with minimal custom wiring.

- [README](../packages/immutable-proof-service/README.md)
- [Examples](../packages/immutable-proof-service/docs/examples.md)
- [Changelog](../packages/immutable-proof-service/docs/changelog.md)

## immutable-proof-rest-client

This package provides client-side access to immutable proof endpoints, including create, get, and verify operations. It gives external consumers a consistent integration surface for remote proof workflows without duplicating API request code.

- [README](../packages/immutable-proof-rest-client/README.md)
- [Examples](../packages/immutable-proof-rest-client/docs/examples.md)
- [Changelog](../packages/immutable-proof-rest-client/docs/changelog.md)
