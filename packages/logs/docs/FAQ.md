# FAQ — @repo/logs

Q: Are logging methods synchronous or asynchronous?

A: All public logging methods (`debug`, `info`, `warn`, `error`, `fatal`) are asynchronous and return a Promise. This enables transports to perform I/O without blocking the event loop. Always await them or call `flush()` during shutdown.

Q: How do I guarantee delivery of logs before process exit?

A: Call `await logger.flush()` to wait for pending operations and then `await logger.close()` to close transports. Add these calls to your SIGTERM/SIGINT handlers.

Q: Does the package mask sensitive fields automatically?

A: The console formatter includes built-in sensitive-field patterns and masking options. You can customize `sensitiveFields` or masking options via the `ConsoleFormatter` when creating a `ConsoleTransport` manually.

Q: Is OTLP supported?

A: Yes — there is an OTLP transport implementation and configuration schema. Provide a valid `otlp.endpoint` to enable it. The OTLP exporter uses batching and timeout settings from the configuration.

Q: How do I test/inject transports in unit tests?

A: Pass an array of transport instances to the `transports` constructor option on `StructuredLogger`. The logger will add those transports directly instead of constructing new ones. This is useful to share a `FileTransport` in tests or inject a mock transport.

Q: What happens if a transport fails?

A: Failures are handled per-transport: the `LogProcessor` will attempt to keep other transports working. Redis and OTLP transports include retry/circuit breaker patterns. If all transports fail, the processor can fall back to an emergency console log if configured.

Q: Where are configuration defaults defined?

A: Defaults and validation live in `src/types/config.ts` using Zod schemas. Use `ConfigValidator.validate()` to parse and apply defaults with runtime validation.

Q: Are there any breaking changes from the legacy logger?

A: Yes — the new logger is async and uses structured log entries. See `MIGRATION.md` for a thorough migration guide and compatibility helpers.
