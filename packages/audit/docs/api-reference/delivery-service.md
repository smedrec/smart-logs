# Delivery Service API Reference

The Delivery Service provides a comprehensive system for delivering audit reports, exports, and other data to various destinations including webhooks, email, cloud storage, SFTP servers, and secure download links.

## Overview

The delivery service is designed with healthcare compliance in mind, offering:

- **Multi-destination fanout**: Deliver to multiple destinations simultaneously
- **Robust retry logic**: Exponential backoff with circuit breaker protection
- **Security-first**: HMAC signatures, encryption, and secure credential management
- **Health monitoring**: Real-time destination health tracking and alerting
- **Observability**: OpenTelemetry tracing and comprehensive metrics
- **Organizational isolation**: Multi-tenant support with proper access control

## Core Interfaces

### IDeliveryService

The main service interface for all delivery operations.

```typescript
interface IDeliveryService {
	// Destination management
	createDestination(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination>
	updateDestination(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination>
	deleteDestination(id: string): Promise<void>
	getDestination(id: string): Promise<DeliveryDestination | null>
	listDestinations(
		options: DeliveryDestinationListOptions
	): Promise<DeliveryDestinationListResponse>

	// Delivery operations
	deliver(request: DeliveryRequest): Promise<DeliveryResponse>
	retryDelivery(deliveryId: string): Promise<DeliveryResponse>
	getDeliveryStatus(deliveryId: string): Promise<DeliveryStatusResponse>
	listDeliveries(options: DeliveryListOptions): Promise<DeliveryListResponse>

	// Health and monitoring
	getDestinationHealth(destinationId: string): Promise<DestinationHealth>
	getDeliveryMetrics(options: MetricsOptions): Promise<DeliveryMetrics>
}
```

### Service Factory

Create and configure delivery service instances:

```typescript
import { createDeliveryService, DeliveryServiceFactory } from '@repo/audit/delivery'

// Simple creation
const deliveryService = createDeliveryService({
	database: databaseClient,
	config: {
		retry: {
			maxAttempts: 3,
			baseDelay: 1000,
			maxDelay: 30000,
		},
		circuitBreaker: {
			failureThreshold: 5,
			resetTimeout: 60000,
		},
	},
})

// Advanced factory with full dependency injection
const factory = createDeliveryServiceFactory({
	database: databaseClient,
	observability: {
		tracing: { enabled: true },
		metrics: { enabled: true },
	},
	security: {
		encryption: { enabled: true },
		webhookSecrets: { rotationDays: 30 },
	},
})

const deliveryService = await factory.createService()
```

## Destination Types

### Webhook Destinations

Deliver data via HTTP/HTTPS webhooks with security features:

```typescript
const webhookDestination = await deliveryService.createDestination({
	organizationId: 'org-123',
	label: 'Patient Portal Webhook',
	type: 'webhook',
	config: {
		webhook: {
			url: 'https://api.example.com/webhooks/audit',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': 'your-api-key',
			},
			timeout: 30000,
			retryConfig: {
				maxRetries: 3,
				backoffMultiplier: 2,
				maxBackoffDelay: 60000,
			},
		},
	},
})
```

**Security Features:**

- HMAC-SHA256 signatures for payload verification
- Idempotency keys to prevent duplicate processing
- Timestamp headers for replay attack prevention
- Configurable webhook secrets with rotation support

### Email Destinations

Send reports and data via email with multiple provider support:

```typescript
const emailDestination = await deliveryService.createDestination({
	organizationId: 'org-123',
	label: 'Compliance Team Email',
	type: 'email',
	config: {
		email: {
			service: 'sendgrid',
			apiKey: 'your-sendgrid-api-key',
			from: 'audit@hospital.com',
			subject: 'Audit Report - {{reportType}}',
			bodyTemplate: 'Please find the {{reportType}} report attached.',
			recipients: ['compliance@hospital.com', 'security@hospital.com'],
		},
	},
})
```

**Supported Providers:**

- SMTP (generic)
- SendGrid
- Resend
- Amazon SES
- Custom API providers

### Storage Destinations

Store files in cloud storage with retention policies:

