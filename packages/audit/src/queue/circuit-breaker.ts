/**
 * Circuit breaker pattern implementation for database connection failures
 */
import type { Redis as RedisType } from 'ioredis'

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
	failureThreshold: number
	recoveryTimeout: number
	monitoringPeriod: number
	minimumThroughput: number
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5, // Number of failures before opening circuit
	recoveryTimeout: 30000, // 30 seconds before attempting recovery
	monitoringPeriod: 60000, // 1 minute monitoring window
	minimumThroughput: 10, // Minimum requests before considering failure rate
}

export interface CircuitBreakerStateChange {
	from: CircuitBreakerState
	to: CircuitBreakerState
	timestamp: string
	reason: string
}

export interface CircuitBreakerMetrics {
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	failureRate: number
	lastFailureTime?: string
	lastSuccessTime?: string
	stateChanges: Array<CircuitBreakerStateChange>
	timestamp: string
}

export class CircuitBreaker {
	private metricsCollector: RedisCircuitBreakerMetricsCollector
	private state: CircuitBreakerState = 'CLOSED'
	private failureCount = 0
	private successCount = 0
	private lastFailureTime?: number
	private lastSuccessTime?: number
	private nextAttemptTime = 0
	private stateChangeListeners: Array<
		(state: CircuitBreakerState, metrics: CircuitBreakerMetrics) => void
	> = []

	constructor(
		private connection: RedisType,
		private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
		private name: string = 'default'
	) {
		this.metricsCollector = new RedisCircuitBreakerMetricsCollector(connection)
	}

	/**
	 * Executes an operation through the circuit breaker
	 */
	async execute<T>(operation: () => Promise<T>): Promise<T> {
		if (this.state === 'OPEN') {
			if (Date.now() < this.nextAttemptTime) {
				throw new Error(
					`Circuit breaker '${this.name}' is OPEN. Next attempt allowed at ${new Date(this.nextAttemptTime).toISOString()}`
				)
			}
			// Transition to HALF_OPEN to test if service has recovered
			this.changeState('HALF_OPEN', 'Recovery timeout elapsed')
		}

		await this.metricsCollector.recordTotalRequests()

		try {
			const result = await operation()
			await this.onSuccess()
			return result
		} catch (error) {
			await this.onFailure(error instanceof Error ? error : new Error(String(error)))
			throw error
		}
	}

	/**
	 * Handles successful operation
	 */
	private async onSuccess(): Promise<void> {
		this.successCount++
		await this.metricsCollector.recordSuccessfulRequests()
		this.lastSuccessTime = Date.now()

		if (this.state === 'HALF_OPEN') {
			// Service has recovered, close the circuit
			await this.changeState('CLOSED', 'Successful request in HALF_OPEN state')
			this.reset()
		} else if (this.state === 'CLOSED') {
			// Reset failure count on successful request
			this.failureCount = 0
		}

		await this.updateMetrics()
	}

	/**
	 * Handles failed operation
	 */
	private async onFailure(error: Error): Promise<void> {
		this.failureCount++
		await this.metricsCollector.recordFailedRequests()
		this.lastFailureTime = Date.now()

		if (this.state === 'HALF_OPEN') {
			// Service still failing, open the circuit again
			await this.changeState('OPEN', `Failure in HALF_OPEN state: ${error.message}`)
			this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
		} else if (this.state === 'CLOSED') {
			// Check if we should open the circuit
			if (await this.shouldOpenCircuit()) {
				await this.changeState(
					'OPEN',
					`Failure threshold exceeded: ${this.failureCount}/${this.config.failureThreshold}`
				)
				this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
			}
		}

		await this.updateMetrics()
	}

	/**
	 * Determines if circuit should be opened based on failure threshold
	 */
	private async shouldOpenCircuit(): Promise<boolean> {
		const totalRequests = await this.metricsCollector.getTotalRequests()

		// Need minimum throughput to make decision
		if (totalRequests < this.config.minimumThroughput) {
			return false
		}

		return this.failureCount >= this.config.failureThreshold
	}

	/**
	 * Changes circuit breaker state and notifies listeners
	 */
	private async changeState(newState: CircuitBreakerState, reason: string): Promise<void> {
		const oldState = this.state
		this.state = newState

		const stateChange = {
			from: oldState,
			to: newState,
			timestamp: new Date().toISOString(),
			reason,
		}

		let stateChanges = await this.metricsCollector.getStateChanges()
		stateChanges.push(stateChange)

		// Keep only last 100 state changes
		if (stateChanges.length > 100) {
			stateChanges = stateChanges.slice(-100)
		}

		await this.metricsCollector.recordStateChanges(stateChanges)
		const metrics = await this.getMetrics()

		// Notify listeners
		this.stateChangeListeners.forEach((listener) => {
			try {
				listener(newState, metrics)
			} catch (error) {
				console.error(`Circuit breaker '${this.name}' state change listener error:`, error)
			}
		})

		console.log(
			`Circuit breaker '${this.name}' state changed: ${oldState} -> ${newState} (${reason})`
		)
	}

	/**
	 * Resets circuit breaker counters
	 */
	private reset(): void {
		this.failureCount = 0
		this.successCount = 0
	}

	/**
	 * Updates failure rate metrics
	 */
	private async updateMetrics(): Promise<void> {
		const totalRequests = await this.metricsCollector.getTotalRequests()
		const failedRequests = await this.metricsCollector.getFailedRequests()
		const failureRate = totalRequests > 0 ? failedRequests / totalRequests : 0
		await this.metricsCollector.recordFailureRate(failureRate)
	}

