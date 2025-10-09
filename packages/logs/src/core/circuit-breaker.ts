import type { CircuitBreaker, CircuitBreakerConfig } from '../types/batch.js'

/**
 * Circuit breaker states
 */
type CircuitBreakerState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker metrics for monitoring
 */
interface CircuitBreakerMetrics {
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	lastFailureTime: number
	lastSuccessTime: number
	stateTransitions: number
}

/**
 * CircuitBreaker implementation for transport reliability
 * Addresses requirements 9.2, 9.1
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
	private state: CircuitBreakerState = 'closed'
	private failureCount = 0
	private lastFailureTime = 0
	private lastSuccessTime = 0
	private stateTransitionTime = 0
	private readonly metrics: CircuitBreakerMetrics
	private healthCheckTimer: NodeJS.Timeout | null = null

	constructor(
		private readonly config: CircuitBreakerConfig,
		private readonly healthCheck?: () => Promise<boolean>
	) {
		this.metrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			lastFailureTime: 0,
			lastSuccessTime: 0,
			stateTransitions: 0,
		}

		// Start health check monitoring if provided
		if (this.healthCheck) {
			this.startHealthCheckMonitoring()
		}
	}

	/**
	 * Check if the circuit breaker allows execution
	 */
	canExecute(): boolean {
		this.metrics.totalRequests++

		switch (this.state) {
			case 'closed':
				return true

			case 'open':
				// Check if enough time has passed to try half-open
				if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
					this.transitionToHalfOpen()
					return true
				}
				return false

			case 'half-open':
				// Allow one request to test if service has recovered
				return true

			default:
				// Should never happen, but default to safe behavior
				return false
		}
	}

	/**
	 * Record a successful operation
	 */
	onSuccess(): void {
		this.metrics.successfulRequests++
		this.lastSuccessTime = Date.now()

		switch (this.state) {
			case 'half-open':
				// Success in half-open state means service has recovered
				this.transitionToClosed()
				break

			case 'closed':
				// Reset failure count on success
				this.failureCount = 0
				break

			case 'open':
				// Shouldn't happen, but handle gracefully
				console.warn('CircuitBreaker: Received success while in open state')
				break
		}
	}

	/**
	 * Record a failed operation
	 */
	onFailure(): void {
		this.metrics.failedRequests++
		this.failureCount++
		this.lastFailureTime = Date.now()

		switch (this.state) {
			case 'closed':
				// Check if we should open the circuit
				if (this.failureCount >= this.config.failureThreshold) {
					this.transitionToOpen()
				}
				break

			case 'half-open':
				// Failure in half-open state means service is still down
				this.transitionToOpen()
				break

			case 'open':
				// Already open, just update metrics
				break
		}
	}

	/**
	 * Get the current circuit breaker state
	 */
	getState(): CircuitBreakerState {
		return this.state
	}

	/**
	 * Get circuit breaker metrics for monitoring
	 */
	getMetrics(): Readonly<CircuitBreakerMetrics> {
		return { ...this.metrics }
	}

	/**
	 * Get failure rate as a percentage
	 */
	getFailureRate(): number {
		if (this.metrics.totalRequests === 0) {
			return 0
		}
		return (this.metrics.failedRequests / this.metrics.totalRequests) * 100
	}

	/**
	 * Check if the circuit breaker is healthy
	 */
	isHealthy(): boolean {
		return this.state === 'closed' && this.getFailureRate() < 50
	}

	/**
	 * Reset the circuit breaker to closed state
	 */
	reset(): void {
		this.state = 'closed'
		this.failureCount = 0
		this.lastFailureTime = 0
		this.stateTransitionTime = Date.now()
		this.logStateTransition('reset')
	}

	/**
	 * Force the circuit breaker to open state
	 */
	forceOpen(): void {
		this.transitionToOpen()
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}
	}

	/**
	 * Transition to closed state
	 */
	private transitionToClosed(): void {
		this.state = 'closed'
		this.failureCount = 0
		this.stateTransitionTime = Date.now()
		this.logStateTransition('closed')
	}

	/**
	 * Transition to open state
	 */
	private transitionToOpen(): void {
		this.state = 'open'
		this.stateTransitionTime = Date.now()
		this.logStateTransition('open')
	}

	/**
	 * Transition to half-open state
	 */
	private transitionToHalfOpen(): void {
		this.state = 'half-open'
		this.stateTransitionTime = Date.now()
		this.logStateTransition('half-open')
	}

	/**
	 * Log state transitions for monitoring
	 */
	private logStateTransition(newState: string): void {
		this.metrics.stateTransitions++
		console.log(
			`CircuitBreaker: State transition to ${newState}. ` +
				`Failures: ${this.failureCount}/${this.config.failureThreshold}, ` +
				`Failure rate: ${this.getFailureRate().toFixed(1)}%`
		)
	}

	/**
	 * Start health check monitoring
	 */
	private startHealthCheckMonitoring(): void {
		if (!this.healthCheck || this.healthCheckTimer) {
			return
		}

		this.healthCheckTimer = setInterval(async () => {
			try {
				const isHealthy = await this.healthCheck!()

				if (isHealthy && this.state === 'open') {
					// Service appears to be healthy, try half-open
					this.transitionToHalfOpen()
				} else if (!isHealthy && this.state === 'closed') {
					// Service appears unhealthy, consider opening
					this.onFailure()
				}
			} catch (error) {
				// Health check failed, treat as failure
				if (this.state === 'closed') {
					this.onFailure()
				}
			}
		}, this.config.monitoringPeriodMs)
	}

	/**
	 * Create a circuit breaker with sensible defaults
	 */
	static create(
		overrides: Partial<CircuitBreakerConfig> = {},
		healthCheck?: () => Promise<boolean>
	): DefaultCircuitBreaker {
		const config: CircuitBreakerConfig = {
			failureThreshold: 5,
			resetTimeoutMs: 60000, // 1 minute
			monitoringPeriodMs: 30000, // 30 seconds
			...overrides,
		}

		return new DefaultCircuitBreaker(config, healthCheck)
	}
}
