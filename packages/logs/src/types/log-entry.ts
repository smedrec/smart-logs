import type { LogFields, LogLevel, LogLevelType, PerformanceMetrics } from './logger.js'

/**
 * Core log entry structure
 * Defines the complete structure of a log entry with all metadata
 */
export interface LogEntry {
	// Core fields
	id: string
	timestamp: Date
	level: LogLevel | LogLevelType
	message: string

	// Context and correlation
	requestId?: string
	correlationId: string
	traceId?: string
	spanId?: string

	// Structured data
	fields: LogFields
	metadata: LogMetadata

	// Performance data (sampled)
	performance?: PerformanceMetrics

	// Internal tracking
	source: string
	version: string
}

/**
 * Metadata structure for contextual information
 */
export interface LogMetadata {
	service: string
	environment: string
	hostname: string
	pid: number

	// Request context
	request?: RequestMetadata

	// Database context
	database?: DatabaseMetadata

	// Security context
	security?: SecurityMetadata
}

/**
 * Request-specific metadata
 */
export interface RequestMetadata {
	method?: string
	url?: string
	userAgent?: string
	ip?: string
	duration?: number
	statusCode?: number
}

/**
 * Database operation metadata
 */
export interface DatabaseMetadata {
	operation: string
	table?: string
	duration: number
	rowsAffected?: number
	query?: string
}

/**
 * Security event metadata
 */
export interface SecurityMetadata {
	event: string
	userId?: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	action?: string
	resource?: string
}
