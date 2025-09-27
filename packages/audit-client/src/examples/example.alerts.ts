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
		authentication: {
			type: 'apiKey',
			apiKey: 'test_GHoOmNbAmkoLOqfBxFtLHGXBZkTHbkuSDrjaRCJtxOhBZldxhdCTblBsVEyOcFwN',
		},
	})

	console.log('✅ Client initialized successfully')
	console.log('📊 Client state:', client.getState())
	console.log('🔧 Client ready:', client.isReady())

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
