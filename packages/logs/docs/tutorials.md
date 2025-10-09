# Tutorials and examples

This document provides longer examples and patterns built around the library's current capabilities.

1. Basic async logging pattern

```ts
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({ service: 'payments', environment: 'production' })

async function processPayment() {
	try {
		await logger.info('Processing payment', { amount: 100, currency: 'USD' })
		// ... do work
		await logger.info('Payment processed', { success: true })
	} catch (err) {
		await logger.error('Payment failed', { error: String(err) })
	}
}

processPayment()
```

2. Multi-transport configuration (console + OTLP + file + redis)

The `StructuredLogger` supports multiple transports. Provide the transport config keys (console, file, otlp, redis) when constructing the logger.

```ts
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
	console: { enabled: true, format: 'json', colorize: false },
	file: { enabled: true, filename: '/var/log/my-service/app.log' },
	otlp: { enabled: true, endpoint: process.env.OTLP_ENDPOINT },
	redis: { enabled: true, host: 'redis', port: 6379, listName: 'my-logs' },
})

await logger.info('Application ready')
```

Notes:

- For OTLP you must provide a valid URL in `otlp.endpoint` (the `LoggingConfigSchema` will validate it).
- The file transport will create directories and files as needed (permission to write to the directory is required).

3. File rotation behaviour

The `FileTransport` implements size and time based rotation. Configure the `file` block in the logger config to enable rotation:

```ts
const logger = new StructuredLogger({
	service: 'worker',
	environment: 'production',
	file: {
		enabled: true,
		filename: '/var/log/worker/worker.log',
		maxSize: 10 * 1024 * 1024, // rotate after 10MB
		rotateDaily: true,
		rotationInterval: 'daily',
		compress: true,
		retentionDays: 14,
	},
})
```

After rotation the transport will rename the previous file using an ISO timestamp and optional counter, then compress it if `compress: true`.

4. Redis transport patterns

The `RedisTransport` supports multiple delivery mechanisms: lists (default), streams and pub/sub. The implementation provides batching, retry and circuit breaker behaviour. Typical configuration:

```ts
const logger = new StructuredLogger({
	service: 'ingest',
	environment: 'production',
	redis: {
		enabled: true,
		host: 'redis.local',
		port: 6379,
		keyPrefix: 'logs:',
		listName: 'ingest-logs',
		maxRetries: 3,
	},
})

await logger.info('Received event', { eventId: 'evt-1' })
```

Troubleshooting Redis: see `troubleshooting.md` for common connection and authentication issues. The redis transport exposes health and connection info via methods on the transport instance (used internally by the processor) — use transport-level logs and `getConnectionInfo()` during debugging.

5. Correlation and request tracking

Use `setRequestId` and `setCorrelationId` to set correlation fields on the logger's context. Child loggers can be created with `withContext` for request-scoped metadata.

```ts
logger.setRequestId('req-123')
logger.setCorrelationId('corr-456')

const requestLogger = logger.withContext({ module: 'auth' })
await requestLogger.info('Login attempt', { user: 'user-123' })
```

6. Graceful shutdown

Always call `flush()` and `close()` during application shutdown to ensure all pending logs are delivered:

```ts
process.on('SIGTERM', async () => {
	await logger.flush()
	await logger.close()
	process.exit(0)
})
```

7. Advanced: injecting transports for tests

The `StructuredLogger` constructor accepts an injected `transports` array for tests or for sharing transport instances between loggers. This is helpful to ensure tests write to the same `FileTransport` instance or to mock transports.

```ts
import { FileTransport } from '@repo/logs/dist/transports/file-transport.js'

const fileTransport = new FileTransport({ filename: '/tmp/test.log', enabled: true })
const logger = new StructuredLogger({
	service: 'test',
	environment: 'test',
	transports: [fileTransport],
})
```

8. Where the code lives

- Main logger: `src/core/structured-logger.ts`
- Config schema and validator: `src/types/config.ts`
- Console formatter: `src/utils/console-formatter.ts`
- File/Redis transports: `src/transports/*`
