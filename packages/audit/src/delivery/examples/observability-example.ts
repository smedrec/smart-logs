/**
 * Example demonstrating the delivery service with integrated observability
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: Real metrics integration example
 */

import { createDeliveryService } from '../delivery-service.js'

import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'

/**
 * Example of using the delivery service with observability enabled
 */
export async function demonstrateObservabilityIntegration(dbClient: EnhancedAuditDatabaseClient) {
	// Create delivery service with observability enabled
	const deliveryService = createDeliveryService(dbClient, {
		enableObservability: true,
		enableHealthMonitoring: true,
		observability: {
			tracing: {
				enabled: true,
				serviceName: 'audit-delivery-service',
				sampleRate: 1.0,
				exporterType: 'console', // Use console for demo
			},
			metrics: {
				enabled: true,
				serviceName: 'audit-delivery-service',
				exporterType: 'console', // Use console for demo
				collectionInterval: 10000, // 10 seconds for demo
			},
			performance: {
				enabled: true,
				trackingEnabled: true,
				slowOperationThreshold: 1000, // 1 second
				memoryTrackingEnabled: true,
			},
		},
	})

	try {
		// Start the service (this initializes observability)
		await deliveryService.start()
		console.log('✅ Delivery service with observability started')

		// Create a test destination
		const destination = await deliveryService.createDestination({
			organizationId: 'demo-org',
			label: 'Demo Webhook',
			type: 'webhook',
			config: {
				webhook: {
					url: 'https://httpbin.org/post',
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					timeout: 5000,
					retryConfig: {
						maxRetries: 3,
						backoffMultiplier: 2,
						maxBackoffDelay: 10000,
					},
				},
			},
		})

		console.log('✅ Created test destination:', destination.id)

		// Simulate some deliveries to generate metrics
		for (let i = 0; i < 10; i++) {
			const deliveryRequest = {
				organizationId: 'demo-org',
				destinations: [destination.id],
				payload: {
					type: 'report' as const,
					data: { message: `Test delivery ${i + 1}`, timestamp: new Date().toISOString() },
					metadata: { example: true, iteration: i + 1 },
				},
				options: {
					correlationId: `demo-${i + 1}`,
					priority: Math.floor(Math.random() * 10),
				},
			}

			const response = await deliveryService.deliver(deliveryRequest)
			console.log(`📤 Delivery ${i + 1} queued:`, response.deliveryId)

			// Simulate some processing time
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Wait a bit for metrics to be collected
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Get real metrics from the observability system
		const metrics = await deliveryService.getDeliveryMetrics({
			organizationId: 'demo-org',
			startDate: new Date(Date.now() - 60000).toISOString(), // Last minute
			endDate: new Date().toISOString(),
		})

		console.log('\n📊 Real Delivery Metrics:')
		console.log('- Total Deliveries:', metrics.totalDeliveries)
		console.log('- Successful Deliveries:', metrics.successfulDeliveries)
		console.log('- Failed Deliveries:', metrics.failedDeliveries)
		console.log('- Success Rate:', metrics.successRate + '%')
		console.log('- Average Delivery Time:', metrics.averageDeliveryTime + 'ms')

		console.log('\n📈 By Destination Type:')
		for (const [type, stats] of Object.entries(metrics.byDestinationType)) {
			console.log(`  ${type}:`, {
				total: stats.total,
				successRate: stats.successRate + '%',
				avgTime: stats.averageTime + 'ms',
			})
		}

		// Access advanced observability features
		const observabilityStack = deliveryService.getObservabilityStack()
		if (observabilityStack) {
			console.log('\n🔍 Advanced Observability Features Available:')

			// Get performance snapshot
			const performanceSnapshot =
				await observabilityStack.performanceMonitor.getPerformanceSnapshot()
			console.log(
				'- System CPU Usage:',
				performanceSnapshot.systemMetrics.cpuUsage.toFixed(2) + '%'
			)
			console.log(
				'- System Memory Usage:',
				(performanceSnapshot.systemMetrics.memoryUsage / 1024 / 1024).toFixed(2) + 'MB'
			)

			// Get custom metrics
			const customMetrics = await observabilityStack.metricsCollector.getCustomMetrics()
			console.log('- Custom Success Rates by Type:', customMetrics.delivery_success_rate_by_type)
		}

		// Clean up
		await deliveryService.deleteDestination(destination.id)
		console.log('✅ Cleaned up test destination')
	} catch (error) {
		console.error('❌ Error in observability demo:', error)
	} finally {
		// Stop the service (this shuts down observability)
		await deliveryService.stop()
		console.log('✅ Delivery service stopped')
	}
}

/**
 * Example of using delivery service without observability (fallback to database metrics)
 */
export async function demonstrateFallbackMetrics(dbClient: EnhancedAuditDatabaseClient) {
	// Create delivery service with observability disabled
	const deliveryService = createDeliveryService(dbClient, {
		enableObservability: false, // Disabled - will use database-based metrics
		enableHealthMonitoring: true,
	})

	try {
		await deliveryService.start()
		console.log('✅ Delivery service started (observability disabled)')

		// Get metrics - this will fall back to database-based calculation
		const metrics = await deliveryService.getDeliveryMetrics({
			organizationId: 'demo-org',
		})

		console.log('\n📊 Database-based Metrics:')
		console.log('- Total Deliveries:', metrics.totalDeliveries)
		console.log('- Success Rate:', metrics.successRate + '%')
		console.log('- Metrics source: Database delivery logs')
	} catch (error) {
		console.error('❌ Error in fallback demo:', error)
	} finally {
		await deliveryService.stop()
		console.log('✅ Delivery service stopped')
	}
}
