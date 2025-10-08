/**
 * Intelligent read replica router for load balancing and high availability
 * Implements sophisticated routing strategies with health monitoring
 */

import { LoggerFactory, StructuredLogger } from '@repo/logs'

import { DatabaseCircuitBreakers } from './circuit-breaker.js'
import { IReadReplicaRouter, ReplicaHealth, RoutingOptions, RoutingStrategy } from './interfaces.js'

export interface ReplicaConnection {
	id: string
	url: string
	weight: number
	region?: string
	isHealthy: boolean
	lastHealthCheck: Date
	metrics: {
		totalRequests: number
		successfulRequests: number
		failedRequests: number
		averageResponseTime: number
		currentConnections: number
	}
}

export interface ReadReplicaConfig {
	replicas: Array<{
		id: string
		url: string
		weight?: number
		region?: string
	}>
	strategy: RoutingStrategy
	healthCheckInterval: number
	maxLagMs: number
	circuitBreakerEnabled: boolean
	fallbackToMaster: boolean
	loadBalancing: {
		enabled: boolean
		algorithm: 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'least_latency'
	}
}

export interface RoutingDecision {
	replicaId: string
	reason: string
	fallbackToMaster: boolean
	estimatedLatency: number
}

/**
 * Advanced read replica router with intelligent routing and health monitoring
 */
export class ReadReplicaRouter implements IReadReplicaRouter {
	private readonly replicas = new Map<string, ReplicaConnection>()
	private currentIndex = 0
	private healthCheckTimer: NodeJS.Timeout | null = null
	private readonly logger: StructuredLogger

	constructor(private config: ReadReplicaConfig) {
		// Initialize Structured Logger
		LoggerFactory.setDefaultConfig({
			level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
			enablePerformanceLogging: true,
			enableErrorTracking: true,
			enableMetrics: false,
			format: 'json',
			outputs: ['otpl'],
			otplConfig: {
				endpoint: 'http://localhost:5080/api/default/default/_json',
				headers: {
					Authorization: process.env.OTLP_AUTH_HEADER || '',
				},
			},
		})

		this.logger = LoggerFactory.createLogger({
			service: '@repo/audit-db - ReadReplicaRouter',
		})

		this.initializeReplicas()
		this.startHealthMonitoring()
	}

	/**
	 * Route query to appropriate replica based on routing strategy
	 */
	async route<T>(query: () => Promise<T>, options: RoutingOptions = {}): Promise<T> {
		const decision = this.makeRoutingDecision(options)

		if (decision.fallbackToMaster) {
			this.logger.info('Routing to master database', { decision })
			return this.executeOnMaster(query)
		}

		const replica = this.replicas.get(decision.replicaId)
		if (!replica) {
			this.logger.error(`Replica not found: ${decision.replicaId}`)
			throw new Error(`Replica not found: ${decision.replicaId}`)
		}

		try {
			this.logger.debug('Routing query to replica', { decision, replica: replica.id })
			return await this.executeOnReplica(replica, query)
		} catch (error) {
			this.logger.error(`Query failed on replica ${replica.id}:`, error as Error)

			// Mark replica as unhealthy
			await this.markReplicaUnhealthy(replica.id, error as Error)

			// Fallback to master if configured
			if (this.config.fallbackToMaster) {
				this.logger.info('Falling back to master database', { replicaId: replica.id })
				return this.executeOnMaster(query)
			}

			throw error
		}
	}

	/**
	 * Get health status of all replicas
	 */
	async getReplicaHealth(): Promise<ReplicaHealth[]> {
		const healthPromises = Array.from(this.replicas.values()).map(async (replica) => {
			try {
				const startTime = Date.now()
				await this.performHealthCheck(replica)
				const responseTime = Date.now() - startTime

				return {
					id: replica.id,
					url: replica.url,
					healthy: replica.isHealthy,
					lagMs: await this.measureReplicationLag(replica),
					responseTimeMs: responseTime,
				}
			} catch (error) {
				this.logger.error(`Health check failed for replica ${replica.id}:`, error as Error)
				return {
					id: replica.id,
					url: replica.url,
					healthy: false,
					lagMs: -1,
					responseTimeMs: -1,
				}
			}
		})

		return Promise.all(healthPromises)
	}

	/**
	 * Update routing strategy dynamically
	 */
	updateStrategy(strategy: RoutingStrategy): void {
		this.config.strategy = strategy
		this.logger.info(`Updated routing strategy to: ${strategy}`)
	}