	/**
	 * Gets current circuit breaker state
	 */
	getState(): CircuitBreakerState {
		return this.state
	}

	/**
	 * Gets current metrics
	 */
	async getMetrics(): Promise<CircuitBreakerMetrics> {
		const metrics = await this.metricsCollector.getMetrics()
		return metrics
	}

	/**
	 * Adds a state change listener
	 */
	onStateChange(
		listener: (state: CircuitBreakerState, metrics: CircuitBreakerMetrics) => void
	): void {
		this.stateChangeListeners.push(listener)
	}

	/**
	 * Removes a state change listener
	 */
	removeStateChangeListener(
		listener: (state: CircuitBreakerState, metrics: CircuitBreakerMetrics) => void
	): void {
		const index = this.stateChangeListeners.indexOf(listener)
		if (index > -1) {
			this.stateChangeListeners.splice(index, 1)
		}
	}

	/**
	 * Manually opens the circuit (for testing or emergency situations)
	 */
	async forceOpen(reason: string = 'Manually forced open'): Promise<void> {
		await this.changeState('OPEN', reason)
		this.nextAttemptTime = Date.now() + this.config.recoveryTimeout
	}

	/**
	 * Manually closes the circuit (for testing or recovery situations)
	 */
	async forceClose(reason: string = 'Manually forced closed'): Promise<void> {
		await this.changeState('CLOSED', reason)
		this.reset()
	}

	/**
	 * Checks if circuit breaker is healthy (not open)
	 */
	isHealthy(): boolean {
		return this.state !== 'OPEN'
	}
}

/**
 * Metrics collector interface
 */
export interface CircuitBreakerMetricsCollector {
	recordTotalRequests(): Promise<void>
	recordSuccessfulRequests(): Promise<void>
	recordFailureRate(rate: number): Promise<void>
	recordStateChanges(stateChanges: Array<CircuitBreakerStateChange>): Promise<void>
	recordFailedRequests(): Promise<void>
	getMetrics(): Promise<CircuitBreakerMetrics>
	resetMetrics(): Promise<void>
	getTotalRequests(): Promise<number>
	getFailedRequests(): Promise<number>
	getStateChanges(): Promise<Array<CircuitBreakerStateChange>>
}

/**
 * Redis metrics collector
 */
export class RedisCircuitBreakerMetricsCollector implements CircuitBreakerMetricsCollector {
	private key = 'circuit-breaker-metrics'

	constructor(private connection: RedisType) {}

	async getMetrics(): Promise<CircuitBreakerMetrics> {
		const metrics: CircuitBreakerMetrics = {
			totalRequests: parseInt((await this.connection.get(`${this.key}:totalRequests`)) || '0', 10),
			failureRate: parseFloat((await this.connection.get(`${this.key}:failureRate`)) || '0'),
			successfulRequests: parseInt(
				(await this.connection.get(`${this.key}:successfulRequests`)) || '0',
				10
			),
			failedRequests: parseInt(
				(await this.connection.get(`${this.key}:failedRequests`)) || '0',
				10
			),
			stateChanges: JSON.parse(
				(await this.connection.get(`${this.key}:stateChanges`)) || '[]'
			) as Array<CircuitBreakerStateChange>,
			lastSuccessTime: (await this.connection.get(`${this.key}:lastSuccessTime`)) || undefined,
			lastFailureTime: (await this.connection.get(`${this.key}:lastFailureTime`)) || undefined,
			timestamp: (await this.connection.get(`${this.key}:timestamp`)) || new Date().toISOString(),
		}

		return metrics
	}

	async resetMetrics(): Promise<void> {
		await this.connection.del(`${this.key}`)

		const metrics: CircuitBreakerMetrics = {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			failureRate: 0,
			stateChanges: [],
			timestamp: new Date().toISOString(),
		}
		await this.connection.set(`${this.key}`, JSON.stringify(metrics))
	}

	async recordTotalRequests(): Promise<void> {
		await this.connection.incr(`${this.key}:totalRequests`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordSuccessfulRequests(): Promise<void> {
		const now = new Date().toISOString()
		await this.connection.incr(`${this.key}:successfulRequests`)
		await this.connection.set(`${this.key}:lastSuccessTime`, now)
		await this.connection.set(`${this.key}:timestamp`, now)
	}

	async recordFailedRequests(): Promise<void> {
		const now = new Date().toISOString()
		await this.connection.incr(`${this.key}:failedRequests`)
		await this.connection.set(`${this.key}:lastFailureTime`, now)
		await this.connection.set(`${this.key}:timestamp`, now)
	}

	async recordFailureRate(rate: number): Promise<void> {
		await this.connection.set(`${this.key}:failureRate`, rate.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordStateChanges(stateChanges: Array<CircuitBreakerStateChange>): Promise<void> {
		await this.connection.set(`${this.key}:stateChanges`, JSON.stringify(stateChanges))
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async getTotalRequests(): Promise<number> {
		return parseInt((await this.connection.get(`${this.key}:totalRequests`)) || '0', 10)
	}

	async getFailedRequests(): Promise<number> {
		return parseInt((await this.connection.get(`${this.key}:failedRequests`)) || '0', 10)
	}

	async getStateChanges(): Promise<Array<CircuitBreakerStateChange>> {
		return JSON.parse((await this.connection.get(`${this.key}:stateChanges`)) || '[]')
	}
}
