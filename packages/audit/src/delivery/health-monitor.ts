/**
 * Health Monitor - Monitors destination health and manages circuit breaker states
 * Requirements 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5: Health monitoring and failure tracking
 */

import { StructuredLogger } from '@repo/logs'

import type { DeliveryDatabaseClient } from './database-client.js'
import type { DestinationHealth } from './types.js'

/**
 * Configuration for health monitoring thresholds
 */
export interface HealthMonitorConfig {
	// Failure thresholds
	degradedThreshold: number // Consecutive failures to mark as degraded
	unhealthyThreshold: number // Consecutive failures to mark as unhealthy
	disableThreshold: number // Consecutive failures to disable destination

	// Circuit breaker thresholds
	circuitBreakerThreshold: number // Consecutive failures to open circuit breaker
	circuitBreakerTimeout: number // Time in ms before attempting half-open
	halfOpenMaxAttempts: number // Max attempts in half-open state

	// Health check intervals
	healthCheckInterval: number // Interval in ms for health checks
	unhealthyCheckInterval: number // Faster interval for unhealthy destinations

	// Success rate thresholds
	minSuccessRate: number // Minimum success rate to consider healthy (percentage)
}

/**
 * Default health monitor configuration
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
	degradedThreshold: 3,
	unhealthyThreshold: 5,
	disableThreshold: 10,
	circuitBreakerThreshold: 5,
	circuitBreakerTimeout: 300000, // 5 minutes
	halfOpenMaxAttempts: 3,
	healthCheckInterval: 300000, // 5 minutes
	unhealthyCheckInterval: 60000, // 1 minute
	minSuccessRate: 95.0,
}

/**
 * Health monitoring service
 */
export class HealthMonitor {
	private readonly logger: StructuredLogger
	private readonly config: HealthMonitorConfig
	private healthCheckTimer?: NodeJS.Timeout
	private isRunning = false

	constructor(
		private readonly dbClient: DeliveryDatabaseClient,
		config?: Partial<HealthMonitorConfig>
	) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - HealthMonitor',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	/**
	 * Start the health monitoring service
	 * Requirements 3.4, 3.5: Health check scheduling and status updates
	 */
	start(): void {
		if (this.isRunning) {
			this.logger.warn('Health monitor is already running')
			return
		}

		this.isRunning = true
		this.logger.info('Starting health monitor', {
			degradedThreshold: this.config.degradedThreshold,
			unhealthyThreshold: this.config.unhealthyThreshold,
			disableThreshold: this.config.disableThreshold,
			circuitBreakerThreshold: this.config.circuitBreakerThreshold,
		})

		// Start periodic health checks
		this.scheduleHealthCheck()
	}

	/**
	 * Stop the health monitoring service
	 */
	stop(): void {
		if (!this.isRunning) {
			return
		}

		this.isRunning = false
		if (this.healthCheckTimer) {
			clearTimeout(this.healthCheckTimer)
			this.healthCheckTimer = undefined
		}

		this.logger.info('Stopped health monitor')
	}

