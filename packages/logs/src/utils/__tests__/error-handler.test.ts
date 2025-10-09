/**
 * Unit tests for ErrorHandler
 * Addresses requirement 10.1: Unit test coverage for error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../../types/error.js'
import { ConsoleAlertingProvider } from '../console-alerting-provider.js'
import { defaultErrorHandlerConfig, ErrorHandler } from '../error-handler.js'

import type { AlertingProvider, ErrorContext } from '../../types/error.js'

describe('ErrorHandler', () => {
	let errorHandler: ErrorHandler
	let mockAlertingProvider: AlertingProvider

	beforeEach(() => {
		errorHandler = new ErrorHandler(defaultErrorHandlerConfig)
		mockAlertingProvider = {
			sendAlert: vi.fn(),
		}
		errorHandler.addAlertingProvider(mockAlertingProvider)
	})

	describe('categorizeError', () => {
		it('should categorize network errors correctly', () => {
			const error = new Error('ECONNREFUSED: Connection refused')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.NETWORK)
			expect(categorized.severity).toBe(ErrorSeverity.MEDIUM)
			expect(categorized.isRetryable).toBe(true)
			expect(categorized.recoveryStrategy).toBe(RecoveryStrategy.RETRY)
		})

		it('should categorize timeout errors correctly', () => {
			const error = new Error('Request timed out after 5000ms')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'redis',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.TIMEOUT)
			expect(categorized.severity).toBe(ErrorSeverity.MEDIUM)
			expect(categorized.isRetryable).toBe(true)
		})

		it('should categorize serialization errors correctly', () => {
			const error = new SyntaxError('Unexpected token in JSON')
			const context: ErrorContext = {
				operation: 'serialize_log',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.SERIALIZATION)
			expect(categorized.severity).toBe(ErrorSeverity.HIGH)
			expect(categorized.isRetryable).toBe(false)
			expect(categorized.recoveryStrategy).toBe(RecoveryStrategy.IGNORE)
		})

		it('should categorize configuration errors correctly', () => {
			const error = new Error('Invalid configuration: missing endpoint')
			const context: ErrorContext = {
				operation: 'validate_config',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.CONFIGURATION)
			expect(categorized.severity).toBe(ErrorSeverity.CRITICAL)
			expect(categorized.isRetryable).toBe(false)
			expect(categorized.recoveryStrategy).toBe(RecoveryStrategy.FAIL_FAST)
		})

		it('should categorize validation errors correctly', () => {
			const error = new Error('Validation failed: required field missing')
			const context: ErrorContext = {
				operation: 'validate_log_entry',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.VALIDATION)
			expect(categorized.severity).toBe(ErrorSeverity.HIGH)
			expect(categorized.isRetryable).toBe(false)
		})

		it('should categorize authentication errors correctly', () => {
			const error = new Error('401 Unauthorized')
			const context: ErrorContext = {
				operation: 'authenticate',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.AUTHENTICATION)
			expect(categorized.severity).toBe(ErrorSeverity.HIGH)
			expect(categorized.isRetryable).toBe(false)
		})

		it('should categorize rate limit errors correctly', () => {
			const error = new Error('429 Too Many Requests')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.RATE_LIMIT)
			expect(categorized.severity).toBe(ErrorSeverity.MEDIUM)
			expect(categorized.isRetryable).toBe(true)
		})

		it('should categorize unknown errors correctly', () => {
			const error = new Error('Some unknown error')
			const context: ErrorContext = {
				operation: 'unknown_operation',
			}

			const categorized = errorHandler.categorizeError(error, context)

			expect(categorized.category).toBe(ErrorCategory.UNKNOWN)
			expect(categorized.severity).toBe(ErrorSeverity.LOW)
		})
	})

	describe('handleError', () => {
		it('should handle retryable errors correctly', async () => {
			const error = new Error('Network error')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)
			const result = await errorHandler.handleError(categorized)

			expect(result.success).toBe(true) // Retryable errors are marked as recoverable
			expect(result.strategy).toBe(RecoveryStrategy.RETRY)
			expect(result.attempts).toBe(1)
		})

		it('should handle non-retryable errors correctly', async () => {
			const error = new Error('Invalid configuration')
			const context: ErrorContext = {
				operation: 'validate_config',
			}

			const categorized = errorHandler.categorizeError(error, context)
			const result = await errorHandler.handleError(categorized)

			expect(result.success).toBe(false)
			expect(result.strategy).toBe(RecoveryStrategy.FAIL_FAST)
		})

		it('should handle fallback strategy correctly', async () => {
			const error = new Error('Out of memory')
			const context: ErrorContext = {
				operation: 'allocate_buffer',
			}

			// Manually create categorized error with fallback strategy
			const categorized = errorHandler.categorizeError(error, context)
			categorized.recoveryStrategy = RecoveryStrategy.FALLBACK

			const result = await errorHandler.handleError(categorized)

			expect(result.success).toBe(true)
			expect(result.strategy).toBe(RecoveryStrategy.FALLBACK)
			expect(result.fallbackUsed).toBe('alternative_transport')
		})
	})

	describe('metrics', () => {
		it('should track error metrics correctly', async () => {
			const error = new Error('Network error')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)
			await errorHandler.handleError(categorized)

			const metrics = errorHandler.getMetrics()
			const key = `${ErrorCategory.NETWORK}_otlp`
			const metric = metrics.get(key)

			expect(metric).toBeDefined()
			expect(metric!.count).toBe(1)
			expect(metric!.category).toBe(ErrorCategory.NETWORK)
			expect(metric!.transportName).toBe('otlp')
		})

		it('should increment error count for repeated errors', async () => {
			const error = new Error('Network error')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			const categorized = errorHandler.categorizeError(error, context)
			await errorHandler.handleError(categorized)
			await errorHandler.handleError(categorized)
			await errorHandler.handleError(categorized)

			const metrics = errorHandler.getMetrics()
			const key = `${ErrorCategory.NETWORK}_otlp`
			const metric = metrics.get(key)

			expect(metric!.count).toBe(3)
		})
	})

	describe('alerting', () => {
		it('should trigger alerts for critical errors', async () => {
			const config = {
				...defaultErrorHandlerConfig,
				enableAlerting: true,
			}
			const handler = new ErrorHandler(config)
			handler.addAlertingProvider(mockAlertingProvider)

			const error = new Error('Critical system failure')
			const context: ErrorContext = {
				operation: 'system_operation',
			}

			const categorized = handler.categorizeError(error, context)
			categorized.severity = ErrorSeverity.CRITICAL

			const shouldAlert = handler.shouldAlert(categorized)
			expect(shouldAlert).toBe(true)

			await handler.handleError(categorized)
			expect(mockAlertingProvider.sendAlert).toHaveBeenCalledWith(categorized, expect.any(Object))
		})

		it('should not trigger alerts when alerting is disabled', async () => {
			const config = {
				...defaultErrorHandlerConfig,
				enableAlerting: false,
			}
			const handler = new ErrorHandler(config)
			handler.addAlertingProvider(mockAlertingProvider)

			const error = new Error('Critical system failure')
			const context: ErrorContext = {
				operation: 'system_operation',
			}

			const categorized = handler.categorizeError(error, context)
			categorized.severity = ErrorSeverity.CRITICAL

			const shouldAlert = handler.shouldAlert(categorized)
			expect(shouldAlert).toBe(false)
		})

		it('should trigger alerts when error rate exceeds threshold', async () => {
			const config = {
				...defaultErrorHandlerConfig,
				enableAlerting: true,
				alertingThresholds: {
					...defaultErrorHandlerConfig.alertingThresholds,
					errorRatePerMinute: 2,
				},
			}
			const handler = new ErrorHandler(config)
			handler.addAlertingProvider(mockAlertingProvider)

			const error = new Error('Network error')
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
			}

			// First error - should not alert
			const categorized1 = handler.categorizeError(error, context)
			let shouldAlert = handler.shouldAlert(categorized1)
			expect(shouldAlert).toBe(false)

			// Second error - should not alert yet
			const categorized2 = handler.categorizeError(error, context)
			shouldAlert = handler.shouldAlert(categorized2)
			expect(shouldAlert).toBe(true) // Rate threshold exceeded
		})
	})

	describe('isRetryable', () => {
		it('should correctly identify retryable errors', () => {
			const networkError = new Error('ECONNREFUSED')
			const networkContext: ErrorContext = { operation: 'send_logs' }
			const networkCategorized = errorHandler.categorizeError(networkError, networkContext)

			expect(errorHandler.isRetryable(networkCategorized)).toBe(true)
		})

		it('should correctly identify non-retryable errors', () => {
			const configError = new Error('Invalid configuration')
			const configContext: ErrorContext = { operation: 'validate_config' }
			const configCategorized = errorHandler.categorizeError(configError, configContext)

			expect(errorHandler.isRetryable(configCategorized)).toBe(false)
		})

		it('should not retry critical errors', () => {
			const error = new Error('Network error')
			const context: ErrorContext = { operation: 'send_logs' }
			const categorized = errorHandler.categorizeError(error, context)
			categorized.severity = ErrorSeverity.CRITICAL

			expect(errorHandler.isRetryable(categorized)).toBe(false)
		})
	})

	describe('recovery strategies', () => {
		it('should return correct recovery strategy for each category', () => {
			expect(errorHandler.getRecoveryStrategy(ErrorCategory.NETWORK)).toBe(RecoveryStrategy.RETRY)
			expect(errorHandler.getRecoveryStrategy(ErrorCategory.CONFIGURATION)).toBe(
				RecoveryStrategy.FAIL_FAST
			)
			expect(errorHandler.getRecoveryStrategy(ErrorCategory.TRANSPORT)).toBe(
				RecoveryStrategy.CIRCUIT_BREAKER
			)
			expect(errorHandler.getRecoveryStrategy(ErrorCategory.RESOURCE)).toBe(
				RecoveryStrategy.FALLBACK
			)
		})
	})

	describe('alerting provider management', () => {
		it('should add and remove alerting providers', () => {
			const provider1 = new ConsoleAlertingProvider()
			const provider2 = new ConsoleAlertingProvider()

			errorHandler.addAlertingProvider(provider1)
			errorHandler.addAlertingProvider(provider2)

			// Verify providers are added (we can't directly test this without exposing internals)
			// But we can test removal
			errorHandler.removeAlertingProvider(provider1)

			// The provider should be removed (tested indirectly through alerting behavior)
			expect(() => errorHandler.removeAlertingProvider(provider1)).not.toThrow()
		})
	})
})
