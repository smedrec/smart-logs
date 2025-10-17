/**
 * Custom delivery performance metrics and monitoring
 * Requirements 8.2, 8.3, 8.4, 8.5: Destination-specific performance metrics and monitoring
 */

import { cpus, freemem, loadavg, totalmem } from 'os'
import { performance } from 'perf_hooks'

import type { IDeliveryMetricsCollector } from './metrics.js'
import type {
	PerformanceMetrics as BasePerformanceMetrics,
	DeliveryObservabilityConfig,
} from './types.js'

/**
 * Enhanced performance metrics for delivery operations
 */
export interface PerformanceMetrics extends BasePerformanceMetrics {
	// Queue metrics
	queueDepth: number
	queueProcessingTime: number
	queueWaitTime: number

	// Destination-specific metrics
	destinationResponseTimes: Record<string, number[]>
	destinationSuccessRates: Record<string, number>
	destinationErrorRates: Record<string, number>

	// Retry metrics
	retryAttempts: Record<string, number>
	retrySuccessRates: Record<string, number>
	retryBackoffTimes: Record<string, number[]>

	// Circuit breaker metrics
	circuitBreakerStates: Record<string, 'open' | 'closed' | 'half-open'>
	circuitBreakerTripCounts: Record<string, number>
	circuitBreakerRecoveryTimes: Record<string, number>

	// Payload metrics
	payloadSizes: number[]
	payloadProcessingTimes: number[]

	// System resource metrics
	systemMetrics: {
		cpuUsage: number
		memoryUsage: number
		memoryTotal: number
		loadAverage: number[]
	}
}

/**
 * Performance timer for measuring operation durations
 */
export class PerformanceTimer {
	private startTime: number
	private endTime?: number
	private marks: Map<string, number> = new Map()

	constructor() {
		this.startTime = performance.now()
	}

	/**
	 * Mark a specific point in time
	 */
	mark(name: string): void {
		this.marks.set(name, performance.now())
	}

	/**
	 * Get duration from start or from a specific mark
	 */
	getDuration(fromMark?: string): number {
		const now = performance.now()
		const startPoint = fromMark ? this.marks.get(fromMark) || this.startTime : this.startTime
		return now - startPoint
	}

	/**
	 * Get duration between two marks
	 */
	getDurationBetween(startMark: string, endMark: string): number {
		const start = this.marks.get(startMark)
		const end = this.marks.get(endMark)

		if (!start || !end) {
			throw new Error(`Mark not found: ${!start ? startMark : endMark}`)
		}

		return end - start
	}

	/**
	 * Stop the timer and return total duration
	 */
	stop(): number {
		this.endTime = performance.now()
		return this.endTime - this.startTime
	}

	/**
	 * Reset the timer
	 */
	reset(): void {
		this.startTime = performance.now()
		this.endTime = undefined
		this.marks.clear()
	}
}

/**
 * Delivery performance monitor interface
 */
export interface IDeliveryPerformanceMonitor {
	// Performance tracking
	startTimer(operationId: string): PerformanceTimer
	recordOperationTime(operation: string, duration: number, metadata?: Record<string, any>): void

	// Queue performance
	recordQueueMetrics(depth: number, processingTime: number, waitTime: number): void
	getQueuePerformanceMetrics(): { depth: number; avgProcessingTime: number; avgWaitTime: number }

	// Destination performance
	recordDestinationPerformance(
		destinationId: string,
		destinationType: string,
		responseTime: number,
		success: boolean
	): void
	getDestinationPerformanceMetrics(destinationId?: string): Record<string, any>

	// Retry performance
	recordRetryMetrics(
		destinationId: string,
		attemptNumber: number,
		backoffTime: number,
		success: boolean
	): void
	getRetryPerformanceMetrics(): Record<string, any>

	// Circuit breaker performance
	recordCircuitBreakerMetrics(
		destinationId: string,
		state: 'open' | 'closed' | 'half-open',
		tripCount?: number,
		recoveryTime?: number
	): void
	getCircuitBreakerMetrics(): Record<string, any>

