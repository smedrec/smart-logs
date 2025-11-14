/**
 * Circuit Breaker Persistence Example
 *
 * This example demonstrates how to use circuit breaker persistence to maintain
 * circuit breaker state across application restarts.
 */

import { AuditClient } from '../core/client'
import {
	LocalStorageCircuitBreakerPersistence,
	MemoryCircuitBreakerPersistence,
	RetryManager,
} from '../infrastructure/retry'

import type { AuditClientConfig } from '../core/config'

/**
 * Example 1: Using Memory Persistence (for testing/development)
 */
export function exampleMemoryPersistence() {
	// Create a memory-based persistence implementation
	const persistence = new MemoryCircuitBreakerPersistence()

	// Create a retry manager with persistence
	const retryManager = RetryManager.createDefault(persistence)

	console.log('Memory persistence example:')
	console.log('- Circuit breaker state will be persisted in memory')
	console.log('- State will be lost when the process exits')
	console.log('- Useful for testing and development')

	return retryManager
}

/**
 * Example 2: Using LocalStorage Persistence (for browser environments)
 */
export function exampleLocalStoragePersistence() {
	// Create a localStorage-based persistence implementation
	// The prefix helps organize keys in localStorage
	const persistence = new LocalStorageCircuitBreakerPersistence('my-app:circuit-breaker:')

	// Create a retry manager with persistence
	const retryManager = RetryManager.createDefault(persistence)

	console.log('LocalStorage persistence example:')
	console.log('- Circuit breaker state will be persisted in browser localStorage')
	console.log('- State will survive page refreshes and browser restarts')
	console.log('- Only states less than 1 hour old will be restored')

	return retryManager
}

/**
 * Example 3: Using Persistence with AuditClient
 */
export async function exampleAuditClientWithPersistence() {
	const config: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		retry: {
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			backoffMultiplier: 2,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
			retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
		},
	}

	// Create persistence implementation
	const persistence = new LocalStorageCircuitBreakerPersistence('audit-client:cb:')

	// Create client
	const client = new AuditClient(config)

	// Note: Currently, you would need to pass persistence to the RetryManager
	// when it's created internally by the client. This would require updating
	// the client to accept persistence configuration.

	console.log('AuditClient with persistence:')
	console.log('- Circuit breaker state persists across page reloads')
	console.log('- Failed services remain blocked after restart')
	console.log('- Reduces unnecessary retry attempts on known-failing services')

	return client
}

/**
 * Example 4: Manually Loading Persisted State
 */
export async function exampleManualStateLoading() {
	const persistence = new MemoryCircuitBreakerPersistence()

	// Simulate some persisted state
	await persistence.save('/api/users:GET', {
		state: 'open' as const,
		failureCount: 5,
		successCount: 2,
		totalRequests: 7,
		lastFailureTime: Date.now() - 300000, // 5 minutes ago
		nextRetryTime: Date.now() + 60000, // 1 minute from now
		persistedAt: Date.now() - 300000,
	})

	// Create retry manager with persistence
	const retryManager = RetryManager.createDefault(persistence)

	// Manually load persisted state
	await retryManager.loadPersistedState()

	// Check if state was loaded
	const stats = retryManager.getCircuitBreakerStats('/api/users:GET')
	console.log('Loaded circuit breaker state:', stats)

	return retryManager
}

/**
 * Example 5: Clearing Persisted State
 */
export async function exampleClearingPersistedState() {
	const persistence = new LocalStorageCircuitBreakerPersistence('my-app:cb:')

	// Clear a specific circuit breaker
	await persistence.clear('/api/users:GET')
	console.log('Cleared circuit breaker state for /api/users:GET')

	// Clear all circuit breakers
	await persistence.clearAll()
	console.log('Cleared all circuit breaker states')
}

/**
 * Example 6: Custom Persistence Implementation
 */
export class CustomDatabasePersistence {
	// This is a placeholder showing how you could implement
	// persistence using a database or other storage mechanism

	async save(key: string, stats: any): Promise<void> {
		// Save to database
		console.log(`Saving circuit breaker state for ${key} to database`)
		// await db.circuitBreakers.upsert({ key, stats })
	}

	async load(key: string): Promise<any> {
		// Load from database
		console.log(`Loading circuit breaker state for ${key} from database`)
		// return await db.circuitBreakers.findOne({ key })
		return null
	}

	async loadAll(): Promise<Map<string, any>> {
		// Load all from database
		console.log('Loading all circuit breaker states from database')
		// const records = await db.circuitBreakers.findAll()
		// return new Map(records.map(r => [r.key, r.stats]))
		return new Map()
	}

	async clear(key: string): Promise<void> {
		// Clear from database
		console.log(`Clearing circuit breaker state for ${key} from database`)
		// await db.circuitBreakers.delete({ key })
	}

	async clearAll(): Promise<void> {
		// Clear all from database
		console.log('Clearing all circuit breaker states from database')
		// await db.circuitBreakers.deleteAll()
	}
}

/**
 * Example 7: Monitoring Persisted State
 */
export async function exampleMonitoringPersistedState() {
	const persistence = new MemoryCircuitBreakerPersistence()
	const retryManager = RetryManager.createDefault(persistence)

	// Load persisted state
	await retryManager.loadPersistedState()

	// Get all circuit breaker stats
	const allStats = retryManager.getCircuitBreakerStats()

	if (allStats instanceof Map) {
		console.log(`Found ${allStats.size} circuit breakers:`)
		for (const [key, stats] of allStats) {
			console.log(`  ${key}:`, {
				state: stats.state,
				failureCount: stats.failureCount,
				successCount: stats.successCount,
				totalRequests: stats.totalRequests,
			})
		}
	}
}

// Run examples
if (require.main === module) {
	console.log('=== Circuit Breaker Persistence Examples ===\n')

	console.log('Example 1: Memory Persistence')
	exampleMemoryPersistence()
	console.log()

	console.log('Example 2: LocalStorage Persistence')
	exampleLocalStoragePersistence()
	console.log()

	console.log('Example 4: Manual State Loading')
	exampleManualStateLoading()
	console.log()

	console.log('Example 5: Clearing Persisted State')
	exampleClearingPersistedState()
	console.log()

	console.log('Example 7: Monitoring Persisted State')
	exampleMonitoringPersistedState()
}