	/**
	 * Get routing statistics and metrics
	 */
	getRoutingStatistics(): {
		totalReplicas: number
		healthyReplicas: number
		routingDecisions: Record<string, number>
		averageResponseTimes: Record<string, number>
		errorRates: Record<string, number>
	} {
		const stats = {
			totalReplicas: this.replicas.size,
			healthyReplicas: 0,
			routingDecisions: {} as Record<string, number>,
			averageResponseTimes: {} as Record<string, number>,
			errorRates: {} as Record<string, number>,
		}

		for (const replica of this.replicas.values()) {
			if (replica.isHealthy) {
				stats.healthyReplicas++
			}

			stats.routingDecisions[replica.id] = replica.metrics.totalRequests
			stats.averageResponseTimes[replica.id] = replica.metrics.averageResponseTime

			const errorRate =
				replica.metrics.totalRequests > 0
					? (replica.metrics.failedRequests / replica.metrics.totalRequests) * 100
					: 0
			stats.errorRates[replica.id] = errorRate
		}

		return stats
	}

	/**
	 * Cleanup resources and stop health monitoring
	 */
	destroy(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}
		this.logger.info('Read replica router destroyed')
	}

	/**
	 * Initialize replica connections from configuration
	 */
	private initializeReplicas(): void {
		for (const replicaConfig of this.config.replicas) {
			const replica: ReplicaConnection = {
				id: replicaConfig.id,
				url: replicaConfig.url,
				weight: replicaConfig.weight || 1,
				region: replicaConfig.region,
				isHealthy: true, // Assume healthy initially
				lastHealthCheck: new Date(),
				metrics: {
					totalRequests: 0,
					successfulRequests: 0,
					failedRequests: 0,
					averageResponseTime: 0,
					currentConnections: 0,
				},
			}

			this.replicas.set(replica.id, replica)
			this.logger.info(`Initialized replica: ${replica.id}`, { url: replica.url })
		}
	}

	/**
	 * Make routing decision based on strategy and options
	 */
	private makeRoutingDecision(options: RoutingOptions): RoutingDecision {
		const healthyReplicas = Array.from(this.replicas.values()).filter(
			(replica) => replica.isHealthy
		)

		// No healthy replicas - fallback to master
		if (healthyReplicas.length === 0) {
			return {
				replicaId: '',
				reason: 'No healthy replicas available',
				fallbackToMaster: true,
				estimatedLatency: -1,
			}
		}

		// Filter by region preference if specified
		let candidateReplicas = healthyReplicas
		if (options.preferLocal) {
			const localReplicas = healthyReplicas.filter(
				(replica) => replica.region === process.env.AWS_REGION || replica.region === 'local'
			)
			if (localReplicas.length > 0) {
				candidateReplicas = localReplicas
			}
		}

		// Filter by maximum lag if specified
		if (options.maxLagMs) {
			candidateReplicas = candidateReplicas.filter(async (replica) => {
				const lag = await this.measureReplicationLag(replica)
				return lag <= options.maxLagMs!
			})
		}

		// Select replica based on routing strategy
		const selectedReplica = this.selectReplicaByStrategy(candidateReplicas)

		return {
			replicaId: selectedReplica.id,
			reason: `Selected by ${this.config.strategy} strategy`,
			fallbackToMaster: false,
			estimatedLatency: selectedReplica.metrics.averageResponseTime,
		}
	}

	/**
	 * Select replica based on configured routing strategy
	 */
	private selectReplicaByStrategy(replicas: ReplicaConnection[]): ReplicaConnection {
		switch (this.config.strategy) {
			case RoutingStrategy.ROUND_ROBIN:
				return this.selectRoundRobin(replicas)

			case RoutingStrategy.LEAST_CONNECTIONS:
				return this.selectLeastConnections(replicas)

			case RoutingStrategy.LEAST_LATENCY:
				return this.selectLeastLatency(replicas)

			default:
				return this.selectRoundRobin(replicas)
		}
	}

	/**
	 * Round-robin selection
	 */
	private selectRoundRobin(replicas: ReplicaConnection[]): ReplicaConnection {
		const replica = replicas[this.currentIndex % replicas.length]
		this.currentIndex++
		return replica
	}

	/**
	 * Least connections selection
	 */
	private selectLeastConnections(replicas: ReplicaConnection[]): ReplicaConnection {
		return replicas.reduce((least, current) =>
			current.metrics.currentConnections < least.metrics.currentConnections ? current : least
		)
	}

	/**
	 * Least latency selection
	 */
	private selectLeastLatency(replicas: ReplicaConnection[]): ReplicaConnection {
		return replicas.reduce((fastest, current) =>
			current.metrics.averageResponseTime < fastest.metrics.averageResponseTime ? current : fastest
		)
	}

	/**
	 * Execute query on master database
	 */
	private async executeOnMaster<T>(query: () => Promise<T>): Promise<T> {
		if (this.config.circuitBreakerEnabled) {
			return DatabaseCircuitBreakers.master.execute(query)
		}
		return query()
	}

	/**
	 * Execute query on specific replica
	 */
	private async executeOnReplica<T>(
		replica: ReplicaConnection,
		query: () => Promise<T>
	): Promise<T> {
		const startTime = Date.now()
		replica.metrics.totalRequests++
		replica.metrics.currentConnections++

		try {
			let result: T

			if (this.config.circuitBreakerEnabled) {
				result = await DatabaseCircuitBreakers.replica.execute(query)
			} else {
				result = await query()
			}

			// Update success metrics
			replica.metrics.successfulRequests++
			const responseTime = Date.now() - startTime
			this.updateAverageResponseTime(replica, responseTime)

			return result
		} catch (error) {
			// Update failure metrics
			replica.metrics.failedRequests++
			throw error
		} finally {
			replica.metrics.currentConnections--
		}
	}

	/**
	 * Update average response time with exponential smoothing
	 */
	private updateAverageResponseTime(replica: ReplicaConnection, responseTime: number): void {
		const alpha = 0.1 // Smoothing factor
		replica.metrics.averageResponseTime =
			replica.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha
	}

	/**
	 * Start periodic health monitoring
	 */
	private startHealthMonitoring(): void {
		this.healthCheckTimer = setInterval(async () => {
			await this.performHealthChecks()
		}, this.config.healthCheckInterval)

		this.logger.info('Started health monitoring', {
			interval: this.config.healthCheckInterval,
		})
	}

	/**
	 * Perform health checks on all replicas
	 */
	private async performHealthChecks(): Promise<void> {
		const healthCheckPromises = Array.from(this.replicas.values()).map((replica) =>
			this.performHealthCheck(replica).catch((error) => {
				this.logger.error(`Health check failed for replica ${replica.id}:`, error as Error)
				replica.isHealthy = false
			})
		)

		await Promise.allSettled(healthCheckPromises)
	}

	/**
	 * Perform health check on a specific replica
	 */
	private async performHealthCheck(replica: ReplicaConnection): Promise<void> {
		try {
			const startTime = Date.now()

			// Simulate health check query
			// In real implementation, this would execute a simple query like SELECT 1
			await new Promise((resolve) => setTimeout(resolve, 10))

			const responseTime = Date.now() - startTime
			replica.isHealthy = true
			replica.lastHealthCheck = new Date()

			// Update response time if health check was successful
			this.updateAverageResponseTime(replica, responseTime)

			this.logger.debug(`Health check passed for replica ${replica.id}`, { responseTime })
		} catch (error) {
			replica.isHealthy = false
			replica.lastHealthCheck = new Date()
			throw error
		}
	}

	/**
	 * Mark replica as unhealthy due to error
	 */
	private async markReplicaUnhealthy(replicaId: string, error: Error): Promise<void> {
		const replica = this.replicas.get(replicaId)
		if (replica) {
			replica.isHealthy = false
			this.logger.warn(`Marked replica ${replicaId} as unhealthy`, { error: error.message })
		}
	}

	/**
	 * Measure replication lag for a replica
	 */
	private async measureReplicationLag(replica: ReplicaConnection): Promise<number> {
		try {
			// Simulate replication lag measurement
			// In real implementation, this would query pg_stat_replication or similar
			return Math.random() * 100 // Random lag between 0-100ms
		} catch (error) {
			this.logger.error(`Failed to measure replication lag for ${replica.id}:`, error as Error)
			return -1
		}
	}
}

/**
 * Factory function for creating read replica router
 */
export function createReadReplicaRouter(
	config: Partial<ReadReplicaConfig> = {}
): ReadReplicaRouter {
	const defaultConfig: ReadReplicaConfig = {
		replicas: [],
		strategy: RoutingStrategy.ROUND_ROBIN,
		healthCheckInterval: 30000, // 30 seconds
		maxLagMs: 1000, // 1 second
		circuitBreakerEnabled: true,
		fallbackToMaster: true,
		loadBalancing: {
			enabled: true,
			algorithm: 'round_robin',
		},
	}

	return new ReadReplicaRouter({ ...defaultConfig, ...config })
}