	// Payload performance
	recordPayloadMetrics(size: number, processingTime: number): void
	getPayloadPerformanceMetrics(): {
		avgSize: number
		avgProcessingTime: number
		sizePercentiles: any
	}

	// System performance
	collectSystemMetrics(): Promise<void>
	getSystemMetrics(): any

	// Comprehensive metrics
	getPerformanceSnapshot(): Promise<PerformanceMetrics>

	// Lifecycle
	start(): void
	stop(): void
}

/**
 * Delivery performance monitor implementation
 */
export class DeliveryPerformanceMonitor implements IDeliveryPerformanceMonitor {
	private config: DeliveryObservabilityConfig['performance']
	private metricsCollector?: IDeliveryMetricsCollector
	private isRunning = false
	private systemMetricsInterval?: NodeJS.Timeout

	// Performance data storage
	private operationTimers = new Map<string, PerformanceTimer>()
	private operationMetrics = new Map<string, { durations: number[]; metadata: any[] }>()

	// Queue metrics
	private queueMetrics = {
		depths: [] as number[],
		processingTimes: [] as number[],
		waitTimes: [] as number[],
	}

	// Destination metrics
	private destinationMetrics = new Map<
		string,
		{
			responseTimes: number[]
			successCount: number
			failureCount: number
			lastResponseTime: number
		}
	>()

	// Retry metrics
	private retryMetrics = new Map<
		string,
		{
			attempts: number[]
			backoffTimes: number[]
			successCount: number
			failureCount: number
		}
	>()

	// Circuit breaker metrics
	private circuitBreakerMetrics = new Map<
		string,
		{
			state: 'open' | 'closed' | 'half-open'
			tripCount: number
			recoveryTimes: number[]
			lastStateChange: number
		}
	>()

	// Payload metrics
	private payloadMetrics = {
		sizes: [] as number[],
		processingTimes: [] as number[],
	}

	// System metrics
	private systemMetrics = {
		cpuUsage: 0,
		memoryUsage: 0,
		memoryTotal: 0,
		loadAverage: [0, 0, 0],
		lastUpdate: 0,
	}

	constructor(
		config: DeliveryObservabilityConfig['performance'],
		metricsCollector?: IDeliveryMetricsCollector
	) {
		this.config = config
		this.metricsCollector = metricsCollector
	}

	/**
	 * Start performance monitoring
	 */
	start(): void {
		if (this.isRunning || !this.config.enabled) {
			return
		}

		this.isRunning = true

		// Start system metrics collection if enabled
		if (this.config.memoryTrackingEnabled) {
			this.systemMetricsInterval = setInterval(() => {
				this.collectSystemMetrics()
			}, 30000) // Every 30 seconds
		}

		console.log('✅ Delivery performance monitoring started')
	}

	/**
	 * Stop performance monitoring
	 */
	stop(): void {
		if (!this.isRunning) {
			return
		}

		this.isRunning = false

		if (this.systemMetricsInterval) {
			clearInterval(this.systemMetricsInterval)
			this.systemMetricsInterval = undefined
		}

		console.log('✅ Delivery performance monitoring stopped')
	}

	/**
	 * Start a performance timer for an operation
	 */
	startTimer(operationId: string): PerformanceTimer {
		const timer = new PerformanceTimer()
		this.operationTimers.set(operationId, timer)
		return timer
	}

