/**
 * AuditClient Usage Examples
 *
 * This file demonstrates how to use the main AuditClient class
 * with various configuration options and service interactions.
 */

import { AuditClient } from '../core/client'

import type { PartialAuditClientConfig } from '../core/config'

// Example 1: Basic client initialization
export async function basicClientExample() {
	console.log('🚀 Basic AuditClient Example\n')

	// Create client with minimal configuration
	const client = new AuditClient({
		baseUrl: 'http://localhost:3000',
		apiVersion: 'v1',
		timeout: 30000,
		authentication: {
			type: 'apiKey',
			apiKey: 'test_GHoOmNbAmkoLOqfBxFtLHGXBZkTHbkuSDrjaRCJtxOhBZldxhdCTblBsVEyOcFwN',
		},
		retry: {
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 10000,
			backoffMultiplier: 2,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
			retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
		},
		/**cache: {
			enabled: false,
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 100,
			storage: 'localStorage',
			keyPrefix: 'audit-cache',
			compressionEnabled: false,
		},*/
		batching: {
			enabled: true,
			maxBatchSize: 10,
			batchTimeoutMs: 1000,
			batchableEndpoints: ['/audit/events'],
		},
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 5,
			requestDeduplication: true,
			responseTransformation: true,
		},
		logging: {
			enabled: true,
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
		errorHandling: {
			throwOnError: true,
			includeStackTrace: true,
			//errorTransformation: true,
		},
	})

	console.log('✅ Client initialized successfully')
	console.log('📊 Client state:', client.getState())
	console.log('🔧 Client ready:', client.isReady())

	// Health check
	const health = await client.health.check()
	console.log('\n🏥 Health check:', health)

	// Access services
	console.log('\n📋 Available services:')
	console.log('- Events service:', !!client.events)
	console.log('- Compliance service:', !!client.compliance)
	console.log('- Scheduled reports service:', !!client.scheduledReports)
	console.log('- Presets service:', !!client.presets)
	console.log('- Metrics service:', !!client.metrics)
	console.log('- Health service:', !!client.health)

	// Get client statistics
	const stats = client.getStats()
	console.log('\n📈 Client statistics:')
	console.log('- Uptime:', stats.uptime, 'ms')
	console.log('- Request count:', stats.requestCount)
	console.log('- Error count:', stats.errorCount)

	const statistics = await client.metrics.getAlertStatistics()
	console.log('\n📈 Alert statistics:')
	console.log('- Total:', statistics.total, 'alerts')
	console.log('- Active:', statistics.active, 'alerts')
	console.log('- by type:', statistics.byType)

	// Get infrastructure statistics
	console.log('📊 Infrastructure statistics:')
	const infraStats = client.getInfrastructureStats()
	console.log('- Cache stats available:', !!infraStats.cache)
	console.log('- Retry stats available:', !!infraStats.retry)
	console.log('- Batch stats available:', !!infraStats.batch)
	console.log('- Auth stats available:', !!infraStats.auth)

	// Get service statistics
	console.log('\n📋 Service statistics:')
	const serviceStats = client.getServiceStats()
	console.log('- Events service stats:', !!serviceStats.events)
	console.log('- Compliance service stats:', !!serviceStats.compliance)
	console.log('- Health service stats:', !!serviceStats.health)

	// Perform health check (this will fail with the example URL, but shows the structure)
	console.log('\n🏥 Performing health check...')
	try {
		const healthResult = await client.healthCheck()
		console.log('✅ Health check result:')
		console.log('- Overall status:', healthResult.overall)
		console.log('- Services:', Object.keys(healthResult.services).length)
		console.log('- Timestamp:', healthResult.timestamp)
	} catch (error) {
		console.log('❌ Health check failed (expected with example URL)')
		console.log('- This is normal for the example - real API would work')
	}

	// Cleanup
	await client.destroy()
	console.log('🧹 Client destroyed successfully\n')
}

// Run all examples
export async function runAllExamples() {
	console.log('🎯 AuditClient Usage Examples\n')
	console.log('='.repeat(50))

	try {
		await basicClientExample()
		//await advancedConfigurationExample()
		//await environmentSpecificExample()
		//await configurationAndInterceptorsExample()
		//await healthCheckAndMonitoringExample()
		//configurationValidationExample()

		console.log('🎉 All examples completed successfully!')
	} catch (error) {
		console.error('❌ Example failed:', error)
	}
}

// Run examples if this file is executed directly

runAllExamples()
