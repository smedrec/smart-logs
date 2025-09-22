/**
 * Performance Optimization Examples
 *
 * This file demonstrates how to use the performance optimization features
 * of the audit client library including compression, streaming, request queuing,
 * metrics collection, and request deduplication.
 */

import { AuditClient } from '../core/client'

import type { AuditClientConfig } from '../core/config'

/**
 * Example 1: Basic Performance Configuration
 */
export async function basicPerformanceConfig() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		// Enable all performance optimizations
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 10,
			requestDeduplication: true,
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 1000,
			compressionThreshold: 1024, // Compress requests larger than 1KB
			streamingThreshold: 10240, // Stream responses larger than 10KB
		},
		// Configure caching for better performance
		cache: {
			enabled: true,
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 1000,
			storage: 'memory',
			compressionEnabled: true,
		},
		// Configure retry with exponential backoff
		retry: {
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			backoffMultiplier: 2,
		},
	}

	const client = new AuditClient(config)

	// Create some audit events to demonstrate performance features
	const events = Array.from({ length: 100 }, (_, i) => ({
		action: 'user.login',
		targetResourceType: 'user',
		targetResourceId: `user-${i}`,
		principalId: `user-${i}`,
		organizationId: 'org-123',
		status: 'success' as const,
		details: {
			timestamp: new Date().toISOString(),
			userAgent: 'Mozilla/5.0...',
			ipAddress: '192.168.1.1',
			sessionId: `session-${i}`,
			// Add some data to make the request larger for compression testing
			metadata: {
				largeData: 'x'.repeat(2000), // This will trigger compression
			},
		},
	}))

	console.log('Creating audit events with performance optimizations...')

	// Bulk create events - this will use request queuing and compression
	const startTime = Date.now()
	const result = await client.events.bulkCreate(events)
	const duration = Date.now() - startTime

	console.log(`Created ${result.created} events in ${duration}ms`)

	// Get performance metrics
	const performanceStats = client.getPerformanceStats()
	console.log('Performance Statistics:', {
		totalRequests: performanceStats.metrics.requestCount,
		averageResponseTime: performanceStats.metrics.averageDuration,
		compressionRatio: performanceStats.metrics.compressionRatio,
		cacheHitRate: performanceStats.metrics.cacheHitRate,
		queueStats: performanceStats.queue,
	})

	return client
}

/**
 * Example 2: Streaming Large Datasets
 */
export async function streamingExample() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 5,
			requestDeduplication: true,
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 1000,
			compressionThreshold: 1024,
			streamingThreshold: 1024, // Lower threshold for demo
		},
	}

	const client = new AuditClient(config)

	console.log('Streaming large dataset...')

	// Query for a large dataset that will be streamed
	const streamParams = {
		filter: {
			dateRange: {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-12-31T23:59:59Z',
			},
		},
		pagination: {
			limit: 10000, // Large limit to trigger streaming
		},
	}

	try {
		// This would normally return a stream for large responses
		const events = await client.events.query(streamParams)
		console.log(`Retrieved ${events.events.length} events`)

		// Example of processing a stream manually
		// Note: This is a mock example since we don't have a real streaming endpoint
		const mockStreamResponse = new Response(
			new ReadableStream({
				start(controller) {
					// Simulate streaming JSON data
					for (let i = 0; i < 10; i++) {
						const chunk =
							JSON.stringify({
								id: `event-${i}`,
								action: 'user.action',
								timestamp: new Date().toISOString(),
							}) + '\n'
						controller.enqueue(new TextEncoder().encode(chunk))
					}
					controller.close()
				},
			}),
			{
				headers: {
					'content-type': 'application/json',
					'content-length': '10000', // Large enough to trigger streaming
				},
			}
		)

		// Create a stream reader
		const streamReader = client.createStreamReader(mockStreamResponse)
		let processedCount = 0

		// Process stream with backpressure handling
		await client.processStream(
			streamReader,
			async (chunk) => {
				// Process each chunk
				console.log(`Processing chunk:`, chunk)
				processedCount++
			},
			{
				maxConcurrency: 3,
				bufferSize: 50,
				onProgress: (processed) => {
					console.log(`Processed ${processed} items`)
				},
			}
		)

		console.log(`Finished processing ${processedCount} chunks`)
	} catch (error) {
		console.error('Streaming error:', error)
	}

	return client
}

/**
 * Example 3: Request Deduplication
 */
export async function deduplicationExample() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 10,
			requestDeduplication: true, // Enable deduplication
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 1000,
			compressionThreshold: 1024,
			streamingThreshold: 10240,
		},
	}

	const client = new AuditClient(config)

	console.log('Testing request deduplication...')

	// Make multiple identical requests simultaneously
	const promises = Array.from({ length: 5 }, () =>
		client.events.query({
			filter: {
				actions: ['user.login'],
			},
			pagination: {
				limit: 10,
			},
		})
	)

	const startTime = Date.now()
	const results = await Promise.all(promises)
	const duration = Date.now() - startTime

	console.log(`Made 5 identical requests in ${duration}ms`)
	console.log(
		`All results identical:`,
		results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]))
	)

	// Check performance metrics to see deduplication in action
	const stats = client.getPerformanceStats()
	console.log('Deduplication stats:', stats.deduplication)

	return client
}

/**
 * Example 4: Advanced Performance Monitoring
 */
