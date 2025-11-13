/**
 * Delivery Service Usage Examples
 *
 * This file demonstrates how to use the DeliveryService for managing
 * delivery destinations and submitting delivery requests.
 */

import { AuditClient } from '../core/client'

/**
 * Example: Create and manage delivery destinations
 */
async function deliveryDestinationExample() {
	// Initialize the client
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	try {
		// Create an email delivery destination
		const emailDestination = await client.delivery.createDestination({
			organizationId: 'org_123',
			label: 'Finance Team Email',
			type: 'email',
			description: 'Send reports to finance team',
			config: {
				email: {
					service: 'smtp',
					from: 'reports@example.com',
					subject: 'Audit Report',
					recipients: ['finance@example.com'],
					smtpConfig: {
						host: 'smtp.example.com',
						port: 587,
						secure: true,
						auth: {
							user: 'reports@example.com',
							pass: 'password',
						},
					},
				},
			},
		})

		console.log('Email destination created:', emailDestination.id)

		// Create a webhook delivery destination
		const webhookDestination = await client.delivery.createDestination({
			organizationId: 'org_123',
			label: 'Slack Webhook',
			type: 'webhook',
			description: 'Send notifications to Slack',
			config: {
				webhook: {
					url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
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

		console.log('Webhook destination created:', webhookDestination.id)

		// List all destinations
		const destinations = await client.delivery.listDestinations({
			limit: 10,
			offset: 0,
			sortBy: 'createdAt',
			sortOrder: 'desc',
		})

		console.log(`Found ${destinations.data.length} destinations`)

		// Get a specific destination
		const destination = await client.delivery.getDestination(emailDestination.id)
		console.log('Retrieved destination:', destination?.label)

		// Update a destination
		const updated = await client.delivery.updateDestination(emailDestination.id, {
			description: 'Updated description',
			disabled: false,
		})

		console.log('Destination updated:', updated.label)

		// Test connection to a destination
		const testResult = await client.delivery.testConnection(webhookDestination.id)
		console.log('Connection test:', testResult.success ? 'Success' : 'Failed')

		// Validate destination configuration
		const validationResult = await client.delivery.validateDestination(emailDestination.id)
		console.log('Validation:', validationResult.isValid ? 'Valid' : 'Invalid')
		if (!validationResult.isValid) {
			console.log('Errors:', validationResult.errors)
		}
	} catch (error) {
		console.error('Error managing destinations:', error)
	} finally {
		await client.destroy()
	}
}

/**
 * Example: Submit delivery requests
 */
async function deliveryRequestExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	try {
		// Submit a delivery request to specific destinations
		const delivery = await client.delivery.deliver({
			organizationId: 'org_123',
			destinations: ['dest_123', 'dest_456'],
			payload: {
				type: 'report',
				data: {
					reportId: 'report_789',
					format: 'pdf',
					content: 'base64-encoded-content',
				},
				metadata: {
					generatedAt: new Date().toISOString(),
					reportType: 'compliance',
				},
			},
			options: {
				priority: 5,
				correlationId: 'corr_123',
				tags: ['compliance', 'monthly'],
			},
		})

		console.log('Delivery submitted:', delivery.deliveryId)
		console.log('Status:', delivery.status)

		// Check delivery status
		const status = await client.delivery.getDeliveryStatus(delivery.deliveryId)
		if (status) {
			console.log('Delivery status:', status.status)
			console.log('Destinations:')
			status.destinations.forEach((dest) => {
				console.log(`  - ${dest.destinationId}: ${dest.status}`)
			})
		}

		// Retry a failed delivery
		if (status?.status === 'failed') {
			const retryResult = await client.delivery.retryDelivery(delivery.deliveryId)
			console.log('Retry submitted:', retryResult.deliveryId)
		}

		// List deliveries with filters
		const deliveries = await client.delivery.listDeliveries({
			status: 'completed',
			startDate: '2024-01-01T00:00:00Z',
			endDate: '2024-12-31T23:59:59Z',
			limit: 20,
			sortBy: 'createdAt',
			sortOrder: 'desc',
		})

		console.log(`Found ${deliveries.data.length} deliveries`)
	} catch (error) {
		console.error('Error with delivery requests:', error)
	} finally {
		await client.destroy()
	}
}

/**
 * Example: Monitor destination health and metrics
 */
async function healthAndMetricsExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	try {
		// Get destination health
		const health = await client.delivery.getDestinationHealth('dest_123')
		if (health) {
			console.log('Destination health:', health.status)
			console.log('Success rate:', health.successRate)
			console.log('Circuit breaker state:', health.circuitBreakerState)
			console.log('Consecutive failures:', health.consecutiveFailures)
		}

		// Get delivery metrics
		const metrics = await client.delivery.getDeliveryMetrics({
			startDate: '2024-01-01T00:00:00Z',
			endDate: '2024-12-31T23:59:59Z',
			granularity: 'day',
		})

		console.log('Total deliveries:', metrics.totalDeliveries)
		console.log('Success rate:', metrics.successRate)
		console.log('Average delivery time:', metrics.averageDeliveryTime, 'ms')

		// Metrics by destination type
		console.log('\nMetrics by destination type:')
		Object.entries(metrics.byDestinationType).forEach(([type, stats]) => {
			console.log(`  ${type}:`)
			console.log(`    Total: ${stats.total}`)
			console.log(`    Success rate: ${stats.successRate}`)
			console.log(`    Average time: ${stats.averageTime}ms`)
		})

		// Check API health
		const apiHealth = await client.delivery.healthCheck()
		console.log('\nAPI Health:', apiHealth.status)
		console.log('Version:', apiHealth.version)
	} catch (error) {
		console.error('Error checking health and metrics:', error)
	} finally {
		await client.destroy()
	}
}

/**
 * Example: Storage destination configuration
 */
async function storageDestinationExample() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
	})

	try {
		// Create S3 storage destination
		const s3Destination = await client.delivery.createDestination({
			organizationId: 'org_123',
			label: 'S3 Archive',
			type: 'storage',
			description: 'Archive reports to S3',
			config: {
				storage: {
					provider: 's3',
					config: {
						bucket: 'my-reports-bucket',
						region: 'us-east-1',
						accessKeyId: 'YOUR_ACCESS_KEY',
						secretAccessKey: 'YOUR_SECRET_KEY',
					},
					path: '/reports/{year}/{month}/',
					retention: {
						days: 365,
						autoCleanup: true,
					},
				},
			},
		})

		console.log('S3 destination created:', s3Destination.id)

		// Create SFTP destination
		const sftpDestination = await client.delivery.createDestination({
			organizationId: 'org_123',
			label: 'SFTP Server',
			type: 'sftp',
			description: 'Upload to SFTP server',
			config: {
				sftp: {
					host: 'sftp.example.com',
					port: 22,
					username: 'reports',
					password: 'secure-password',
					path: '/uploads/reports/',
					filename: 'report_{timestamp}.pdf',
				},
			},
		})

		console.log('SFTP destination created:', sftpDestination.id)
	} catch (error) {
		console.error('Error creating storage destinations:', error)
	} finally {
		await client.destroy()
	}
}

// Run examples
if (require.main === module) {
	;(async () => {
		console.log('=== Delivery Destination Example ===')
		await deliveryDestinationExample()

		console.log('\n=== Delivery Request Example ===')
		await deliveryRequestExample()

		console.log('\n=== Health and Metrics Example ===')
		await healthAndMetricsExample()

		console.log('\n=== Storage Destination Example ===')
		await storageDestinationExample()
	})()
}

export {
	deliveryDestinationExample,
	deliveryRequestExample,
	healthAndMetricsExample,
	storageDestinationExample,
}
