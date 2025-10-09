import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { StructuredLogger } from '../structured-logger.js'

describe('StructuredLogger', () => {
	let logger: StructuredLogger
	let consoleSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		// Mock console.log to capture output
		consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

		logger = new StructuredLogger({
			minLevel: LogLevel.DEBUG,
			service: 'test-service',
			environment: 'test',
			version: '1.0.0',
		})
	})

	describe('Logger interface compliance', () => {
		it('should implement all Logger interface methods', () => {
			expect(typeof logger.debug).toBe('function')
			expect(typeof logger.info).toBe('function')
			expect(typeof logger.warn).toBe('function')
			expect(typeof logger.error).toBe('function')
			expect(typeof logger.fatal).toBe('function')
			expect(typeof logger.setRequestId).toBe('function')
			expect(typeof logger.setCorrelationId).toBe('function')
			expect(typeof logger.withContext).toBe('function')
			expect(typeof logger.flush).toBe('function')
			expect(typeof logger.close).toBe('function')
		})

		it('should return promises from all log methods', async () => {
			const debugPromise = logger.debug('test')
			const infoPromise = logger.info('test')
			const warnPromise = logger.warn('test')
			const errorPromise = logger.error('test')
			const fatalPromise = logger.fatal('test')

			expect(debugPromise).toBeInstanceOf(Promise)
			expect(infoPromise).toBeInstanceOf(Promise)
			expect(warnPromise).toBeInstanceOf(Promise)
			expect(errorPromise).toBeInstanceOf(Promise)
			expect(fatalPromise).toBeInstanceOf(Promise)

			await Promise.all([debugPromise, infoPromise, warnPromise, errorPromise, fatalPromise])
		})
	})

	describe('shouldLog method', () => {
		it('should respect minimum log level', () => {
			const warnLogger = new StructuredLogger({
				minLevel: LogLevel.WARN,
				service: 'test-service',
				environment: 'test',
			})

			expect(warnLogger.shouldLog(LogLevel.DEBUG)).toBe(false)
			expect(warnLogger.shouldLog(LogLevel.INFO)).toBe(false)
			expect(warnLogger.shouldLog(LogLevel.WARN)).toBe(true)
			expect(warnLogger.shouldLog(LogLevel.ERROR)).toBe(true)
			expect(warnLogger.shouldLog(LogLevel.FATAL)).toBe(true)
		})

		it('should handle invalid log levels gracefully', () => {
			// Mock console.error to capture error output
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

			// This should not throw and should default to allowing the log
			const result = logger.shouldLog('invalid' as any)
			expect(result).toBe(true)
			expect(errorSpy).toHaveBeenCalled()

			errorSpy.mockRestore()
		})
	})

	describe('correlation ID management', () => {
		it('should generate initial correlation ID', () => {
			const context = logger.getContext()
			expect(context.correlationId).toBeDefined()
			expect(typeof context.correlationId).toBe('string')
		})

		it('should set and get correlation ID', () => {
			const testCorrelationId = 'test-correlation-123'
			logger.setCorrelationId(testCorrelationId)

			const context = logger.getContext()
			expect(context.correlationId).toBe(testCorrelationId)
		})

		it('should set and get request ID', () => {
			const testRequestId = 'test-request-456'
			logger.setRequestId(testRequestId)

			const context = logger.getContext()
			expect(context.requestId).toBe(testRequestId)
		})
	})

	describe('withContext method', () => {
		it('should create new logger with additional context', () => {
			const newContext = {
				requestId: 'new-request-123',
				traceId: 'trace-456',
			}

			const contextLogger = logger.withContext(newContext) as StructuredLogger

			expect(contextLogger).not.toBe(logger)
			expect(contextLogger.getContext().requestId).toBe('new-request-123')
			expect(contextLogger.getContext().traceId).toBe('trace-456')
		})

		it('should preserve original logger context', () => {
			const originalCorrelationId = logger.getContext().correlationId

			const contextLogger = logger.withContext({ requestId: 'test-123' })

			expect(logger.getContext().correlationId).toBe(originalCorrelationId)
			expect(logger.getContext().requestId).toBeUndefined()
		})
	})

	describe('structured metadata collection', () => {
		it('should include service metadata in logs', async () => {
			await logger.info('test message')

			expect(consoleSpy).toHaveBeenCalled()
			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)

			expect(logOutput.metadata.service).toBe('test-service')
			expect(logOutput.metadata.environment).toBe('test')
			expect(logOutput.metadata.hostname).toBeDefined()
			expect(logOutput.metadata.pid).toBe(process.pid)
		})

		it('should include correlation ID in logs', async () => {
			const testCorrelationId = 'test-correlation-789'
			logger.setCorrelationId(testCorrelationId)

			await logger.info('test message')

			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)
			expect(logOutput.correlationId).toBe(testCorrelationId)
		})

		it('should include request ID when set', async () => {
			const testRequestId = 'test-request-789'
			logger.setRequestId(testRequestId)

			await logger.info('test message')

			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)
			expect(logOutput.requestId).toBe(testRequestId)
		})
	})

	describe('field validation', () => {
		it('should handle valid fields', async () => {
			const fields = {
				userId: 123,
				action: 'login',
				success: true,
			}

			await logger.info('test message', fields)

			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)
			expect(logOutput.fields.userId).toBe(123)
			expect(logOutput.fields.action).toBe('login')
			expect(logOutput.fields.success).toBe(true)
		})

		it('should handle undefined fields gracefully', async () => {
			const fields = {
				defined: 'value',
				undefined: undefined,
			}

			await logger.info('test message', fields)

			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)
			expect(logOutput.fields.defined).toBe('value')
			expect(logOutput.fields.undefined).toBeUndefined()
		})

		it('should handle circular references in fields', async () => {
			const circular: any = { name: 'test' }
			circular.self = circular

			await logger.info('test message', { circular })

			const logOutput = JSON.parse(consoleSpy.mock.calls[0][0] as string)
			expect(logOutput.fields.circular).toBe('[Circular Reference or Non-Serializable]')
		})
	})

	describe('error handling', () => {
		it('should handle logging errors gracefully', async () => {
			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

			// Mock JSON.stringify to throw an error
			const originalStringify = JSON.stringify
			vi.spyOn(JSON, 'stringify').mockImplementation(() => {
				throw new Error('Serialization error')
			})

			// This should not throw
			await expect(logger.info('test message')).resolves.toBeUndefined()

			expect(errorSpy).toHaveBeenCalledWith('Failed to process log entry:', expect.any(Error))

			// Restore mocks
			vi.mocked(JSON.stringify).mockRestore()
			errorSpy.mockRestore()
		})
	})

	describe('lifecycle management', () => {
		it('should implement flush method', async () => {
			await expect(logger.flush()).resolves.toBeUndefined()
		})

		it('should implement close method', async () => {
			await expect(logger.close()).resolves.toBeUndefined()
		})
	})
})
