/**
 * Performance Monitoring Example
 *
 * This example demonstrates how to use the built-in performance monitoring
 * features to track metrics, enforce budgets, and optimize your application.
 */

import { AuditClient } from '@smedrec/audit-client'

// Initialize client with performance monitoring enabled
const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
	performance: {
		enabled: true,
		budget: {
			maxBundleSize: 140 * 1024, // 140KB gzipped
			maxInitTime: 100, // 100ms
			maxRequestTime: 1000, // 1 second (p95)
			maxMemoryUsage: 50 * 1024 * 1024, // 50MB
			maxCacheSize: 100, // 100 entries
		},
	},
	cache: {
		enabled: true,
		maxSize: 100,
		defaultTtlMs: 300000, // 5 minutes
	},
	retry: {
		enabled: true,
		circuitBreaker: {
			enabled: true,
			failureThreshold: 5,
			resetTimeout: 60000,
		},
	},
})

// Example 1: Basic Performance Monitoring
async function basicMonitoring() {
	console.log('=== Basic Performance Monitoring ===\n')

	// Make some requests
	for (let i = 0; i < 10; i++) {
		try {
			await client.events.create({
				action: 'user.login',
				principalId: `user-${i}`,
				organizationId: 'org-123',
				status: 'success',
			})
		} catch (error) {
			console.error('Request failed:', error)
		}
	}

	// Get performance metrics
	const metrics = client.getPerformanceMetrics()
	console.log('Performance Metrics:', {
		avgRequestTime: `${metrics.avgRequestTime.toFixed(2)}ms`,
		p95RequestTime: `${metrics.p95RequestTime.toFixed(2)}ms`,
		p99RequestTime: `${metrics.p99RequestTime.toFixed(2)}ms`,
		cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
		errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
		memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
	})
	console.log()
}

// Example 2: Performance Budget Enforcement
async function budgetEnforcement() {
	console.log('=== Performance Budget Enforcement ===\n')

	// Check for budget violations
	const violations = client.checkPerformanceBudget()

	if (violations.length === 0) {
		console.log('✅ All performance budgets met!')
	} else {
		console.warn('⚠️  Performance Budget Violations:')
		violations.forEach((v) => {
			console.warn(`  - ${v.metric}: ${v.actual} > ${v.budget} (${v.severity})`)
		})
	}
	console.log()
}

// Example 3: Performance Report
async function performanceReport() {
	console.log('=== Performance Report ===\n')

	const report = client.getPerformanceReport()

	console.log('Report Generated:', report.timestamp)
	console.log('Status:', report.passed ? '✅ PASSED' : '❌ FAILED')
	console.log('Summary:', report.summary)
	console.log()

	console.log('Metrics:')
	console.log(`  Bundle Size: ${(report.metrics.bundleSize / 1024).toFixed(2)}KB`)
	console.log(`  Init Time: ${report.metrics.initTime}ms`)
	console.log(`  Avg Request Time: ${report.metrics.avgRequestTime.toFixed(2)}ms`)
	console.log(`  P95 Request Time: ${report.metrics.p95RequestTime.toFixed(2)}ms`)
	console.log(`  Memory Usage: ${(report.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
	console.log(`  Cache Hit Rate: ${(report.metrics.cacheHitRate * 100).toFixed(1)}%`)
	console.log()

	if (report.violations.length > 0) {
		console.log('Violations:')
		report.violations.forEach((v) => {
			console.log(`  - ${v.metric}: ${v.actual} > ${v.budget}`)
		})
		console.log()
	}
}

// Example 4: Continuous Monitoring
function continuousMonitoring() {
	console.log('=== Continuous Monitoring ===\n')
	console.log('Starting continuous monitoring (press Ctrl+C to stop)...\n')

	// Monitor performance every minute
	const interval = setInterval(() => {
		const metrics = client.getPerformanceMetrics()
		const violations = client.checkPerformanceBudget()

		console.log(`[${new Date().toISOString()}] Performance Check:`)
		console.log(`  Avg Request Time: ${metrics.avgRequestTime.toFixed(2)}ms`)
		console.log(`  P95 Request Time: ${metrics.p95RequestTime.toFixed(2)}ms`)
		console.log(`  Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
		console.log(`  Error Rate: ${(metrics.errorRate * 100).toFixed(1)}%`)

		if (violations.length > 0) {
			console.warn('  ⚠️  Violations:', violations.length)
		} else {
			console.log('  ✅ All budgets met')
		}
		console.log()
	}, 60000) // Every minute

	// Clean up on exit
	process.on('SIGINT', () => {
		clearInterval(interval)
		client.destroy()
		console.log('\nMonitoring stopped.')
		process.exit(0)
	})
}

