/**
 * Reliable event processor with guaranteed delivery, retry mechanisms, and circuit breaker
 */

import { Queue, Worker } from 'bullmq'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

import { DEFAULT_RETRY_CONFIG, executeWithRetry } from '../retry.js'
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker.js'
import { DeadLetterHandler, DEFAULT_DEAD_LETTER_CONFIG } from './dead-letter-queue.js'

import type { Job } from 'bullmq'
import type { Redis as RedisType } from 'ioredis'
import type { RetryConfig } from '../retry.js'
import type { AuditLogEvent } from '../types.js'
import type { CircuitBreakerConfig } from './circuit-breaker.js'
import type { DeadLetterConfig } from './dead-letter-queue.js'

export interface ReliableProcessorConfig {
	queueName: string
	concurrency: number
	retryConfig: RetryConfig
	circuitBreakerConfig: CircuitBreakerConfig
	deadLetterConfig: DeadLetterConfig
	persistentStorage: boolean
	durabilityGuarantees: boolean
}

export const DEFAULT_RELIABLE_PROCESSOR_CONFIG: ReliableProcessorConfig = {
	queueName: 'audit-reliable',
	concurrency: 5,
	retryConfig: DEFAULT_RETRY_CONFIG,
	circuitBreakerConfig: DEFAULT_CIRCUIT_BREAKER_CONFIG,
	deadLetterConfig: DEFAULT_DEAD_LETTER_CONFIG,
	persistentStorage: true,
	durabilityGuarantees: true,
}

export interface ProcessorMetrics {
	totalProcessed: number
	successfullyProcessed: number
	failedProcessed: number
	retriedEvents: number
	deadLetterEvents: number
	circuitBreakerTrips: number
	averageProcessingTime: number
	queueDepth: number
	lastProcessedTime?: string
	timestamp: string
}

export type EventProcessor<T = AuditLogEvent> = (event: T) => Promise<void>

export class ReliableEventProcessor<T = AuditLogEvent> {
	private queue: Queue<T>
	private worker?: Worker<T>
	private circuitBreaker: CircuitBreaker
	private deadLetterHandler: DeadLetterHandler
	private metricsCollector: ProcessorMetricsCollector
	private isRunning = false
	private processingTimes: number[] = []

	constructor(
		private connection: RedisType,
		private db: PostgresJsDatabase<any>,
		private processor: EventProcessor<T>,
		private config: ReliableProcessorConfig = DEFAULT_RELIABLE_PROCESSOR_CONFIG
	) {
		// Initialize queue with durability settings
		this.queue = new Queue(config.queueName, {
			connection,
			defaultJobOptions: {
				removeOnComplete: config.persistentStorage ? false : 100,
				removeOnFail: false, // Keep failed jobs for analysis
				attempts: 1, // We handle retries manually for better control
			},
		})

		// Initialize circuit breaker
		this.circuitBreaker = new CircuitBreaker(
			connection,
			config.circuitBreakerConfig,
			config.queueName
		)

		// Initialize dead letter handler
		this.deadLetterHandler = new DeadLetterHandler(connection, db, config.deadLetterConfig)

		// Initialize metrics collector
		this.metricsCollector = new RedisProcessorMetricsCollector(connection)

		// Set up circuit breaker monitoring
		this.circuitBreaker.onStateChange((state, cbMetrics) => {
			if (state === 'OPEN') {
				this.metricsCollector.recordCircuitBreakerTrips()
				console.warn(
					`[ReliableProcessor] Circuit breaker opened for ${config.queueName}: ${cbMetrics.failureRate * 100}% failure rate`
				)
			}
		})

		// Set up dead letter queue alerts
		this.deadLetterHandler.onAlert((dlMetrics) => {
			console.error(
				`[ReliableProcessor] Dead letter queue alert: ${dlMetrics.totalEvents} failed events`
			)
		})
	}

