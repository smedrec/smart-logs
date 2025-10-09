# Multi-Transport Structured Logging

The StructuredLogger now supports multiple transports simultaneously, allowing you to send logs to console, files, OTLP endpoints, and Redis with a single logger instance.

## Quick Start

### Development Logger (Console Only)

```typescript
import { createDevelopmentLogger } from '@your-org/logs'

const logger = createDevelopmentLogger('my-service')
await logger.info('Hello world', { userId: '123' })
```

### Production Logger (Console + OTLP)

```typescript
import { createConsoleAndOTLPLogger } from '@your-org/logs'

const logger = createConsoleAndOTLPLogger('my-service', 'https://your-otlp-endpoint.com/v1/logs')
await logger.info('Production log', { version: '1.0.0' })
```

### Custom Multi-Transport Configuration

```typescript
import { StructuredLogger } from '@your-org/logs'

const logger = new StructuredLogger({
	service: 'my-service',
	environment: 'production',
	minLevel: 'info',

	// Console transport (JSON format for production)
	console: {
		enabled: true,
		format: 'json',
		colorize: false,
	},

	// OTLP transport for observability platforms
	otlp: {
		enabled: true,
		endpoint: 'https://otlp-endpoint.com/v1/logs',
		batchSize: 50,
		timeoutMs: 30000,
	},

	// File transport with rotation
	file: {
		enabled: true,
		filename: 'app.log',
		maxSize: 10 * 1024 * 1024, // 10MB
		maxFiles: 5,
		rotateDaily: true,
	},

	// Redis transport for log aggregation
	redis: {
		enabled: true,
		host: 'localhost',
		port: 6379,
		listName: 'my-service-logs',
	},
})
```

## Logger Factory Methods

### Development

```typescript
import { LoggerFactory } from '@your-org/logs'

const logger = LoggerFactory.createDevelopmentLogger('my-service', {
	level: 'debug',
	enablePerformance: true,
})
```

### Production

```typescript
const logger = LoggerFactory.createProductionLogger('my-service', {
	otlpEndpoint: 'https://otlp-endpoint.com/v1/logs',
	fileConfig: {
		filename: 'production.log',
		maxSize: 50 * 1024 * 1024, // 50MB
	},
})
```

## Transport Configuration

### Console Transport

```typescript
console: {
  enabled: true,
  format: 'pretty' | 'json',
  colorize: true,
  level: 'debug' // Optional: override global level
}
```

### OTLP Transport

```typescript
otlp: {
  enabled: true,
  endpoint: 'https://your-endpoint.com/v1/logs',
  headers: { 'Authorization': 'Bearer token' },
  batchSize: 100,
  batchTimeoutMs: 5000,
  timeoutMs: 30000
}
```

### File Transport

```typescript
file: {
  enabled: true,
  filename: 'app.log',
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  rotateDaily: true,
  compress: true,
  retentionDays: 30
}
```

### Redis Transport

```typescript
redis: {
  enabled: true,
  host: 'localhost',
  port: 6379,
  password: 'optional-password',
  database: 0,
  listName: 'application-logs',
  keyPrefix: 'logs:'
}
```

## Usage Examples

### Basic Logging

```typescript
await logger.info('User logged in', { userId: '123', ip: '192.168.1.1' })
await logger.warn('Rate limit approaching', { current: 95, limit: 100 })
await logger.error('Database connection failed', { error: 'Connection timeout' })
```

### Correlation Tracking

```typescript
logger.setRequestId('req-abc123')
logger.setCorrelationId('corr-xyz789')
await logger.info('Processing request')

// Create child logger with additional context
const childLogger = logger.withContext({ module: 'payment' })
await childLogger.info('Payment processed', { amount: 100 })
```

### Health Monitoring

```typescript
// Check transport health
const health = logger.getTransportHealth()
console.log(
	'Healthy transports:',
	health.filter((h) => h.healthy)
)

// Check if any transports are working
if (!logger.hasHealthyTransports()) {
	console.error('All logging transports are down!')
}
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
	await logger.flush() // Wait for pending logs
	await logger.close() // Close all transports
	process.exit(0)
})
```

## Error Handling

The logger handles transport failures gracefully:

- If one transport fails, others continue working
- Failed transports are automatically retried
- Emergency console logging is used if all transports fail
- Transport health is monitored and reported

## Performance Features

- Concurrent transport processing for better performance
- Automatic batching for OTLP and Redis transports
- Memory-aware queuing to prevent memory exhaustion
- Configurable sampling for performance metrics

## Migration from Legacy Logger

If you were using the deprecated `logging.ts` file:

```typescript
// Old way (deprecated)
import { StructuredLogger } from '@your-org/logs/logging'

// New way
import { StructuredLogger } from '@your-org/logs'
// or
import { createDevelopmentLogger } from '@your-org/logs'
```

The new StructuredLogger provides the same interface but with proper multi-transport support and better error handling.