	/**
	 * Record operation time
	 */
	recordOperationTime(operation: string, duration: number, metadata?: Record<string, any>): void {
		if (!this.config.trackingEnabled) return

		// Get or create operation metrics
		const metrics = this.operationMetrics.get(operation) || { durations: [], metadata: [] }

		metrics.durations.push(duration)
		if (metadata) {
			metrics.metadata.push(metadata)
		}

		// Keep only recent data (last 1000 measurements)
		if (metrics.durations.length > 1000) {
			metrics.durations = metrics.durations.slice(-1000)
			metrics.metadata = metrics.metadata.slice(-1000)
		}

		this.operationMetrics.set(operation, metrics)

		// Record with metrics collector if available
		if (this.metricsCollector) {
			this.metricsCollector.recordProcessingTime(operation, duration)
		}

		// Check for slow operations
		if (duration > this.config.slowOperationThreshold) {
			console.warn(`🐌 Slow operation detected: ${operation} took ${duration}ms`, metadata || {})
		}
	}

	/**
	 * Record queue metrics
	 */
	recordQueueMetrics(depth: number, processingTime: number, waitTime: number): void {
		if (!this.config.trackingEnabled) return

		this.queueMetrics.depths.push(depth)
		this.queueMetrics.processingTimes.push(processingTime)
		this.queueMetrics.waitTimes.push(waitTime)

		// Keep only recent data
		const maxSize = 1000
		if (this.queueMetrics.depths.length > maxSize) {
			this.queueMetrics.depths = this.queueMetrics.depths.slice(-maxSize)
			this.queueMetrics.processingTimes = this.queueMetrics.processingTimes.slice(-maxSize)
			this.queueMetrics.waitTimes = this.queueMetrics.waitTimes.slice(-maxSize)
		}

		// Record with metrics collector
		if (this.metricsCollector) {
			this.metricsCollector.recordQueueDepth(depth)
			this.metricsCollector.recordProcessingTime('queue.processing', processingTime)
			this.metricsCollector.recordProcessingTime('queue.wait', waitTime)
		}
	}

	/**
	 * Get queue performance metrics
	 */
	getQueuePerformanceMetrics(): { depth: number; avgProcessingTime: number; avgWaitTime: number } {
		const depths = this.queueMetrics.depths
		const processingTimes = this.queueMetrics.processingTimes
		const waitTimes = this.queueMetrics.waitTimes

		return {
			depth: depths.length > 0 ? depths[depths.length - 1] : 0,
			avgProcessingTime:
				processingTimes.length > 0
					? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
					: 0,
			avgWaitTime:
				waitTimes.length > 0
					? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
					: 0,
		}
	}

	/**
	 * Record destination performance
	 */
	recordDestinationPerformance(
		destinationId: string,
		destinationType: string,
		responseTime: number,
		success: boolean
	): void {
		if (!this.config.trackingEnabled) return

		// Get or create destination metrics
		const metrics = this.destinationMetrics.get(destinationId) || {
			responseTimes: [],
			successCount: 0,
			failureCount: 0,
			lastResponseTime: 0,
		}

		metrics.responseTimes.push(responseTime)
		metrics.lastResponseTime = responseTime

		if (success) {
			metrics.successCount++
		} else {
			metrics.failureCount++
		}

		// Keep only recent data
		if (metrics.responseTimes.length > 1000) {
			metrics.responseTimes = metrics.responseTimes.slice(-1000)
		}

		this.destinationMetrics.set(destinationId, metrics)

		// Record with metrics collector
		if (this.metricsCollector) {
			this.metricsCollector.recordDestinationHealth(
				destinationId,
				destinationType,
				success,
				responseTime
			)
		}
	}

	/**
	 * Get destination performance metrics
	 */
	getDestinationPerformanceMetrics(destinationId?: string): Record<string, any> {
		if (destinationId) {
			const metrics = this.destinationMetrics.get(destinationId)
			if (!metrics) return {}

			const totalRequests = metrics.successCount + metrics.failureCount
			const successRate = totalRequests > 0 ? (metrics.successCount / totalRequests) * 100 : 0
			const avgResponseTime =
				metrics.responseTimes.length > 0
					? metrics.responseTimes.reduce((sum, time) => sum + time, 0) /
						metrics.responseTimes.length
					: 0

			return {
				successRate,
				avgResponseTime,
				lastResponseTime: metrics.lastResponseTime,
				totalRequests,
				responseTimes: metrics.responseTimes,
			}
		}

		// Return all destinations
		const result: Record<string, any> = {}
		for (const [id, metrics] of this.destinationMetrics.entries()) {
			const totalRequests = metrics.successCount + metrics.failureCount
			const successRate = totalRequests > 0 ? (metrics.successCount / totalRequests) * 100 : 0
			const avgResponseTime =
				metrics.responseTimes.length > 0
					? metrics.responseTimes.reduce((sum, time) => sum + time, 0) /
						metrics.responseTimes.length
					: 0

			result[id] = {
				successRate,
				avgResponseTime,
				lastResponseTime: metrics.lastResponseTime,
				totalRequests,
			}
		}

		return result
	}