	/**
	 * Starts the reliable event processor
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			console.warn('[ReliableProcessor] Processor already running')
			return
		}

		// Start dead letter handler worker
		this.deadLetterHandler.startWorker()

		// Create and start main worker
		try {
			this.worker = new Worker<T>(
				this.config.queueName,
				async (job: Job<T>) => {
					await this.processJobWithReliability(job)
				},
				{
					connection: this.connection,
					concurrency: this.config.concurrency,
				}
			)
		} catch (error) {
			console.error('[ReliableProcessor] Error creating worker', error)
			throw error
		}

		// Set up worker event handlers
		this.worker.on('completed', async (job) => {
			await this.metricsCollector.recordSuccessfullyProcessed()
			this.updateProcessingTime(job)
			console.debug(`[ReliableProcessor] Job ${job.id} completed successfully`)
		})

		this.worker.on('failed', async (job, error) => {
			await this.metricsCollector.recordFailedProcessed()
			console.error(`[ReliableProcessor] Job ${job?.id} failed:`, error)
		})

		this.worker.on('error', (error) => {
			console.error('[ReliableProcessor] Worker error:', error)
		})

		this.isRunning = true
		console.log(`[ReliableProcessor] Started processor for queue: ${this.config.queueName}`)

		// Start periodic metrics update
		this.startMetricsUpdater()
	}

	/**
	 * Stops the reliable event processor
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return
		}

		this.isRunning = false

		// Stop worker
		if (this.worker) {
			await this.worker.close()
			this.worker = undefined
		}

		// Stop dead letter handler
		await this.deadLetterHandler.stopWorker()

		console.log(`[ReliableProcessor] Stopped processor for queue: ${this.config.queueName}`)
	}

	/**
	 * Adds an event to the reliable processing queue
	 */
	async addEvent(event: T, options: { priority?: number; delay?: number } = {}): Promise<void> {
		try {
			await this.queue.add('event' as any, event as any, {
				priority: options.priority || 0,
				delay: options.delay || 0,
			})
		} catch (error) {
			console.error('[ReliableProcessor] Failed to add event to queue:', error)
			throw new Error(
				`Failed to add event to reliable processing queue: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Processes a job with full reliability features
	 */
	private async processJobWithReliability(job: Job<T>): Promise<void> {
		const startTime = Date.now()
		await this.metricsCollector.recordTotalProcessed()

		try {
			// Execute through circuit breaker and retry mechanism
			await this.circuitBreaker.execute(async () => {
				const retryResult = await executeWithRetry(
					() => this.processor(job.data),
					this.config.retryConfig
				)

				if (!retryResult.success) {
					// Track retry attempts
					if (retryResult.attempts.length > 1) {
						await this.metricsCollector.recordRetriedEvents()
					}

					// Send to dead letter queue
					await this.deadLetterHandler.addFailedEvent(
						job.data as any, // Type assertion needed here
						retryResult.error!,
						job.id,
						this.config.queueName,
						retryResult.attempts.map((attempt) => ({
							attempt: attempt.attempt,
							timestamp: attempt.timestamp,
							error: attempt.error.message,
						}))
					)

					await this.metricsCollector.recordDeadLetterEvents()
					throw retryResult.error
				}

				// Track successful retry if there were previous attempts
				if (retryResult.attempts.length > 0) {
					this.metricsCollector.recordRetriedEvents()
				}
			})

			// Record processing time
			const processingTime = Date.now() - startTime
			this.processingTimes.push(processingTime)

			// Keep only last 1000 processing times for average calculation
			if (this.processingTimes.length > 1000) {
				this.processingTimes = this.processingTimes.slice(-1000)
			}
		} catch (error) {
			// Final failure after all retry attempts and circuit breaker
			const processingTime = Date.now() - startTime
			this.processingTimes.push(processingTime)

			console.error(
				`[ReliableProcessor] Final failure for job ${job.id} after ${processingTime}ms:`,
				error
			)
			throw error
		}
	}

	/**
	 * Updates processing time metrics
	 */
	private updateProcessingTime(job: Job<T>): void {
		if (job.processedOn && job.timestamp) {
			const processingTime = job.processedOn - job.timestamp
			this.processingTimes.push(processingTime)

			// Keep only last 1000 processing times
			if (this.processingTimes.length > 1000) {
				this.processingTimes = this.processingTimes.slice(-1000)
			}
		}
	}

	/**
	 * Starts periodic metrics updates
	 */
	private startMetricsUpdater(): void {
		const updateMetrics = async () => {
			if (!this.isRunning) return

			try {
				// Update queue depth
				const waiting = await this.queue.getWaiting()
				await this.metricsCollector.recordQueueDepth(waiting.length)

				// Update average processing time
				if (this.processingTimes.length > 0) {
					const sum = this.processingTimes.reduce((a, b) => a + b, 0)
					await this.metricsCollector.recordAverageProcessingTime(sum / this.processingTimes.length)
				}

				// Schedule next update
				setTimeout(updateMetrics, 30000) // Update every 30 seconds
			} catch (error) {
				console.error('[ReliableProcessor] Error updating metrics:', error)
				setTimeout(updateMetrics, 30000)
			}
		}

		// Start first update
		setTimeout(updateMetrics, 1000)
	}

	/**
	 * Gets current processor metrics
	 */
	async getMetrics(): Promise<ProcessorMetrics> {
		const metrics = await this.metricsCollector.getMetrics()
		return metrics
	}

	/**
	 * Gets circuit breaker metrics
	 */
	getCircuitBreakerMetrics() {
		return this.circuitBreaker.getMetrics()
	}

	/**
	 * Gets dead letter queue metrics
	 */
	async getDeadLetterMetrics() {
		return await this.deadLetterHandler.getMetrics()
	}

	/**
	 * Gets comprehensive health status
	 */
	async getHealthStatus() {
		const [metrics, dlMetrics, cbMetrics] = await Promise.all([
			this.getMetrics(),
			this.deadLetterHandler.getMetrics(),
			Promise.resolve(this.circuitBreaker.getMetrics()),
		])

		const healthScore = await this.calculateHealthScore(dlMetrics, cbMetrics)

		return {
			isRunning: this.isRunning,
			circuitBreakerState: this.circuitBreaker.getState(),
			queueDepth: metrics.queueDepth,
			processorMetrics: metrics,
			circuitBreakerMetrics: cbMetrics,
			deadLetterMetrics: dlMetrics,
			healthScore,
		}
	}

	/**
	 * Calculates a health score based on various metrics
	 */
	private async calculateHealthScore(dlMetrics: any, cbMetrics: any): Promise<number> {
		let score = 100

		// Deduct points for circuit breaker issues
		if (this.circuitBreaker.getState() === 'OPEN') {
			score -= 30
		} else if (this.circuitBreaker.getState() === 'HALF_OPEN') {
			score -= 15
		}

		// Deduct points for high failure rate
		if (cbMetrics.failureRate > 0.1) {
			score -= Math.min(30, cbMetrics.failureRate * 100)
		}

		// Deduct points for dead letter queue buildup
		if (dlMetrics.totalEvents > 0) {
			score -= Math.min(20, dlMetrics.totalEvents)
		}

		const queueDepth = await this.metricsCollector.getQueueDepth()
		// Deduct points for high queue depth
		if (queueDepth > 100) {
			score -= Math.min(20, queueDepth / 10)
		}

		return Math.max(0, Math.round(score))
	}

	/**
	 * Forces processing of all pending events (for testing/emergency)
	 */
	async processPendingEvents(): Promise<void> {
		const waitingJobs = await this.queue.getJobs(['waiting'])
		console.log(`[ReliableProcessor] Force processing ${waitingJobs.length} pending events`)

		for (const job of waitingJobs) {
			try {
				await this.processJobWithReliability(job)
				await job.moveToCompleted(undefined as any, job.token!)
			} catch (error) {
				await job.moveToFailed(error as Error, job.token!)
			}
		}
	}

	/**
	 * Get queue
	 */
	getQueue(): Queue<T> {
		return this.queue
	}

	/**
	 * GET worker
	 */
	getWorker(): Worker<T> | undefined {
		return this.worker
	}

	/**
	 * Get DeadLetterHandler
	 */
	getDeadLetterHandler(): DeadLetterHandler {
		return this.deadLetterHandler
	}

	/**
	 * Get CircuitBreaker
	 */
	getCircuitBreaker(): CircuitBreaker {
		return this.circuitBreaker
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		await this.stop()
		await this.deadLetterHandler.cleanup()
		await this.queue.close()
	}
}

/**
 * Metrics collector interface
 */
export interface ProcessorMetricsCollector {
	recordTotalProcessed(): Promise<void>
	recordSuccessfullyProcessed(): Promise<void>
	recordAverageProcessingTime(time: number): Promise<void>
	recordRetriedEvents(): Promise<void>
	recordFailedProcessed(): Promise<void>
	recordCircuitBreakerTrips(): Promise<void>
	recordQueueDepth(depth: number): Promise<void>
	getQueueDepth(): Promise<number>
	getMetrics(): Promise<ProcessorMetrics>
	resetMetrics(): Promise<void>
	recordDeadLetterEvents(): Promise<void>
}

/**
 * Redis metrics collector
 */
export class RedisProcessorMetricsCollector implements ProcessorMetricsCollector {
	private key = 'processor-metrics'

	constructor(private connection: RedisType) {}

	async getMetrics(): Promise<ProcessorMetrics> {
		const metrics: ProcessorMetrics = {
			totalProcessed: parseInt(
				(await this.connection.get(`${this.key}:totalProcessed`)) || '0',
				10
			),
			averageProcessingTime: parseFloat(
				(await this.connection.get(`${this.key}:averageProcessingTime`)) || '0'
			),
			queueDepth: parseInt((await this.connection.get(`${this.key}:queueDepth`)) || '0', 10),
			successfullyProcessed: parseInt(
				(await this.connection.get(`${this.key}:successfullyProcessed`)) || '0',
				10
			),
			failedProcessed: parseInt(
				(await this.connection.get(`${this.key}:failedProcessed`)) || '0',
				10
			),
			lastProcessedTime: (await this.connection.get(`${this.key}:lastProcessedTime`)) || undefined,
			timestamp: (await this.connection.get(`${this.key}:timestamp`)) || new Date().toISOString(),
			retriedEvents: parseInt((await this.connection.get(`${this.key}:retriedEvents`)) || '0', 10),
			deadLetterEvents: parseInt(
				(await this.connection.get(`${this.key}:deadLetterEvents`)) || '0',
				10
			),
			circuitBreakerTrips: parseInt(
				(await this.connection.get(`${this.key}:circuitBreakerTrips`)) || '0',
				10
			),
		}

		return metrics
	}

	async resetMetrics(): Promise<void> {
		await this.connection.del(`${this.key}`)

		const metrics: ProcessorMetrics = {
			totalProcessed: 0,
			successfullyProcessed: 0,
			failedProcessed: 0,
			retriedEvents: 0,
			deadLetterEvents: 0,
			circuitBreakerTrips: 0,
			averageProcessingTime: 0,
			queueDepth: 0,
			timestamp: new Date().toISOString(),
		}
		await this.connection.set(`${this.key}`, JSON.stringify(metrics))
	}

	async getQueueDepth(): Promise<number> {
		const depth = parseInt((await this.connection.get(`${this.key}:queueDepth`)) || '0', 10)
		return depth
	}

	async recordQueueDepth(depth: number): Promise<void> {
		await this.connection.set(`${this.key}:queueDepth`, depth.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordTotalProcessed(): Promise<void> {
		await this.connection.incr(`${this.key}:totalProcessed`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordRetriedEvents(): Promise<void> {
		await this.connection.incr(`${this.key}:retriedEvents`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordFailedProcessed(): Promise<void> {
		await this.connection.incr(`${this.key}:failedProcessed`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordAverageProcessingTime(time: number): Promise<void> {
		await this.connection.set(`${this.key}:averageProcessingTime`, time.toString())
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordDeadLetterEvents(): Promise<void> {
		await this.connection.incr(`${this.key}:deadLetterEvents`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}

	async recordSuccessfullyProcessed(): Promise<void> {
		const now = new Date().toISOString()
		await this.connection.incr(`${this.key}:successfullyProcessed`)
		await this.connection.set(`${this.key}:lastProcessedTime`, now)
		await this.connection.set(`${this.key}:timestamp`, now)
	}

	async recordCircuitBreakerTrips(): Promise<void> {
		await this.connection.incr(`${this.key}:circuitBreakerTrips`)
		await this.connection.set(`${this.key}:timestamp`, new Date().toISOString())
	}
}
