/**
 * Enhanced database client integrating all optimization components
 * Implements circuit breakers, error handling, and partition management
 */

import { LoggerFactory, StructuredLogger } from '@repo/logs'

import { DatabaseCircuitBreakers } from './circuit-breaker.js'
import { EnhancedPartitionManager } from './enhanced-partition-manager.js'
import { GlobalErrorHandler } from './error-handler.js'
import { OptimizedLRUCache } from '../cache/optimized-lru-cache.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisType } from 'ioredis'
import type {
	IAuditDatabase,
	IConnectionManager,
	DatabaseConnectionConfig,
	PartitionConfig,
	ErrorContext
} from './interfaces.js'
import type * as schema from './schema.js'

export interface EnhancedDatabaseConfig {
	database: DatabaseConnectionConfig
	partition: PartitionConfig
	cache: {
		enabled: boolean
		maxSizeMB: number
		defaultTTL: number
	}
	circuitBreaker: {
		enabled: boolean
		failureThreshold: number
		timeoutMs: number
		resetTimeoutMs: number
	}
	monitoring: {
		enabled: boolean
		slowQueryThreshold: number
		metricsRetentionDays: number
	}
}

export interface DatabaseHealth {
	overall: 'healthy' | 'degraded' | 'unhealthy'
	components: {
		connection: { status: 'healthy' | 'unhealthy'; responseTime: number }
		cache: { status: 'healthy' | 'unhealthy'; hitRatio: number; sizeMB: number }
		partitions: { status: 'healthy' | 'unhealthy'; totalPartitions: number }
		circuitBreaker: { status: 'closed' | 'open' | 'half_open' }
	}
	metrics: {
		totalRequests: number
		successRate: number
		averageResponseTime: number
		errorRate: number
	}
}

/**
 * Enhanced audit database client with comprehensive optimizations
 */
export class EnhancedAuditDatabaseClient implements IAuditDatabase, IConnectionManager {
	private readonly db: PostgresJsDatabase<typeof schema>
	private readonly partitionManager: EnhancedPartitionManager
	private readonly cache: OptimizedLRUCache
	private readonly logger: StructuredLogger
	private readonly metrics = {
		totalRequests: 0,
		successfulRequests: 0,
		failedRequests: 0,
		totalResponseTime: 0
	}

