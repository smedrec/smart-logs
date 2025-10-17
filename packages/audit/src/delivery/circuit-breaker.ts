/**
 * Circuit Breaker - Destination protection and failure management
 * Requirements 3.4, 3.5, 7.3, 7.5: Circuit breaker pattern for destination protection
 */

import { StructuredLogger } from '@repo/logs'

import type { DeliveryDatabaseClient } from './database-client.js'
import type { CircuitBreakerState, ICircuitBreaker } from './interfaces.js'

/**
 * Configuration for circuit breaker
 */
export interface CircuitBreakerConfig {
	failureThreshold: number // Number of failures before opening circuit
	recoveryTimeout: number // Time in milliseconds before attempting recovery
	successThreshold: number // Number of successes needed to close circuit in half-open state
	monitoringWindow: number // Time window in milliseconds for failure counting
	volumeThreshold: number // Minimum number of requests before circuit can open
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5, // Open after 5 consecutive failures
	recoveryTimeout: 60000, // 1 minute recovery timeout
	successThreshold: 3, // Need 3 successes to close from half-open
	monitoringWindow: 300000, // 5 minute monitoring window
	volumeThreshold: 10, // Need at least 10 requests before opening
}

/**
 * Circuit breaker metrics for monitoring
 */
export interface CircuitBreakerMetrics {
	destinationId: string
	state: 'closed' | 'open' | 'half-open'
	failureCount: number
	successCount: number
	totalRequests: number
	failureRate: number
	lastFailureAt?: string
	lastSuccessAt?: string
	openedAt?: string
	lastStateChange: string
	timeInCurrentState: number
}

/**
 * Circuit breaker implementation for destination protection
 */
export class CircuitBreaker implements ICircuitBreaker {
	private readonly logger: StructuredLogger
	private readonly config: CircuitBreakerConfig

	constructor(
		private readonly dbClient: DeliveryDatabaseClient,
		config: Partial<CircuitBreakerConfig> = {}
	) {
		this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config }

