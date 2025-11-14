import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AuditLogger,
	DataMasker,
	DefaultLogger,
	LogFormatter,
	LoggerFactory,
} from '../../infrastructure/logger'

import type {
	CustomLogger,
	LogEntry,
	LogFormat,
	LoggerConfig,
	LogLevel,
} from '../../infrastructure/logger'

describe('DataMasker', () => {
	let dataMasker: DataMasker

	beforeEach(() => {
		dataMasker = new DataMasker()
	})

	describe('maskString', () => {
		it('should mask credit card numbers', () => {
			const input = 'Credit card: 4532-1234-5678-9012'
			const result = dataMasker.mask(input)
			expect(result).toContain('****')
			expect(result).not.toContain('4532-1234-5678-9012')
		})

		it('should mask SSN format', () => {
			const input = 'SSN: 123-45-6789'
			const result = dataMasker.mask(input)
			expect(result).toContain('****')
			expect(result).not.toContain('123-45-6789')
		})

		it('should mask email addresses', () => {
			const input = 'Email: user@example.com'
			const result = dataMasker.mask(input)
			expect(result).toContain('****')
			expect(result).not.toContain('user@example.com')
		})

		it('should mask Bearer tokens', () => {
			const input = 'Authorization: Bearer abc123def456'
			const result = dataMasker.mask(input)
			expect(result).toContain('****')
			expect(result).not.toContain('abc123def456')
		})
	})

	describe('maskObject', () => {
		it('should mask sensitive fields by name', () => {
			const input = {
				username: 'john',
				password: 'secret123',
				apiKey: 'key123',
				data: 'normal data',
			}

			const result = dataMasker.mask(input)
			expect(result.username).toBe('john')
			expect(result.password).toBe('*********')
			expect(result.apiKey).toBe('******')
			expect(result.data).toBe('normal data')
		})

		it('should mask nested objects', () => {
			const input = {
				user: {
					name: 'john',
					credentials: {
						password: 'secret',
						token: 'abc123',
					},
				},
				metadata: {
					version: '1.0',
				},
			}

			const result = dataMasker.mask(input)
			expect(result.user.name).toBe('john')
			expect(result.user.credentials.password).toBe('******')
			expect(result.user.credentials.token).toBe('******')
			expect(result.metadata.version).toBe('1.0')
		})

		it('should mask arrays', () => {
			const input = [
				{ name: 'john', password: 'secret' },
				{ name: 'jane', apiKey: 'key123' },
			]

			const result = dataMasker.mask(input)
			expect(result[0].name).toBe('john')
			expect(result[0].password).toBe('******')
			expect(result[1].name).toBe('jane')
			expect(result[1].apiKey).toBe('******')
		})

		it('should handle custom sensitive fields', () => {
			const customMasker = new DataMasker(['customField', 'secretData'])
			const input = {
				customField: 'sensitive',
				secretData: 'very secret',
				normalField: 'normal',
			}

			const result = customMasker.mask(input)
			expect(result.customField).toBe('*********')
			expect(result.secretData).toBe('***********')
			expect(result.normalField).toBe('normal')
		})
	})
})

describe('LogFormatter', () => {
	const sampleEntry: LogEntry = {
		timestamp: '2023-01-01T00:00:00.000Z',
		level: 'info',
		message: 'Test message',
		requestId: 'req-123',
		correlationId: 'corr-456',
		component: 'test-component',
		metadata: { key: 'value' },
	}

	describe('formatEntry', () => {
		it('should format as JSON', () => {
			const result = LogFormatter.formatEntry(sampleEntry, 'json')
			const parsed = JSON.parse(result)
			expect(parsed.timestamp).toBe(sampleEntry.timestamp)
			expect(parsed.level).toBe(sampleEntry.level)
			expect(parsed.message).toBe(sampleEntry.message)
		})

		it('should format as text', () => {
			const result = LogFormatter.formatEntry(sampleEntry, 'text')
			expect(result).toContain('2023-01-01T00:00:00.000Z')
			expect(result).toContain('[INFO]')
			expect(result).toContain('[test-component]')
			expect(result).toContain('[req-123]')
			expect(result).toContain('Test message')
		})

		it('should format as structured', () => {
			const result = LogFormatter.formatEntry(sampleEntry, 'structured')
			const parsed = JSON.parse(result)
			expect(parsed['@timestamp']).toBe(sampleEntry.timestamp)
			expect(parsed['@level']).toBe(sampleEntry.level)
			expect(parsed['@message']).toBe(sampleEntry.message)
			expect(parsed['@component']).toBe(sampleEntry.component)
		})

		it('should include error information', () => {
			const entryWithError: LogEntry = {
				...sampleEntry,
				error: {
					name: 'TestError',
					message: 'Test error message',
					stack: 'Error stack trace',
				},
			}

			const result = LogFormatter.formatEntry(entryWithError, 'text')
			expect(result).toContain('Error: TestError: Test error message')
		})
	})
})

