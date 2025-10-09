import { ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../types/error.js'

import type {
	AlertingProvider,
	CategorizedError,
	ErrorContext,
	ErrorHandlerConfig,
	ErrorMetrics,
	ErrorRecoveryResult,
	ErrorHandler as IErrorHandler,
} from '../types/error.js'

/**
 * Centralized error handling system for the logging library
 * Addresses requirements 9.1, 9.3, 9.4: Error categorization, recovery strategies, and metrics
 */

export class ErrorHandler implements IErrorHandler {
	private metrics = new Map<string, ErrorMetrics>()
	private alertingProviders: AlertingProvider[] = []
	private errorCounts = new Map<string, { count: number; windowStart: number }>()

	constructor(private config: ErrorHandlerConfig) {}

	/**
	 * Categorize an error based on its type and context
	 */
	categorizeError(error: Error, context: ErrorContext): CategorizedError {
		const category = this.determineCategory(error, context)
		const severity = this.determineSeverity(error, category, context)
		const isRetryable = this.isErrorRetryable(error, category)
		const recoveryStrategy = this.getRecoveryStrategy(category)

		return {
			originalError: error,
			category,
			severity,
			context,
			timestamp: new Date(),
			isRetryable,
			recoveryStrategy,
		}
	}

	/**
	 * Handle a categorized error with appropriate recovery strategy
	 */
	async handleError(categorizedError: CategorizedError): Promise<ErrorRecoveryResult> {
		// Update metrics
		this.updateMetrics(categorizedError)

		// Check if we should alert
		if (this.shouldAlert(categorizedError)) {
			await this.sendAlerts(categorizedError)
		}

		// Apply recovery strategy
		const startTime = Date.now()
		let attempts = 0
		let success = false
		let fallbackUsed: string | undefined
		let lastError: Error = categorizedError.originalError

		try {
			switch (categorizedError.recoveryStrategy) {
				case RecoveryStrategy.RETRY:
					// Retry logic is handled by RetryManager, just mark as retryable
					success = categorizedError.isRetryable
					attempts = 1
					break

				case RecoveryStrategy.FALLBACK:
					// Fallback to alternative transport or method
					success = true
					fallbackUsed = 'alternative_transport'
					attempts = 1
					break

				case RecoveryStrategy.CIRCUIT_BREAKER:
					// Circuit breaker logic is handled by CircuitBreaker, just track
					success = false
					attempts = 1
					break

				case RecoveryStrategy.IGNORE:
					// Log and continue
					success = true
					attempts = 1
					break

				case RecoveryStrategy.FAIL_FAST:
					// Don't attempt recovery
					success = false
					attempts = 1
					break

				default:
					success = false
					attempts = 1
			}
		} catch (error) {
			lastError = error as Error
			success = false
		}

		const duration = Date.now() - startTime

		// Update recovery metrics
		if (success) {
			this.updateRecoveryMetrics(categorizedError, true)
		}

		return {
			success,
			strategy: categorizedError.recoveryStrategy,
			attempts,
			duration,
			fallbackUsed,
			error: success ? undefined : lastError,
		}
	}

	/**
	 * Get current error metrics
	 */
	getMetrics(): Map<string, ErrorMetrics> {
		return new Map(this.metrics)
	}

	/**
	 * Check if an error should trigger an alert
	 */
	shouldAlert(error: CategorizedError): boolean {
		if (!this.config.enableAlerting) {
			return false
		}

		// Check severity threshold
		if (error.severity === ErrorSeverity.CRITICAL) {
			return true
		}

		// Check error rate threshold
		const key = `${error.category}_${error.context.transportName || 'unknown'}`
		const now = Date.now()
		const windowMs = 60 * 1000 // 1 minute window

		const errorCount = this.errorCounts.get(key)
		if (!errorCount || now - errorCount.windowStart > windowMs) {
			this.errorCounts.set(key, { count: 1, windowStart: now })
			return false
		}

		errorCount.count++
		return errorCount.count >= this.config.alertingThresholds.errorRatePerMinute
	}

	/**
	 * Check if an error is retryable
	 */
	isRetryable(error: CategorizedError): boolean {
		return (
			error.isRetryable &&
			this.config.retryableCategories.includes(error.category) &&
			error.severity !== ErrorSeverity.CRITICAL
		)
	}

	/**
	 * Get recovery strategy for an error category
	 */
	getRecoveryStrategy(category: ErrorCategory): RecoveryStrategy {
		return this.config.recoveryStrategies[category] || RecoveryStrategy.RETRY
	}

	/**
	 * Add an alerting provider
	 */
	addAlertingProvider(provider: AlertingProvider): void {
		this.alertingProviders.push(provider)
	}

	/**
	 * Remove an alerting provider
	 */
	removeAlertingProvider(provider: AlertingProvider): void {
		const index = this.alertingProviders.indexOf(provider)
		if (index > -1) {
			this.alertingProviders.splice(index, 1)
		}
	}

	/**
	 * Determine error category based on error type and context
	 */
	private determineCategory(error: Error, context: ErrorContext): ErrorCategory {
		const message = error.message.toLowerCase()
		const name = error.name.toLowerCase()

		// Network-related errors
		if (
			message.includes('network') ||
			message.includes('connection') ||
			message.includes('econnrefused') ||
			message.includes('enotfound') ||
			message.includes('etimedout') ||
			name.includes('networkerror')
		) {
			return ErrorCategory.NETWORK
		}

		// Timeout errors
		if (
			message.includes('timeout') ||
			message.includes('timed out') ||
			name.includes('timeouterror')
		) {
			return ErrorCategory.TIMEOUT
		}

		// Serialization errors
		if (
			message.includes('json') ||
			message.includes('parse') ||
			message.includes('serialize') ||
			message.includes('circular') ||
			name.includes('syntaxerror')
		) {
			return ErrorCategory.SERIALIZATION
		}

		// Validation errors (check before configuration)
		if (
			message.includes('validation') ||
			message.includes('schema') ||
			message.includes('required') ||
			name.includes('validationerror')
		) {
			return ErrorCategory.VALIDATION
		}

		// Configuration errors
		if (
			message.includes('config') ||
			message.includes('invalid') ||
			message.includes('missing') ||
			context.operation.includes('config')
		) {
			return ErrorCategory.CONFIGURATION
		}

		// Transport-specific errors
		if (context.transportName && message.includes('transport')) {
			return ErrorCategory.TRANSPORT
		}

		// Resource errors
		if (
			message.includes('memory') ||
			message.includes('disk') ||
			message.includes('space') ||
			message.includes('resource')
		) {
			return ErrorCategory.RESOURCE
		}

		// Authentication errors
		if (
			message.includes('auth') ||
			message.includes('unauthorized') ||
			message.includes('forbidden') ||
			message.includes('401') ||
			message.includes('403')
		) {
			return ErrorCategory.AUTHENTICATION
		}

		// Rate limit errors
		if (
			message.includes('rate') ||
			message.includes('limit') ||
			message.includes('throttle') ||
			message.includes('429')
		) {
			return ErrorCategory.RATE_LIMIT
		}

		return ErrorCategory.UNKNOWN
	}

	/**
	 * Determine error severity based on category and context
	 */
	private determineSeverity(
		error: Error,
		category: ErrorCategory,
		context: ErrorContext
	): ErrorSeverity {
		// Check configured severity thresholds
		const configuredSeverity = this.config.severityThresholds[category]
		if (configuredSeverity) {
			return configuredSeverity
		}

		// Default severity mapping
		switch (category) {
			case ErrorCategory.NETWORK:
			case ErrorCategory.TIMEOUT:
				return ErrorSeverity.MEDIUM

			case ErrorCategory.SERIALIZATION:
			case ErrorCategory.VALIDATION:
				return ErrorSeverity.HIGH

			case ErrorCategory.CONFIGURATION:
			case ErrorCategory.RESOURCE:
				return ErrorSeverity.CRITICAL

			case ErrorCategory.AUTHENTICATION:
				return ErrorSeverity.HIGH

			case ErrorCategory.RATE_LIMIT:
				return ErrorSeverity.MEDIUM

			case ErrorCategory.TRANSPORT:
				return ErrorSeverity.MEDIUM

			default:
				return ErrorSeverity.LOW
		}
	}

	/**
	 * Check if an error is retryable based on its characteristics
	 */
	private isErrorRetryable(error: Error, category: ErrorCategory): boolean {
		// Non-retryable categories
		if (
			category === ErrorCategory.CONFIGURATION ||
			category === ErrorCategory.VALIDATION ||
			category === ErrorCategory.SERIALIZATION
		) {
			return false
		}

		// Check for specific non-retryable error codes
		const message = error.message.toLowerCase()
		if (
			message.includes('400') ||
			message.includes('401') ||
			message.includes('403') ||
			message.includes('404')
		) {
			return false
		}

		// Most other errors are potentially retryable
		return true
	}

	/**
	 * Update error metrics
	 */
	private updateMetrics(error: CategorizedError): void {
		if (!this.config.enableMetrics) {
			return
		}

		const key = `${error.category}_${error.context.transportName || 'unknown'}`
		const existing = this.metrics.get(key)

		if (existing) {
			existing.count++
			existing.lastOccurrence = error.timestamp
		} else {
			this.metrics.set(key, {
				category: error.category,
				severity: error.severity,
				count: 1,
				lastOccurrence: error.timestamp,
				firstOccurrence: error.timestamp,
				transportName: error.context.transportName,
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			})
		}
	}

	/**
	 * Update recovery metrics
	 */
	private updateRecoveryMetrics(error: CategorizedError, success: boolean): void {
		if (!this.config.enableMetrics) {
			return
		}

		const key = `${error.category}_${error.context.transportName || 'unknown'}`
		const metrics = this.metrics.get(key)

		if (metrics) {
			metrics.recoveryAttempts++
			if (success) {
				metrics.successfulRecoveries++
			}
		}
	}

	/**
	 * Send alerts to all configured providers
	 */
	private async sendAlerts(error: CategorizedError): Promise<void> {
		const key = `${error.category}_${error.context.transportName || 'unknown'}`
		const metrics = this.metrics.get(key)

		if (!metrics) {
			return
		}

		const alertPromises = this.alertingProviders.map(async (provider) => {
			try {
				await provider.sendAlert(error, metrics)
			} catch (alertError) {
				// Don't let alerting failures affect the main error handling
				console.error('Failed to send alert:', alertError)
			}
		})

		await Promise.allSettled(alertPromises)
	}
}

/**
 * Default error handler configuration
 */
export const defaultErrorHandlerConfig: ErrorHandlerConfig = {
	enableMetrics: true,
	enableAlerting: false,
	maxErrorsPerMinute: 100,
	retryableCategories: [
		ErrorCategory.NETWORK,
		ErrorCategory.TIMEOUT,
		ErrorCategory.TRANSPORT,
		ErrorCategory.RATE_LIMIT,
	],
	severityThresholds: {
		[ErrorCategory.CONFIGURATION]: ErrorSeverity.CRITICAL,
		[ErrorCategory.RESOURCE]: ErrorSeverity.CRITICAL,
		[ErrorCategory.AUTHENTICATION]: ErrorSeverity.HIGH,
		[ErrorCategory.VALIDATION]: ErrorSeverity.HIGH,
		[ErrorCategory.SERIALIZATION]: ErrorSeverity.HIGH,
	},
	recoveryStrategies: {
		[ErrorCategory.NETWORK]: RecoveryStrategy.RETRY,
		[ErrorCategory.TIMEOUT]: RecoveryStrategy.RETRY,
		[ErrorCategory.TRANSPORT]: RecoveryStrategy.CIRCUIT_BREAKER,
		[ErrorCategory.RATE_LIMIT]: RecoveryStrategy.RETRY,
		[ErrorCategory.CONFIGURATION]: RecoveryStrategy.FAIL_FAST,
		[ErrorCategory.VALIDATION]: RecoveryStrategy.FAIL_FAST,
		[ErrorCategory.SERIALIZATION]: RecoveryStrategy.IGNORE,
		[ErrorCategory.AUTHENTICATION]: RecoveryStrategy.FAIL_FAST,
		[ErrorCategory.RESOURCE]: RecoveryStrategy.FALLBACK,
	},
	alertingThresholds: {
		errorRatePerMinute: 10,
		criticalErrorCount: 5,
		consecutiveFailures: 3,
	},
}