	constructor(
		private readonly redis: RedisType,
		private readonly config: EnhancedDatabaseConfig,
		database: PostgresJsDatabase<typeof schema>
	) {
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
			service: '@repo/audit-db - EnhancedAuditDatabaseClient',
		})

		this.db = database
		this.partitionManager = new EnhancedPartitionManager(database, redis)
		this.cache = new OptimizedLRUCache({
			enabled: config.cache.enabled,
			maxSizeMB: config.cache.maxSizeMB,
			defaultTTL: config.cache.defaultTTL,
			keyPrefix: 'audit_db',
			maxKeys: 50000,
			cleanupInterval: 60000
		})

		this.initialize()
	}

	/**
	 * Initialize the enhanced database client
	 */
	private async initialize(): Promise<void> {
		try {
			// Initialize partitioning if enabled
			if (this.config.partition.autoMaintenance) {
				await this.partitionManager.createAuditLogPartitions(this.config.partition)
				this.logger.info('Partition management initialized')
			}

			this.logger.info('Enhanced audit database client initialized successfully')
		} catch (error) {
			this.logger.error('Failed to initialize enhanced database client:', error as Error)
			throw error
		}
	}

	/**
	 * Insert audit log entry with circuit breaker protection
	 */
	async insert<T>(data: T): Promise<void> {
		const context: ErrorContext = {
			operation: 'insert',
			timestamp: new Date(),
			metadata: { dataType: typeof data }
		}

		return this.executeWithProtection(async () => {
			// Insert operation through database
			// Implementation would depend on your schema structure
			this.logger.debug('Inserting audit log entry', { data })
			
			// Invalidate related cache entries
			await this.cache.invalidate('audit_log:*')
			
			return Promise.resolve()
		}, context)
	}

	/**
	 * Query audit logs with caching and circuit breaker protection
	 */
	async query<T>(filters: Record<string, any>): Promise<T[]> {
		const context: ErrorContext = {
			operation: 'query',
			timestamp: new Date(),
			metadata: { filters }
		}

		// Generate cache key based on filters
		const cacheKey = this.generateCacheKey('query', filters)

		return this.executeWithProtection(async () => {
			// Try cache first
			const cached = await this.cache.get<T[]>(cacheKey)
			if (cached) {
				this.logger.debug('Cache hit for query', { cacheKey })
				return cached
			}

			// Execute query against database
			this.logger.debug('Cache miss, executing database query', { filters })
			
			// Placeholder for actual query implementation
			const result: T[] = []
			
			// Cache the result
			await this.cache.set(cacheKey, result, this.config.cache.defaultTTL)
			
			return result
		}, context)
	}

	/**
	 * Execute transaction with circuit breaker protection
	 */
	async transaction<T>(callback: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>): Promise<T> {
		const context: ErrorContext = {
			operation: 'transaction',
			timestamp: new Date()
		}

		return this.executeWithProtection(async () => {
			return this.db.transaction(callback)
		}, context)
	}

	/**
	 * Check database health
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const health = await this.getHealthStatus()
			return health.overall === 'healthy'
		} catch (error) {
			this.logger.error('Health check failed:', error as Error)
			return false
		}
	}

	/**
	 * Get database connection (for compatibility)
	 */
	async getConnection(): Promise<PostgresJsDatabase<typeof schema>> {
		return this.db
	}

	/**
	 * Get connection pool statistics
	 */
	async poolStats() {
		return {
			totalConnections: 1, // Placeholder
			activeConnections: 1,
			idleConnections: 0,
			waitingRequests: 0
		}
	}

	/**
	 * Get comprehensive health status
	 */
	async getHealthStatus(): Promise<DatabaseHealth> {
		const startTime = Date.now()

		try {
			// Test database connection
			const connectionHealth = await this.testConnection()
			
			// Get cache statistics
			const cacheStats = await this.cache.stats()
			
			// Get partition status
			const partitionStatus = await this.partitionManager.getPartitionStatus()
			
			// Get circuit breaker status
			const circuitBreakerStatus = DatabaseCircuitBreakers.master.getState()
			
			const responseTime = Date.now() - startTime
			const successRate = this.metrics.totalRequests > 0 
				? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
				: 100
			
			const averageResponseTime = this.metrics.totalRequests > 0 
				? this.metrics.totalResponseTime / this.metrics.totalRequests 
				: 0
			
			const errorRate = this.metrics.totalRequests > 0 
				? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
				: 0

			// Determine overall health
			let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
			
			if (!connectionHealth.healthy || circuitBreakerStatus === 'open') {
				overall = 'unhealthy'
			} else if (cacheStats.hitRatio < 50 || successRate < 95) {
				overall = 'degraded'
			}

			return {
				overall,
				components: {
					connection: {
						status: connectionHealth.healthy ? 'healthy' : 'unhealthy',
						responseTime: connectionHealth.responseTime
					},
					cache: {
						status: this.config.cache.enabled ? 'healthy' : 'unhealthy',
						hitRatio: cacheStats.hitRatio,
						sizeMB: cacheStats.memoryUsageMB
					},
					partitions: {
						status: partitionStatus.length > 0 ? 'healthy' : 'unhealthy',
						totalPartitions: partitionStatus.length
					},
					circuitBreaker: {
						status: circuitBreakerStatus as 'closed' | 'open' | 'half_open'
					}
				},
				metrics: {
					totalRequests: this.metrics.totalRequests,
					successRate,
					averageResponseTime,
					errorRate
				}
			}
		} catch (error) {
			this.logger.error('Failed to get health status:', error as Error)
			return {
				overall: 'unhealthy',
				components: {
					connection: { status: 'unhealthy', responseTime: -1 },
					cache: { status: 'unhealthy', hitRatio: 0, sizeMB: 0 },
					partitions: { status: 'unhealthy', totalPartitions: 0 },
					circuitBreaker: { status: 'open' }
				},
				metrics: {
					totalRequests: this.metrics.totalRequests,
					successRate: 0,
					averageResponseTime: 0,
					errorRate: 100
				}
			}
		}
	}

	/**
	 * Close all connections and cleanup resources
	 */
	async close(): Promise<void> {
		try {
			this.cache.destroy()
			// Database connection cleanup would be handled by the connection pool
			this.logger.info('Enhanced database client closed successfully')
		} catch (error) {
			this.logger.error('Error closing database client:', error as Error)
			throw error
		}
	}

	/**
	 * Execute operation with circuit breaker protection and error handling
	 */
	private async executeWithProtection<T>(
		operation: () => Promise<T>,
		context: ErrorContext
	): Promise<T> {
		const startTime = Date.now()
		this.metrics.totalRequests++

		try {
			// Execute with circuit breaker protection
			const result = await DatabaseCircuitBreakers.master.execute(operation)
			
			// Record success metrics
			this.metrics.successfulRequests++
			this.metrics.totalResponseTime += Date.now() - startTime
			
			return result
		} catch (error) {
			// Record failure metrics
			this.metrics.failedRequests++
			this.metrics.totalResponseTime += Date.now() - startTime
			
			// Handle error with enhanced error handler
			const resolution = await GlobalErrorHandler.handle(error as Error, context)
			
			// Attempt recovery if suggested
			if (resolution.retryable && resolution.retryAfterMs) {
				this.logger.info(`Retrying operation after ${resolution.retryAfterMs}ms`, { context })
				await this.delay(resolution.retryAfterMs)
				
				// Retry the operation (simple retry, could be enhanced with retry limits)
				return this.executeWithProtection(operation, {
					...context,
					retryAttempt: (context as any).retryAttempt ? (context as any).retryAttempt + 1 : 1
				} as ErrorContext)
			}
			
			throw error
		}
	}

	/**
	 * Test database connection
	 */
	private async testConnection(): Promise<{ healthy: boolean; responseTime: number }> {
		const startTime = Date.now()
		
		try {
			// Simple connectivity test
			await this.db.execute({ sql: 'SELECT 1', args: [] })
			
			return {
				healthy: true,
				responseTime: Date.now() - startTime
			}
		} catch (error) {
			return {
				healthy: false,
				responseTime: Date.now() - startTime
			}
		}
	}

	/**
	 * Generate cache key for queries
	 */
	private generateCacheKey(operation: string, data: any): string {
		const dataHash = this.hashObject(data)
		return `${operation}:${dataHash}`
	}

	/**
	 * Hash object for cache key generation
	 */
	private hashObject(obj: any): string {
		const str = JSON.stringify(obj, Object.keys(obj).sort())
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return hash.toString(36)
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}

