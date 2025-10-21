# Delivery Service Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Delivery Service.

## Table of Contents

1. [Common Issues](#common-issues)
2. [Destination-Specific Problems](#destination-specific-problems)
3. [Performance Issues](#performance-issues)
4. [Security and Authentication](#security-and-authentication)
5. [Monitoring and Debugging](#monitoring-and-debugging)
6. [Recovery Procedures](#recovery-procedures)

## Common Issues

### Delivery Failures

#### Symptom: Deliveries are failing with generic errors

**Possible Causes:**

- Network connectivity issues
- Destination configuration problems
- Authentication failures
- Rate limiting

**Diagnosis Steps:**

1. Check delivery status:

```typescript
const status = await deliveryService.getDeliveryStatus(deliveryId)
console.log('Status:', status.status)
status.destinations.forEach((dest) => {
	console.log(`${dest.destinationId}: ${dest.status}`)
	if (dest.failureReason) {
		console.log(`  Error: ${dest.failureReason}`)
	}
})
```

2. Check destination health:

```typescript
const health = await deliveryService.getDestinationHealth(destinationId)
console.log('Health status:', health.status)
console.log('Success rate:', health.successRate)
console.log('Consecutive failures:', health.consecutiveFailures)
```

3. Test destination connectivity:

```typescript
import { ConnectionTester } from '@repo/audit/delivery'

const tester = new ConnectionTester()
const result = await tester.testConnection(destination)
console.log('Connection test:', result.success)
console.log('Response time:', result.responseTime)
```

**Solutions:**

- **Network Issues**: Check firewall rules, DNS resolution, and network connectivity
- **Configuration Issues**: Validate destination configuration using the connection tester
- **Authentication**: Verify API keys, credentials, and authentication methods
- **Rate Limiting**: Implement proper backoff strategies and respect rate limits

### Circuit Breaker Activation

#### Symptom: Deliveries are being blocked due to circuit breaker

**Diagnosis:**

```typescript
const circuitState = await circuitBreaker.getState(destinationId)
console.log('Circuit breaker state:', circuitState.state)
console.log('Failure count:', circuitState.failureCount)
console.log('Last failure:', circuitState.lastFailureAt)
```

**Solutions:**

1. **Manual Reset** (if destination is healthy):

```typescript
await circuitBreaker.forceClose(destinationId)
```

2. **Wait for Automatic Recovery**:
   - Circuit breaker will automatically attempt recovery
   - Monitor the half-open state transitions

3. **Fix Underlying Issues**:
   - Address the root cause of failures
   - Update destination configuration if needed

### Queue Backlog

#### Symptom: Deliveries are queuing up and not processing

**Diagnosis:**

```typescript
const queueStatus = await deliveryScheduler.getQueueStatus()
console.log('Pending count:', queueStatus.pendingCount)
console.log('Processing count:', queueStatus.processingCount)
console.log('Average processing time:', queueStatus.averageProcessingTime)
console.log('Oldest pending age:', queueStatus.oldestPendingAge)
```

**Solutions:**

1. **Increase Concurrency**:

```typescript
const config = {
	queue: {
		concurrency: 20, // Increase from default
		batchSize: 50,
	},
}
```

2. **Scale Horizontally**:
   - Deploy multiple service instances
   - Use load balancing for queue processing

3. **Optimize Destinations**:
   - Reduce timeout values for faster failures
   - Optimize retry configurations

## Destination-Specific Problems

### Webhook Destinations

#### Issue: Webhook signature verification failures

**Symptoms:**

- Receiving webhook but signature validation fails
- Partner reports invalid signatures

**Diagnosis:**

```typescript
import { WebhookSecurityManager } from '@repo/audit/delivery'

const securityManager = new WebhookSecurityManager()
const isValid = securityManager.verifySignature(payload, receivedSignature, secret, timestamp)
console.log('Signature valid:', isValid)
```

**Solutions:**

1. **Check Secret Synchronization**:

```typescript
const secret = await webhookSecretManager.getActiveSecret(destinationId)
console.log('Current secret:', secret.id)
```

2. **Verify Timestamp Tolerance**:

```typescript
const config = {
	timestampTolerance: 300, // 5 minutes
}
```

3. **Debug Signature Generation**:

```typescript
const expectedSignature = securityManager.generateSignature(payload, secret)
console.log('Expected:', expectedSignature)
console.log('Received:', receivedSignature)
```

#### Issue: Webhook timeouts

**Solutions:**

1. **Adjust Timeout Settings**:

```typescript
const webhookConfig = {
	webhook: {
		timeout: 60000, // Increase to 60 seconds
		retryConfig: {
			maxRetries: 5,
			backoffMultiplier: 2,
		},
	},
}
```

2. **Implement Async Processing**:
   - Use webhook queues for long-running operations
   - Return 200 OK immediately and process asynchronously

### Email Destinations

#### Issue: Email delivery failures

**Common Causes:**

- Invalid SMTP configuration
- Authentication failures
- Rate limiting by email provider
- Recipient address issues

**Diagnosis:**

```typescript
// Test SMTP connection
const emailResult = await tester.testEmailConnection({
	service: 'smtp',
	smtpConfig: {
		host: 'smtp.gmail.com',
		port: 587,
		secure: false,
		auth: {
			user: 'your-email@gmail.com',
			pass: 'your-password',
		},
	},
})
```

**Solutions:**

1. **SMTP Configuration**:

```typescript
const emailConfig = {
	email: {
		service: 'smtp',
		smtpConfig: {
			host: 'smtp.gmail.com',
			port: 587,
			secure: false, // Use STARTTLS
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS,
			},
			tls: {
				rejectUnauthorized: false, // For self-signed certificates
			},
		},
	},
}
```

2. **API-based Providers**:

```typescript
const sendgridConfig = {
	email: {
		service: 'sendgrid',
		apiKey: process.env.SENDGRID_API_KEY,
		from: 'verified-sender@yourdomain.com',
	},
}
```

### Storage Destinations

#### Issue: S3 access denied errors

**Diagnosis:**

```typescript
// Test S3 connection
const s3Result = await tester.testStorageConnection({
	provider: 's3',
	config: {
		region: 'us-east-1',
		bucket: 'your-bucket',
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
})
```

**Solutions:**

1. **Check IAM Permissions**:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
			"Resource": "arn:aws:s3:::your-bucket/*"
		}
	]
}
```

2. **Verify Bucket Configuration**:
   - Check bucket exists and is accessible
   - Verify region configuration
   - Ensure bucket policy allows access

### SFTP Destinations

#### Issue: SFTP connection failures

**Common Causes:**

- SSH key authentication issues
- Network connectivity problems
- Incorrect host/port configuration
- Permission issues on remote server

**Solutions:**

1. **SSH Key Authentication**:

```typescript
const sftpConfig = {
	sftp: {
		host: 'sftp.example.com',
		port: 22,
		username: 'audit_user',
		privateKey: fs.readFileSync('/path/to/private/key'),
		passphrase: 'key-passphrase-if-any',
	},
}
```

2. **Password Authentication**:

```typescript
const sftpConfig = {
	sftp: {
		host: 'sftp.example.com',
		port: 22,
		username: 'audit_user',
		password: process.env.SFTP_PASSWORD,
	},
}
```

## Performance Issues

### High Latency

#### Symptoms:

- Slow delivery processing
- High response times
- Queue backlog building up

**Diagnosis:**

```typescript
const metrics = await deliveryService.getDeliveryMetrics({
	organizationId: 'your-org',
	startDate: '2024-01-01T00:00:00Z',
	endDate: '2024-01-31T23:59:59Z',
})

console.log('Average delivery time:', metrics.averageDeliveryTime)
console.log('Success rate:', metrics.successRate)
```

**Solutions:**

1. **Optimize Configuration**:

```typescript
const optimizedConfig = {
	queue: {
		concurrency: 25,
		batchSize: 100,
		processingTimeout: 30000,
	},
	retry: {
		maxAttempts: 3,
		baseDelay: 1000,
		maxDelay: 10000,
	},
}
```

2. **Connection Pooling**:

```typescript
const config = {
	performance: {
		enableConnectionPooling: true,
		maxConnections: 50,
		connectionTimeout: 10000,
	},
}
```

3. **Database Optimization**:
   - Add indexes on frequently queried columns
   - Optimize database connection pool size
   - Use read replicas for metrics queries

### Memory Issues

#### Symptoms:

- High memory usage
- Out of memory errors
- Slow garbage collection

**Solutions:**

1. **Batch Size Optimization**:

```typescript
const config = {
	queue: {
		batchSize: 50, // Reduce if memory constrained
		processingTimeout: 60000,
	},
}
```

2. **Memory Monitoring**:

```typescript
// Monitor memory usage
setInterval(() => {
	const memUsage = process.memoryUsage()
	console.log('Memory usage:', {
		rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
		heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
		heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
	})
}, 30000)
```

## Security and Authentication

### Authentication Failures

#### Issue: API key or credential authentication failures

**Diagnosis Steps:**

1. **Verify Credentials**:

```typescript
// Test with minimal request
const testResult = await tester.testConnection(destination)
if (!testResult.success) {
	console.log('Auth error:', testResult.error)
}
```

2. **Check Credential Rotation**:

```typescript
const secret = await webhookSecretManager.getActiveSecret(destinationId)
console.log('Secret created:', secret.createdAt)
console.log('Secret expires:', secret.expiresAt)
```

**Solutions:**

1. **Credential Refresh**:

```typescript
// Rotate webhook secrets
await webhookSecretManager.rotateSecret(destinationId)

// Update API keys
await deliveryService.updateDestination(destinationId, {
	config: {
		webhook: {
			headers: {
				Authorization: `Bearer ${newApiKey}`,
			},
		},
	},
})
```

2. **Environment Variable Check**:

```bash
# Verify environment variables are set
echo $SENDGRID_API_KEY
echo $AWS_ACCESS_KEY_ID
echo $WEBHOOK_SECRET
```

### SSL/TLS Issues

#### Issue: SSL certificate verification failures

**Solutions:**

1. **Certificate Validation**:

```typescript
const config = {
	webhook: {
		url: 'https://api.example.com/webhook',
		tls: {
			rejectUnauthorized: true, // Enable for production
			ca: fs.readFileSync('/path/to/ca-cert.pem'), // Custom CA if needed
		},
	},
}
```

2. **Development Workaround** (not for production):

```typescript
const config = {
	webhook: {
		tls: {
			rejectUnauthorized: false, // Only for development
		},
	},
}
```

## Monitoring and Debugging

### Enable Debug Logging

```typescript
// Enable detailed logging
const config = {
	logging: {
		level: 'debug',
		enableTracing: true,
		logDestinationHealth: true,
		logRetryAttempts: true,
	},
}
```

### OpenTelemetry Tracing

```typescript
import { traceDeliveryOperation } from '@repo/audit/delivery'

// Trace specific operations
const result = await traceDeliveryOperation(
	'troubleshoot-delivery',
	{ destinationId, organizationId },
	async (span) => {
		span.addEvent('diagnosis-started')

		// Your troubleshooting code here
		const health = await deliveryService.getDestinationHealth(destinationId)
		span.addEvent('health-checked', { status: health.status })

		return health
	}
)
```

### Health Check Endpoints

```typescript
// Implement health check endpoint
app.get('/health/delivery', async (req, res) => {
	try {
		const queueStatus = await deliveryScheduler.getQueueStatus()
		const isHealthy = queueStatus.pendingCount < 1000 && queueStatus.averageProcessingTime < 30000

		res.status(isHealthy ? 200 : 503).json({
			status: isHealthy ? 'healthy' : 'unhealthy',
			queue: queueStatus,
			timestamp: new Date().toISOString(),
		})
	} catch (error) {
		res.status(503).json({
			status: 'error',
			error: error.message,
		})
	}
})
```

## Recovery Procedures

### Manual Recovery Steps

#### 1. Clear Stuck Queue Items

```typescript
// Get stuck deliveries
const stuckDeliveries = await deliveryService.listDeliveries({
	status: 'processing',
	startDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
})

// Reset stuck deliveries
for (const delivery of stuckDeliveries.deliveries) {
	await retryManager.resetRetryCount(delivery.deliveryId)
	await deliveryService.retryDelivery(delivery.deliveryId)
}
```

#### 2. Reset Circuit Breakers

```typescript
// Get all destinations with open circuit breakers
const destinations = await deliveryService.listDestinations({})

for (const dest of destinations.deliveryDestinations) {
	const state = await circuitBreaker.getState(dest.id)
	if (state.state === 'open') {
		// Test if destination is healthy now
		const testResult = await tester.testConnection(dest)
		if (testResult.success) {
			await circuitBreaker.forceClose(dest.id)
			console.log(`Reset circuit breaker for ${dest.label}`)
		}
	}
}
```

#### 3. Bulk Retry Failed Deliveries

```typescript
// Retry all failed deliveries from the last 24 hours
const failedDeliveries = await deliveryService.listDeliveries({
	status: 'failed',
	startDate: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
})

const retryResults = await Promise.allSettled(
	failedDeliveries.deliveries.map((delivery) => deliveryService.retryDelivery(delivery.deliveryId))
)

console.log(`Retried ${retryResults.length} deliveries`)
console.log(`Successful retries: ${retryResults.filter((r) => r.status === 'fulfilled').length}`)
```

### Emergency Procedures

#### Service Restart Checklist

1. **Graceful Shutdown**:

```typescript
// Drain queue before shutdown
await deliveryScheduler.pauseQueue()
await new Promise((resolve) => setTimeout(resolve, 30000)) // Wait 30 seconds
await deliveryScheduler.resumeQueue()
```

2. **Health Verification**:

```typescript
// Verify all destinations after restart
const destinations = await deliveryService.listDestinations({})
for (const dest of destinations.deliveryDestinations) {
	const health = await deliveryService.getDestinationHealth(dest.id)
	console.log(`${dest.label}: ${health.status}`)
}
```

3. **Queue Status Check**:

```typescript
const queueStatus = await deliveryScheduler.getQueueStatus()
console.log('Queue status after restart:', queueStatus)
```

### Data Recovery

#### Backup and Restore

```typescript
// Export delivery configuration
const destinations = await deliveryService.listDestinations({})
const backup = {
	timestamp: new Date().toISOString(),
	destinations: destinations.deliveryDestinations,
}

fs.writeFileSync('delivery-backup.json', JSON.stringify(backup, null, 2))

// Restore from backup
const backupData = JSON.parse(fs.readFileSync('delivery-backup.json', 'utf8'))
for (const dest of backupData.destinations) {
	await deliveryService.createDestination({
		organizationId: dest.organizationId,
		label: dest.label,
		type: dest.type,
		config: dest.config,
	})
}
```

## Getting Help

### Log Collection

When reporting issues, collect these logs:

```bash
# Application logs
tail -f /var/log/delivery-service.log

# Database logs
tail -f /var/log/postgresql/postgresql.log

# System metrics
top -p $(pgrep -f delivery-service)
```

### Diagnostic Information

```typescript
// Generate diagnostic report
const diagnostics = {
	timestamp: new Date().toISOString(),
	version: process.env.npm_package_version,
	nodeVersion: process.version,
	memory: process.memoryUsage(),
	uptime: process.uptime(),
	queueStatus: await deliveryScheduler.getQueueStatus(),
	destinationHealth: await Promise.all(
		destinations.map(async (dest) => ({
			id: dest.id,
			label: dest.label,
			health: await deliveryService.getDestinationHealth(dest.id),
		}))
	),
}

console.log(JSON.stringify(diagnostics, null, 2))
```

### Support Channels

1. **Check Documentation**: Review API reference and tutorials
2. **Search Issues**: Look for similar problems in the issue tracker
3. **Create Issue**: Provide diagnostic information and reproduction steps
4. **Community Support**: Ask questions in the community forums

Remember to sanitize any sensitive information (API keys, credentials, PHI data) before sharing logs or diagnostic information.
