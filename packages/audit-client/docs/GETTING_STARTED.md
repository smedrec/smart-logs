# Getting Started with the Smart Logs Audit Client

This guide will walk you through the process of installing, configuring, and making your first API call with the `@smedrec/audit-client`.

## 1. Installation

First, install the package using your preferred package manager.

```bash
# With pnpm
pnpm add @smedrec/audit-client

# With npm
npm install @smedrec/audit-client

# With yarn
yarn add @smedrec/audit-client
```

## 2. Initializing the Client

The `AuditClient` is the main entry point of the library. To get started, you need to import it and create a new instance with a basic configuration.

The only required options are `baseUrl` and `authentication`.

```typescript
import { AuditClient } from '@smedrec/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'YOUR_API_KEY', // Replace with your actual API key
	},
})

console.log('AuditClient initialized!')
```

### Authentication

The client supports several authentication methods:

- **API Key**: `type: 'apiKey'` (recommended for server-to-server communication)
- **Bearer Token**: `type: 'bearer'` (for OAuth 2.0 flows)
- **Session Token**: `type: 'session'` (for user-based sessions)

Choose the one that best fits your application's security model.

## 3. Creating Your First Audit Event

Once the client is initialized, you can use its services to interact with the Smart Logs API. The most common task is creating an audit event using the `events` service.

Here's how to log a `user.login` action:

```typescript
import { AuditClient } from '@smedrec/audit-client'

async function logUserLogin() {
	const client = new AuditClient({
		baseUrl: 'https://api.smartlogs.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'YOUR_API_KEY',
		},
	})

	try {
		const event = await client.events.create(
			{
				action: 'user.login',
				principalId: 'user-123',
				organizationId: 'org-456',
				status: 'success',
				outcomeDescription: 'User successfully logged in via password.',
				targetResourceType: 'User',
				targetResourceId: 'user-123',
				sessionContext: {
					ipAddress: '198.51.100.10',
					userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
				},
				details: {
					mfa_used: true,
				},
			},
			{ generateHash: true, generateSignature: true }
		)

		console.log('Successfully created audit event:', event.id)
		return event
	} catch (error) {
		console.error('Failed to create audit event:', error)
	} finally {
		// It's good practice to clean up the client when done
		await client.destroy()
	}
}

logUserLogin()
```

## 4. Querying Events

After creating events, you'll want to retrieve them. The `events` service provides a powerful `query` method for this purpose.

This example fetches all successful `user.login` events from the last 7 days:

```typescript
import { AuditClient } from '@smedrec/audit-client'

async function queryLoginEvents() {
	const client = new AuditClient({
		baseUrl: 'https://api.smartlogs.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'YOUR_API_KEY',
		},
	})

	try {
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

		const results = await client.events.query({
			filter: {
				actions: ['user.login'],
				statuses: ['success'],
				dateRange: {
					startDate: sevenDaysAgo,
				},
			},
			pagination: {
				limit: 100, // Get up to 100 events
			},
			sort: {
				field: 'timestamp',
				direction: 'desc', // Get the most recent events first
			},
		})

		console.log(`Found ${results.events.length} login events.`)
		results.events.forEach((event) => {
			console.log(
				`- Event ID: ${event.id}, Principal: ${event.principalId}, Timestamp: ${event.timestamp}`
			)
		})

		return results
	} catch (error) {
		console.error('Failed to query events:', error)
	} finally {
		await client.destroy()
	}
}

queryLoginEvents()
```

## 5. Advanced Configuration

The client is highly configurable. You can enable features like automatic retries, caching, detailed logging, and performance monitoring to enhance reliability and performance.

```typescript
import { AuditClient } from '@smedrec/audit-client'

import type { AuditClientConfig } from '@smedrec/audit-client'

const config: AuditClientConfig = {
	baseUrl: 'https://api.smartlogs.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'YOUR_API_KEY',
	},
	// Enable automatic retries on network errors or server issues
	retry: {
		enabled: true,
		maxAttempts: 3,
		circuitBreaker: {
			enabled: true,
			failureThreshold: 5,
			resetTimeout: 60000, // 1 minute
		},
	},
	// Enable in-memory caching for GET requests to reduce latency
	cache: {
		enabled: true,
		defaultTtlMs: 60000, // Cache responses for 1 minute
		maxSize: 100, // Maximum number of cached entries
	},
	// Configure logging for better observability
	logging: {
		enabled: true,
		level: 'info', // Can be 'debug', 'info', 'warn', or 'error'
	},
	// Enable performance monitoring
	performance: {
		enabled: true,
		budget: {
			maxRequestTime: 1000, // 1 second
			maxMemoryUsage: 50 * 1024 * 1024, // 50MB
		},
	},
}

const client = new AuditClient(config)
```

### Performance Monitoring

The client includes built-in performance monitoring to track request times, memory usage, and cache efficiency:

```typescript
// Get performance metrics
const metrics = client.getPerformanceMetrics()
console.log('Average request time:', metrics.avgRequestTime, 'ms')
console.log('Cache hit rate:', metrics.cacheHitRate, '%')
console.log('Memory usage:', metrics.memoryUsage, 'bytes')

// Check for performance budget violations
const violations = client.checkPerformanceBudget()
if (violations.length > 0) {
	console.warn('Performance budget violations:', violations)
}
```

### Lazy Loading Plugins

The client supports lazy loading of plugins to reduce initial bundle size. Plugins are automatically loaded when needed:

```typescript
// Plugins are loaded on-demand
const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	plugins: {
		lazyLoad: true, // Enable lazy loading (default: true)
	},
})

// The request logging plugin will be loaded automatically when first used
await client.events.create({ action: 'user.login' /* ... */ })
```

## Next Steps

You've now learned the basics of using the `@smedrec/audit-client`. From here, you can explore more advanced topics:

- **API Reference**: Dive deep into all available services and methods.
- **Code Examples**: See practical examples for common use cases.
- **Tutorials**: Follow step-by-step guides for specific tasks.
- **Framework Integration**: Learn how to integrate the client with frameworks like Express, Next.js, and more.