/**
 * Factory function for creating enhanced database client
 */
export function createEnhancedAuditDatabaseClient(
	redis: RedisType,
	database: PostgresJsDatabase<typeof schema>,
	config: Partial<EnhancedDatabaseConfig> = {}
): EnhancedAuditDatabaseClient {
	const defaultConfig: EnhancedDatabaseConfig = {
		database: {
			url: process.env.DATABASE_URL || '',
			poolSize: 10,
			connectionTimeout: 30000,
			queryTimeout: 30000,
			ssl: false,
			maxConnectionAttempts: 3
		},
		partition: {
			strategy: 'range',
			partitionColumn: 'timestamp',
			interval: 'monthly',
			retentionDays: 2555, // ~7 years
			autoMaintenance: true,
			maintenanceInterval: 86400000 // 24 hours
		},
		cache: {
			enabled: true,
			maxSizeMB: 100,
			defaultTTL: 300 // 5 minutes
		},
		circuitBreaker: {
			enabled: true,
			failureThreshold: 5,
			timeoutMs: 30000,
			resetTimeoutMs: 60000
		},
		monitoring: {
			enabled: true,
			slowQueryThreshold: 1000,
			metricsRetentionDays: 30
		}
	}

	const finalConfig = { ...defaultConfig, ...config }
	return new EnhancedAuditDatabaseClient(redis, finalConfig, database)
}