	/**
	 * Record a successful delivery for health tracking
	 * Requirements 3.4, 3.5: Health status tracking with metrics collection
	 */
	async recordSuccess(destinationId: string, responseTime: number): Promise<void> {
		try {
			await this.dbClient.health.recordSuccess(destinationId, responseTime)
			this.logger.debug('Recorded successful delivery', { destinationId, responseTime })
		} catch (error) {
			this.logger.error('Failed to record success', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Record a failed delivery for health tracking
	 * Requirements 3.4, 3.5: Failure counting and consecutive failure detection
	 */
	async recordFailure(destinationId: string, error: string): Promise<void> {
		try {
			await this.dbClient.health.recordFailure(destinationId, error)

			// Check if destination should be disabled
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			if (health && health.consecutiveFailures >= this.config.disableThreshold) {
				await this.disableDestination(destinationId, 'Exceeded failure threshold')
			}

			this.logger.debug('Recorded failed delivery', { destinationId, error })
		} catch (error) {
			this.logger.error('Failed to record failure', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Check if a destination should be allowed to receive deliveries
	 * Requirements 3.4, 3.5: Circuit breaker pattern for failing destinations
	 */
	async shouldAllowDelivery(destinationId: string): Promise<boolean> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			if (!health) {
				// No health record means it's a new destination, allow delivery
				return true
			}

			// Check if destination is disabled
			if (health.status === 'disabled') {
				return false
			}

			// Check circuit breaker state
			switch (health.circuitBreakerState) {
				case 'closed':
					return true

				case 'open':
					// Check if enough time has passed to try half-open
					if (health.circuitBreakerOpenedAt) {
						const openedAt = new Date(health.circuitBreakerOpenedAt).getTime()
						const now = Date.now()
						if (now - openedAt >= this.config.circuitBreakerTimeout) {
							// Move to half-open state
							await this.dbClient.health.updateCircuitBreakerState(destinationId, 'half-open')
							return true
						}
					}
					return false

				case 'half-open':
					// Allow limited attempts in half-open state
					return true

				default:
					return true
			}
		} catch (error) {
			this.logger.error('Failed to check delivery allowance', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			// Default to allowing delivery on error
			return true
		}
	}

	/**
	 * Update circuit breaker state based on delivery results
	 * Requirements 3.4, 3.5: Circuit breaker state management
	 */
	async updateCircuitBreakerState(
		destinationId: string,
		success: boolean,
		responseTime?: number
	): Promise<void> {
		try {
			const health = await this.dbClient.health.findByDestinationId(destinationId)
			if (!health) {
				return
			}

			if (success) {
				if (responseTime !== undefined) {
					await this.recordSuccess(destinationId, responseTime)
				}

				// If in half-open state and success, close the circuit
				if (health.circuitBreakerState === 'half-open') {
					await this.dbClient.health.updateCircuitBreakerState(destinationId, 'closed')
					this.logger.info('Circuit breaker closed after successful delivery', { destinationId })
				}
			} else {
				// Record failure and check if circuit should open
				if (health.circuitBreakerState === 'half-open') {
					// Failed in half-open, go back to open
					await this.dbClient.health.updateCircuitBreakerState(
						destinationId,
						'open',
						new Date().toISOString()
					)
					this.logger.info('Circuit breaker reopened after failure in half-open state', {
						destinationId,
					})
				} else if (
					health.circuitBreakerState === 'closed' &&
					health.consecutiveFailures >= this.config.circuitBreakerThreshold
				) {
					// Open the circuit breaker
					await this.dbClient.health.updateCircuitBreakerState(
						destinationId,
						'open',
						new Date().toISOString()
					)
					this.logger.info('Circuit breaker opened due to consecutive failures', {
						destinationId,
						consecutiveFailures: health.consecutiveFailures,
					})
				}
			}
		} catch (error) {
			this.logger.error('Failed to update circuit breaker state', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get health status for a destination
	 */
	async getDestinationHealth(destinationId: string): Promise<DestinationHealth | null> {
		try {
			return await this.dbClient.health.findByDestinationId(destinationId)
		} catch (error) {
			this.logger.error('Failed to get destination health', {
				destinationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return null
		}
	}

	/**
	 * Get all unhealthy destinations
	 */
	async getUnhealthyDestinations(): Promise<DestinationHealth[]> {
		try {
			return await this.dbClient.health.getUnhealthyDestinations()
		} catch (error) {
			this.logger.error('Failed to get unhealthy destinations', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return []
		}
	}

	/**
	 * Disable a destination due to health issues
	 * Requirements 3.4, 3.5: Automatic destination disabling based on failure thresholds
	 */
	private async disableDestination(destinationId: string, reason: string): Promise<void> {
		try {
			// Disable in destinations table
			await this.dbClient.destinations.setDisabled(destinationId, true, reason, 'health-monitor')

			// Update health status
			await this.dbClient.health.upsert(destinationId, {
				status: 'disabled',
				disabledAt: new Date().toISOString(),
				disabledReason: reason,
			})

			this.logger.warn('Automatically disabled destination due to health issues', {
				destinationId,
				reason,
			})
		} catch (error) {
			this.logger.error('Failed to disable destination', {
				destinationId,
				reason,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Schedule the next health check
	 */
	private scheduleHealthCheck(): void {
		if (!this.isRunning) {
			return
		}

		const interval = this.config.healthCheckInterval
		this.healthCheckTimer = setTimeout(async () => {
			await this.performHealthCheck()
			this.scheduleHealthCheck()
		}, interval)
	}

	/**
	 * Perform periodic health checks
	 * Requirements 7.1, 7.2, 7.3, 7.4, 7.5: Health monitoring and alerting
	 */
	private async performHealthCheck(): Promise<void> {
		try {
			this.logger.debug('Performing periodic health check')

			const unhealthyDestinations = await this.getUnhealthyDestinations()

			for (const health of unhealthyDestinations) {
				// Check if circuit breaker should be moved to half-open
				if (health.circuitBreakerState === 'open' && health.circuitBreakerOpenedAt) {
					const openedAt = new Date(health.circuitBreakerOpenedAt).getTime()
					const now = Date.now()

					if (now - openedAt >= this.config.circuitBreakerTimeout) {
						await this.dbClient.health.updateCircuitBreakerState(health.destinationId, 'half-open')
						this.logger.info('Moved circuit breaker to half-open state', {
							destinationId: health.destinationId,
						})
					}
				}

				// Log unhealthy destinations for monitoring
				this.logger.warn('Unhealthy destination detected', {
					destinationId: health.destinationId,
					status: health.status,
					consecutiveFailures: health.consecutiveFailures,
					successRate: health.successRate,
					circuitBreakerState: health.circuitBreakerState,
				})
			}

			this.logger.debug('Health check completed', {
				unhealthyCount: unhealthyDestinations.length,
			})
		} catch (error) {
			this.logger.error('Health check failed', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}
}

/**
 * Factory function for creating health monitor
 */
export function createHealthMonitor(
	dbClient: DeliveryDatabaseClient,
	config?: Partial<HealthMonitorConfig>
): HealthMonitor {
	return new HealthMonitor(dbClient, config)
}
