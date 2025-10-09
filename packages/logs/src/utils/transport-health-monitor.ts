/**
 * Transport health monitoring and automatic failover system
 * Addresses requirements 5.4, 9.1, 9.2: Transport health monitoring and failover
 */
import { ErrorCategory, ErrorSeverity } from '../types/error.js'

import type { ErrorContext, ErrorHandler } from '../types/error.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'

export interface TransportHealthStatus {
	transport: LogTransport
	isHealthy: boolean
	lastHealthCheck: Date
	consecutiveFailures: number
	lastFailure?: Date
	lastSuccess?: Date
	errorRate: number
	averageResponseTime: number
}

export interface HealthCheckConfig {
	checkIntervalMs: number
	failureThreshold: number
	recoveryThreshold: number
	timeoutMs: number
	enableAutoRecovery: boolean
}

export interface FallbackConfig {
	enableFallback: boolean
	fallbackChain: string[] // Transport names in order of preference
	maxFallbackDepth: number
}

export class TransportHealthMonitor {
	private healthStatus = new Map<string, TransportHealthStatus>()
	private healthCheckInterval?: NodeJS.Timeout
	private transports = new Map<string, LogTransport>()
	private responseTimes = new Map<string, number[]>()

	constructor(
		private healthConfig: HealthCheckConfig,
		private fallbackConfig: FallbackConfig,
		private errorHandler: ErrorHandler
	) {}

	/**
	 * Register a transport for health monitoring
	 */
	registerTransport(transport: LogTransport): void {
		this.transports.set(transport.name, transport)
		this.healthStatus.set(transport.name, {
			transport,
			isHealthy: true,
			lastHealthCheck: new Date(),
			consecutiveFailures: 0,
			errorRate: 0,
			averageResponseTime: 0,
		})
		this.responseTimes.set(transport.name, [])
	}

	/**
	 * Unregister a transport from health monitoring
	 */
	unregisterTransport(transportName: string): void {
		this.transports.delete(transportName)
		this.healthStatus.delete(transportName)
		this.responseTimes.delete(transportName)
	}

	/**
	 * Start health monitoring
	 */
	startMonitoring(): void {
		if (this.healthCheckInterval) {
			return
		}

		this.healthCheckInterval = setInterval(
			() => this.performHealthChecks(),
			this.healthConfig.checkIntervalMs
		)
	}

