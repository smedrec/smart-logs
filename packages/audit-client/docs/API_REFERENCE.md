# API Reference

This document provides a detailed reference for the `@smart-logs/audit-client` library, including the main `AuditClient`, its services, configuration options, and type definitions.

## `AuditClient`

The `AuditClient` class is the central component of the library.

### `new AuditClient(config)`

Creates a new client instance.

- `config`: `PartialAuditClientConfig` - A configuration object. See [Configuration](#configuration) for details.

**Example**

```typescript
import { AuditClient } from '@smart-logs/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_KEY' },
})
```

### Services

The client provides access to several services:

- `client.events`: [`EventsService`](#eventsservice)
- `client.compliance`: [`ComplianceService`](#complianceservice)
- `client.metrics`: [`MetricsService`](#metricsservice)
- `client.health`: [`HealthService`](#healthservice)
- `client.presets`: [`PresetsService`](#presetsservice)
- `client.scheduledReports`: [`ScheduledReportsService`](#scheduledreportsservice)

### Methods

- `getConfig()`: Returns the current `AuditClientConfig`.
- `updateConfig(updates)`: Updates the client's configuration.
- `addRequestInterceptor(interceptor)`: Adds a global request interceptor.
- `addResponseInterceptor(interceptor)`: Adds a global response interceptor.
- `clearInterceptors()`: Removes all interceptors.
- `getStats()`: Returns `ClientStats` with performance and usage metrics.
- `healthCheck()`: Performs a health check on all services.
- `destroy()`: Cleans up resources and closes connections.

---

## Services

### `EventsService`

Used for creating, querying, and managing audit events.

- `create(event)`: Creates a single audit event. Returns `Promise<AuditEvent>`.
- `bulkCreate(events)`: Creates multiple events. Returns `Promise<BulkCreateResult>`.
- `query(params)`: Queries events with filters, pagination, and sorting. Returns `Promise<PaginatedAuditEvents>`.
- `getById(id)`: Retrieves a single event by its ID. Returns `Promise<AuditEvent | null>`.
- `verify(id)`: Verifies the cryptographic integrity of an event. Returns `Promise<IntegrityVerificationResult>`.
- `export(params)`: Exports a large number of events. Returns `Promise<ExportResult>`.
- `stream(params)`: Streams events in real-time. Returns `Promise<ReadableStream>`.
- `subscribe(params)`: Subscribes to real-time event notifications. Returns `EventSubscription`.

### `ComplianceService`

For generating compliance reports (e.g., HIPAA, GDPR).

- `generateHipaaReport(criteria)`: Generates a HIPAA compliance report.
- `generateGdprReport(criteria)`: Generates a GDPR compliance report.
- `exportGdprData(params)`: Exports data for a GDPR Data Subject Access Request (DSAR).

### `MetricsService`

For fetching system and audit metrics.

- `getSystemMetrics()`: Retrieves overall system metrics.
- `getAuditMetrics(params)`: Retrieves audit-specific metrics.
- `getAlerts()`: Fetches active alerts.
- `acknowledgeAlert(id)`: Acknowledges an alert.

### `HealthService`

For monitoring the health of the audit system.

- `check()`: Performs a basic health check.
- `detailedCheck()`: Gets a detailed status of all components.

### `PresetsService`

Manages audit event presets and templates.

- `list()`: Lists available presets.
- `getById(id)`: Retrieves a specific preset.
- `validate(id, event)`: Validates an event against a preset.

### `ScheduledReportsService`

Manages automated, scheduled reports.

- `list()`: Lists all scheduled reports.
- `create(report)`: Creates a new scheduled report.
- `update(id, updates)`: Updates an existing report.
- `delete(id)`: Deletes a scheduled report.
- `getHistory(id)`: Retrieves the execution history for a report.

---

## Configuration

The `AuditClientConfig` object allows for detailed configuration of the client.

```typescript
export interface AuditClientConfig {
	// Connection
	baseUrl: string
	apiVersion?: string
	timeout?: number

	// Auth
	authentication: AuthenticationConfig

	// Features
	retry?: RetryConfig
	cache?: CacheConfig
	batching?: BatchingConfig
	performance?: PerformanceConfig
	logging?: LoggingConfig
	errorHandling?: ErrorHandlingConfig

	// Metadata
	environment?: 'development' | 'staging' | 'production'
	customHeaders?: Record<string, string>
	interceptors?: InterceptorConfig
}
```

### `AuthenticationConfig`

| Field             | Type                                            | Description                     |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| `type`            | `'apiKey' \| 'session' \| 'bearer' \| 'custom'` | Auth method.                    |
| `apiKey`          | `string`                                        | API key.                        |
| `sessionToken`    | `string`                                        | Session token.                  |
| `bearerToken`     | `string`                                        | Bearer token.                   |
| `autoRefresh`     | `boolean`                                       | Whether to auto-refresh tokens. |
| `refreshEndpoint` | `string`                                        | Endpoint for token refresh.     |

### `RetryConfig`

| Field               | Type      | Default | Description                         |
| ------------------- | --------- | ------- | ----------------------------------- |
| `enabled`           | `boolean` | `true`  | Enable/disable retries.             |
| `maxAttempts`       | `number`  | `3`     | Max retry attempts.                 |
| `initialDelayMs`    | `number`  | `1000`  | Initial delay before retry.         |
| `maxDelayMs`        | `number`  | `30000` | Max delay between retries.          |
| `backoffMultiplier` | `number`  | `2`     | Multiplier for exponential backoff. |

### `CacheConfig`

| Field          | Type                             | Default    | Description                             |
| -------------- | -------------------------------- | ---------- | --------------------------------------- |
| `enabled`      | `boolean`                        | `true`     | Enable/disable caching.                 |
| `defaultTtlMs` | `number`                         | `300000`   | Default time-to-live for cache entries. |
| `storage`      | `'memory' \| 'localStorage' ...` | `'memory'` | Cache storage backend.                  |

---

## Types

Key data types used throughout the library.

### `AuditEvent`

Represents a single audit event record.

```typescript
export interface AuditEvent {
	id: string
	timestamp: string
	action: string
	status: 'success' | 'failure' | 'attempt'
	principalId: string
	organizationId: string
	targetResourceType?: string
	targetResourceId?: string
	// ... and many more fields
}
```

### `PaginatedAuditEvents`

The response from a `query` call.

```typescript
export interface PaginatedAuditEvents {
	events: AuditEvent[]
	pagination: {
		total: number
		limit: number
		offset: number
	}
}
```

For a complete list of all types, please refer to the source code in `packages/audit-client/src/types/` and `packages/audit-client/src/services/`.