```typescript
const storageDestination = await deliveryService.createDestination({
	organizationId: 'org-123',
	label: 'S3 Archive',
	type: 'storage',
	config: {
		storage: {
			provider: 's3',
			config: {
				region: 'us-east-1',
				bucket: 'audit-reports',
				accessKeyId: 'your-access-key',
				secretAccessKey: 'your-secret-key',
			},
			path: '/audit-reports/{organizationId}/{year}/{month}/',
			retention: {
				days: 2555, // 7 years for HIPAA compliance
				autoCleanup: true,
			},
		},
	},
})
```

**Supported Providers:**

- Amazon S3
- Azure Blob Storage
- Google Cloud Storage
- Local filesystem (development)

### SFTP Destinations

Secure file transfer to SFTP servers:

```typescript
const sftpDestination = await deliveryService.createDestination({
	organizationId: 'org-123',
	label: 'Partner SFTP',
	type: 'sftp',
	config: {
		sftp: {
			host: 'sftp.partner.com',
			port: 22,
			username: 'audit_user',
			privateKey: '-----BEGIN PRIVATE KEY-----\n...',
			path: '/incoming/audit-reports/',
			filename: 'audit-{timestamp}.json',
		},
	},
})
```

### Download Link Destinations

Generate secure, time-limited download links:

```typescript
const downloadDestination = await deliveryService.createDestination({
	organizationId: 'org-123',
	label: 'Secure Downloads',
	type: 'download',
	config: {
		download: {
			baseUrl: 'https://secure.hospital.com/downloads',
			expiryHours: 24,
			maxAccess: 3,
			allowedIpRanges: ['10.0.0.0/8', '192.168.1.0/24'],
		},
	},
})
```

## Delivery Operations

### Basic Delivery

Send data to one or more destinations:

```typescript
const response = await deliveryService.deliver({
	organizationId: 'org-123',
	destinations: ['dest-webhook-1', 'dest-email-1'],
	payload: {
		type: 'report',
		data: {
			reportId: 'rpt-456',
			title: 'HIPAA Compliance Report',
			generatedAt: '2024-01-15T10:30:00Z',
			content: reportData,
		},
		metadata: {
			reportType: 'compliance',
			period: '2024-Q1',
			confidentiality: 'restricted',
		},
	},
	options: {
		priority: 8,
		correlationId: 'audit-batch-789',
		idempotencyKey: 'delivery-unique-key-123',
	},
})

console.log('Delivery queued:', response.deliveryId)
console.log('Status:', response.status)
console.log('Destinations:', response.destinations)
```

### Default Destinations

Configure organization-level default destinations:

```typescript
// Set default destinations for an organization
await destinationManager.setDefaultDestination('org-123', 'dest-email-compliance')
await destinationManager.setDefaultDestination('org-123', 'dest-storage-archive')

// Deliver to default destinations
const response = await deliveryService.deliver({
	organizationId: 'org-123',
	destinations: 'default', // Uses organization's default destinations
	payload: {
		type: 'export',
		data: exportData,
		metadata: { exportType: 'patient-data' },
	},
})
```

### Delivery Status Tracking

Monitor delivery progress and status:

```typescript
const status = await deliveryService.getDeliveryStatus('delivery-123')

console.log('Overall status:', status.status)
status.destinations.forEach((dest) => {
	console.log(`${dest.destinationId}: ${dest.status}`)
	if (dest.failureReason) {
		console.log(`  Error: ${dest.failureReason}`)
	}
	if (dest.crossSystemReference) {
		console.log(`  External ref: ${dest.crossSystemReference}`)
	}
})
```

### Retry Management

Handle failed deliveries with intelligent retry logic:

```typescript
// Manual retry
const retryResponse = await deliveryService.retryDelivery('delivery-123')

// Check retry schedule
const retrySchedule = await retryManager.getRetrySchedule('delivery-123')
console.log(`Next retry at: ${retrySchedule.nextRetryAt}`)
console.log(`Attempt ${retrySchedule.currentAttempt} of ${retrySchedule.maxAttempts}`)
```

## Health Monitoring

### Destination Health

Monitor destination health and performance:

```typescript
const health = await deliveryService.getDestinationHealth('dest-webhook-1')

console.log('Status:', health.status) // healthy, degraded, unhealthy, disabled
console.log('Success rate:', health.successRate)
console.log('Consecutive failures:', health.consecutiveFailures)
console.log('Circuit breaker:', health.circuitBreakerState)

if (health.status === 'unhealthy') {
	console.log('Last failure:', health.lastFailureAt)
	console.log('Disabled reason:', health.disabledReason)
}
```

### Delivery Metrics

Get comprehensive delivery analytics:

```typescript
const metrics = await deliveryService.getDeliveryMetrics({
	organizationId: 'org-123',
	startDate: '2024-01-01T00:00:00Z',
	endDate: '2024-01-31T23:59:59Z',
	granularity: 'day',
})

console.log('Total deliveries:', metrics.totalDeliveries)
console.log('Success rate:', metrics.successRate)
console.log('Average delivery time:', metrics.averageDeliveryTime, 'ms')

// By destination type
Object.entries(metrics.byDestinationType).forEach(([type, stats]) => {
	console.log(`${type}: ${stats.successRate} success rate`)
})
```

## Configuration

### Service Configuration

```typescript
interface DeliveryServiceConfiguration {
	retry: {
		maxAttempts: number
		baseDelay: number
		maxDelay: number
		jitterFactor: number
	}
	circuitBreaker: {
		failureThreshold: number
		resetTimeout: number
		halfOpenMaxCalls: number
	}
	queue: {
		concurrency: number
		batchSize: number
		processingTimeout: number
	}
	security: {
		webhookSecrets: {
			rotationDays: number
			algorithm: 'sha256' | 'sha512'
		}
		encryption: {
			enabled: boolean
			algorithm: string
		}
	}
	observability: {
		tracing: {
			enabled: boolean
			sampleRate: number
		}
		metrics: {
			enabled: boolean
			collectInterval: number
		}
	}
}
```

### Environment Configuration

Load configuration from environment variables:

```typescript
import { loadConfigFromEnvironment } from '@repo/audit/delivery'

const config = loadConfigFromEnvironment({
	DELIVERY_RETRY_MAX_ATTEMPTS: '5',
	DELIVERY_CIRCUIT_BREAKER_THRESHOLD: '10',
	DELIVERY_WEBHOOK_SECRET_ROTATION_DAYS: '30',
	DELIVERY_OBSERVABILITY_TRACING_ENABLED: 'true',
})
```

## Error Handling

### Delivery Errors

```typescript
import { DeliveryAPIError } from '@repo/audit/delivery'

try {
	await deliveryService.deliver(request)
} catch (error) {
	if (error instanceof DeliveryAPIError) {
		console.log('Delivery error:', error.code)
		console.log('Details:', error.details)

		switch (error.code) {
			case 'DESTINATION_NOT_FOUND':
				// Handle missing destination
				break
			case 'VALIDATION_ERROR':
				// Handle validation issues
				break
			case 'RATE_LIMIT_EXCEEDED':
				// Handle rate limiting
				break
		}
	}
}
```

### Circuit Breaker States

```typescript
const circuitState = await circuitBreaker.getState('dest-webhook-1')

switch (circuitState.state) {
	case 'closed':
		// Normal operation
		break
	case 'open':
		// Destination is failing, requests blocked
		console.log('Circuit opened at:', circuitState.openedAt)
		break
	case 'half-open':
		// Testing if destination has recovered
		console.log('Next attempt at:', circuitState.nextAttemptAt)
		break
}
```

## Observability

### OpenTelemetry Integration

The delivery service provides comprehensive tracing:

```typescript
import { traceDeliveryOperation } from '@repo/audit/delivery'

// Automatic tracing for all delivery operations
const span = traceDeliveryOperation('webhook-delivery', {
	destinationId: 'dest-webhook-1',
	organizationId: 'org-123',
	deliveryId: 'delivery-456',
})

// Custom spans for business logic
span.addEvent('payload-validation-started')
// ... validation logic
span.addEvent('payload-validation-completed', { isValid: true })
```

### Custom Metrics