	/**
	 * Record retry metrics
	 */
	recordRetryMetrics(
		destinationId: string,
		attemptNumber: number,
		backoffTime: number,
		success: boolean
	): void {
		if (!this.config.trackingEnabled) return

		// Get or create retry metrics
		const metrics = this.retryMetrics.get(destinationId) || {
			attempts: [],
			backoffTimes: [],
			successCount: 0,
			failureCount: 0,
		}

		metrics.attempts.push(attemptNumber)
		metrics.backoffTimes.push(backoffTime)

		if (success) {
			metrics.successCount++
		} else {
			metrics.failureCount++
		}

		// Keep only recent data
		if (metrics.attempts.length > 1000) {
			metrics.attempts = metrics.attempts.slice(-1000)
			metrics.backoffTimes = metrics.backoffTimes.slice(-1000)
		}

		this.retryMetrics.set(destinationId, metrics)

		// Record with metrics collector
		if (this.metricsCollector) {
			this.metricsCollector.recordRetryAttempt(destinationId, attemptNumber, success)
		}
	}

	/**
	 * Get retry performance metrics
	 */
	getRetryPerformanceMetrics(): Record<string, any> {
		const result: Record<string, any> = {}

		for (const [destinationId, metrics] of this.retryMetrics.entries()) {
			const totalRetries = metrics.successCount + metrics.failureCount
			const successRate = totalRetries > 0 ? (metrics.successCount / totalRetries) * 100 : 0
			const avgAttempts =
				metrics.attempts.length > 0
					? metrics.attempts.reduce((sum, attempts) => sum + attempts, 0) / metrics.attempts.length
					: 0
			const avgBackoffTime =
				metrics.backoffTimes.length > 0
					? metrics.backoffTimes.reduce((sum, time) => sum + time, 0) / metrics.backoffTimes.length
					: 0

			result[destinationId] = {
				successRate,
				avgAttempts,
				avgBackoffTime,
				totalRetries,
			}
		}

		return result
	}

	/**
	 * Record circuit breaker metrics
	 */
	recordCircuitBreakerMetrics(
		destinationId: string,
		state: 'open' | 'closed' | 'half-open',
		tripCount?: number,
		recoveryTime?: number
	): void {
		if (!this.config.trackingEnabled) return

		// Get or create circuit breaker metrics
		const metrics = this.circuitBreakerMetrics.get(destinationId) || {
			state: 'closed' as const,
			tripCount: 0,
			recoveryTimes: [],
			lastStateChange: Date.now(),
		}

		const previousState = metrics.state
		metrics.state = state
		metrics.lastStateChange = Date.now()

		if (tripCount !== undefined) {
			metrics.tripCount = tripCount
		}

		if (recoveryTime !== undefined) {
			metrics.recoveryTimes.push(recoveryTime)

			// Keep only recent data
			if (metrics.recoveryTimes.length > 100) {
				metrics.recoveryTimes = metrics.recoveryTimes.slice(-100)
			}
		}

		this.circuitBreakerMetrics.set(destinationId, metrics)

		// Record with metrics collector
		if (this.metricsCollector) {
			this.metricsCollector.recordCircuitBreakerState(destinationId, state)

			if (previousState !== 'open' && state === 'open') {
				this.metricsCollector.recordCircuitBreakerTrip(destinationId, 'failure_threshold_exceeded')
			}
		}
	}