		this.logger = new StructuredLogger({
			service: '@repo/audit - CircuitBreaker',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})
	}

	/**
	 * Check if circuit breaker is open for a destination
	 * Requirements 3.4, 3.5: Circuit breaker state management
	 */
	async isOpen(destinationId: string): Promise<boolean> {
		try {
			const state = await this.getState(destinationId)

			// If circuit is open, check if recovery timeout has passed
			if (state.state === 'open' && state.openedAt) {
				const openedTime = new Date(state.openedAt).getTime()
				const now = Date.now()

				if (now - openedTime >= this.config.recoveryTimeout) {
					// Transition to half-open state
					await this.transitionToHalfOpen(destinationId)
					return false // Allow one request to test
				}

				return true // Still in open state
			}

			return state.state === 'open'
		} catch (error) {
			this.logger.error('Error checking circuit breaker state', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			// Fail safe - assume circuit is closed on error
			return false
		}
	}

	/**
	 * Record successful delivery attempt
	 * Requirements 3.4, 3.5: Success tracking and circuit recovery
	 */
	async recordSuccess(destinationId: string): Promise<void> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			const currentState = health?.circuitBreakerState || 'closed'

			// Update destination health with success
			await this.dbClient.health.recordSuccess(destinationId, 0) // Response time handled elsewhere

			if (currentState === 'half-open') {
				// Count successes in half-open state
				const metadata = health?.metadata || {}
				const halfOpenSuccesses = (metadata.halfOpenSuccesses || 0) + 1

				if (halfOpenSuccesses >= this.config.successThreshold) {
					// Close the circuit - destination has recovered
					await this.transitionToClosed(destinationId)
					this.logger.info('Circuit breaker closed - destination recovered', {
						destinationId,
						successesNeeded: this.config.successThreshold,
					})
				} else {
					// Update success count in half-open state
					await this.dbClient.health.upsert(destinationId, {
						metadata: {
							...metadata,
							halfOpenSuccesses,
						},
					})
				}
			} else if (currentState === 'open') {
				// This shouldn't happen, but handle gracefully
				this.logger.warn('Success recorded for open circuit - transitioning to half-open', {
					destinationId,
				})
				await this.transitionToHalfOpen(destinationId)
			}

			this.logger.debug('Circuit breaker success recorded', {
				destinationId,
				currentState,
			})
		} catch (error) {
			this.logger.error('Error recording circuit breaker success', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Record failed delivery attempt
	 * Requirements 3.4, 3.5: Failure tracking and circuit opening
	 */
	async recordFailure(destinationId: string): Promise<void> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			const currentState = health?.circuitBreakerState || 'closed'

			// Update destination health with failure
			await this.dbClient.health.recordFailure(destinationId, 'Delivery failed')

			// Get updated health after recording failure
			const updatedHealth = await this.dbClient.health.findByDestinationId(destinationId)

			if (!updatedHealth) {
				this.logger.error('Could not retrieve updated health after recording failure', {
					destinationId,
				})
				return
			}

			// Check if we should open the circuit
			if (currentState === 'closed' || currentState === 'half-open') {
				const shouldOpen = await this.shouldOpenCircuit(updatedHealth)

				if (shouldOpen) {
					await this.transitionToOpen(destinationId, 'Failure threshold exceeded')
					this.logger.warn('Circuit breaker opened due to failures', {
						destinationId,
						consecutiveFailures: updatedHealth.consecutiveFailures,
						threshold: this.config.failureThreshold,
					})
				}
			}

			this.logger.debug('Circuit breaker failure recorded', {
				destinationId,
				currentState,
				consecutiveFailures: updatedHealth.consecutiveFailures,
			})
		} catch (error) {
			this.logger.error('Error recording circuit breaker failure', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get current circuit breaker state for a destination
	 * Requirements 3.4, 3.5: State monitoring and reporting
	 */
	async getState(destinationId: string): Promise<CircuitBreakerState> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)

			if (!health) {
				// Return default closed state for new destinations
				return {
					state: 'closed',
					failureCount: 0,
				}
			}

			return {
				state: health.circuitBreakerState,
				failureCount: health.consecutiveFailures,
				lastFailureAt: health.lastFailureAt,
				openedAt: health.circuitBreakerOpenedAt,
				nextAttemptAt: this.calculateNextAttemptTime(health),
			}
		} catch (error) {
			this.logger.error('Error getting circuit breaker state', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Return safe default state
			return {
				state: 'closed',
				failureCount: 0,
			}
		}
	}

	/**
	 * Force circuit breaker to open state
	 * Requirements 7.3, 7.5: Manual circuit control for maintenance
	 */
	async forceOpen(destinationId: string, reason: string): Promise<void> {
		try {
			await this.transitionToOpen(destinationId, `Manually opened: ${reason}`)

			this.logger.info('Circuit breaker manually opened', {
				destinationId,
				reason,
			})
		} catch (error) {
			this.logger.error('Error forcing circuit breaker open', {
				destinationId,
				reason,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Force circuit breaker to closed state
	 * Requirements 7.3, 7.5: Manual circuit control for recovery
	 */
	async forceClose(destinationId: string): Promise<void> {
		try {
			await this.transitionToClosed(destinationId)

			this.logger.info('Circuit breaker manually closed', {
				destinationId,
			})
		} catch (error) {
			this.logger.error('Error forcing circuit breaker closed', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get circuit breaker metrics for monitoring
	 */
	async getMetrics(destinationId: string): Promise<CircuitBreakerMetrics> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			const state = await this.getState(destinationId)

			if (!health) {
				return {
					destinationId,
					state: 'closed',
					failureCount: 0,
					successCount: 0,
					totalRequests: 0,
					failureRate: 0,
					lastStateChange: new Date().toISOString(),
					timeInCurrentState: 0,
				}
			}

			const totalRequests = health.totalDeliveries
			const failureRate = totalRequests > 0 ? (health.totalFailures / totalRequests) * 100 : 0
			const successCount = totalRequests - health.totalFailures

			// Calculate time in current state
			const lastStateChangeTime = health.circuitBreakerOpenedAt
				? new Date(health.circuitBreakerOpenedAt).getTime()
				: new Date(health.lastCheckAt).getTime()
			const timeInCurrentState = Date.now() - lastStateChangeTime

			return {
				destinationId,
				state: state.state,
				failureCount: health.consecutiveFailures,
				successCount,
				totalRequests,
				failureRate,
				lastFailureAt: health.lastFailureAt,
				lastSuccessAt: health.lastSuccessAt,
				openedAt: health.circuitBreakerOpenedAt,
				lastStateChange: health.circuitBreakerOpenedAt || health.lastCheckAt,
				timeInCurrentState,
			}
		} catch (error) {
			this.logger.error('Error getting circuit breaker metrics', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Get all circuit breakers with their current states
	 */
	async getAllStates(): Promise<CircuitBreakerMetrics[]> {
		try {
			const unhealthyDestinations = await this.dbClient.health.getUnhealthyDestinations()
			const metrics: CircuitBreakerMetrics[] = []

			for (const health of unhealthyDestinations) {
				const destinationMetrics = await this.getMetrics(health.destinationId)
				metrics.push(destinationMetrics)
			}

			return metrics
		} catch (error) {
			this.logger.error('Error getting all circuit breaker states', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Transition circuit breaker to open state
	 */
	private async transitionToOpen(destinationId: string, reason: string): Promise<void> {
		const now = new Date().toISOString()

		await this.dbClient.health.updateCircuitBreakerState(destinationId, 'open', now)
		await this.dbClient.health.upsert(destinationId, {
			metadata: {
				openReason: reason,
				openedAt: now,
				halfOpenSuccesses: 0, // Reset half-open success count
			},
		})
	}

	/**
	 * Transition circuit breaker to half-open state
	 */
	private async transitionToHalfOpen(destinationId: string): Promise<void> {
		await this.dbClient.health.updateCircuitBreakerState(destinationId, 'half-open')
		await this.dbClient.health.upsert(destinationId, {
			metadata: {
				halfOpenAt: new Date().toISOString(),
				halfOpenSuccesses: 0, // Reset success count for half-open state
			},
		})
	}

	/**
	 * Transition circuit breaker to closed state
	 */
	private async transitionToClosed(destinationId: string): Promise<void> {
		await this.dbClient.health.updateCircuitBreakerState(destinationId, 'closed')
		await this.dbClient.health.upsert(destinationId, {
			consecutiveFailures: 0, // Reset failure count
			circuitBreakerOpenedAt: undefined, // Clear opened timestamp
			metadata: {
				closedAt: new Date().toISOString(),
				halfOpenSuccesses: 0, // Reset half-open success count
			},
		})
	}

	/**
	 * Determine if circuit should be opened based on health metrics
	 */
	private async shouldOpenCircuit(health: any): Promise<boolean> {
		// Check if we have enough volume to make a decision
		if (health.totalDeliveries < this.config.volumeThreshold) {
			return false
		}

		// Check consecutive failures threshold
		if (health.consecutiveFailures >= this.config.failureThreshold) {
			return true
		}

		// Check failure rate within monitoring window
		const windowStart = Date.now() - this.config.monitoringWindow
		const recentFailures = await this.getRecentFailureCount(health.destinationId, windowStart)
		const recentTotal = await this.getRecentRequestCount(health.destinationId, windowStart)

		if (recentTotal >= this.config.volumeThreshold) {
			const recentFailureRate = (recentFailures / recentTotal) * 100
			// Open if failure rate exceeds 50% in the monitoring window
			return recentFailureRate > 50
		}

		return false
	}

	/**
	 * Get recent failure count within time window
	 */
	private async getRecentFailureCount(destinationId: string, since: number): Promise<number> {
		// This would need to be implemented based on how delivery logs are stored
		// For now, return a conservative estimate based on consecutive failures
		const health = await this.dbClient.health.findByDestinationId(destinationId)
		return health?.consecutiveFailures || 0
	}

	/**
	 * Get recent request count within time window
	 */
	private async getRecentRequestCount(destinationId: string, since: number): Promise<number> {
		// This would need to be implemented based on how delivery logs are stored
		// For now, return a conservative estimate
		const health = await this.dbClient.health.findByDestinationId(destinationId)
		return Math.max(health?.consecutiveFailures || 0, this.config.volumeThreshold)
	}

	/**
	 * Calculate next attempt time for open circuit
	 */
	private calculateNextAttemptTime(health: any): string | undefined {
		if (health.circuitBreakerState === 'open' && health.circuitBreakerOpenedAt) {
			const openedTime = new Date(health.circuitBreakerOpenedAt).getTime()
			const nextAttemptTime = openedTime + this.config.recoveryTimeout
			return new Date(nextAttemptTime).toISOString()
		}
		return undefined
	}

	/**
	 * Get current configuration
	 */
	getConfig(): CircuitBreakerConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration
	 */
	updateConfig(updates: Partial<CircuitBreakerConfig>): void {
		Object.assign(this.config, updates)
		this.logger.info('Circuit breaker configuration updated', { updates })
	}
}

/**
 * Factory function for creating circuit breaker
 */
export function createCircuitBreaker(
	dbClient: DeliveryDatabaseClient,
	config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
	return new CircuitBreaker(dbClient, config)
}
