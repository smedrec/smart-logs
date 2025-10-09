# @repo/logs — Documentation

This directory contains the user-facing and developer documentation for the `@repo/logs` package.

Contents:

- `getting-started.md` — quick start and minimal example to get a StructuredLogger running.
- `tutorials.md` — deeper tutorials and common usage patterns (multi-transport, file rotation, Redis, OTLP, graceful shutdown).
- `troubleshooting.md` — common problems and how to diagnose/fix them.
- `FAQ.md` — Frequently asked questions about behaviour, configuration and migration.
- `TODOs.md` — a developer-facing list of placeholder/remaining work items discovered in the codebase.

This package implements a structured, multi-transport logging system with TypeScript types and runtime configuration validation. The current public API (as implemented) exposes:

- `StructuredLogger` — main logger implementation (async methods: `debug`, `info`, `warn`, `error`, `fatal`, `flush`, `close`, `withContext`, `setRequestId`, `setCorrelationId`).
- `ConfigValidator` — zod-based validation utilities for logging configuration (see `src/types/config.ts`).
- Transport implementations: `ConsoleTransport`, `FileTransport`, `RedisTransport` (OTLP transport implementation exists in the code but requires endpoint configuration).

Read the files in this directory in order. If you're migrating from the legacy logger, see `MIGRATION.md` in the package root.
