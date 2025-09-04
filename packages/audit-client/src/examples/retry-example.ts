import { CircuitBreakerState, HttpError, RetryManager } from '../infrastructure/retry'

import type { RetryConfig } from '../core/config'

/**
 * Example demonstrating the RetryManager functionality
 */
async function demonstrateRetryManager() {
	console.log('🔄 RetryManager Demonstration\n')

	// Create retry configuration
	const retryConfig: RetryConfig = {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 100,
		maxDelayMs: 1000,
		backoffMultiplier: 2,
		retryableStatusCodes: [408, 429, 500, 502, 503, 504],
		retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
	}

	// Circuit breaker configuration
	const circuitBreakerConfig = {
		enabled: true,
		failureThreshold: 3,
		recoveryTimeoutMs: 2000,
		monitoringWindowMs: 10000,
		minimumRequestThreshold: 2,
	}

	const retryManager = new RetryManager(retryConfig, circuitBreakerConfig)

	// Example 1: Successful retry after transient failure
	console.log('1️⃣ Testing successful retry after transient failure')
	let attempt = 0
	const successAfterRetry = async () => {
		attempt++
		if (attempt < 3) {
			throw new HttpError(500, 'Internal Server Error')
		}
		return 'Success!'
	}

	try {
		const result = await retryManager.execute(successAfterRetry, {
			endpoint: '/api/test',
			requestId: 'req-1',
		})
		console.log(`✅ Result: ${result}`)
		console.log(`📊 Attempts made: ${attempt}\n`)
	} catch (error) {
		console.log(`❌ Failed: ${error.message}\n`)
	}

	// Example 2: Network error retry
	console.log('2️⃣ Testing network error retry')
	attempt = 0
	const networkErrorThenSuccess = async () => {
		attempt++
		if (attempt < 2) {
			throw new Error('ECONNRESET: Connection reset by peer')
		}
		return 'Network recovered!'
	}

	try {
		const result = await retryManager.execute(networkErrorThenSuccess, {
			endpoint: '/api/network',
			requestId: 'req-2',
		})
		console.log(`✅ Result: ${result}`)
		console.log(`📊 Attempts made: ${attempt}\n`)
	} catch (error) {
		console.log(`❌ Failed: ${error.message}\n`)
	}

	// Example 3: Non-retryable error (should fail immediately)
	console.log('3️⃣ Testing non-retryable error (400 Bad Request)')
	const nonRetryableError = async () => {
		throw new HttpError(400, 'Bad Request')
	}

	try {
		await retryManager.execute(nonRetryableError, {
			endpoint: '/api/bad-request',
			requestId: 'req-3',
		})
	} catch (error) {
		console.log(`✅ Correctly failed immediately: ${error.message}`)
		console.log(`📊 No retries attempted for 4xx errors\n`)
	}

	// Example 4: Circuit breaker demonstration
	console.log('4️⃣ Testing circuit breaker pattern')
	const alwaysFails = async () => {
		throw new HttpError(500, 'Service Unavailable')
	}

	// Generate failures to trigger circuit breaker
	for (let i = 1; i <= 3; i++) {
		try {
			await retryManager.execute(alwaysFails, {
				endpoint: '/api/failing-service',
				requestId: `req-4-${i}`,
			})
		} catch (error) {
			console.log(`❌ Attempt ${i}: ${error.constructor.name}`)
		}
	}

	// Check circuit breaker stats
	const stats = retryManager.getCircuitBreakerStats('/api/failing-service:GET')
	console.log(`📊 Circuit breaker state: ${stats?.state}`)
	console.log(`📊 Failure count: ${stats?.failureCount}`)
	console.log(`📊 Total requests: ${stats?.totalRequests}`)

	// Next request should be blocked by circuit breaker
	try {
		await retryManager.execute(alwaysFails, {
			endpoint: '/api/failing-service',
			requestId: 'req-4-blocked',
		})
	} catch (error) {
		console.log(`🚫 Circuit breaker blocked request: ${error.constructor.name}`)
		console.log(`⏰ Next retry time: ${new Date(error.nextRetryTime).toISOString()}\n`)
	}

	// Example 5: Configuration updates
	console.log('5️⃣ Testing configuration updates')
	console.log(`📊 Current max attempts: ${retryManager.getConfig().maxAttempts}`)

	retryManager.updateConfig({ maxAttempts: 5 })
	console.log(`📊 Updated max attempts: ${retryManager.getConfig().maxAttempts}`)

	// Reset circuit breaker
	retryManager.resetCircuitBreaker('/api/failing-service:GET')
	const resetStats = retryManager.getCircuitBreakerStats('/api/failing-service:GET')
	console.log(`🔄 Circuit breaker reset: ${resetStats ? 'Still exists' : 'Cleared'}\n`)

	// Example 6: Exponential backoff demonstration
	console.log('6️⃣ Testing exponential backoff timing')
	const startTime = Date.now()
	attempt = 0
	const trackTiming = async () => {
		attempt++
		const elapsed = Date.now() - startTime
		console.log(`⏱️  Attempt ${attempt} at ${elapsed}ms`)
		throw new HttpError(503, 'Service Temporarily Unavailable')
	}

	try {
		await retryManager.execute(trackTiming, {
			endpoint: '/api/timing-test',
			requestId: 'req-6',
		})
	} catch (error) {
		const totalTime = Date.now() - startTime
		console.log(`⏱️  Total time: ${totalTime}ms`)
		console.log(`📊 Exponential backoff with jitter applied\n`)
	}

	console.log('🎉 RetryManager demonstration completed!')
}

// Run the demonstration
demonstrateRetryManager().catch(console.error)

export { demonstrateRetryManager }