	/**
	 * Get circuit breaker metrics
	 */
	getCircuitBreakerMetrics(): Record<string, any> {
		const result: Record<string, any> = {}

		for (const [destinationId, metrics] of this.circuitBreakerMetrics.entries()) {
			const avgRecoveryTime =
				metrics.recoveryTimes.length > 0
					? metrics.recoveryTimes.reduce((sum, time) => sum + time, 0) /
						metrics.recoveryTimes.length
					: 0

			result[destinationId] = {
				state: metrics.state,
				tripCount: metrics.tripCount,
				avgRecoveryTime,
				lastStateChange: metrics.lastStateChange,
			}
		}

		return result
	}

	/**
	 * Record payload metrics
	 */
	recordPayloadMetrics(size: number, processingTime: number): void {
		if (!this.config.trackingEnabled) return

		this.payloadMetrics.sizes.push(size)
		this.payloadMetrics.processingTimes.push(processingTime)

		// Keep only recent data
		const maxSize = 1000
		if (this.payloadMetrics.sizes.length > maxSize) {
			this.payloadMetrics.sizes = this.payloadMetrics.sizes.slice(-maxSize)
			this.payloadMetrics.processingTimes = this.payloadMetrics.processingTimes.slice(-maxSize)
		}

		// Record with metrics collector
		if (this.metricsCollector) {
			this.metricsCollector.recordDeliveryPayloadSize(size)
			this.metricsCollector.recordProcessingTime('payload.processing', processingTime)
		}
	}

	/**
	 * Get payload performance metrics
	 */
	getPayloadPerformanceMetrics(): {
		avgSize: number
		avgProcessingTime: number
		sizePercentiles: any
	} {
		const sizes = this.payloadMetrics.sizes
		const processingTimes = this.payloadMetrics.processingTimes

		const avgSize = sizes.length > 0 ? sizes.reduce((sum, size) => sum + size, 0) / sizes.length : 0
		const avgProcessingTime =
			processingTimes.length > 0
				? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
				: 0

		// Calculate size percentiles
		const sortedSizes = [...sizes].sort((a, b) => a - b)
		const sizePercentiles = {
			p50: this.calculatePercentile(sortedSizes, 50),
			p90: this.calculatePercentile(sortedSizes, 90),
			p95: this.calculatePercentile(sortedSizes, 95),
			p99: this.calculatePercentile(sortedSizes, 99),
		}

		return {
			avgSize,
			avgProcessingTime,
			sizePercentiles,
		}
	}

	/**
	 * Collect system metrics
	 */
	async collectSystemMetrics(): Promise<void> {
		if (!this.config.memoryTrackingEnabled) return

		try {
			const memUsage = process.memoryUsage()
			const cpuCount = cpus().length
			const loadAvg = loadavg()

			// Calculate CPU usage (simplified)
			const cpuUsage = (loadAvg[0] / cpuCount) * 100

			this.systemMetrics = {
				cpuUsage,
				memoryUsage: memUsage.heapUsed,
				memoryTotal: memUsage.heapTotal,
				loadAverage: loadAvg,
				lastUpdate: Date.now(),
			}

			// Record with metrics collector
			if (this.metricsCollector) {
				this.metricsCollector.recordMemoryUsage(memUsage.heapUsed, memUsage.heapTotal)
				this.metricsCollector.recordCpuUsage(cpuUsage)
			}
		} catch (error) {
			console.error('Failed to collect system metrics:', error)
		}
	}

	/**
	 * Get system metrics
	 */
	getSystemMetrics(): any {
		return { ...this.systemMetrics }
	}

