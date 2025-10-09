import Redis from 'ioredis'

import { closeSharedRedisConnection, getSharedRedisConnection } from '@repo/redis-client'

import { DefaultBatchManager } from '../core/batch-manager.js'
import { DefaultCircuitBreaker } from '../core/circuit-breaker.js'
import { DefaultRetryManager } from '../core/retry-manager.js'

import type { Cluster, RedisOptions, Redis as RedisType } from 'ioredis'
import type { BatchManager, CircuitBreaker, RetryManager } from '../types/batch.js'
import type { RedisConfig } from '../types/config.js'
import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'

/**
 * Redis-specific error with connection information
 */
class RedisTransportError extends Error {
	constructor(
		message: string,
		public readonly isRetryable: boolean,
		public readonly connectionStatus?: string
	) {
		super(message)
		this.name = 'RedisTransportError'
	}
}

/**
 * Redis transport implementation with connection management and resilience
 * Addresses requirements 5.3, 1.1: Redis output support with consistent interface
 * Addresses requirements 9.1: Proper error handling for Redis connection failures
 */
export class RedisTransport implements LogTransport {
	public readonly name = 'redis'
	private readonly batchManager: BatchManager
	private readonly circuitBreaker: CircuitBreaker
	private readonly retryManager: RetryManager
	private redisClient: RedisType | Cluster | null = null
	private isHealthyState = true
	private lastError: Error | null = null
	private connectionAttempts = 0
	private readonly maxConnectionAttempts = 5
	private reconnectTimer: NodeJS.Timeout | null = null
	private readonly isClusterMode: boolean

	constructor(private readonly config: RedisConfig) {
		this.isClusterMode = Boolean(
			config.enableCluster && config.clusterNodes && config.clusterNodes.length > 0
		)

		// Initialize circuit breaker with Redis-specific health check
		this.circuitBreaker = new DefaultCircuitBreaker(
			{
				failureThreshold: config.maxRetries || 3,
				resetTimeoutMs: 60000, // 1 minute
				monitoringPeriodMs: 30000, // 30 seconds
			},
			() => this.performHealthCheck()
		)

		// Initialize retry manager with circuit breaker integration
		this.retryManager = new DefaultRetryManager(this.circuitBreaker)

		// Initialize batch manager with Redis-specific configuration
		this.batchManager = new DefaultBatchManager(
			{
				maxSize: 50, // Smaller batches for Redis to avoid memory issues
				timeoutMs: 2000, // Faster flush for Redis
				maxConcurrency: 5, // Limit Redis concurrency
				maxQueueSize: 1000, // Reasonable queue size for Redis
			},
			(entries) => this.processBatch(entries)
		)

		// Initialize Redis connection
		this.initializeConnection()
	}

	/**
	 * Send log entries to Redis using batching
	 */
	async send(entries: LogEntry[]): Promise<void> {
		if (entries.length === 0) {
			return
		}

		// Add entries to batch manager for processing
		for (const entry of entries) {
			await this.batchManager.add(entry)
		}
	}

	/**
	 * Flush any pending logs
	 */
	async flush(): Promise<void> {
		await this.batchManager.flush()
	}

	/**
	 * Close the transport and cleanup resources
	 */
	async close(): Promise<void> {
		try {
			// Cancel any pending reconnection attempts
			if (this.reconnectTimer) {
				clearTimeout(this.reconnectTimer)
				this.reconnectTimer = null
			}

			// Close batch manager first
			await this.batchManager.close()

			// Cleanup circuit breaker
			this.circuitBreaker.destroy()

			// Close Redis connection if we have one
			if (this.redisClient) {
				try {
					// For cluster connections, we need to disconnect properly
					if (this.isClusterMode) {
						await (this.redisClient as Cluster).disconnect()
					} else {
						// For single connections, use quit for graceful shutdown
						await (this.redisClient as RedisType).quit()
					}
				} catch (error) {
					console.warn('Error during Redis connection cleanup:', error)
					// Force disconnect if graceful shutdown fails
					if (this.isClusterMode) {
						;(this.redisClient as Cluster).disconnect()
					} else {
						;(this.redisClient as RedisType).disconnect()
					}
				} finally {
					this.redisClient = null
				}
			}
		} catch (error) {
			console.error('Error closing Redis transport:', error)
			throw error
		}
	}

