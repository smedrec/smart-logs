import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoggingHelper } from '../../utils/logging-helper'

import type { Logger } from '../../infrastructure/logger'

describe('LoggingHelper', () => {
	let mockLogger: Logger
	let logSpy: {
		debug: ReturnType<typeof vi.fn>
		info: ReturnType<typeof vi.fn>
		warn: ReturnType<typeof vi.fn>
		error: ReturnType<typeof vi.fn>
		setCorrelationId: ReturnType<typeof vi.fn>
		setRequestId: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		// Create mock logger with all required methods
		logSpy = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			setCorrelationId: vi.fn(),
			setRequestId: vi.fn(),
		}

		mockLogger = logSpy as unknown as Logger
	})

	describe('logRequest', () => {
		it('should log at info level by default', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { userId: '123' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
			expect(logSpy.debug).not.toHaveBeenCalled()
			expect(logSpy.warn).not.toHaveBeenCalled()
			expect(logSpy.error).not.toHaveBeenCalled()
		})

		it('should log at error level when error is present in metadata', () => {
			const config = { enabled: true }
			const message = 'Error occurred'
			const meta = { error: new Error('Test error'), userId: '123' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.error).toHaveBeenCalledWith(message, meta)
			expect(logSpy.info).not.toHaveBeenCalled()
			expect(logSpy.warn).not.toHaveBeenCalled()
		})

		it('should log at warn level when warning is present in metadata', () => {
			const config = { enabled: true }
			const message = 'Warning message'
			const meta = { warning: true, userId: '123' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.warn).toHaveBeenCalledWith(message, meta)
			expect(logSpy.info).not.toHaveBeenCalled()
			expect(logSpy.error).not.toHaveBeenCalled()
		})

		it('should log at warn level when status >= 400', () => {
			const config = { enabled: true }
			const message = 'HTTP error'
			const meta = { status: 404, endpoint: '/api/test' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.warn).toHaveBeenCalledWith(message, meta)
			expect(logSpy.info).not.toHaveBeenCalled()
		})

		it('should log at warn level when status is exactly 400', () => {
			const config = { enabled: true }
			const message = 'Bad request'
			const meta = { status: 400 }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.warn).toHaveBeenCalledWith(message, meta)
		})

		it('should log at info level when status < 400', () => {
			const config = { enabled: true }
			const message = 'Success'
			const meta = { status: 200 }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
			expect(logSpy.warn).not.toHaveBeenCalled()
		})

		it('should prioritize error level over warn level', () => {
			const config = { enabled: true }
			const message = 'Error with warning'
			const meta = { error: new Error('Test'), warning: true, status: 500 }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.error).toHaveBeenCalledWith(message, meta)
			expect(logSpy.warn).not.toHaveBeenCalled()
		})

		it('should set correlation ID when available', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { correlationId: 'corr-123' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.setCorrelationId).toHaveBeenCalledWith('corr-123')
			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should set request ID when available', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { requestId: 'req-456' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.setRequestId).toHaveBeenCalledWith('req-456')
			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should set both correlation ID and request ID when available', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { correlationId: 'corr-123', requestId: 'req-456' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.setCorrelationId).toHaveBeenCalledWith('corr-123')
			expect(logSpy.setRequestId).toHaveBeenCalledWith('req-456')
			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should not log when logging is disabled', () => {
			const config = { enabled: false }
			const message = 'Test message'
			const meta = { userId: '123' }

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.info).not.toHaveBeenCalled()
			expect(logSpy.debug).not.toHaveBeenCalled()
			expect(logSpy.warn).not.toHaveBeenCalled()
			expect(logSpy.error).not.toHaveBeenCalled()
		})

		it('should not log when logger is undefined', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { userId: '123' }

			// Should not throw error
			expect(() => {
				LoggingHelper.logRequest(undefined, config, message, meta)
			}).not.toThrow()
		})

		it('should handle empty metadata', () => {
			const config = { enabled: true }
			const message = 'Test message'

			LoggingHelper.logRequest(mockLogger, config, message, {})

			expect(logSpy.info).toHaveBeenCalledWith(message, {})
		})

		it('should handle logger without setCorrelationId method', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { correlationId: 'corr-123' }

			// Create logger without setCorrelationId
			const limitedLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			} as unknown as Logger

			// Should not throw error
			expect(() => {
				LoggingHelper.logRequest(limitedLogger, config, message, meta)
			}).not.toThrow()

			expect((limitedLogger as any).info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle logger without setRequestId method', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { requestId: 'req-456' }

			// Create logger without setRequestId
			const limitedLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			} as unknown as Logger

			// Should not throw error
			expect(() => {
				LoggingHelper.logRequest(limitedLogger, config, message, meta)
			}).not.toThrow()

			expect((limitedLogger as any).info).toHaveBeenCalledWith(message, meta)
		})
	})

	describe('createRequestLogger', () => {
		it('should create a bound logger function', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			expect(typeof logger).toBe('function')
		})

		it('should log using the bound configuration', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			logger('Test message', { userId: '123' })

			expect(logSpy.info).toHaveBeenCalledWith('Test message', { userId: '123' })
		})

		it('should respect disabled logging in bound configuration', () => {
			const config = { enabled: false }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			logger('Test message', { userId: '123' })

			expect(logSpy.info).not.toHaveBeenCalled()
		})

		it('should allow calling without metadata', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			logger('Test message')

			expect(logSpy.info).toHaveBeenCalledWith('Test message', {})
		})

		it('should determine log level correctly in bound logger', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			// Test error level
			logger('Error message', { error: new Error('Test') })
			expect(logSpy.error).toHaveBeenCalledWith('Error message', { error: expect.any(Error) })

			// Test warn level
			logger('Warning message', { status: 404 })
			expect(logSpy.warn).toHaveBeenCalledWith('Warning message', { status: 404 })

			// Test info level
			logger('Info message', { status: 200 })
			expect(logSpy.info).toHaveBeenCalledWith('Info message', { status: 200 })
		})

		it('should handle correlation IDs in bound logger', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(mockLogger, config)

			logger('Test message', { correlationId: 'corr-789', requestId: 'req-012' })

			expect(logSpy.setCorrelationId).toHaveBeenCalledWith('corr-789')
			expect(logSpy.setRequestId).toHaveBeenCalledWith('req-012')
			expect(logSpy.info).toHaveBeenCalledWith('Test message', {
				correlationId: 'corr-789',
				requestId: 'req-012',
			})
		})

		it('should work with undefined logger', () => {
			const config = { enabled: true }
			const logger = LoggingHelper.createRequestLogger(undefined, config)

			// Should not throw error
			expect(() => {
				logger('Test message', { userId: '123' })
			}).not.toThrow()
		})

		it('should create multiple independent bound loggers', () => {
			const config1 = { enabled: true }
			const config2 = { enabled: false }

			const logger1 = LoggingHelper.createRequestLogger(mockLogger, config1)
			const logger2 = LoggingHelper.createRequestLogger(mockLogger, config2)

			logger1('Message 1')
			logger2('Message 2')

			// Only logger1 should log (config1 is enabled)
			expect(logSpy.info).toHaveBeenCalledTimes(1)
			expect(logSpy.info).toHaveBeenCalledWith('Message 1', {})
		})
	})

	describe('log level determination', () => {
		it('should use debug level when explicitly logging debug messages', () => {
			// Note: The current implementation doesn't have a debug path,
			// but we test the fallback behavior
			const config = { enabled: true, level: 'debug' as const }
			const message = 'Debug message'
			const meta = {}

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			// Should default to info when no error/warning indicators
			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle complex metadata with multiple indicators', () => {
			const config = { enabled: true }
			const message = 'Complex message'
			const meta = {
				userId: '123',
				endpoint: '/api/test',
				duration: 150,
				cached: false,
				status: 200,
			}

			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle status codes at boundary values', () => {
			const config = { enabled: true }

			// Test 399 (should be info)
			LoggingHelper.logRequest(mockLogger, config, 'Message', { status: 399 })
			expect(logSpy.info).toHaveBeenCalled()
			expect(logSpy.warn).not.toHaveBeenCalled()

			vi.clearAllMocks()

			// Test 400 (should be warn)
			LoggingHelper.logRequest(mockLogger, config, 'Message', { status: 400 })
			expect(logSpy.warn).toHaveBeenCalled()
			expect(logSpy.info).not.toHaveBeenCalled()

			vi.clearAllMocks()

			// Test 500 (should be warn)
			LoggingHelper.logRequest(mockLogger, config, 'Message', { status: 500 })
			expect(logSpy.warn).toHaveBeenCalled()
		})
	})

	describe('edge cases', () => {
		it('should handle null metadata values', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { userId: null, correlationId: null }

			expect(() => {
				LoggingHelper.logRequest(mockLogger, config, message, meta)
			}).not.toThrow()

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle undefined metadata values', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta = { userId: undefined, correlationId: undefined }

			expect(() => {
				LoggingHelper.logRequest(mockLogger, config, message, meta)
			}).not.toThrow()

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle very long messages', () => {
			const config = { enabled: true }
			const message = 'A'.repeat(10000)
			const meta = { userId: '123' }

			expect(() => {
				LoggingHelper.logRequest(mockLogger, config, message, meta)
			}).not.toThrow()

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle metadata with circular references gracefully', () => {
			const config = { enabled: true }
			const message = 'Test message'
			const meta: any = { userId: '123' }
			meta.self = meta // Create circular reference

			// Should not throw error (logger handles serialization)
			expect(() => {
				LoggingHelper.logRequest(mockLogger, config, message, meta)
			}).not.toThrow()
		})

		it('should handle empty string message', () => {
			const config = { enabled: true }
			const message = ''
			const meta = { userId: '123' }

			expect(() => {
				LoggingHelper.logRequest(mockLogger, config, message, meta)
			}).not.toThrow()

			expect(logSpy.info).toHaveBeenCalledWith(message, meta)
		})

		it('should handle config without enabled property', () => {
			const config = {}
			const message = 'Test message'
			const meta = { userId: '123' }

			// Should not log when enabled is not explicitly true
			LoggingHelper.logRequest(mockLogger, config, message, meta)

			expect(logSpy.info).not.toHaveBeenCalled()
		})
	})
})
