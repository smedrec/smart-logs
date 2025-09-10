# Code Examples

This file provides practical code examples for common use cases of the `@smart-logs/audit-client`.

## 1. Client Initialization

### Basic Initialization

Minimal configuration to get the client running.

```typescript
import { AuditClient } from '@smart-logs/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
	},
})
```

### Advanced Configuration

A more complex setup with retries, caching, and logging enabled.

```typescript
import { AuditClient } from '@smart-logs/audit-client'

import type { AuditClientConfig } from '@smart-logs/audit-client'

const config: AuditClientConfig = {
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'bearer',
		bearerToken: 'your-bearer-token',
		autoRefresh: true,
		refreshEndpoint: '/auth/refresh',
	},
	retry: {
		enabled: true,
		maxAttempts: 5,
	},
	cache: {
		enabled: true,
		defaultTtlMs: 600000, // 10 minutes
	},
	logging: {
		enabled: true,
		level: 'info',
	},
	customHeaders: {
		'X-Client-Version': '1.0.0',
	},
}

const client = new AuditClient(config)
```

### Environment-Based Configuration

Use static methods to create clients for different environments.

```typescript
import { AuditClient } from '@smart-logs/audit-client'

// Development client with debug logging
const devClient = AuditClient.createForEnvironment('development', 'https://dev-api.example.com', {
	type: 'apiKey',
	apiKey: 'dev-key',
})

// Production client with performance optimizations
const prodClient = AuditClient.createForEnvironment(
	'production',
	'https://api.example.com',
	{ type: 'bearer', bearerToken: 'prod-token' },
	{
		cache: { enabled: true },
		performance: { maxConcurrentRequests: 50 },
	}
)
```

## 2. Working with Audit Events

### Create a Detailed Event

Creating a rich audit event with full context.

```typescript
async function createDetailedEvent(client: AuditClient) {
	const eventData = {
		action: 'document.delete',
		targetResourceType: 'Document',
		targetResourceId: 'doc-987',
		principalId: 'user-admin',
		organizationId: 'org-456',
		status: 'success',
		dataClassification: 'CONFIDENTIAL',
		outcomeDescription: 'Admin user permanently deleted a sensitive document.',
		sessionContext: {
			sessionId: 'sess-xyz456',
			ipAddress: '203.0.113.50',
			userAgent: 'AuditClient/1.0',
		},
		details: {
			reason: 'Cleanup of old records',
			deletion_type: 'permanent',
		},
	}

	const createdEvent = await client.events.create(eventData, {
		priority: 1,
		delay: 1000,
		durabilityGuarantees: true,
		generateHash: true,
		generateSignature: true,
		correlationId: 'my-correlation-id',
		eventVersion: '1.0',
		skipValidation: false,
		validationConfig: {
			maxStringLength: 10000,
			allowedDataClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'],
			requiredFields: ['timestamp', 'action', 'status'],
			maxCustomFieldDepth: 3,
			allowedEventVersions: ['1.0', '1.1', '2.0'],
		},
	})
	console.log('Created event:', createdEvent.id)
}
```

### Bulk Event Creation

Efficiently create multiple events in a single API call.

```typescript
async function createBulkEvents(client: AuditClient) {
	const events = [
		{
			action: 'policy.update',
			principalId: 'user-admin',
			organizationId: 'org-456',
			status: 'success',
		},
		{
			action: 'user.invite',
			principalId: 'user-admin',
			organizationId: 'org-456',
			status: 'success',
			details: { invited_user_id: 'user-new' },
		},
	]

	const result = await client.events.bulkCreate(events)
	console.log(`Bulk create: ${result.successful}/${result.total} succeeded.`)
	if (result.failed > 0) {
		console.warn(
			'Failed events:',
			result.results.filter((r) => !r.success)
		)
	}
}
```

### Advanced Event Query

Find specific events using a combination of filters.

```typescript
async function querySpecificEvents(client: AuditClient) {
	const results = await client.events.query({
		filter: {
			dateRange: {
				startDate: '2023-01-01T00:00:00Z',
				endDate: '2023-12-31T23:59:59Z',
			},
			principalIds: ['user-admin', 'system-process'],
			actions: ['document.delete', 'policy.update'],
			statuses: ['success'],
			verifiedOnly: true, // Only return events that have passed integrity checks
		},
		pagination: {
			limit: 50,
		},
		sort: {
			field: 'timestamp',
			direction: 'asc',
		},
	})

	console.log(`Found ${results.events.length} matching events.`)
}
```

## 3. Interceptors

Interceptors allow you to modify requests and responses globally.

### Logging Request and Response

```typescript
import { AuditClient } from '@smart-logs/audit-client'

const client = new AuditClient({
	/* ...config */
})

// Log outgoing requests
client.addRequestInterceptor((options) => {
	console.log(`--> ${options.method} ${options.url}`)
	return options
})

// Log incoming responses
client.addResponseInterceptor((response) => {
	console.log(`<-- ${response.status} ${response.url}`)
	return response
})
```

### Adding a Custom Header to All Requests

```typescript
import { AuditClient } from '@smart-logs/audit-client'

const client = new AuditClient({
	/* ...config */
})

client.addRequestInterceptor((options) => {
	return {
		...options,
		headers: {
			...options.headers,
			'X-Request-ID': crypto.randomUUID(), // Add a unique ID to each request
		},
	}
})
```

## 4. Error Handling

Example of handling specific errors thrown by the client.

```typescript
import { AuditClient, RetryExhaustedError, ValidationError } from '@smart-logs/audit-client'

const client = new AuditClient({
	/* ...config */
})

async function resilientEventCreation() {
	try {
		await client.events.create({ action: 'test' }) // Missing required fields
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error('Validation failed:', error.errors)
		} else if (error instanceof RetryExhaustedError) {
			console.error('Request failed after multiple retries:', error.cause)
		} else {
			console.error('An unexpected error occurred:', error)
		}
	}
}
```