```typescript
import { createDeliveryMetricsCollector } from '@repo/audit/delivery'

const metricsCollector = createDeliveryMetricsCollector({
	enabled: true,
	collectInterval: 30000,
})

// Custom metrics
metricsCollector.recordDeliveryAttempt('webhook', 'success', 1250) // 1.25s
metricsCollector.recordQueueDepth(42)
metricsCollector.recordCircuitBreakerState('dest-webhook-1', 'open')
```

## Security Considerations

### Webhook Security

- **Signature Verification**: All webhook payloads are signed with HMAC-SHA256
- **Timestamp Validation**: Prevents replay attacks with configurable time windows
- **Idempotency**: Duplicate delivery prevention with idempotency keys
- **Secret Rotation**: Automatic webhook secret rotation with dual-key support

### Credential Management

- **Encryption at Rest**: All sensitive configuration data is encrypted
- **Secret Rotation**: Automated rotation for webhook secrets and API keys
- **Access Control**: Organization-level isolation and role-based permissions
- **Audit Trail**: All configuration changes are logged and auditable

### Data Protection

- **PHI Handling**: Secure processing of Protected Health Information
- **Encryption in Transit**: TLS 1.2+ for all external communications
- **Data Retention**: Configurable retention policies with automatic cleanup
- **Access Logging**: Comprehensive logging of all data access and modifications

## Performance Optimization

### Queue Management

- **Priority Queues**: High-priority deliveries processed first
- **Batch Processing**: Efficient processing of multiple deliveries
- **Concurrency Control**: Configurable concurrent delivery limits
- **Backpressure Handling**: Automatic queue throttling under load

### Connection Pooling

- **HTTP Connections**: Reused connections for webhook deliveries
- **Database Connections**: Efficient database connection management
- **SFTP Sessions**: Connection pooling for SFTP destinations
- **Email Providers**: Provider-specific connection optimization

### Caching

- **Destination Configuration**: Cached destination configs for performance
- **Health Status**: Cached health checks with TTL
- **Metrics**: Aggregated metrics caching for dashboard performance
- **Circuit Breaker State**: Cached circuit breaker states

## Best Practices

### Destination Configuration

1. **Use descriptive labels** for easy identification
2. **Set appropriate timeouts** based on destination characteristics
3. **Configure retry policies** suitable for each destination type
4. **Enable health monitoring** for critical destinations
5. **Use default destinations** for organization-wide policies

### Error Handling

1. **Implement proper retry logic** with exponential backoff
2. **Monitor circuit breaker states** and respond appropriately
3. **Set up alerting** for delivery failures and health issues
4. **Log delivery attempts** for troubleshooting and compliance
5. **Handle rate limiting** gracefully with backoff strategies

### Security

1. **Rotate webhook secrets** regularly (recommended: 30 days)
2. **Use strong encryption** for sensitive configuration data
3. **Implement proper access controls** for multi-tenant environments
4. **Monitor for security events** and unauthorized access attempts
5. **Follow principle of least privilege** for service accounts

### Performance

1. **Use appropriate queue priorities** for time-sensitive deliveries
2. **Monitor delivery metrics** and optimize based on patterns
3. **Configure circuit breakers** to protect downstream systems
4. **Implement proper caching** for frequently accessed data
5. **Scale horizontally** by running multiple service instances

## Migration Guide

### From Legacy Systems

When migrating from existing delivery systems:

1. **Audit existing destinations** and map to new destination types
2. **Migrate configuration data** using the provided migration utilities
3. **Test connectivity** for all migrated destinations
4. **Set up monitoring** and alerting for the new system
5. **Gradually migrate traffic** using feature flags or routing rules

### Version Upgrades

For upgrading between versions:

1. **Review breaking changes** in the changelog
2. **Update configuration** according to new schema requirements
3. **Test in staging environment** before production deployment
4. **Monitor metrics** during and after the upgrade
5. **Have rollback plan** ready in case of issues

## Troubleshooting

See the [Delivery Service Troubleshooting Guide](../troubleshooting/delivery-service.md) for common issues and solutions.

## Examples

See the [Delivery Service Examples](../examples/delivery-service.md) for practical implementation examples and use cases.
