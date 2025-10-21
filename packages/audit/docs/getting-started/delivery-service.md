# Getting Started with Delivery Service

The Delivery Service enables secure, reliable delivery of audit reports, exports, and other data to various destinations. This guide will help you set up and configure your first delivery destinations.

## Quick Start

### 1. Installation

The delivery service is included with the `@repo/audit` package:

```bash
npm install @repo/audit
```

### 2. Basic Setup

```typescript
import { createEnhancedAuditDatabaseClient } from '@repo/audit-db'
import { createDeliveryService } from '@repo/audit/delivery'

// Initialize database client
const databaseClient = createEnhancedAuditDatabaseClient({
	connectionString: process.env.DATABASE_URL,
})

// Create delivery service
const deliveryService = createDeliveryService({
	database: databaseClient,
	config: {
		retry: {
			maxAttempts: 3,
			baseDelay: 1000,
		},
	},
})
```

### 3. Create Your First Destination

Let's create a webhook destination to receive audit reports:

```typescript
const webhookDestination = await deliveryService.createDestination({
	organizationId: 'your-org-id',
	label: 'Audit Webhook',
	type: 'webhook',
	description: 'Receives audit reports via webhook',
	config: {
		webhook: {
			url: 'https://your-api.com/webhooks/audit',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer your-token',
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

console.log('Destination created:', webhookDestination.id)
```

### 4. Send Your First Delivery

```typescript
const response = await deliveryService.deliver({
	organizationId: 'your-org-id',
	destinations: [webhookDestination.id],
	payload: {
		type: 'report',
		data: {
			reportId: 'audit-report-001',
			title: 'Daily Audit Summary',
			generatedAt: new Date().toISOString(),
			events: [
				{
					action: 'patient.read',
					userId: 'user-123',
					timestamp: new Date().toISOString(),
				},
			],
		},
		metadata: {
			reportType: 'daily-summary',
			confidentiality: 'internal',
		},
	},
})

console.log('Delivery queued:', response.deliveryId)
```

### 5. Check Delivery Status

```typescript
const status = await deliveryService.getDeliveryStatus(response.deliveryId)

console.log('Delivery status:', status.status)
status.destinations.forEach((dest) => {
	console.log(`${dest.destinationId}: ${dest.status}`)
})
```

## Destination Types Overview

### Webhook Destinations

Perfect for real-time integrations and API-based systems:

```typescript
const webhookConfig = {
	webhook: {
		url: 'https://api.example.com/webhooks/audit',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': 'your-api-key',
		},
		timeout: 30000,
	},
}
```

**Use cases:**

- Real-time audit event streaming
- Integration with SIEM systems
- Triggering downstream workflows
- API-based partner integrations

### Email Destinations

Ideal for reports and notifications:

```typescript
const emailConfig = {
	email: {
		service: 'sendgrid',
		apiKey: 'your-sendgrid-key',
		from: 'audit@yourcompany.com',
		subject: 'Audit Report - {{date}}',
		recipients: ['compliance@yourcompany.com'],
	},
}
```

**Use cases:**

- Compliance team notifications
- Executive summaries
- Scheduled report delivery
- Alert notifications

### Storage Destinations

For long-term archival and compliance:

```typescript
const storageConfig = {
	storage: {
		provider: 's3',
		config: {
			region: 'us-east-1',
			bucket: 'audit-archives',
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		},
		path: '/audit-reports/{year}/{month}/',
		retention: {
			days: 2555, // 7 years for HIPAA
			autoCleanup: true,
		},
	},
}
```

**Use cases:**

- HIPAA compliance archival
- Long-term data retention
- Backup and disaster recovery
- Regulatory audit trails

### SFTP Destinations

For secure file transfers to partners:

```typescript
const sftpConfig = {
	sftp: {
		host: 'sftp.partner.com',
		port: 22,
		username: 'audit_user',
		privateKey: process.env.SFTP_PRIVATE_KEY,
		path: '/incoming/audit-reports/',
	},
}
```

**Use cases:**

- Partner data sharing
- Regulatory submissions
- Secure file exchanges
- Legacy system integration

### Download Link Destinations

For secure, time-limited access:

```typescript
const downloadConfig = {
	download: {
		expiryHours: 24,
		maxAccess: 3,
		allowedIpRanges: ['10.0.0.0/8'],
	},
}
```

**Use cases:**

- Secure report sharing
- Time-limited access
- External auditor access
- Temporary data sharing

## Configuration Best Practices

### Environment Variables

Set up your environment variables for secure configuration:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/audit_db

# Email providers
SENDGRID_API_KEY=your-sendgrid-key
RESEND_API_KEY=your-resend-key

# Storage providers
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1

# Security
WEBHOOK_SECRET_KEY=your-webhook-secret
ENCRYPTION_KEY=your-encryption-key

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=audit-delivery-service
```

### Service Configuration

Create a comprehensive service configuration:

```typescript
import { loadConfigFromEnvironment } from '@repo/audit/delivery'

const config = loadConfigFromEnvironment({
	// Retry configuration
	DELIVERY_RETRY_MAX_ATTEMPTS: '5',
	DELIVERY_RETRY_BASE_DELAY: '1000',
	DELIVERY_RETRY_MAX_DELAY: '60000',

	// Circuit breaker
	DELIVERY_CIRCUIT_BREAKER_THRESHOLD: '5',
	DELIVERY_CIRCUIT_BREAKER_RESET_TIMEOUT: '60000',

	// Queue settings
	DELIVERY_QUEUE_CONCURRENCY: '10',
	DELIVERY_QUEUE_BATCH_SIZE: '50',

	// Security
	DELIVERY_WEBHOOK_SECRET_ROTATION_DAYS: '30',
	DELIVERY_ENCRYPTION_ENABLED: 'true',

	// Observability
	DELIVERY_TRACING_ENABLED: 'true',
	DELIVERY_METRICS_ENABLED: 'true',
})

