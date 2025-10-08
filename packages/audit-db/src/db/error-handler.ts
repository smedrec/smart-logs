/**
 * Structured error handling system for audit database operations
 * Implements comprehensive error classification, recovery, and reporting
 */

import { LoggerFactory, StructuredLogger } from '@repo/logs'

import { CircuitBreakerOpenError } from './circuit-breaker.js'

import type {
	IErrorHandler,
	ErrorContext,
	ErrorResolution,
	ErrorClassification
} from './interfaces.js'

export interface ErrorMetrics {
	totalErrors: number
	errorsByType: Record<string, number>
	errorsBySeverity: Record<string, number>
	recoveryAttempts: number
	successfulRecoveries: number
	lastErrorTime?: Date
}

export interface ErrorHandlerConfig {
	enableRetry: boolean
	maxRetryAttempts: number
	baseRetryDelay: number
	maxRetryDelay: number
	enableCircuitBreaker: boolean
	enableErrorReporting: boolean
	alertingThreshold: number
}

/**
 * Enhanced error handler with classification, recovery, and metrics
 */
export class EnhancedErrorHandler implements IErrorHandler {
	private metrics: ErrorMetrics
	private readonly logger: StructuredLogger

	constructor(private config: ErrorHandlerConfig) {
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
			service: '@repo/audit-db - EnhancedErrorHandler',
		})

		this.metrics = {
			totalErrors: 0,
			errorsByType: {},
			errorsBySeverity: {},
			recoveryAttempts: 0,
			successfulRecoveries: 0
		}
	}

	/**
	 * Handle and classify errors with comprehensive context
	 */
	async handle(error: Error, context: ErrorContext): Promise<ErrorResolution> {
		this.metrics.totalErrors++
		this.metrics.lastErrorTime = new Date()

		// Classify the error
		const classification = this.classify(error)
		
		// Update metrics
		this.updateMetrics(classification)

		// Create enriched error context
		const enrichedContext = this.enrichContext(error, context, classification)

		// Log the error with structured data
		this.logError(error, enrichedContext, classification)

		// Determine resolution strategy
		const resolution = await this.determineResolution(error, enrichedContext, classification)

		// Alert if necessary
		if (this.shouldAlert(classification)) {
			await this.sendAlert(error, enrichedContext, classification)
		}

		return resolution
	}

	/**
	 * Classify error type, severity, and category
	 */
	classify(error: Error): ErrorClassification {
		// Circuit breaker errors
		if (error instanceof CircuitBreakerOpenError) {
			return {
				type: 'system',
				severity: 'high',
				category: 'circuit_breaker_open'
			}
		}

		// Connection errors
		if (this.isConnectionError(error)) {
			return {
				type: 'connection',
				severity: 'high',
				category: 'database_connection'
			}
		}

		// Timeout errors
		if (this.isTimeoutError(error)) {
			return {
				type: 'timeout',
				severity: 'medium',
				category: 'operation_timeout'
			}
		}

		// Validation errors
		if (this.isValidationError(error)) {
			return {
				type: 'validation',
				severity: 'low',
				category: 'data_validation'
			}
		}

		// Permission errors
		if (this.isPermissionError(error)) {
			return {
				type: 'permission',
				severity: 'medium',
				category: 'access_denied'
			}
		}

		// Lock timeout or partition conflicts
		if (this.isLockError(error)) {
			return {
				type: 'system',
				severity: 'medium',
				category: 'resource_lock'
			}
		}

		// Default classification
		return {
			type: 'system',
			severity: 'high',
			category: 'unknown_error'
		}
	}

	/**
	 * Attempt error recovery based on classification
	 */
	async recover(error: Error, context: ErrorContext): Promise<boolean> {
		this.metrics.recoveryAttempts++
		
		const classification = this.classify(error)

		try {
			switch (classification.type) {
				case 'connection':
					return await this.recoverConnection(error, context)
				
				case 'timeout':
					return await this.recoverTimeout(error, context)
				
				case 'system':
					if (classification.category === 'resource_lock') {
						return await this.recoverLock(error, context)
					}
					return false
				
				case 'validation':
					// Validation errors generally can't be recovered automatically
					return false
				
				case 'permission':
					// Permission errors need manual intervention
					return false
				
				default:
					return false
			}
		} catch (recoveryError) {
			this.logger.error('Error recovery failed:', recoveryError as Error)
			return false
		}
	}

	/**
	 * Get error handling metrics
	 */
	getMetrics(): ErrorMetrics {
		return { ...this.metrics }
	}

	/**
	 * Reset error metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			totalErrors: 0,
			errorsByType: {},
			errorsBySeverity: {},
			recoveryAttempts: 0,
			successfulRecoveries: 0
		}
	}

	/**
	 * Check if error is a connection-related error
	 */
	private isConnectionError(error: Error): boolean {
		const connectionKeywords = [
			'connection',
			'connect',
			'ECONNREFUSED',
			'ENOTFOUND',
			'ETIMEDOUT',
			'ECONNRESET',
			'connect ECONNREFUSED'
		]
		
		return connectionKeywords.some(keyword => 
			error.message.toLowerCase().includes(keyword.toLowerCase())
		)
	}

	/**
	 * Check if error is a timeout error
	 */
	private isTimeoutError(error: Error): boolean {
		const timeoutKeywords = [
			'timeout',
			'timed out',
			'ETIMEDOUT',
			'query timeout',
			'connection timeout'
		]
		
		return timeoutKeywords.some(keyword => 
			error.message.toLowerCase().includes(keyword.toLowerCase())
		)
	}

	/**
	 * Check if error is a validation error
	 */
	private isValidationError(error: Error): boolean {
		const validationKeywords = [
			'validation',
			'invalid',
			'constraint',
			'check constraint',
			'foreign key',
			'not null'
		]
		
		return validationKeywords.some(keyword => 
			error.message.toLowerCase().includes(keyword.toLowerCase())
		)
	}

	/**
	 * Check if error is a permission error
	 */
	private isPermissionError(error: Error): boolean {
		const permissionKeywords = [
			'permission',
			'denied',
			'unauthorized',
			'access',
			'forbidden',
			'authentication'
		]
		
		return permissionKeywords.some(keyword => 
			error.message.toLowerCase().includes(keyword.toLowerCase())
		)
	}

	/**
	 * Check if error is related to locks or resource conflicts
	 */
	private isLockError(error: Error): boolean {
		const lockKeywords = [
			'lock',
			'locked',
			'deadlock',
			'conflict',
			'concurrent',
			'serialization failure'
		]
		
		return lockKeywords.some(keyword => 
			error.message.toLowerCase().includes(keyword.toLowerCase())
		)
	}

	/**
	 * Update error metrics
	 */
	private updateMetrics(classification: ErrorClassification): void {
		// Update type metrics
		this.metrics.errorsByType[classification.type] = 
			(this.metrics.errorsByType[classification.type] || 0) + 1
		
		// Update severity metrics
		this.metrics.errorsBySeverity[classification.severity] = 
			(this.metrics.errorsBySeverity[classification.severity] || 0) + 1
	}

	/**
	 * Enrich error context with additional information
	 */
	private enrichContext(
		error: Error, 
		context: ErrorContext, 
		classification: ErrorClassification
	): ErrorContext & { 
		classification: ErrorClassification
		errorId: string
		stackTrace?: string
	} {
		return {
			...context,
			classification,
			errorId: this.generateErrorId(),
			stackTrace: error.stack,
			timestamp: new Date()
		}
	}

	/**
	 * Log error with structured format
	 */
	private logError(
		error: Error, 
		context: ErrorContext & { classification: ErrorClassification }, 
		classification: ErrorClassification
	): void {
		const logData = {
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack
			},
			context,
			classification,
			metrics: this.getMetrics()
		}

		switch (classification.severity) {
			case 'critical':
				this.logger.error('Critical database error occurred', error, logData)
				break
			case 'high':
				this.logger.error('High severity database error', error, logData)
				break
			case 'medium':
				this.logger.warn('Medium severity database error', error, logData)
				break
			case 'low':
				this.logger.info('Low severity database error', error, logData)
				break
		}
	}

	/**
	 * Determine resolution strategy based on error classification
	 */
	private async determineResolution(
		error: Error,
		context: ErrorContext,
		classification: ErrorClassification
	): Promise<ErrorResolution> {
		// Circuit breaker open - fail fast
		if (error instanceof CircuitBreakerOpenError) {
			return {
				resolved: false,
				retryable: false,
				action: 'fail'
			}
		}

		// Connection errors - retryable with backoff
		if (classification.type === 'connection') {
			return {
				resolved: false,
				retryable: true,
				retryAfterMs: this.calculateRetryDelay(context),
				action: 'retry'
			}
		}

		// Timeout errors - retryable with longer delay
		if (classification.type === 'timeout') {
			return {
				resolved: false,
				retryable: true,
				retryAfterMs: this.calculateRetryDelay(context) * 2,
				action: 'retry'
			}
		}

		// Lock errors - retryable with jitter
		if (classification.category === 'resource_lock') {
			return {
				resolved: false,
				retryable: true,
				retryAfterMs: this.calculateRetryDelay(context) + Math.random() * 1000,
				action: 'retry'
			}
		}

		// Validation errors - not retryable
		if (classification.type === 'validation') {
			return {
				resolved: false,
				retryable: false,
				action: 'fail'
			}
		}

		// Permission errors - not retryable
		if (classification.type === 'permission') {
			return {
				resolved: false,
				retryable: false,
				action: 'fail'
			}
		}

		// Default - retryable with caution
		return {
			resolved: false,
			retryable: true,
			retryAfterMs: this.calculateRetryDelay(context),
			action: 'retry'
		}
	}

	/**
	 * Calculate retry delay with exponential backoff
	 */
	private calculateRetryDelay(context: ErrorContext & { retryAttempt?: number }): number {
		const attempt = context.retryAttempt || 0
		const baseDelay = this.config.baseRetryDelay
		const maxDelay = this.config.maxRetryDelay
		
		// Exponential backoff: baseDelay * 2^attempt
		const exponentialDelay = baseDelay * Math.pow(2, attempt)
		
		// Add jitter (±25%)
		const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
		
		// Cap at max delay
		return Math.min(exponentialDelay + jitter, maxDelay)
	}

	/**
	 * Connection recovery strategy
	 */
	private async recoverConnection(error: Error, context: ErrorContext): Promise<boolean> {
		// Wait before attempting recovery
		await this.delay(1000)
		
		try {
			// Attempt to recreate connection pool or similar recovery logic
			// This would be implemented based on specific connection manager
			this.logger.info('Attempting connection recovery', { context })
			
			// Placeholder for actual recovery logic
			// In real implementation, this would interact with connection manager
			
			this.metrics.successfulRecoveries++
			return true
		} catch (recoveryError) {
			this.logger.error('Connection recovery failed:', recoveryError as Error)
			return false
		}
	}

	/**
	 * Timeout recovery strategy
	 */
	private async recoverTimeout(error: Error, context: ErrorContext): Promise<boolean> {
		// For timeout errors, we typically don't recover automatically
		// but we can adjust timeout values or suggest query optimization
		this.logger.info('Timeout recovery - suggesting query optimization', { context })
		return false
	}

	/**
	 * Lock recovery strategy
	 */
	private async recoverLock(error: Error, context: ErrorContext): Promise<boolean> {
		// Wait with jitter to avoid thundering herd
		const delay = 500 + Math.random() * 1000
		await this.delay(delay)
		
		this.logger.info('Lock recovery - retrying after delay', { context, delay })
		return true // Indicate retry should be attempted
	}

	/**
	 * Check if alert should be sent
	 */
	private shouldAlert(classification: ErrorClassification): boolean {
		return classification.severity === 'critical' || classification.severity === 'high'
	}

	/**
	 * Send alert for high-severity errors
	 */
	private async sendAlert(
		error: Error,
		context: ErrorContext,
		classification: ErrorClassification
	): Promise<void> {
		// Implementation for alerting system
		// This could integrate with PagerDuty, Slack, email, etc.
		this.logger.error('ALERT: High-severity database error detected', error, {
			context,
			classification,
			alertLevel: classification.severity
		})
	}

	/**
	 * Generate unique error ID for tracking
	 */
	private generateErrorId(): string {
		return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms))
	}
}

/**
 * Factory function for creating error handler with default configuration
 */
export function createErrorHandler(config?: Partial<ErrorHandlerConfig>): EnhancedErrorHandler {
	const defaultConfig: ErrorHandlerConfig = {
		enableRetry: true,
		maxRetryAttempts: 3,
		baseRetryDelay: 1000,
		maxRetryDelay: 30000,
		enableCircuitBreaker: true,
		enableErrorReporting: true,
		alertingThreshold: 5
	}

	return new EnhancedErrorHandler({ ...defaultConfig, ...config })
}

/**
 * Global error handler instance
 */
export const GlobalErrorHandler = createErrorHandler()