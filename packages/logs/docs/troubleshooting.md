# Troubleshooting

This page lists common issues, how to detect them and recommended fixes.

1. Logs not appearing on disk (FileTransport)

Symptoms:

- No file is created at the configured path
- Errors like `EACCES` or `ENOENT` appear

Checks & fixes:

- Verify the process has write permission to the directory. Fix file permissions or choose a directory that your process can write to.
- Ensure `file.filename` was provided when enabling file transport. `FileTransport` constructor throws if `filename` is missing.
- Check that the directory exists or let the transport create it (transport tries to create directories but may fail if permissions are incorrect).
- In tests, set `NODE_ENV=test` to enable eager test-time file creation behaviour.

2. OTLP transport not sending logs

Symptoms:

- OTLP endpoint reported as invalid by `ConfigValidator`
- Timeouts or connection errors to OTLP

Checks & fixes:

- Validate the OTLP URL: it must be a valid URL and reachable from your environment.
- Ensure network egress and TLS settings are correct when connecting to the OTLP endpoint.
- Check headers and authentication; `OTLPConfig` accepts headers which will be sent with requests.
- Increase `timeoutMs` if you observe frequent timeouts in slow networks.

3. Redis transport connection failures

Symptoms:

- RedisTransport logs `Connection error` / `Failed to initialize Redis connection`
- Circuit breaker trips and `Circuit breaker is open` errors

Checks & fixes:

- Verify host/port and credentials. The `RedisConfig` accepts TLS options and cluster nodes.
- For authentication issues ensure you supplied the correct `password` and the server's ACLs permit the operations used (LPUSH, XADD, PUBLISH).
- If the transport keeps reconnecting, the library schedules reconnects with exponential backoff — inspect logs and `getConnectionInfo()` to understand attempts and last error.

4. Unhandled promise rejections / missing logs during shutdown

Symptoms:

- Application exits before logs are flushed
- Unhandled promise rejection warnings related to logger

Checks & fixes:

- All public logging methods are async — always await them or call `await logger.flush()` before exiting.
- Add a graceful shutdown handler that calls `await logger.flush()` and `await logger.close()` on SIGTERM/SIGINT and on uncaught exceptions.

5. CPU / memory pressure from high-throughput logging

Symptoms:

- Increased memory usage or GC pauses during bursts

Checks & fixes:

- Use batching and configure `batch` in your config (see `BatchConfigSchema`).
- For Redis and OTLP transports tune batch sizes and flush timeouts.
- Use sampling in `performance` section to limit instrumentation overhead.

6. How to collect more diagnostic info

- Enable debug mode in config (`enableDebugMode: true`) to get more verbose logging from transports and internal managers.
- Inspect transport health via `logger.getTransportHealth()` and per-transport APIs (RedisTransport exposes `getConnectionInfo()` / `getLastError()`).
- Use `ConfigValidator.validate()` to get a clear error message for invalid configs.