const deliveryService = createDeliveryService({
	database: databaseClient,
	config,
})
```

## Health Monitoring Setup

### Basic Health Checks

Set up health monitoring for your destinations:

```typescript
// Check destination health
const health = await deliveryService.getDestinationHealth(destinationId)

if (health.status !== 'healthy') {
	console.warn(`Destination ${destinationId} is ${health.status}`)
	console.log('Consecutive failures:', health.consecutiveFailures)
	console.log('Success rate:', health.successRate)
}
```

### Automated Health Monitoring

```typescript
import { createHealthMonitor } from '@repo/audit/delivery'

const healthMonitor = createHealthMonitor({
	checkInterval: 60000, // Check every minute
	failureThreshold: 5,
	recoveryThreshold: 3,
})

// Monitor all destinations for an organization
await healthMonitor.monitorOrganization('your-org-id')
```

## Error Handling

### Basic Error Handling

```typescript
import { DeliveryAPIError } from '@repo/audit/delivery'

try {
	const response = await deliveryService.deliver(request)
	console.log('Delivery successful:', response.deliveryId)
} catch (error) {
	if (error instanceof DeliveryAPIError) {
		switch (error.code) {
			case 'DESTINATION_NOT_FOUND':
				console.error('Destination does not exist')
				break
			case 'VALIDATION_ERROR':
				console.error('Invalid request:', error.details)
				break
			case 'RATE_LIMIT_EXCEEDED':
				console.error('Rate limit exceeded, retry later')
				break
			default:
				console.error('Delivery error:', error.message)
		}
	} else {
		console.error('Unexpected error:', error)
	}
}
```

### Retry Logic

The service includes automatic retry with exponential backoff:

```typescript
// Check retry status
const retrySchedule = await retryManager.getRetrySchedule(deliveryId)

console.log(`Attempt ${retrySchedule.currentAttempt} of ${retrySchedule.maxAttempts}`)
if (retrySchedule.nextRetryAt) {
	console.log(`Next retry at: ${retrySchedule.nextRetryAt}`)
}

// Manual retry if needed
if (retrySchedule.currentAttempt < retrySchedule.maxAttempts) {
	await deliveryService.retryDelivery(deliveryId)
}
```

## Security Setup

### Webhook Security

Enable webhook security features:

```typescript
import { WebhookSecurityManager } from '@repo/audit/delivery'

const securityManager = new WebhookSecurityManager({
	algorithm: 'sha256',
	timestampTolerance: 300, // 5 minutes
})

// Generate signature for outgoing webhook
const signature = securityManager.generateSignature(payload, secret)

// Verify incoming webhook (for testing)
const isValid = securityManager.verifySignature(payload, signature, secret, timestamp)
```

### Secret Management

Set up automatic secret rotation:

```typescript
import { createWebhookSecretManager } from '@repo/audit/delivery'

const secretManager = createWebhookSecretManager({
	rotationDays: 30,
	algorithm: 'sha256',
	keyLength: 32,
})

// Rotate secrets for a destination
await secretManager.rotateSecret(destinationId)

// Get current active secret
const secret = await secretManager.getActiveSecret(destinationId)
```

## Testing Your Setup

### Connection Testing

Test destination connectivity before going live:

```typescript
import { ConnectionTester } from '@repo/audit/delivery'

const tester = new ConnectionTester()

// Test webhook destination
const webhookResult = await tester.testWebhookConnection({
	url: 'https://api.example.com/webhook',
	method: 'POST',
	headers: { Authorization: 'Bearer token' },
})

console.log('Webhook test:', webhookResult.success)
console.log('Response time:', webhookResult.responseTime, 'ms')

// Test email destination
const emailResult = await tester.testEmailConnection({
	service: 'sendgrid',
	apiKey: 'your-key',
})

console.log('Email test:', emailResult.success)
```

### End-to-End Testing

```typescript
// Create test destination
const testDestination = await deliveryService.createDestination({
	organizationId: 'test-org',
	label: 'Test Webhook',
	type: 'webhook',
	config: {
		webhook: {
			url: 'https://httpbin.org/post', // Test endpoint
			method: 'POST',
			timeout: 10000,
		},
	},
})

// Send test delivery
const testDelivery = await deliveryService.deliver({
	organizationId: 'test-org',
	destinations: [testDestination.id],
	payload: {
		type: 'test',
		data: { message: 'Hello, World!' },
		metadata: { test: true },
	},
})

// Wait and check status
setTimeout(async () => {
	const status = await deliveryService.getDeliveryStatus(testDelivery.deliveryId)
	console.log('Test delivery status:', status.status)
}, 5000)
```

## Next Steps

Now that you have the delivery service set up:

1. **Configure multiple destinations** for redundancy
2. **Set up monitoring and alerting** for production use
3. **Implement proper error handling** in your application
4. **Review security settings** and enable appropriate features
5. **Test failover scenarios** and circuit breaker behavior

### Advanced Topics

- [Delivery Service Tutorials](../tutorials/delivery-service.md) - Detailed implementation guides
- [Security Best Practices](../guides/delivery-security.md) - Security configuration and best practices
- [Performance Optimization](../guides/delivery-performance.md) - Scaling and optimization techniques
- [Troubleshooting Guide](../troubleshooting/delivery-service.md) - Common issues and solutions

### Examples

- [Healthcare Delivery Scenarios](../examples/delivery-healthcare.md) - Healthcare-specific use cases
- [Multi-tenant Setup](../examples/delivery-multi-tenant.md) - Multi-organization configuration
- [High-volume Processing](../examples/delivery-high-volume.md) - Scaling for high throughput