describe('AuditLogger', () => {
	let logger: AuditLogger
	let mockCustomLogger: CustomLogger & { log: any }

	beforeEach(() => {
		mockCustomLogger = {
			log: vi.fn(),
		}

		logger = new AuditLogger({
			level: 'debug',
			format: 'json',
			enableConsole: false,
			enableBuffer: true,
			bufferSize: 100,
		})
	})

	describe('basic logging', () => {
		it('should log debug messages', () => {
			logger.debug('Debug message', { key: 'value' })
			const buffer = logger.getBuffer()
			expect(buffer).toHaveLength(1)
			expect(buffer[0].level).toBe('debug')
			expect(buffer[0].message).toBe('Debug message')
		})

		it('should log info messages', () => {
			logger.info('Info message')
			const buffer = logger.getBuffer()
			expect(buffer).toHaveLength(1)
			expect(buffer[0].level).toBe('info')
		})

		it('should log warn messages', () => {
			logger.warn('Warning message')
			const buffer = logger.getBuffer()
			expect(buffer).toHaveLength(1)
			expect(buffer[0].level).toBe('warn')
		})

		it('should log error messages', () => {
			logger.error('Error message')
			const buffer = logger.getBuffer()
			expect(buffer).toHaveLength(1)
			expect(buffer[0].level).toBe('error')
		})
	})

	describe('log level filtering', () => {
		it('should respect log level settings', () => {
			logger.setLevel('warn')

			logger.debug('Debug message')
			logger.info('Info message')
			logger.warn('Warning message')
			logger.error('Error message')

			const buffer = logger.getBuffer()
			expect(buffer).toHaveLength(2)
			expect(buffer[0].level).toBe('warn')
			expect(buffer[1].level).toBe('error')
		})
	})

	describe('request correlation', () => {
		it('should set and include request ID', () => {
			logger.setRequestId('req-123')
			logger.info('Test message')

			const buffer = logger.getBuffer()
			expect(buffer[0].requestId).toBe('req-123')
		})

		it('should set and include correlation ID', () => {
			logger.setCorrelationId('corr-456')
			logger.info('Test message')

			const buffer = logger.getBuffer()
			expect(buffer[0].correlationId).toBe('corr-456')
		})
	})

	describe('sensitive data masking', () => {
		it('should mask sensitive data when enabled', () => {
			const loggerWithMasking = new AuditLogger({
				level: 'debug',
				maskSensitiveData: true,
				enableBuffer: true,
				enableConsole: false,
			})

			loggerWithMasking.info('Test message', {
				password: 'secret123',
				apiKey: 'key456',
				normalData: 'normal',
			})

			const buffer = loggerWithMasking.getBuffer()
			expect(buffer[0].metadata.password).toBe('*********')
			expect(buffer[0].metadata.apiKey).toBe('******')
			expect(buffer[0].metadata.normalData).toBe('normal')
		})

		it('should not mask data when disabled', () => {
			const loggerWithoutMasking = new AuditLogger({
				level: 'debug',
				maskSensitiveData: false,
				enableBuffer: true,
				enableConsole: false,
			})

			loggerWithoutMasking.info('Test message', {
				password: 'secret123',
				normalData: 'normal',
			})

			const buffer = loggerWithoutMasking.getBuffer()
			expect(buffer[0].metadata.password).toBe('secret123')
			expect(buffer[0].metadata.normalData).toBe('normal')
		})
	})

	describe('HTTP request/response logging', () => {
		it('should log HTTP requests', () => {
			logger.logRequest(
				'GET',
				'https://api.example.com/users',
				{ Authorization: 'Bearer token' },
				{ query: 'test' }
			)

			const buffer = logger.getBuffer()
			expect(buffer[0].message).toBe('HTTP GET https://api.example.com/users')
			expect(buffer[0].metadata.type).toBe('request')
			expect(buffer[0].metadata.method).toBe('GET')
			expect(buffer[0].metadata.url).toBe('https://api.example.com/users')
		})

		it('should log HTTP responses', () => {
			logger.logResponse(
				200,
				'OK',
				{ 'Content-Type': 'application/json' },
				{ result: 'success' },
				150
			)

			const buffer = logger.getBuffer()
			expect(buffer[0].message).toBe('HTTP 200 OK')
			expect(buffer[0].metadata.type).toBe('response')
			expect(buffer[0].metadata.status).toBe(200)
			expect(buffer[0].metadata.duration).toBe(150)
		})
	})

	describe('error logging', () => {
		it('should log errors with full context', () => {
			const error = new Error('Test error')
			error.stack = 'Error stack trace'

			logger.logError(error, { context: 'test context' })

			const buffer = logger.getBuffer()
			expect(buffer[0].level).toBe('error')
			expect(buffer[0].message).toBe('Test error')
			expect(buffer[0].error?.name).toBe('Error')
			expect(buffer[0].error?.message).toBe('Test error')
			expect(buffer[0].error?.stack).toBe('Error stack trace')
			expect(buffer[0].metadata.context).toBe('test context')
		})
	})

	describe('buffer management', () => {
		it('should maintain buffer size limit', () => {
			const smallBufferLogger = new AuditLogger({
				level: 'debug',
				enableBuffer: true,
				bufferSize: 3,
				enableConsole: false,
			})

			for (let i = 0; i < 5; i++) {
				smallBufferLogger.info(`Message ${i}`)
			}

			const buffer = smallBufferLogger.getBuffer()
			expect(buffer).toHaveLength(3)
			expect(buffer[0].message).toBe('Message 2')
			expect(buffer[2].message).toBe('Message 4')
		})

		it('should clear buffer', () => {
			logger.info('Test message')
			expect(logger.getBuffer()).toHaveLength(1)

			logger.clearBuffer()
			expect(logger.getBuffer()).toHaveLength(0)
		})
	})

	describe('custom logger integration', () => {
		it('should use custom logger when provided', async () => {
			const customLogger = new AuditLogger(
				{
					level: 'debug',
					enableBuffer: false,
					enableConsole: false,
					maskSensitiveData: false, // Disable masking for this test
				},
				mockCustomLogger
			)

			customLogger.info('Test message', { key: 'value' })

			expect(mockCustomLogger.log).toHaveBeenCalledWith(
				expect.objectContaining({
					level: 'info',
					message: 'Test message',
					metadata: { key: 'value' },
				})
			)
		})

		it('should flush buffer to custom logger', async () => {
			const bufferLogger = new AuditLogger(
				{
					level: 'debug',
					enableBuffer: true,
					enableConsole: false,
				},
				mockCustomLogger
			)

			bufferLogger.info('Message 1')
			bufferLogger.info('Message 2')

			await bufferLogger.flush()

			expect(mockCustomLogger.log).toHaveBeenCalledTimes(2)
			expect(bufferLogger.getBuffer()).toHaveLength(0)
		})
	})

	describe('message truncation', () => {
		it('should truncate long messages', () => {
			const longMessage = 'a'.repeat(15000)
			const loggerWithSmallLimit = new AuditLogger({
				level: 'debug',
				maxLogSize: 100,
				enableBuffer: true,
				enableConsole: false,
			})

			loggerWithSmallLimit.info(longMessage)

			const buffer = loggerWithSmallLimit.getBuffer()
			expect(buffer[0].message).toHaveLength(100)
			expect(buffer[0].message.endsWith('...')).toBe(true)
		})
	})
})