	/**
	 * Check if the transport is healthy
	 */
	isHealthy(): boolean {
		const batchHealthy = this.batchManager.isHealthy()
		const circuitHealthy = this.circuitBreaker.getState() !== 'open'
		const connectionHealthy = this.redisClient?.status === 'ready'
		return this.isHealthyState && batchHealthy && circuitHealthy && connectionHealthy
	}

	/**
	 * Get the last error that occurred
	 */
	getLastError(): Error | null {
		return this.lastError
	}

	/**
	 * Get Redis connection status
	 */
	getConnectionStatus(): string {
		if (!this.redisClient) {
			return 'uninitialized'
		}

		const status = this.redisClient.status
		const type = this.isClusterMode ? 'cluster' : 'single'
		return `${status} (${type})`
	}

	/**
	 * Get circuit breaker state for monitoring
	 */
	getCircuitBreakerState(): 'closed' | 'open' | 'half-open' {
		return this.circuitBreaker.getState()
	}

	/**
	 * Get batch manager statistics for monitoring
	 */
	getBatchStats(): {
		pendingCount: number
		isHealthy: boolean
	} {
		return {
			pendingCount: this.batchManager.getPendingCount(),
			isHealthy: this.batchManager.isHealthy(),
		}
	}

	/**
	 * Get detailed connection information for monitoring
	 */
	getConnectionInfo(): {
		type: 'single' | 'cluster'
		status: string
		isHealthy: boolean
		connectionAttempts: number
		lastError: string | null
		tlsEnabled: boolean
		nodes?: string[]
	} {
		return {
			type: this.isClusterMode ? 'cluster' : 'single',
			status: this.getConnectionStatus(),
			isHealthy: this.isHealthy(),
			connectionAttempts: this.connectionAttempts,
			lastError: this.lastError?.message || null,
			tlsEnabled: this.config.enableTLS,
			...(this.isClusterMode && { nodes: this.config.clusterNodes }),
		}
	}

	/**
	 * Perform health check on Redis connection
	 * Works with both single instance and cluster connections
	 */
	async performHealthCheck(): Promise<boolean> {
		try {
			if (!this.redisClient) {
				return false
			}

			// Check connection status
			if (this.isClusterMode) {
				const cluster = this.redisClient as Cluster
				if (cluster.status !== 'ready') {
					return false
				}
			} else {
				const redis = this.redisClient as RedisType
				if (redis.status !== 'ready') {
					return false
				}
			}

			// Use PING command to check Redis connectivity
			const result = await this.redisClient.ping()
			return result === 'PONG'
		} catch (error) {
			console.warn('Redis health check failed:', error)
			return false
		}
	}

	/**
	 * Initialize Redis connection with proper error handling
	 * Supports both single instance and cluster configurations with TLS
	 */
	private async initializeConnection(): Promise<void> {
		try {
			this.connectionAttempts++

			if (this.isClusterMode) {
				// Initialize Redis Cluster connection
				this.redisClient = await this.createClusterConnection()
			} else {
				// Initialize single Redis connection
				this.redisClient = await this.createSingleConnection()
			}

			// Set up event handlers for connection monitoring
			this.setupConnectionEventHandlers()

			this.isHealthyState = true
			this.lastError = null
			this.connectionAttempts = 0
		} catch (error) {
			const redisError = new RedisTransportError(
				`Failed to initialize Redis connection: ${error instanceof Error ? error.message : String(error)}`,
				true,
				'failed'
			)

			this.isHealthyState = false
			this.lastError = redisError

			// If we've exceeded max connection attempts, schedule retry
			if (this.connectionAttempts >= this.maxConnectionAttempts) {
				console.error(
					`Failed to connect to Redis after ${this.maxConnectionAttempts} attempts, will retry in 30 seconds`
				)
				this.scheduleReconnect()
			} else {
				// Immediate retry for transient errors
				this.scheduleReconnect(5000) // 5 second delay
			}

			throw redisError
		}
	}

