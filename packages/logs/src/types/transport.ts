import type { LogEntry } from './log-entry.js'

/**
 * Transport interface for different output destinations
 * Addresses requirement 1.1: Consistent interfaces for all transport implementations
 */
export interface LogTransport {
	readonly name: string

	// Core transport operations
	send(entries: LogEntry[]): Promise<void>
	flush(): Promise<void>
	close(): Promise<void>

	// Health monitoring
	isHealthy(): boolean
}

/**
 * Transport configuration base interface
 */
export interface TransportConfig {
	name: string
	enabled: boolean
	level?: string
}

/**
 * Console transport specific configuration
 */
export interface ConsoleTransportConfig extends TransportConfig {
	format: 'json' | 'pretty'
	colorize: boolean
}

/**
 * File transport specific configuration
 */
export interface FileTransportConfig extends TransportConfig {
	filename: string
	maxSize: number
	maxFiles: number
	rotateDaily: boolean
	rotationInterval: 'daily' | 'weekly' | 'monthly'
	compress: boolean
	retentionDays: number
}

/**
 * OTLP transport specific configuration
 */
export interface OTLPTransportConfig extends TransportConfig {
	endpoint: string
	headers?: Record<string, string>
	timeoutMs: number
	batchSize: number
	batchTimeoutMs: number
	maxConcurrency: number
	circuitBreakerThreshold: number
	circuitBreakerResetMs: number
}

/**
 * Redis transport specific configuration
 */
export interface RedisTransportConfig extends TransportConfig {
	host: string
	port: number
	password?: string
	database: number
	keyPrefix: string
	listName: string
	maxRetries: number
}