	/**
	 * Stop health monitoring
	 */
	stopMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = undefined
		}
	}

	/**
	 * Get health status for all transports
	 */
	getHealthStatus(): Map<string, TransportHealthStatus> {
		return new Map(this.healthStatus)
	}

	/**
	 * Get health status for a specific transport
	 */
	getTransportHealth(transportName: string): TransportHealthStatus | undefined {
		return this.healthStatus.get(transportName)
	}

	/**
	 * Send logs with automatic failover
	 */
	async sendWithFailover(
		primaryTransportName: string,
		entries: LogEntry[]
	): Promise<{ success: boolean; transportUsed: string; error?: Error }> {
		const fallbackChain = this.buildFallbackChain(primaryTransportName)

		for (const transportName of fallbackChain) {
			const transport = this.transports.get(transportName)
			const status = this.healthStatus.get(transportName)

			if (!transport || !status) {
				continue
			}

			// Skip unhealthy transports unless it's the last option
			if (!status.isHealthy && fallbackChain.indexOf(transportName) < fallbackChain.length - 1) {
				continue
			}

			try {
				const startTime = Date.now()
				await this.sendWithTimeout(transport, entries)
				const responseTime = Date.now() - startTime

				// Update success metrics
				this.recordSuccess(transportName, responseTime)

				return {
					success: true,
					transportUsed: transportName,
				}
			} catch (error) {
				const err = error as Error
				this.recordFailure(transportName, err)

				// If this is the last transport in the chain, return the error
				if (transportName === fallbackChain[fallbackChain.length - 1]) {
					return {
						success: false,
						transportUsed: transportName,
						error: err,
					}
				}

				// Continue to next transport in fallback chain
				continue
			}
		}

		return {
			success: false,
			transportUsed: primaryTransportName,
			error: new Error('All transports in fallback chain failed'),
		}
	}

	/**
	 * Record a successful transport operation
	 */
	recordSuccess(transportName: string, responseTime: number): void {
		const status = this.healthStatus.get(transportName)
		if (!status) return

		status.lastSuccess = new Date()
		status.consecutiveFailures = 0

		// Update response time tracking
		const times = this.responseTimes.get(transportName) || []
		times.push(responseTime)
		if (times.length > 100) {
			times.shift() // Keep only last 100 measurements
		}
		this.responseTimes.set(transportName, times)

		// Calculate average response time
		status.averageResponseTime = times.reduce((sum, time) => sum + time, 0) / times.length

		// Mark as healthy if it was previously unhealthy and meets recovery threshold
		if (!status.isHealthy && status.consecutiveFailures === 0) {
			status.isHealthy = true
		}
	}

	/**
	 * Record a failed transport operation
	 */
	recordFailure(transportName: string, error: Error): void {
		const status = this.healthStatus.get(transportName)
		if (!status) return

		status.lastFailure = new Date()
		status.consecutiveFailures++

		// Mark as unhealthy if failure threshold is exceeded
		if (status.consecutiveFailures >= this.healthConfig.failureThreshold) {
			status.isHealthy = false
		}

		// Report error to error handler
		const context: ErrorContext = {
			operation: 'transport_send',
			transportName,
			metadata: {
				consecutiveFailures: status.consecutiveFailures,
				averageResponseTime: status.averageResponseTime,
			},
		}

		const categorizedError = this.errorHandler.categorizeError(error, context)
		this.errorHandler.handleError(categorizedError).catch((handlerError) => {
			// Don't let error handler failures affect transport operations
			console.error('Error handler failed:', handlerError)
		})
	}

	/**
	 * Perform health checks on all registered transports
	 */
	private async performHealthChecks(): Promise<void> {
		const healthCheckPromises = Array.from(this.transports.entries()).map(
			async ([name, transport]) => {
				try {
					await this.checkTransportHealth(name, transport)
				} catch (error) {
					// Individual health check failures shouldn't stop other checks
					console.error(`Health check failed for transport ${name}:`, error)
				}
			}
		)

		await Promise.allSettled(healthCheckPromises)
	}

	/**
	 * Check health of a specific transport
	 */
	private async checkTransportHealth(name: string, transport: LogTransport): Promise<void> {
		const status = this.healthStatus.get(name)
		if (!status) return

		status.lastHealthCheck = new Date()

		try {
			// Use the transport's built-in health check if available
			const isHealthy = transport.isHealthy()

			if (isHealthy && this.healthConfig.enableAutoRecovery) {
				// If transport reports healthy and auto-recovery is enabled,
				// reset consecutive failures to allow recovery
				if (status.consecutiveFailures > 0) {
					status.consecutiveFailures = Math.max(0, status.consecutiveFailures - 1)
				}

				// Mark as healthy if consecutive failures are below recovery threshold
				if (status.consecutiveFailures <= this.healthConfig.recoveryThreshold) {
					status.isHealthy = true
				}
			} else if (!isHealthy) {
				status.consecutiveFailures++
				if (status.consecutiveFailures >= this.healthConfig.failureThreshold) {
					status.isHealthy = false
				}
			}
		} catch (error) {
			// Health check itself failed
			status.consecutiveFailures++
			if (status.consecutiveFailures >= this.healthConfig.failureThreshold) {
				status.isHealthy = false
			}
		}
	}

	/**
	 * Send logs with timeout
	 */
	private async sendWithTimeout(transport: LogTransport, entries: LogEntry[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(
					new Error(`Transport ${transport.name} timed out after ${this.healthConfig.timeoutMs}ms`)
				)
			}, this.healthConfig.timeoutMs)

			transport
				.send(entries)
				.then(() => {
					clearTimeout(timeout)
					resolve()
				})
				.catch((error) => {
					clearTimeout(timeout)
					reject(error)
				})
		})
	}

	/**
	 * Build fallback chain for a primary transport
	 */
	private buildFallbackChain(primaryTransportName: string): string[] {
		if (!this.fallbackConfig.enableFallback) {
			return [primaryTransportName]
		}

		const chain = [primaryTransportName]
		let depth = 0

		for (const fallbackName of this.fallbackConfig.fallbackChain) {
			if (fallbackName !== primaryTransportName && depth < this.fallbackConfig.maxFallbackDepth) {
				chain.push(fallbackName)
				depth++
			}
		}

		return chain
	}
}

/**
 * Default health check configuration
 */
export const defaultHealthCheckConfig: HealthCheckConfig = {
	checkIntervalMs: 30000, // 30 seconds
	failureThreshold: 3,
	recoveryThreshold: 1,
	timeoutMs: 10000, // 10 seconds
	enableAutoRecovery: true,
}

/**
 * Default fallback configuration
 */
export const defaultFallbackConfig: FallbackConfig = {
	enableFallback: true,
	fallbackChain: ['console', 'file'], // Default fallback order
	maxFallbackDepth: 2,
}