	/**
	 * Create a single Redis connection with TLS support
	 */
	private async createSingleConnection(): Promise<RedisType> {
		const options: RedisOptions = {
			host: this.config.host,
			port: this.config.port,
			password: this.config.password,
			db: this.config.database,
			maxRetriesPerRequest: null, // Let our retry manager handle retries
			enableAutoPipelining: this.config.enableAutoPipelining,
			enableOfflineQueue: this.config.enableOfflineQueue,
			connectTimeout: this.config.connectTimeoutMs,
			commandTimeout: this.config.commandTimeoutMs,
			lazyConnect: false, // Connect immediately
		}

		// Add TLS configuration if enabled
		if (this.config.enableTLS && this.config.tlsOptions) {
			options.tls = {
				rejectUnauthorized: this.config.tlsOptions.rejectUnauthorized,
				...(this.config.tlsOptions.ca && { ca: this.config.tlsOptions.ca }),
				...(this.config.tlsOptions.cert && { cert: this.config.tlsOptions.cert }),
				...(this.config.tlsOptions.key && { key: this.config.tlsOptions.key }),
			}
		}

		return new Redis(options)
	}

	/**
	 * Create a Redis Cluster connection with TLS support
	 */
	private async createClusterConnection(): Promise<Cluster> {
		if (!this.config.clusterNodes || this.config.clusterNodes.length === 0) {
			throw new Error('Cluster nodes must be specified for cluster mode')
		}

		// Parse cluster nodes
		const nodes = this.config.clusterNodes.map((node) => {
			const [host, port] = node.split(':')
			return {
				host: host || 'localhost',
				port: parseInt(port) || 6379,
			}
		})

		const clusterOptions = {
			enableAutoPipelining: this.config.enableAutoPipelining,
			enableOfflineQueue: this.config.enableOfflineQueue,
			maxRetriesPerRequest: null, // Let our retry manager handle retries
			redisOptions: {
				password: this.config.password,
				connectTimeout: this.config.connectTimeoutMs,
				commandTimeout: this.config.commandTimeoutMs,
				...(this.config.enableTLS &&
					this.config.tlsOptions && {
						tls: {
							rejectUnauthorized: this.config.tlsOptions.rejectUnauthorized,
							...(this.config.tlsOptions.ca && { ca: this.config.tlsOptions.ca }),
							...(this.config.tlsOptions.cert && { cert: this.config.tlsOptions.cert }),
							...(this.config.tlsOptions.key && { key: this.config.tlsOptions.key }),
						},
					}),
			},
		}

		return new Redis.Cluster(nodes, clusterOptions)
	}

