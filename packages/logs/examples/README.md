# Examples — @repo/logs

This folder contains runnable examples demonstrating sending logs to an OTLP collector and to Redis.

What's included

- `docker-compose.yml` — brings up a minimal OpenTelemetry Collector (OTLP HTTP receiver) and Redis.
- `otel-config.yaml` — collector config: receives OTLP HTTP logs and writes them to the collector's console exporter.
- `run-example.mjs` — small Node ESM script that constructs a `StructuredLogger` and sends a few log entries to OTLP and Redis.

How to run (local machine)

1. Start the OTLP collector and Redis (from this `examples` directory):

```bash
cd packages/logs/examples
docker compose up -d
```

The OTLP HTTP port will be available on `http://localhost:4318` and Redis on `localhost:6379`.

2. Run the Node example

You can run the example using Node from the monorepo root (ensure dependencies are installed and that Node resolves the workspace package imports):

```bash
# from repo root
node packages/logs/examples/run-example.mjs
```

What to expect

- The OTLP collector will print received logs to its console (check docker logs for the `otel-collector` container).
- The example also writes logs into Redis list `example-logs` on the Redis container.

Teardown

```bash
cd packages/logs/examples
docker compose down
```

Notes

- The example imports the package source directly (`../../src/index.js`) so it works when you develop the package inside the monorepo. If you publish the package, update imports accordingly.
- If your environment requires proxies or different network settings, adjust `otel` and `redis` configuration in `run-example.mjs`.