describe('DefaultLogger', () => {
	let logger: DefaultLogger

	beforeEach(() => {
		logger = new DefaultLogger({
			level: 'debug',
			enableBuffer: true,
			enableConsole: false,
		})
	})

	it('should provide backward compatibility interface', () => {
		logger.debug('Debug message')
		logger.info('Info message')
		logger.warn('Warning message')
		logger.error('Error message')

		const buffer = logger.getBuffer()
		expect(buffer).toHaveLength(4)
	})

	it('should support request correlation', () => {
		logger.setRequestId('req-123')
		logger.setCorrelationId('corr-456')
		logger.info('Test message')

		const buffer = logger.getBuffer()
		expect(buffer[0].requestId).toBe('req-123')
		expect(buffer[0].correlationId).toBe('corr-456')
	})
})

describe('LoggerFactory', () => {
	it('should create logger with custom config', () => {
		const logger = LoggerFactory.create({
			level: 'warn',
			format: 'structured',
		})

		expect(logger).toBeInstanceOf(AuditLogger)
	})

	it('should create default logger', () => {
		const logger = LoggerFactory.createDefault()
		expect(logger).toBeInstanceOf(DefaultLogger)
	})

	it('should create silent logger', () => {
		const logger = LoggerFactory.createSilent()
		expect(logger).toBeInstanceOf(AuditLogger)
	})

	it('should create debug logger', () => {
		const logger = LoggerFactory.createDebug()
		expect(logger).toBeInstanceOf(AuditLogger)
	})
})

