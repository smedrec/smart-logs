/**
 * Unit tests for ConsoleAlertingProvider
 * Addresses requirement 10.1: Unit test coverage for alerting
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../../types/error.js'
import { ConsoleAlertingProvider } from '../console-alerting-provider.js'

import type { CategorizedError, ErrorContext, ErrorMetrics } from '../../types/error.js'

describe('ConsoleAlertingProvider', () => {
	let provider: ConsoleAlertingProvider
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		provider = new ConsoleAlertingProvider(false) // Disable colors for testing
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleErrorSpy.mockRestore()
	})

	describe('sendAlert', () => {
		it('should send alert with correct format', async () => {
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'otlp',
				correlationId: 'test-correlation-id',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Test error message'),
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.HIGH,
				context,
				timestamp: new Date('2023-01-01T00:00:00.000Z'),
				isRetryable: true,
				recoveryStrategy: RecoveryStrategy.RETRY,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.HIGH,
				count: 5,
				lastOccurrence: new Date('2023-01-01T00:00:00.000Z'),
				firstOccurrence: new Date('2023-01-01T00:00:00.000Z'),
				transportName: 'otlp',
				recoveryAttempts: 3,
				successfulRecoveries: 2,
			}

			await provider.sendAlert(categorizedError, metrics)

			const alertMessage = consoleErrorSpy.mock.calls[0][0]
			expect(alertMessage).toContain('[ALERT]')
			expect(alertMessage).toContain('Category: network')
			expect(alertMessage).toContain('Severity: high')
			expect(alertMessage).toContain('Transport: otlp')
			expect(alertMessage).toContain('Operation: send_logs')
			expect(alertMessage).toContain('Error: Test error message')
			expect(alertMessage).toContain('Count: 5')
			expect(alertMessage).toContain('Recovery Rate: 67%')
		})

		it('should handle missing transport name', async () => {
			const context: ErrorContext = {
				operation: 'send_logs',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Test error'),
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				context,
				timestamp: new Date(),
				isRetryable: true,
				recoveryStrategy: RecoveryStrategy.RETRY,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await provider.sendAlert(categorizedError, metrics)

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Transport: unknown'))
		})

		it('should calculate recovery rate correctly when no attempts', async () => {
			const context: ErrorContext = {
				operation: 'send_logs',
				transportName: 'console',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Test error'),
				category: ErrorCategory.SERIALIZATION,
				severity: ErrorSeverity.LOW,
				context,
				timestamp: new Date(),
				isRetryable: false,
				recoveryStrategy: RecoveryStrategy.IGNORE,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.SERIALIZATION,
				severity: ErrorSeverity.LOW,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await provider.sendAlert(categorizedError, metrics)

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Recovery Rate: 0%'))
		})

		it('should log stack trace for critical errors', async () => {
			const context: ErrorContext = {
				operation: 'critical_operation',
				transportName: 'file',
				stackTrace: 'Error: Critical failure\n    at test.js:1:1',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Critical failure'),
				category: ErrorCategory.RESOURCE,
				severity: ErrorSeverity.CRITICAL,
				context,
				timestamp: new Date(),
				isRetryable: false,
				recoveryStrategy: RecoveryStrategy.FAIL_FAST,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.RESOURCE,
				severity: ErrorSeverity.CRITICAL,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await provider.sendAlert(categorizedError, metrics)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Stack Trace:',
				'Error: Critical failure\n    at test.js:1:1'
			)
		})

		it('should not log stack trace for non-critical errors', async () => {
			const context: ErrorContext = {
				operation: 'normal_operation',
				transportName: 'redis',
				stackTrace: 'Error: Normal failure\n    at test.js:1:1',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Normal failure'),
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				context,
				timestamp: new Date(),
				isRetryable: true,
				recoveryStrategy: RecoveryStrategy.RETRY,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.NETWORK,
				severity: ErrorSeverity.MEDIUM,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await provider.sendAlert(categorizedError, metrics)

			expect(consoleErrorSpy).not.toHaveBeenCalledWith('Stack Trace:', expect.any(String))
		})
	})

	describe('color support', () => {
		it('should use colors when enabled', async () => {
			const colorProvider = new ConsoleAlertingProvider(true)
			// Mock isTTY property
			const originalIsTTY = process.stdout.isTTY
			Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })

			const context: ErrorContext = {
				operation: 'test_operation',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Test error'),
				category: ErrorCategory.UNKNOWN,
				severity: ErrorSeverity.CRITICAL,
				context,
				timestamp: new Date(),
				isRetryable: false,
				recoveryStrategy: RecoveryStrategy.FAIL_FAST,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.UNKNOWN,
				severity: ErrorSeverity.CRITICAL,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await colorProvider.sendAlert(categorizedError, metrics)

			// Should contain ANSI color codes for critical severity
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('\x1b[41m\x1b[37m') // Red background, white text
			)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('\x1b[0m') // Reset color
			)

			// Restore original isTTY
			Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true })
		})

		it('should not use colors when disabled', async () => {
			const noColorProvider = new ConsoleAlertingProvider(false)

			const context: ErrorContext = {
				operation: 'test_operation',
			}

			const categorizedError: CategorizedError = {
				originalError: new Error('Test error'),
				category: ErrorCategory.UNKNOWN,
				severity: ErrorSeverity.CRITICAL,
				context,
				timestamp: new Date(),
				isRetryable: false,
				recoveryStrategy: RecoveryStrategy.FAIL_FAST,
			}

			const metrics: ErrorMetrics = {
				category: ErrorCategory.UNKNOWN,
				severity: ErrorSeverity.CRITICAL,
				count: 1,
				lastOccurrence: new Date(),
				firstOccurrence: new Date(),
				recoveryAttempts: 0,
				successfulRecoveries: 0,
			}

			await noColorProvider.sendAlert(categorizedError, metrics)

			// Should not contain ANSI color codes
			const callArgs = consoleErrorSpy.mock.calls[0][0]
			expect(callArgs).not.toContain('\x1b[')
		})
	})
})
