# TODOs / Unimplemented features

This file enumerates known placeholders, missing implementations and tasks that were found while analysing the `@repo/logs` package. It is intended for maintainers and implementers.

Summary of current status and remaining items (updated):

IMPORTANT: The core resilience primitives (BatchManager, RetryManager and CircuitBreaker) are implemented under `src/core` — this file reflects that current state and updates remaining tasks accordingly.

1. Batch manager (implemented)

- Implementation: `src/core/batch-manager.ts` — class `DefaultBatchManager`
- Status: Implemented. Provides queuing, scheduled flushing, concurrency limits, backpressure behavior and graceful shutdown integration.
- Notes: Review and add more unit tests covering high-throughput, backpressure and error propagation from `processor` callbacks.

2. Retry manager (implemented)

- Implementation: `src/core/retry-manager.ts` — class `DefaultRetryManager`
- Status: Implemented. Provides exponential backoff with jitter, retryable error detection, optional circuit breaker integration and a convenience `createConfig()`.
- Notes: Add tests for non-retryable vs retryable error patterns and behaviour when circuit breaker prevents execution.

3. Circuit breaker (implemented)

- Implementation: `src/core/circuit-breaker.ts` — class `DefaultCircuitBreaker`
- Status: Implemented. Implements closed / open / half-open states, failure threshold, reset timeout and optional health-check monitoring.
- Notes: Add tests to verify state transitions, metrics and interactions with `DefaultRetryManager` under simulated failures.

4. Transport integrations

- Files: `src/transports/redis-transport.ts`, `src/transports/otlp-transport.ts`, and others already consume batch/retry/circuit features.
- Status: Largely wired; verify integration tests that simulate downstream failures and ensure the circuit breaker and retry manager behave as expected.

5. Serializer and performance monitor

- Files: `src/utils/serializer.ts`, `src/utils/performance-monitor.ts`, `src/utils/transport-retry-policies.ts`
- Status: Present; recommend additional tests for edge cases (circular references, very large fields, nested objects) and a documented maximum payload size for transports that send serialized JSON.

6. Documentation and examples

- Status: `docs/` added (this folder); package has `MIGRATION.md`, `README-NEW-STRUCTURE.md`, and `README-MULTI-TRANSPORT.md` as reference material.
- Suggested work: consolidate longer guides into `docs/`, add runnable examples under `examples/` (OTLP + Redis compose) and create a short `examples/README.md` linking to them.

7. Tests and CI

- Status: Some tests exist under `src/__tests__` and `src/core/__tests__`.
- Suggested work: Add comprehensive unit and integration tests for BatchManager, RetryManager and CircuitBreaker if missing, and add stress/performance tests for batching and file/redis transports.

8. API stability and typings

- Status: `src/index.ts` exports public APIs; check for any internal types accidentally exported and ensure the package `types` entry points to the built `dist` types.

9. Next priorities (recommended)

- High: Add integration tests that simulate failing OTLP and Redis backends to verify retry + circuit breaker behaviour end-to-end.
- Medium: Add serializer limits and tests; add examples + README for `examples/` folder.
- Low: Add advanced production features (sampling, more performance metrics, optional telemetry of logger internals).

Notes

- The `docs/TODOs.md` file previously listed the core primitives as placeholders — this has been updated to reflect the implemented classes under `src/core`.
- When implementing tests or changing public behaviour, please update this TODO file with PR references and completion dates.
