/**
 * Interface definitions for dependency injection and clean architecture
 * Following the design document's interface standardization approach
 */

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisType } from 'ioredis'
import type * as schema from './schema.js'

/**
 * Core database operation interface
 */
export interface IAuditDatabase {
	/**
	 * Insert audit log entry
	 */
	insert<T>(data: T): Promise<void>

	/**
	 * Query audit logs with filters
	 */
	query<T>(filters: Record<string, any>): Promise<T[]>

	/**
	 * Execute transaction
	 */
	transaction<T>(callback: (tx: PostgresJsDatabase<typeof schema>) => Promise<T>): Promise<T>

	/**
	 * Check database health
	 */
	healthCheck(): Promise<ConnectionHealth>
}

/**
 * Partition lifecycle management interface
 */
export interface IPartitionManager {
	/**
	 * Create partition for given date range
	 */
	createPartition(tableName: string, startDate: Date, endDate: Date): Promise<void>

	/**
	 * Drop expired partitions based on retention policy
	 */
	dropPartition(partitionName: string): Promise<void>

	/**
	 * Optimize partition indexes and statistics
	 */
	optimize(partitionName: string): Promise<void>

	/**
	 * Get partition health status
	 */
	getPartitionStatus(): Promise<PartitionStatus[]>
}

/**
 * Cache operations interface
 */
export interface IQueryCache {
	/**
	 * Get cached value by key
	 */
	get<T>(key: string): Promise<T | null>

	/**
	 * Set cache value with TTL
	 */
	set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>

	/**
	 * Invalidate cache entries by pattern
	 */
	invalidate(pattern: string): Promise<number>

	/**
	 * Get cache statistics
	 */
	stats(): Promise<CacheStats>
}

/**
 * Connection lifecycle management interface
 */
export interface IConnectionManager {
	/**
	 * Get database connection from pool
	 */
	getConnection(): Promise<PostgresJsDatabase<typeof schema>>

	/**
	 * Execute health check on connections
	 */
	healthCheck(): Promise<ConnectionHealth>

	/**
	 * Get connection pool statistics
	 */
	poolStats(): Promise<PoolStats>

	/**
	 * Close all connections
	 */
	close(): Promise<void>
}

/**
 * Error processing and recovery interface
 */
export interface IErrorHandler {
	/**
	 * Handle and classify errors
	 */
	handle(error: Error, context: ErrorContext): Promise<ErrorResolution>

	/**
	 * Classify error type and severity
	 */
	classify(error: Error): ErrorClassification

	/**
	 * Attempt error recovery
	 */
	recover(error: Error, context: ErrorContext): Promise<boolean>
}

/**
 * Circuit breaker pattern interface
 */
export interface ICircuitBreaker {
	/**
	 * Execute operation with circuit breaker protection
	 */
	execute<T>(operation: () => Promise<T>): Promise<T>

	/**
	 * Get circuit breaker state
	 */
	getState(): CircuitBreakerState

	/**
	 * Reset circuit breaker to closed state
	 */
	reset(): void
}

/**
 * Read replica routing interface
 */
export interface IReadReplicaRouter {
	/**
	 * Route query to appropriate replica
	 */
	route<T>(query: () => Promise<T>, options?: RoutingOptions): Promise<T>

	/**
	 * Get replica health status
	 */
	getReplicaHealth(): Promise<ReplicaHealth[]>

	/**
	 * Update routing strategy
	 */
	updateStrategy(strategy: RoutingStrategy): void
}

// Supporting types

export interface PartitionStatus {
	name: string
	tableName: string
	healthy: boolean
	recordCount: number
	sizeBytes: number
	lastOptimized: Date
}

export interface CacheStats {
	hitRatio: number
	totalKeys: number
	memoryUsageMB: number
	evictions: number
}

export interface ConnectionHealth {
	healthy: boolean
	activeConnections: number
	errorRate: number
	averageResponseTime: number
}

export interface PoolStats {
	totalConnections: number
	activeConnections: number
	idleConnections: number
	waitingRequests: number
}

export interface ErrorContext {
	operation: string
	userId?: string
	organizationId?: string
	timestamp: Date
	metadata?: Record<string, any>
}

export interface ErrorResolution {
	resolved: boolean
	retryable: boolean
	retryAfterMs?: number
	action: 'retry' | 'fallback' | 'fail' | 'ignore'
}

export interface ErrorClassification {
	type: 'connection' | 'timeout' | 'validation' | 'permission' | 'system'
	severity: 'low' | 'medium' | 'high' | 'critical'
	category: string
}

export enum CircuitBreakerState {
	CLOSED = 'closed',
	OPEN = 'open',
	HALF_OPEN = 'half_open',
}

export interface RoutingOptions {
	preferLocal?: boolean
	maxLagMs?: number
	timeout?: number
}

export interface ReplicaHealth {
	id: string
	url: string
	healthy: boolean
	lagMs: number
	responseTimeMs: number
}

export enum RoutingStrategy {
	ROUND_ROBIN = 'round_robin',
	LEAST_CONNECTIONS = 'least_connections',
	LEAST_LATENCY = 'least_latency',
}

/**
 * Configuration interfaces
 */
export interface DatabaseConnectionConfig {
	url: string
	poolSize: number
	connectionTimeout: number
	queryTimeout: number
	ssl: boolean
	maxConnectionAttempts: number
}

export interface PartitionConfig {
	strategy: 'range' | 'hash' | 'list'
	partitionColumn: string
	interval?: 'monthly' | 'quarterly' | 'yearly'
	partitionCount?: number
	retentionDays: number
	autoMaintenance: boolean
	maintenanceInterval: number
}

export interface CacheConfig {
	enabled: boolean
	type: 'memory' | 'redis' | 'hybrid'
	maxSizeMB: number
	defaultTTL: number
	keyPrefix: string
}

export interface CircuitBreakerConfig {
	failureThreshold: number
	timeoutMs: number
	resetTimeoutMs: number
}
