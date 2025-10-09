# @repo/logs

Structured, multi-transport logging library for the Smart Logs monorepo.

This README consolidates architecture notes, quick-start examples, transport configuration, migration guidance and links to the more detailed guides in the `docs/` folder.

The library focuses on:

- Strong TypeScript types and runtime configuration validation (Zod schemas).
- Structured log entries (JSON-friendly) with correlation/request tracking.
- Asynchronous, non-blocking logging APIs (all public logging methods return Promises).
- Multiple, composable transports (Console, File, OTLP, Redis) with batching, retries and circuit breakers.
- Production-ready features: file rotation, graceful shutdown, backpressure, and health checks.

## Contents

- `src/` — implementation (types, core, transports, utils)
- `docs/` — user and developer documentation (getting started, tutorials, troubleshooting, FAQ, TODOs)
- `examples/` — runnable examples (OTLP + Redis docker compose and a Node script)
- `MIGRATION.md` — full migration guide from the legacy logger

## Quick start

Install (monorepo: package is available in workspace)

```bash
npm install @repo/logs
```

Minimal example

```ts
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'development',
})

await logger.info('Application starting', { version: '1.0.0' })
await logger.flush()
await logger.close()
```

Notes:

- Always `await` public logging calls or call `flush()`/`close()` during shutdown to ensure delivery.
- Use `ConfigValidator` (Zod schemas) for runtime-validated configuration: see `src/types/config.ts`.

## Key concepts and components

### StructuredLogger

Primary entry point. Exposes async methods:

- `debug`, `info`, `warn`, `error`, `fatal` — all return Promise<void>
- `setRequestId`, `setCorrelationId`, `withContext` — context / correlation helpers
- `flush`, `close` — lifecycle methods for graceful shutdown

Implementation lives in `src/core/structured-logger.ts`.

### Transports

- ConsoleTransport — pretty or JSON output (development vs production)
- FileTransport — file output with size/time rotation, compression and retention
- OTLPTransport — export logs to OTLP endpoints (collector/provider)
- RedisTransport — push logs to Redis (list, stream or pub/sub) with batching and retries

Transport implementations are in `src/transports/`.

### Reliability primitives (implemented)

The package includes production-grade primitives used by transports and the log processor:

- `DefaultBatchManager` — batching with maxSize, timeout, maxConcurrency and backpressure (`src/core/batch-manager.ts`).
- `DefaultRetryManager` — exponential backoff with jitter and retryable-error detection (`src/core/retry-manager.ts`).
- `DefaultCircuitBreaker` — closed/half-open/open states, failure threshold and health-check monitoring (`src/core/circuit-breaker.ts`).

These are wired into transports (Redis, OTLP) and the log processing pipeline to provide resilience under partial failures.

## Configuration

All configuration is validated using Zod schemas (`src/types/config.ts`). Key config blocks:

- `level` — global minimum log level (`debug|info|warn|error|fatal`)
- `service`, `environment`, `version` — metadata
- `console`, `file`, `otlp`, `redis` — transport-specific configuration objects
- `batch`, `retry`, `performance` — tuning primitives

Example (production multi-transport):

```ts
const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
	console: { enabled: true, format: 'json', colorize: false },
	file: { enabled: true, filename: '/var/log/my-service/app.log' },
	otlp: { enabled: true, endpoint: 'https://otlp:4318/v1/logs' },
	redis: { enabled: true, host: 'redis', port: 6379, listName: 'my-service-logs' },
	batch: { maxSize: 100, timeoutMs: 5000 },
})
```

Always validate custom configs using `ConfigValidator.validate()` before passing them to factories.

## Usage examples

See `docs/getting-started.md` and `docs/tutorials.md` for examples covering multi-transport configuration, file rotation, Redis usage, correlation, and graceful shutdown.

The `examples/` folder contains a runnable demo: OTLP collector + Redis via Docker Compose and a small Node script that sends logs to both targets.

## Migration from the legacy logger

The migration guide (`MIGRATION.md`) contains a detailed step-by-step plan. High-level notes:

- The new API is async and structured. Replace synchronous logger calls with `await logger.method()`.
- Use `ConfigMigrator` from `src/compatibility` to convert old configuration shapes.
- The package ships compatibility wrappers to ease gradual migration (see `src/compatibility`).

## Troubleshooting & diagnostics

- If file logs are not created: check `file.filename`, filesystem permissions and ensure the process can write to the target directory.
- If OTLP exports fail: validate the OTLP endpoint URL, network connectivity, and headers.
- If Redis connections fail: verify host/port, credentials and TLS options; inspect `getConnectionInfo()` on the redis transport (used internally) for diagnostics.
- For unflushed logs on shutdown: ensure you call `await logger.flush()` and `await logger.close()` in your shutdown handlers.

For more details and troubleshooting steps, see `docs/troubleshooting.md`.

## Testing and CI

- There are unit and integration tests under `src/__tests__` and `src/core/__tests__`.
- Recommended tests to add/extend: integration tests that simulate failing OTLP/Redis backends to validate retry + circuit-breaker behaviors and stress tests for batching and file rotation.

## Examples

Run the included example:

```bash
cd packages/logs/examples
docker compose up -d
node run-example.mjs
docker compose down
```

## Contributing

- Read `docs/TODOs.md` for outstanding developer-focused tasks and priorities.
- Keep public API changes backward-compatible; update `MIGRATION.md` when breaking changes are introduced.

## License

See the repository `LICENSE` file.
