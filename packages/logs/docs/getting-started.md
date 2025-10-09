# Getting started — @repo/logs

This guide shows the minimal steps to get a `StructuredLogger` instance and log messages. It targets technical users (backend engineers and SREs).

1. Install

If you are using the monorepo this package is available in the workspace. If you publish or use it as an npm package, install it normally:

    npm install @repo/logs

2. Minimal example

```ts
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'development',
})

await logger.info('Application starting', { version: '1.0.0' })
await logger.debug('Debugging info', { debug: true })

// On shutdown
await logger.flush()
await logger.close()
```

Notes:

- All public logging methods are async — always await them or ensure you call `flush()`/`close()` during shutdown.
- Default console transport is enabled in non-test environments unless explicitly disabled via config.

3. Pre-validated configuration

Use `ConfigValidator` to validate configuration objects before passing them to higher-level factories or constructing your own helpers:

```ts
import { ConfigValidator } from '@repo/logs/src/types/config.js'

const rawConfig = {
	service: 'my-service',
	environment: 'production',
	otlp: { enabled: true, endpoint: 'https://my-otlp:4318/v1/logs' },
}

const config = ConfigValidator.validate(rawConfig)

// config now has defaults applied and is runtime-validated
```

4. Development vs production transports

- For local development the default `ConsoleTransport` produces pretty output and colorization. Use `ConsoleTransport.createDevelopmentTransport()` to instantiate a dev-friendly transport.
- In production prefer JSON output and disable colorization with `ConsoleTransport.createProductionTransport()` or by setting `console.format = 'json'` in config.

5. Example: console + file + redis

```ts
import { StructuredLogger } from '@repo/logs'

const logger = new StructuredLogger({
	service: 'api',
	environment: 'production',
	file: { enabled: true, filename: '/var/log/my-service/app.log' },
	redis: { enabled: true, host: 'redis.local', port: 6379, listName: 'api-logs' },
})

await logger.info('Started')
```

6. Where to go next

- Read `tutorials.md` for multi-transport examples, file rotation and Redis usage.
- Review `troubleshooting.md` for common issues (permissions, connection errors, unhandled promise rejections).
- Check `TODOs.md` (developer-facing) for known unimplemented features and planned tasks.
