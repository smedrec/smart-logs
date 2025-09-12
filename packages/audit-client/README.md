# @smedrec/audit-client

Enhanced TypeScript SDK for Smart Logs Audit API with comprehensive features including retry mechanisms, caching, authentication, and type safety.

## Features

- 🔒 **Type Safety**: Full TypeScript support with strict type checking
- 🔄 **Retry Logic**: Exponential backoff with configurable retry policies
- 💾 **Intelligent Caching**: Multiple storage backends with TTL management
- 🔐 **Authentication**: Support for API keys, session tokens, and custom auth
- 📊 **Request Batching**: Automatic request batching and deduplication
- 🚨 **Error Handling**: Comprehensive error management with correlation IDs
- 📈 **Performance**: Request compression, streaming, and performance monitoring
- 🔍 **Observability**: Structured logging and request/response inspection
- 🔌 **Plugin Architecture**: Extend functionality with custom middleware, storage, and auth plugins.

## Plugin Architecture

The audit client now features a comprehensive plugin architecture, allowing developers to extend and customize its functionality. This system supports:

- **Middleware Plugins**: For processing requests and responses.
- **Storage Plugins**: For implementing custom caching or storage backends.
- **Authentication Plugins**: For integrating custom authentication methods.

The client includes a variety of built-in plugins for common use cases like request logging, correlation IDs, rate limiting, Redis/IndexedDB caching, and JWT/OAuth2 authentication.

For detailed information on creating and using plugins, see the [Plugin Architecture Documentation](./docs/PLUGIN_ARCHITECTURE.md).

## Installation

```bash
pnpm add @smedrec/audit-client
```

## Quick Start

```typescript
import { AuditClient } from '@smedrec/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})

// Create an audit event
const event = await client.events.create({
	action: 'user.login',
	principalId: 'user-123',
	organizationId: 'org-456',
	status: 'success',
})
```

## Architecture

The library is built with a modular architecture:

- **Core Layer**: Main client, configuration, and base resource classes
- **Service Layer**: Domain-specific services (events, compliance, metrics, etc.)
- **Infrastructure Layer**: Cross-cutting concerns (auth, caching, retry, etc.)
- **Utils Layer**: Utility functions, validators, and transformers

## Project Structure

```
packages/audit-client/
├── dist/                     # Compiled output (CJS/ESM + type definitions)
├── src/                      # TypeScript source files
│   ├── core/                 # Core layer (client, config, base resource)
│   ├── services/             # Service layer (events, compliance, etc.)
│   ├── infrastructure/       # Infrastructure layer (auth, cache, retry, etc.)
│   ├── utils/                # Utility functions and helpers
│   ├── types.ts              # Main type definitions
│   └── index.ts              # Main entry point
├── examples/                 # Usage examples
├── docs/                     # Documentation
├── package.json              # Package configuration with dual exports
├── tsconfig.json             # TypeScript configuration with strict settings
├── tsup.config.ts            # Build configuration for CJS/ESM output
└── README.md                 # This file
```

## Configuration

The client supports comprehensive configuration options:

```typescript
import { AuditClient } from '@smedrec/audit-client'

import type { AuditClientConfig } from '@smedrec/audit-client'

const config: AuditClientConfig = {
	baseUrl: 'https://api.smartlogs.com',

	// Authentication
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
		autoRefresh: true,
	},

	// Retry configuration
	retry: {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 100,
		maxDelayMs: 5000,
		backoffMultiplier: 2,
	},

	// Caching
	cache: {
		enabled: true,
		defaultTtlMs: 300000, // 5 minutes
		storage: 'memory',
	},

	// Logging
	logging: {
		enabled: true,
		level: 'info',
		maskSensitiveData: true,
	},
}

const client = new AuditClient(config)
```

## Services

The client provides several specialized services:

### Events Service

```typescript
// Create audit events
await client.events.create(eventData, options)
await client.events.bulkCreate([event1, event2])

// Query events
const events = await client.events.query({
	filter: { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
})

// Verify event integrity
const verification = await client.events.verify(eventId)
```

### Compliance Service

```typescript
// Generate compliance reports
const hipaaReport = await client.compliance.generateHipaaReport(criteria)
const gdprReport = await client.compliance.generateGdprReport(criteria)

// GDPR data export
const exportResult = await client.compliance.exportGdprData(params)
```

### Metrics Service

```typescript
// Get system metrics
const systemMetrics = await client.metrics.getSystemMetrics()
const auditMetrics = await client.metrics.getAuditMetrics(params)

// Manage alerts
const alerts = await client.metrics.getAlerts()
await client.metrics.acknowledgeAlert(alertId)
```

## Development

### Building

```bash
pnpm build          # Build for production
pnpm build:watch    # Build in watch mode
pnpm dev           # Development mode with watch
```

### Testing

```bash
pnpm test              # Run tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Run tests with coverage
```

### Type Checking

```bash
pnpm check:types    # Type check
pnpm check:lint     # Lint check
```

## Documentation

- [Getting Started Guide](./docs/GETTING_STARTED.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Tutorials](./docs/TUTORIALS.md)
- [Code Examples](./docs/CODE_EXAMPLES.md)
- [Troubleshooting & FAQ](./docs/TROUBLESHOOTING_AND_FAQ.md)
- [Framework Integration](./docs/FRAMEWORK_INTEGRATION.md)
- [Plugin Architecture](./docs/PLUGIN_ARCHITECTURE.md)

## License

MIT License - see LICENSE file for details.
