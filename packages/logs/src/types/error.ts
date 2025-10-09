/**
 * Error handling types and interfaces for the logging system
 * Addresses requirements 9.1, 9.3, 9.4: Centralized error handling with categorization and recovery
 */

export enum ErrorCategory {
	NETWORK = 'network',
	TIMEOUT = 'timeout',
	SERIALIZATION = 'serialization',
	CONFIGURATION = 'configuration',
	TRANSPORT = 'transport',
	VALIDATION = 'validation',
	RESOURCE = 'resource',
	AUTHENTICATION = 'authentication',
	RATE_LIMIT = 'rate_limit',
	UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical',
}

export enum RecoveryStrategy {
	RETRY = 'retry',
	FALLBACK = 'fallback',
	CIRCUIT_BREAKER = 'circuit_breaker',
	IGNORE = 'ignore',
	FAIL_FAST = 'fail_fast',
}

export interface ErrorMetrics {
	category: ErrorCategory
	severity: ErrorSeverity
	count: number
	lastOccurrence: Date
	firstOccurrence: Date
	transportName?: string
	recoveryAttempts: number
	successfulRecoveries: number
}

export interface ErrorContext {
	transportName?: string
	operation: string
	correlationId?: string
	requestId?: string
	metadata?: Record<string, unknown>
	stackTrace?: string
}

export interface CategorizedError {
	originalError: Error
	category: ErrorCategory
	severity: ErrorSeverity
	context: ErrorContext
	timestamp: Date
	isRetryable: boolean
	recoveryStrategy: RecoveryStrategy
}

export interface ErrorRecoveryResult {
	success: boolean
	strategy: RecoveryStrategy
	attempts: number
	duration: number
	fallbackUsed?: string
	error?: Error
}

export interface ErrorHandlerConfig {
	enableMetrics: boolean
	enableAlerting: boolean
	maxErrorsPerMinute: number
	retryableCategories: ErrorCategory[]
	severityThresholds: {
		[key in ErrorCategory]?: ErrorSeverity
	}
	recoveryStrategies: {
		[key in ErrorCategory]?: RecoveryStrategy
	}
	alertingThresholds: {
		errorRatePerMinute: number
		criticalErrorCount: number
		consecutiveFailures: number
	}
}

export interface ErrorHandler {
	categorizeError(error: Error, context: ErrorContext): CategorizedError
	handleError(categorizedError: CategorizedError): Promise<ErrorRecoveryResult>
	getMetrics(): Map<string, ErrorMetrics>
	shouldAlert(error: CategorizedError): boolean
	isRetryable(error: CategorizedError): boolean
	getRecoveryStrategy(category: ErrorCategory): RecoveryStrategy
}

export interface AlertingProvider {
	sendAlert(error: CategorizedError, metrics: ErrorMetrics): Promise<void>
}
