import {
	AuditClientError,
	NetworkError,
	TimeoutError,
	ValidationError,
} from '@smedrec/audit-client'

// Error types for UI handling
export interface UIError {
	code: string
	message: string
	field?: string
	details?: Record<string, any>
	retryable: boolean
	severity: 'low' | 'medium' | 'high' | 'critical'
}

// Error categories for different handling strategies
export enum ErrorCategory {
	NETWORK = 'network',
	AUTHENTICATION = 'authentication',
	AUTHORIZATION = 'authorization',
	VALIDATION = 'validation',
	SERVER = 'server',
	CLIENT = 'client',
	TIMEOUT = 'timeout',
	RATE_LIMIT = 'rate_limit',
	UNKNOWN = 'unknown',
}

// Retry configuration
export interface RetryConfig {
	maxAttempts: number
	initialDelayMs: number
	maxDelayMs: number
	backoffMultiplier: number
	retryableErrors: ErrorCategory[]
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	initialDelayMs: 1000,
	maxDelayMs: 10000,
	backoffMultiplier: 2,
	retryableErrors: [
		ErrorCategory.NETWORK,
		ErrorCategory.TIMEOUT,
		ErrorCategory.SERVER,
		ErrorCategory.RATE_LIMIT,
	],
}

// Error classification
export function classifyError(error: unknown): ErrorCategory {
	if (error instanceof NetworkError) {
		return ErrorCategory.NETWORK
	}

	if (error instanceof TimeoutError) {
		return ErrorCategory.TIMEOUT
	}

	if (error instanceof ValidationError) {
		return ErrorCategory.VALIDATION
	}

	if (error instanceof AuditClientError) {
		const message = error.message.toLowerCase()

		if (message.includes('unauthorized') || message.includes('authentication')) {
			return ErrorCategory.AUTHENTICATION
		}

		if (message.includes('forbidden') || message.includes('permission')) {
			return ErrorCategory.AUTHORIZATION
		}

		if (message.includes('rate limit') || message.includes('too many requests')) {
			return ErrorCategory.RATE_LIMIT
		}

		// Check HTTP status codes if available
		if ('status' in error) {
			const status = (error as any).status
			if (status >= 500) return ErrorCategory.SERVER
			if (status === 429) return ErrorCategory.RATE_LIMIT
			if (status === 401) return ErrorCategory.AUTHENTICATION
			if (status === 403) return ErrorCategory.AUTHORIZATION
			if (status >= 400) return ErrorCategory.CLIENT
		}
	}

	return ErrorCategory.UNKNOWN
}

// Convert errors to UI-friendly format
export function transformError(error: unknown): UIError {
	const category = classifyError(error)

	// Base error structure
	let uiError: UIError = {
		code: 'UNKNOWN_ERROR',
		message: 'An unexpected error occurred',
		retryable: false,
		severity: 'medium',
	}

	if (error instanceof AuditClientError) {
		uiError.code = error.name || 'AUDIT_CLIENT_ERROR'
		uiError.message = error.message
		uiError.details = {
			originalError: error.name,
			stack: error.stack,
		}
	} else if (error instanceof Error) {
		uiError.message = error.message
		uiError.details = {
			name: error.name,
			stack: error.stack,
		}
	}

	// Category-specific handling
	switch (category) {
		case ErrorCategory.NETWORK:
			uiError = {
				...uiError,
				code: 'NETWORK_ERROR',
				message: 'Network connection failed. Please check your internet connection and try again.',
				retryable: true,
				severity: 'high',
			}
			break

		case ErrorCategory.TIMEOUT:
			uiError = {
				...uiError,
				code: 'TIMEOUT_ERROR',
				message: 'Request timed out. The server may be busy, please try again.',
				retryable: true,
				severity: 'medium',
			}
			break

		case ErrorCategory.AUTHENTICATION:
			uiError = {
				...uiError,
				code: 'AUTHENTICATION_ERROR',
				message: 'Authentication failed. Please log in again.',
				retryable: false,
				severity: 'critical',
			}
			break

		case ErrorCategory.AUTHORIZATION:
			uiError = {
				...uiError,
				code: 'AUTHORIZATION_ERROR',
				message: 'You do not have permission to perform this action.',
				retryable: false,
				severity: 'high',
			}
			break

		case ErrorCategory.VALIDATION:
			uiError = {
				...uiError,
				code: 'VALIDATION_ERROR',
				message: 'Invalid data provided. Please check your input and try again.',
				retryable: false,
				severity: 'low',
			}

			// Extract field-specific validation errors
			if (error instanceof ValidationError && 'field' in error) {
				uiError.field = (error as any).field
			}
			break

		case ErrorCategory.SERVER:
			uiError = {
				...uiError,
				code: 'SERVER_ERROR',
				message: 'Server error occurred. Please try again later.',
				retryable: true,
				severity: 'high',
			}
			break

		case ErrorCategory.RATE_LIMIT:
			uiError = {
				...uiError,
				code: 'RATE_LIMIT_ERROR',
				message: 'Too many requests. Please wait a moment before trying again.',
				retryable: true,
				severity: 'medium',
			}
			break

		case ErrorCategory.CLIENT:
			uiError = {
				...uiError,
				code: 'CLIENT_ERROR',
				message: 'Invalid request. Please check your input and try again.',
				retryable: false,
				severity: 'low',
			}
			break
	}

	return uiError
}