	/**
	 * Get comprehensive performance snapshot
	 */
	async getPerformanceSnapshot(): Promise<PerformanceMetrics> {
		// Ensure system metrics are up to date
		await this.collectSystemMetrics()

		// Build destination response times and success rates
		const destinationResponseTimes: Record<string, number[]> = {}
		const destinationSuccessRates: Record<string, number> = {}
		const destinationErrorRates: Record<string, number> = {}

		for (const [id, metrics] of this.destinationMetrics.entries()) {
			destinationResponseTimes[id] = [...metrics.responseTimes]
			const total = metrics.successCount + metrics.failureCount
			destinationSuccessRates[id] = total > 0 ? (metrics.successCount / total) * 100 : 0
			destinationErrorRates[id] = total > 0 ? (metrics.failureCount / total) * 100 : 0
		}

		// Build retry metrics
		const retryAttempts: Record<string, number> = {}
		const retrySuccessRates: Record<string, number> = {}
		const retryBackoffTimes: Record<string, number[]> = {}

		for (const [id, metrics] of this.retryMetrics.entries()) {
			const avgAttempts =
				metrics.attempts.length > 0
					? metrics.attempts.reduce((sum, attempts) => sum + attempts, 0) / metrics.attempts.length
					: 0
			retryAttempts[id] = avgAttempts

			const total = metrics.successCount + metrics.failureCount
			retrySuccessRates[id] = total > 0 ? (metrics.successCount / total) * 100 : 0
			retryBackoffTimes[id] = [...metrics.backoffTimes]
		}

		// Build circuit breaker metrics
		const circuitBreakerStates: Record<string, 'open' | 'closed' | 'half-open'> = {}
		const circuitBreakerTripCounts: Record<string, number> = {}
		const circuitBreakerRecoveryTimes: Record<string, number> = {}

		for (const [id, metrics] of this.circuitBreakerMetrics.entries()) {
			circuitBreakerStates[id] = metrics.state
			circuitBreakerTripCounts[id] = metrics.tripCount
			const avgRecoveryTime =
				metrics.recoveryTimes.length > 0
					? metrics.recoveryTimes.reduce((sum, time) => sum + time, 0) /
						metrics.recoveryTimes.length
					: 0
			circuitBreakerRecoveryTimes[id] = avgRecoveryTime
		}

		// Get queue metrics
		const queueMetrics = this.getQueuePerformanceMetrics()

		return {
			operation: 'performance_snapshot',
			startTime: Date.now(),
			queueDepth: queueMetrics.depth,
			queueProcessingTime: queueMetrics.avgProcessingTime,
			queueWaitTime: queueMetrics.avgWaitTime,
			destinationResponseTimes,
			destinationSuccessRates,
			destinationErrorRates,
			retryAttempts,
			retrySuccessRates,
			retryBackoffTimes,
			circuitBreakerStates,
			circuitBreakerTripCounts,
			circuitBreakerRecoveryTimes,
			payloadSizes: [...this.payloadMetrics.sizes],
			payloadProcessingTimes: [...this.payloadMetrics.processingTimes],
			systemMetrics: {
				cpuUsage: this.systemMetrics.cpuUsage,
				memoryUsage: this.systemMetrics.memoryUsage,
				memoryTotal: this.systemMetrics.memoryTotal,
				loadAverage: [...this.systemMetrics.loadAverage],
			},
		}
	}

	/**
	 * Calculate percentile from sorted array
	 */
	private calculatePercentile(sortedArray: number[], percentile: number): number {
		if (sortedArray.length === 0) return 0

		const index = (percentile / 100) * (sortedArray.length - 1)
		const lower = Math.floor(index)
		const upper = Math.ceil(index)

		if (lower === upper) {
			return sortedArray[lower]
		}

		const weight = index - lower
		return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
	}
}

/**
 * Factory function for creating delivery performance monitor
 */
export function createDeliveryPerformanceMonitor(
	config: DeliveryObservabilityConfig['performance'],
	metricsCollector?: IDeliveryMetricsCollector
): IDeliveryPerformanceMonitor {
	return new DeliveryPerformanceMonitor(config, metricsCollector)
}