// Integration tests
describe('Logger Integration', () => {
	let consoleLogSpy: any
	let consoleErrorSpy: any

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleLogSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	it('should write to console when enabled', () => {
		const logger = new AuditLogger({
			level: 'info',
			enableConsole: true,
			format: 'text',
		})

		logger.info('Test message')

		expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'))
	})

	it('should not write to console when disabled', () => {
		const logger = new AuditLogger({
			level: 'info',
			enableConsole: false,
		})

		logger.info('Test message')

		expect(consoleLogSpy).not.toHaveBeenCalled()
	})

	it('should handle custom logger errors gracefully', async () => {
		const failingCustomLogger: CustomLogger = {
			log: vi.fn().mockRejectedValue(new Error('Custom logger failed')),
		}

		const logger = new AuditLogger(
			{
				level: 'info',
				enableBuffer: true,
				enableConsole: false,
			},
			failingCustomLogger
		)

		logger.info('Test message')
		await logger.flush()

		expect(consoleErrorSpy).toHaveBeenCalledWith('Custom logger failed:', expect.any(Error))
	})
})

// Console formatting tests
describe('Console Output Formatting', () => {
	let consoleDebugSpy: any
	let consoleInfoSpy: any
	let consoleWarnSpy: any
	let consoleErrorSpy: any

	beforeEach(() => {
		consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
		consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleDebugSpy.mockRestore()
		consoleInfoSpy.mockRestore()
		consoleWarnSpy.mockRestore()
		consoleErrorSpy.mockRestore()
	})

	describe('color coding', () => {
		it('should use cyan color for debug messages', () => {
			const logger = new AuditLogger({
				level: 'debug',
				enableConsole: true,
				format: 'json',
			})

			logger.debug('Debug message')

			expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[36m'))
			expect(consoleDebugSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[0m'))
		})

		it('should use green color for info messages', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
			})

			logger.info('Info message')

			expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[32m'))
			expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[0m'))
		})

		it('should use yellow color for warn messages', () => {
			const logger = new AuditLogger({
				level: 'warn',
				enableConsole: true,
				format: 'json',
			})

			logger.warn('Warning message')

			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[33m'))
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[0m'))
		})

		it('should use red color for error messages', () => {
			const logger = new AuditLogger({
				level: 'error',
				enableConsole: true,
				format: 'json',
			})

			logger.error('Error message')

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[31m'))
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('\x1b[0m'))
		})

		it('should reset color codes after each message', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
			})

			logger.info('First message')
			logger.info('Second message')

			const firstCall = consoleInfoSpy.mock.calls[0][0]
			const secondCall = consoleInfoSpy.mock.calls[1][0]

			expect(firstCall).toMatch(/\x1b\[0m$/)
			expect(secondCall).toMatch(/\x1b\[0m$/)
		})
	})

	describe('timestamp formatting', () => {
		it('should include ISO timestamp in console output', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
			})

			logger.info('Test message')

			const output = consoleInfoSpy.mock.calls[0][0]
			// Check for ISO 8601 timestamp format
			expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
		})

		it('should include timestamp for all log levels', () => {
			const logger = new AuditLogger({
				level: 'debug',
				enableConsole: true,
				format: 'json',
			})

			logger.debug('Debug message')
			logger.info('Info message')
			logger.warn('Warn message')
			logger.error('Error message')

			expect(consoleDebugSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/)
			expect(consoleInfoSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/)
			expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/)
			expect(consoleErrorSpy.mock.calls[0][0]).toMatch(/\d{4}-\d{2}-\d{2}T/)
		})
	})

	describe('metadata formatting', () => {
		it('should format metadata objects with proper indentation', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
				maskSensitiveData: false, // Disable masking for this test
			})

			logger.info('Test message', {
				key1: 'value1',
				key2: 'value2',
				nested: {
					nestedKey: 'nestedValue',
				},
			})

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('Metadata:')
			expect(output).toContain('key1')
			expect(output).toContain('value1')
			expect(output).toContain('nested')
			// Check for indentation (at least 2 spaces)
			expect(output).toMatch(/\n {2,}/)
		})

		it('should handle empty metadata gracefully', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
			})

			logger.info('Test message', {})

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('Test message')
			// Should not include metadata section for empty objects
			expect(output).not.toContain('Metadata:')
		})

		it('should format metadata in text format with indentation', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'text',
				maskSensitiveData: false, // Disable masking for this test
			})

			logger.info('Test message', {
				key1: 'value1',
				nested: {
					nestedKey: 'nestedValue',
				},
			})

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('Metadata:')
			expect(output).toContain('key1')
			// Check for proper indentation
			expect(output).toMatch(/\n {2,}/)
		})
	})

	describe('error handling', () => {
		it('should handle metadata serialization errors gracefully', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
				maskSensitiveData: false, // Disable masking to test JSON serialization directly
			})

			// Create circular reference
			const circular: any = { key: 'value' }
			circular.self = circular

			logger.info('Test message', circular)

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('Test message')
			// With masking disabled, circular references should be caught during JSON.stringify
			expect(output).toContain('Serialization Error')
		})

		it('should handle metadata serialization errors in text format', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'text',
				maskSensitiveData: false, // Disable masking to test JSON serialization directly
			})

			// Create circular reference
			const circular: any = { key: 'value' }
			circular.self = circular

			logger.info('Test message', circular)

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('Test message')
			expect(output).toContain('Serialization Error')
		})

		it('should display error information with proper formatting', () => {
			const logger = new AuditLogger({
				level: 'error',
				enableConsole: true,
				format: 'json',
			})

			const error = new Error('Test error')
			error.stack = 'Error: Test error\n  at test.ts:10:5'

			logger.logError(error, { context: 'test' })

			const output = consoleErrorSpy.mock.calls[0][0]
			expect(output).toContain('Error:')
			expect(output).toContain('Test error')
			expect(output).toContain('Stack:')
		})
	})

	describe('component and request ID formatting', () => {
		it('should include component in formatted output', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
				component: 'TestComponent',
			})

			logger.info('Test message')

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('TestComponent')
		})

		it('should include request ID in formatted output', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
			})

			logger.setRequestId('req-123')
			logger.info('Test message')

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('req-123')
		})

		it('should include both component and request ID', () => {
			const logger = new AuditLogger({
				level: 'info',
				enableConsole: true,
				format: 'json',
				component: 'TestComponent',
			})

			logger.setRequestId('req-123')
			logger.info('Test message')

			const output = consoleInfoSpy.mock.calls[0][0]
			expect(output).toContain('TestComponent')
			expect(output).toContain('req-123')
		})
	})
})