// Retry mechanism with exponential backoff
export class RetryManager {
	private config: RetryConfig

	constructor(config: Partial<RetryConfig> = {}) {
		this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
	}

	async executeWithRetry<T>(operation: () => Promise<T>, context?: string): Promise<T> {
		let lastError: unknown

		for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				return await operation()
			} catch (error) {
				lastError = error
				const category = classifyError(error)

				// Don't retry if error is not retryable
				if (!this.config.retryableErrors.includes(category)) {
					throw error
				}

				// Don't retry on last attempt
				if (attempt === this.config.maxAttempts) {
					break
				}

				// Calculate delay with exponential backoff
				const delay = Math.min(
					this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
					this.config.maxDelayMs
				)

				console.warn(
					`Retry attempt ${attempt}/${this.config.maxAttempts} for ${context || 'operation'} after ${delay}ms delay`,
					{ error, category }
				)

				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		throw lastError
	}

	isRetryable(error: unknown): boolean {
		const category = classifyError(error)
		return this.config.retryableErrors.includes(category)
	}
}

// Global retry manager instance
export const globalRetryManager = new RetryManager()

// Utility function for handling API calls with retry
export async function withRetry<T>(
	operation: () => Promise<T>,
	context?: string,
	retryConfig?: Partial<RetryConfig>
): Promise<T> {
	const retryManager = retryConfig ? new RetryManager(retryConfig) : globalRetryManager

	return retryManager.executeWithRetry(operation, context)
}

// Error recovery strategies
export interface ErrorRecoveryStrategy {
	canRecover: (error: UIError) => boolean
	recover: (error: UIError) => Promise<void> | void
	description: string
}

// Built-in recovery strategies
export const authenticationRecoveryStrategy: ErrorRecoveryStrategy = {
	canRecover: (error) => error.code === 'AUTHENTICATION_ERROR',
	recover: () => {
		// Redirect to login or refresh token
		window.location.href = '/login'
	},
	description: 'Redirect to login page',
}

export const networkRecoveryStrategy: ErrorRecoveryStrategy = {
	canRecover: (error) => error.code === 'NETWORK_ERROR',
	recover: async () => {
		// Wait and check network connectivity
		await new Promise((resolve) => setTimeout(resolve, 2000))

		// Could implement network connectivity check here
		if (!navigator.onLine) {
			throw new Error('Network is still unavailable')
		}
	},
	description: 'Wait for network connectivity',
}

// Error recovery manager
export class ErrorRecoveryManager {
	private strategies: ErrorRecoveryStrategy[] = []

	addStrategy(strategy: ErrorRecoveryStrategy) {
		this.strategies.push(strategy)
	}

	async attemptRecovery(error: UIError): Promise<boolean> {
		for (const strategy of this.strategies) {
			if (strategy.canRecover(error)) {
				try {
					await strategy.recover(error)
					return true
				} catch (recoveryError) {
					console.warn(`Recovery strategy "${strategy.description}" failed:`, recoveryError)
				}
			}
		}
		return false
	}

	getApplicableStrategies(error: UIError): ErrorRecoveryStrategy[] {
		return this.strategies.filter((strategy) => strategy.canRecover(error))
	}
}

// Global error recovery manager
export const globalErrorRecoveryManager = new ErrorRecoveryManager()

// Add default recovery strategies
globalErrorRecoveryManager.addStrategy(authenticationRecoveryStrategy)
globalErrorRecoveryManager.addStrategy(networkRecoveryStrategy)

// User-friendly error messages mapping
export const ERROR_MESSAGES: Record<string, string> = {
	// Network errors
	NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
	TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',

	// Authentication errors
	AUTHENTICATION_ERROR: 'Your session has expired. Please log in again.',
	AUTHORIZATION_ERROR: "You don't have permission to perform this action.",

	// Validation errors
	VALIDATION_ERROR: 'Please check your input and try again.',
	REQUIRED_FIELD: 'This field is required.',
	INVALID_FORMAT: 'Please enter a valid format.',

	// Server errors
	SERVER_ERROR: 'A server error occurred. Our team has been notified.',
	RATE_LIMIT_ERROR: 'Too many requests. Please wait before trying again.',

	// Compliance-specific errors
	REPORT_NOT_FOUND: 'The requested report could not be found.',
	REPORT_EXECUTION_FAILED: 'Report execution failed. Please try again.',
	INVALID_SCHEDULE: 'The schedule configuration is invalid.',
	INVALID_CRITERIA: 'The report criteria are invalid.',

	// Generic fallback
	UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
}

// Get user-friendly error message
export function getUserFriendlyMessage(error: UIError): string {
	return ERROR_MESSAGES[error.code] || error.message || ERROR_MESSAGES.UNKNOWN_ERROR
}

// Error logging for debugging and monitoring
export function logError(error: UIError, context?: string) {
	const logData = {
		timestamp: new Date().toISOString(),
		context,
		error: {
			code: error.code,
			message: error.message,
			field: error.field,
			severity: error.severity,
			retryable: error.retryable,
			details: error.details,
		},
	}

	// Log to console in development
	if (process.env.NODE_ENV === 'development') {
		console.error('Compliance UI Error:', logData)
	}

	// In production, you might want to send to error tracking service
	// Example: Sentry, LogRocket, etc.
	// errorTrackingService.captureError(logData)
}