export async function performanceMonitoringExample() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 5,
			requestDeduplication: true,
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 1000,
			compressionThreshold: 1024,
			streamingThreshold: 10240,
		},
		logging: {
			enabled: true,
			level: 'info',
			format: 'json',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
	}

	const client = new AuditClient(config)

	console.log('Performance monitoring example...')

	// Perform various operations to generate metrics
	const operations = [
		() => client.events.query({ pagination: { limit: 10 } }),
		() => client.health.check(),
		() => client.metrics.getSystemMetrics(),
		() =>
			client.events.create({
				action: 'user.login',
				targetResourceType: 'user',
				principalId: 'user-123',
				organizationId: 'org-123',
				status: 'success',
			}),
	]

	// Execute operations with different priorities
	const promises = operations.map((op, index) => {
		const performanceManager = client.getPerformanceManager()
		return performanceManager.getQueueManager().enqueue(op, {
			priority: index + 1,
			metadata: { operation: `operation-${index}` },
		})
	})

	await Promise.all(promises)

	// Get comprehensive performance statistics
	const stats = client.getPerformanceStats()

	console.log('=== Performance Report ===')
	console.log('Request Metrics:', {
		totalRequests: stats.metrics.requestCount,
		successfulRequests: stats.metrics.successCount,
		failedRequests: stats.metrics.errorCount,
		averageResponseTime: `${stats.metrics.averageDuration.toFixed(2)}ms`,
		minResponseTime: `${stats.metrics.minDuration}ms`,
		maxResponseTime: `${stats.metrics.maxDuration}ms`,
		totalBytesTransferred: stats.metrics.bytesTransferred,
		compressionRatio: `${(stats.metrics.compressionRatio * 100).toFixed(1)}%`,
		cacheHitRate: `${(stats.metrics.cacheHitRate * 100).toFixed(1)}%`,
	})

	console.log('Queue Statistics:', {
		activeRequests: stats.queue.activeRequests,
		queuedRequests: stats.queue.queuedRequests,
		completedRequests: stats.queue.completedRequests,
		failedRequests: stats.queue.failedRequests,
		averageWaitTime: `${stats.queue.averageWaitTime.toFixed(2)}ms`,
		maxWaitTime: `${stats.queue.maxWaitTime}ms`,
	})

	console.log('Deduplication Statistics:', {
		pendingRequests: stats.deduplication.pendingRequests,
		cachedHashes: stats.deduplication.cachedHashes,
	})

	// Reset performance tracking for next test
	client.resetPerformanceTracking()

	return client
}

/**
 * Example 5: Custom Performance Configuration
 */
export async function customPerformanceConfig() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		performance: {
			enableCompression: true,
			enableStreaming: false, // Disable streaming for this example
			maxConcurrentRequests: 3, // Lower concurrency limit
			requestDeduplication: false, // Disable deduplication
			responseTransformation: true,
			metricsCollection: true,
			metricsBufferSize: 500, // Smaller buffer
			compressionThreshold: 512, // Lower compression threshold
			streamingThreshold: 5120, // Higher streaming threshold
		},
	}

	const client = new AuditClient(config)

	console.log('Custom performance configuration example...')

	// Test with custom configuration
	const events = Array.from({ length: 20 }, (_, i) => ({
		action: 'data.access',
		targetResourceType: 'document',
		targetResourceId: `doc-${i}`,
		principalId: 'user-123',
		organizationId: 'org-123',
		status: 'success' as const,
		details: {
			// Small payload to test compression threshold
			data: 'x'.repeat(600), // Just above compression threshold
		},
	}))

	// Create events in batches to test queue management
	const batchSize = 5
	const batches = []

	for (let i = 0; i < events.length; i += batchSize) {
		batches.push(events.slice(i, i + batchSize))
	}

	console.log(`Processing ${batches.length} batches of ${batchSize} events each...`)

	const startTime = Date.now()

	for (const [index, batch] of batches.entries()) {
		console.log(`Processing batch ${index + 1}/${batches.length}`)
		await client.events.bulkCreate(batch)

		// Show queue status
		const queueStats = client.getPerformanceStats().queue
		console.log(`Queue: ${queueStats.activeRequests} active, ${queueStats.queuedRequests} queued`)
	}

	const duration = Date.now() - startTime
	console.log(`Completed all batches in ${duration}ms`)

	// Final performance report
	const finalStats = client.getPerformanceStats()
	console.log('Final Performance Stats:', {
		totalRequests: finalStats.metrics.requestCount,
		averageResponseTime: finalStats.metrics.averageDuration,
		compressionRatio: finalStats.metrics.compressionRatio,
		totalProcessed: finalStats.queue.completedRequests,
	})

	return client
}

/**
 * Run all performance examples
 */
export async function runAllPerformanceExamples() {
	console.log('🚀 Running Performance Optimization Examples\n')

	try {
		console.log('1. Basic Performance Configuration')
		await basicPerformanceConfig()
		console.log('✅ Completed\n')

		console.log('2. Streaming Example')
		await streamingExample()
		console.log('✅ Completed\n')

		console.log('3. Request Deduplication')
		await deduplicationExample()
		console.log('✅ Completed\n')

		console.log('4. Performance Monitoring')
		await performanceMonitoringExample()
		console.log('✅ Completed\n')

		console.log('5. Custom Performance Configuration')
		await customPerformanceConfig()
		console.log('✅ Completed\n')

		console.log('🎉 All performance examples completed successfully!')
	} catch (error) {
		console.error('❌ Error running performance examples:', error)
	}
}

// Export individual examples for selective testing
export {
	basicPerformanceConfig,
	streamingExample,
	deduplicationExample,
	performanceMonitoringExample,
	customPerformanceConfig,
}
