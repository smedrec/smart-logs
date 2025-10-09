import type { LogEntry } from './log-entry.js'

/**
 * Batch manager interface for efficient log processing
 * Addresses requirement 1.1: Consistent interface for batching operations
 */
export interface BatchManager {
	add(entry: LogEntry): Promise<void>
	flush(): Promise<void>
	close(): Promise<void>

	// Status monitoring
	getPendingCount(): number
	isHealthy(): boolean
}

/**
 * Batch configuration options
 */
export interface BatchConfig {
	maxSize: number
	timeoutMs: number
	maxConcurrency: number
	maxQueueSize: number
}

/**
 * Retry manager interface for handling failures
 */
export interface RetryManager {
	executeWithRetry<T>(operation: () => Promise<T>, config: RetryConfig): Promise<T>
}

/**
 * Retry configuration
 */
export interface RetryConfig {
	maxAttempts: number
	initialDelayMs: number
	maxDelayMs: number
	multiplier: number
	jitterMs?: number
}

/**
 * Circuit breaker interface for transport reliability
 */
export interface CircuitBreaker {
	canExecute(): boolean
	onSuccess(): void
	onFailure(): void
	getState(): 'closed' | 'open' | 'half-open'
	destroy(): void
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
	failureThreshold: number
	resetTimeoutMs: number
	monitoringPeriodMs: number
}