// Example 5: Circuit Breaker Monitoring
async function circuitBreakerMonitoring() {
	console.log('=== Circuit Breaker Monitoring ===\n')

	const retryManager = client.getRetryManager()
	const stats = retryManager.getCircuitBreakerStats()

	console.log('Circuit Breaker Status:')
	console.log(`  State: ${stats.state}`)
	console.log(`  Failure Count: ${stats.failureCount}`)
	console.log(`  Success Count: ${stats.successCount}`)

	if (stats.lastFailureTime) {
		console.log(`  Last Failure: ${new Date(stats.lastFailureTime).toISOString()}`)
	}

	if (stats.nextAttemptTime) {
		console.log(`  Next Attempt: ${new Date(stats.nextAttemptTime).toISOString()}`)
	}

	console.log()

	// Alert if circuit is open
	if (stats.state === 'open') {
		console.warn('⚠️  Circuit breaker is OPEN - requests will fail immediately')
		console.warn(`   Will retry at: ${new Date(stats.nextAttemptTime!).toISOString()}`)
	} else if (stats.state === 'half-open') {
		console.log('ℹ️  Circuit breaker is HALF-OPEN - testing service recovery')
	} else {
		console.log('✅ Circuit breaker is CLOSED - normal operation')
	}
	console.log()
}

// Example 6: Performance Optimization Tips
async function optimizationTips() {
	console.log('=== Performance Optimization Tips ===\n')

	const metrics = client.getPerformanceMetrics()
	const violations = client.checkPerformanceBudget()

	// Analyze and provide tips
	const tips: string[] = []

	if (metrics.cacheHitRate < 0.5) {
		tips.push('💡 Cache hit rate is low (<50%). Consider:')
		tips.push('   - Increasing cache TTL')
		tips.push('   - Increasing cache size')
		tips.push('   - Reviewing cache key strategy')
	}

	if (metrics.p95RequestTime > 1000) {
		tips.push('💡 P95 request time is high (>1s). Consider:')
		tips.push('   - Enabling request compression')
		tips.push('   - Enabling response caching')
		tips.push('   - Checking network latency')
	}

	if (metrics.errorRate > 0.05) {
		tips.push('💡 Error rate is high (>5%). Consider:')
		tips.push('   - Reviewing error logs')
		tips.push('   - Adjusting retry configuration')
		tips.push('   - Checking API health')
	}

	if (metrics.memoryUsage > 40 * 1024 * 1024) {
		tips.push('💡 Memory usage is high (>40MB). Consider:')
		tips.push('   - Reducing cache size')
		tips.push('   - Enabling response streaming')
		tips.push('   - Checking for memory leaks')
	}

	if (tips.length === 0) {
		console.log('✅ Performance looks good! No optimization tips at this time.')
	} else {
		console.log('Optimization Suggestions:')
		tips.forEach((tip) => console.log(tip))
	}
	console.log()
}

// Run all examples
async function main() {
	try {
		await basicMonitoring()
		await budgetEnforcement()
		await performanceReport()
		await circuitBreakerMonitoring()
		await optimizationTips()

		// Uncomment to run continuous monitoring
		// continuousMonitoring()
	} catch (error) {
		console.error('Error:', error)
	} finally {
		await client.destroy()
	}
}

// Run if executed directly
if (require.main === module) {
	main()
}

export {
	basicMonitoring,
	budgetEnforcement,
	performanceReport,
	continuousMonitoring,
	circuitBreakerMonitoring,
	optimizationTips,
}