	/**
	 * Schedule reconnection attempt with exponential backoff
	 */
	private scheduleReconnect(delayMs: number = 30000): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
		}

		this.reconnectTimer = setTimeout(async () => {
			this.reconnectTimer = null
			console.log('Attempting to reconnect to Redis...')

			try {
				await this.initializeConnection()
				console.log('Successfully reconnected to Redis')
			} catch (error) {
				console.error('Reconnection attempt failed:', error)
				// Will schedule another reconnect attempt in initializeConnection
			}
		}, delayMs)
	}

	/**
	 * Set up Redis connection event handlers for monitoring and resilience
	 * Handles both single instance and cluster connections
	 */
	private setupConnectionEventHandlers(): void {
		if (!this.redisClient) {
			return
		}

		const connectionType = this.isClusterMode ? 'Redis Cluster' : 'Redis'

		this.redisClient.on('connect', () => {
			const target = this.isClusterMode
				? `cluster with ${this.config.clusterNodes?.length} nodes`
				: `${this.config.host}:${this.config.port}`
			console.log(`${connectionType} transport: Connected to ${target}`)
			this.isHealthyState = true
		})

		this.redisClient.on('ready', () => {
			console.log(`${connectionType} transport: Connection ready`)
			this.isHealthyState = true
			this.circuitBreaker.onSuccess()
			this.connectionAttempts = 0 // Reset connection attempts on successful connection
		})

		this.redisClient.on('error', (error: Error) => {
			console.error(`${connectionType} transport: Connection error:`, error.message)
			this.isHealthyState = false
			this.lastError = error
			this.circuitBreaker.onFailure()

			// For critical errors, schedule reconnection
			if (this.isCriticalError(error)) {
				this.scheduleReconnect()
			}
		})

		this.redisClient.on('close', () => {
			console.log(`${connectionType} transport: Connection closed`)
			this.isHealthyState = false
		})

		this.redisClient.on('reconnecting', (delay: number) => {
			console.log(`${connectionType} transport: Reconnecting in ${delay}ms`)
		})

		this.redisClient.on('end', () => {
			console.log(`${connectionType} transport: Connection ended`)
			this.isHealthyState = false
		})

		// Cluster-specific events
		if (this.isClusterMode) {
			const cluster = this.redisClient as Cluster

			cluster.on('node error', (error: Error, node: any) => {
				console.error(
					`${connectionType} transport: Node error on ${node.options.host}:${node.options.port}:`,
					error.message
				)
			})

			cluster.on('+node', (node: any) => {
				console.log(
					`${connectionType} transport: Node added: ${node.options.host}:${node.options.port}`
				)
			})

			cluster.on('-node', (node: any) => {
				console.log(
					`${connectionType} transport: Node removed: ${node.options.host}:${node.options.port}`
				)
			})
		}
	}

	/**
	 * Determine if an error is critical and requires reconnection
	 */
	private isCriticalError(error: Error): boolean {
		const message = error.message.toLowerCase()

		const criticalPatterns = [
			'connection lost',
			'connection closed',
			'econnreset',
			'econnrefused',
			'etimedout',
			'network error',
		]

		return criticalPatterns.some((pattern) => message.includes(pattern))
	}

	/**
	 * Process a batch of log entries with retry logic and circuit breaker integration
	 */
	private async processBatch(entries: LogEntry[]): Promise<void> {
		if (entries.length === 0) {
			return
		}

		// Check circuit breaker before attempting to send
		if (!this.circuitBreaker.canExecute()) {
			const error = new RedisTransportError(
				'Circuit breaker is open, Redis endpoint is unavailable',
				false,
				this.getConnectionStatus()
			)
			this.isHealthyState = false
			this.lastError = error
			throw error
		}

		try {
			// Execute with retry logic
			await this.retryManager.executeWithRetry(() => this.sendToRedis(entries), {
				maxAttempts: this.config.maxRetries || 3,
				initialDelayMs: 1000,
				maxDelayMs: 10000, // Shorter max delay for Redis
				multiplier: 2,
			})

			this.circuitBreaker.onSuccess()
			this.isHealthyState = true
			this.lastError = null
		} catch (error) {
			this.circuitBreaker.onFailure()
			this.isHealthyState = false
			this.lastError = error as Error
			throw error
		}
	}

	/**
	 * Send log entries to Redis using lists for reliable delivery
	 * Supports multiple Redis data structures: lists, streams, and pub/sub
	 */
	private async sendToRedis(entries: LogEntry[]): Promise<void> {
		if (!this.redisClient) {
			throw new RedisTransportError('Redis client not initialized', true, 'uninitialized')
		}

		if (this.redisClient.status !== 'ready') {
			throw new RedisTransportError(
				`Redis connection not ready: ${this.redisClient.status}`,
				true,
				this.redisClient.status
			)
		}

		try {
			// Use Redis pipeline for better performance with multiple entries
			const pipeline = this.redisClient.pipeline()

			for (const entry of entries) {
				const serializedEntry = this.serializeLogEntry(entry)
				const key = `${this.config.keyPrefix}${this.config.listName}`

				// Use LPUSH to add to the beginning of the list (FIFO when using RPOP)
				pipeline.lpush(key, serializedEntry)
			}

			// Execute all commands in the pipeline
			const results = await pipeline.exec()

			// Check for any pipeline errors
			if (results) {
				for (const [error, result] of results) {
					if (error) {
						throw new RedisTransportError(
							`Redis pipeline command failed: ${error.message}`,
							this.isRetryableRedisError(error),
							this.redisClient.status
						)
					}
				}
			}

			// Optional: Set expiration on the list to prevent unbounded growth
			// This is a separate command to avoid affecting the main pipeline
			const key = `${this.config.keyPrefix}${this.config.listName}`
			await this.redisClient.expire(key, 86400) // 24 hours TTL
		} catch (error) {
			if (error instanceof RedisTransportError) {
				throw error
			}

			// Wrap other errors in RedisTransportError
			const redisError = new RedisTransportError(
				`Failed to send logs to Redis: ${error instanceof Error ? error.message : String(error)}`,
				this.isRetryableRedisError(error),
				this.redisClient.status
			)

			throw redisError
		}
	}

	/**
	 * Serialize log entry to JSON string for Redis storage
	 */
	private serializeLogEntry(entry: LogEntry): string {
		try {
			// Create a structured log object for Redis
			const logObject = {
				'@timestamp': entry.timestamp.toISOString(),
				level: entry.level,
				message: entry.message,
				id: entry.id,
				source: entry.source,
				version: entry.version,
				correlationId: entry.correlationId,
				...(entry.requestId && { requestId: entry.requestId }),
				...(entry.traceId && { traceId: entry.traceId }),
				...(entry.spanId && { spanId: entry.spanId }),
				fields: entry.fields,
				metadata: entry.metadata,
				...(entry.performance && { performance: entry.performance }),
			}

			return JSON.stringify(logObject)
		} catch (error) {
			// If serialization fails, create a minimal log entry
			const fallbackLog = {
				'@timestamp': entry.timestamp.toISOString(),
				level: entry.level,
				message: entry.message,
				id: entry.id,
				error: `Serialization failed: ${error instanceof Error ? error.message : String(error)}`,
			}

			return JSON.stringify(fallbackLog)
		}
	}

	/**
	 * Determine if a Redis error is retryable
	 */
	private isRetryableRedisError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return true // Default to retryable for unknown error types
		}

		const message = error.message.toLowerCase()

		// Connection-related errors that are retryable
		const retryablePatterns = [
			'connection',
			'timeout',
			'network',
			'econnreset',
			'econnrefused',
			'etimedout',
			'socket',
			'redis connection lost',
			'connection is closed',
			'connection not ready',
			'loading',
			'busy',
			'readonly',
		]

		// Non-retryable errors (authentication, syntax, etc.)
		const nonRetryablePatterns = [
			'noauth',
			'wrongpass',
			'invalid',
			'syntax error',
			'unknown command',
			'wrong number of arguments',
			'operation not permitted',
		]

		// Check for non-retryable patterns first
		for (const pattern of nonRetryablePatterns) {
			if (message.includes(pattern)) {
				return false
			}
		}

		// Check for retryable patterns
		for (const pattern of retryablePatterns) {
			if (message.includes(pattern)) {
				return true
			}
		}

		// Default to retryable for Redis errors to handle transient issues
		return true
	}

	/**
	 * Alternative method to send logs using Redis Streams (for advanced use cases)
	 */
	async sendToRedisStream(entries: LogEntry[], streamName?: string): Promise<void> {
		if (!this.redisClient || this.redisClient.status !== 'ready') {
			throw new RedisTransportError('Redis client not ready for stream operations', true)
		}

		const stream = streamName || `${this.config.keyPrefix}stream`

		try {
			const pipeline = this.redisClient.pipeline()

			for (const entry of entries) {
				const fields = this.createStreamFields(entry)
				pipeline.xadd(stream, '*', ...fields)
			}

			await pipeline.exec()

			// Optional: Trim stream to prevent unbounded growth
			await this.redisClient.xtrim(stream, 'MAXLEN', '~', 10000)
		} catch (error) {
			throw new RedisTransportError(
				`Failed to send logs to Redis stream: ${error instanceof Error ? error.message : String(error)}`,
				this.isRetryableRedisError(error)
			)
		}
	}

	/**
	 * Create Redis stream fields from log entry
	 */
	private createStreamFields(entry: LogEntry): string[] {
		const fields: string[] = []

		// Add core fields
		fields.push('timestamp', entry.timestamp.toISOString())
		fields.push('level', entry.level)
		fields.push('message', entry.message)
		fields.push('id', entry.id)
		fields.push('source', entry.source)
		fields.push('correlationId', entry.correlationId)

		// Add optional fields
		if (entry.requestId) {
			fields.push('requestId', entry.requestId)
		}
		if (entry.traceId) {
			fields.push('traceId', entry.traceId)
		}

		// Add serialized complex fields
		if (Object.keys(entry.fields).length > 0) {
			fields.push('fields', JSON.stringify(entry.fields))
		}
		if (entry.metadata) {
			fields.push('metadata', JSON.stringify(entry.metadata))
		}

		return fields
	}

	/**
	 * Alternative method to publish logs using Redis Pub/Sub (for real-time use cases)
	 */
	async publishToRedisChannel(entries: LogEntry[], channelName?: string): Promise<void> {
		if (!this.redisClient || this.redisClient.status !== 'ready') {
			throw new RedisTransportError('Redis client not ready for pub/sub operations', true)
		}

		const channel = channelName || `${this.config.keyPrefix}channel`

		try {
			for (const entry of entries) {
				const serializedEntry = this.serializeLogEntry(entry)
				await this.redisClient.publish(channel, serializedEntry)
			}
		} catch (error) {
			throw new RedisTransportError(
				`Failed to publish logs to Redis channel: ${error instanceof Error ? error.message : String(error)}`,
				this.isRetryableRedisError(error)
			)
		}
	}
}
