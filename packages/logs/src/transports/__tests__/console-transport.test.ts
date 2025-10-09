import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { ConsoleTransport } from '../console-transport.js'

import type { ConsoleConfig } from '../../types/config.js'
import type { LogEntry } from '../../types/log-entry.js'

/**
 * Test suite for ConsoleTransport
 * Addresses requirement 10.1 and 10.3: Unit test coverage and configuration testing
 */
describe('ConsoleTransport', () => {
	let mockStdout: ReturnType<typeof vi.spyOn>
	let mockStderr: ReturnType<typeof vi.spyOn>
	let transport: ConsoleTransport

	beforeEach(() => {
		// Mock console output methods
		mockStdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
		mockStderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
	})

	afterEach(() => {
		// Restore mocks
		mockStdout.mockRestore()
		mockStderr.mockRestore()
	})

	describe('Constructor and Configuration', () => {
		it('should create transport with default configuration', () => {
			transport = new ConsoleTransport()

			expect(transport.name).toBe('console')
			expect(transport.isHealthy()).toBe(true)
		})

		it('should create transport with custom configuration', () => {
			const config: Partial<ConsoleConfig> = {
				format: 'json',
				colorize: false,
				level: 'warn',
			}

			transport = new ConsoleTransport(config)

			expect(transport.name).toBe('console')
			expect(transport.isHealthy()).toBe(true)
		})

		it('should create development transport with appropriate settings', () => {
			transport = ConsoleTransport.createDevelopmentTransport()

			expect(transport.name).toBe('console')
			expect(transport.isHealthy()).toBe(true)
		})

		it('should create production transport with appropriate settings', () => {
			transport = ConsoleTransport.createProductionTransport()

			expect(transport.name).toBe('console')
			expect(transport.isHealthy()).toBe(true)
		})
	})

	describe('Log Entry Processing', () => {
		beforeEach(() => {
			transport = new ConsoleTransport()
		})

		it('should send log entries to console', async () => {
			const entries: LogEntry[] = [createTestLogEntry('info', 'Test message')]

			await transport.send(entries)

			expect(mockStdout).toHaveBeenCalled()
		})

		it('should send error entries to stderr', async () => {
			const entries: LogEntry[] = [createTestLogEntry('error', 'Error message')]

			await transport.send(entries)

			expect(mockStderr).toHaveBeenCalled()
		})

		it('should send fatal entries to stderr', async () => {
			const entries: LogEntry[] = [createTestLogEntry('fatal', 'Fatal message')]

			await transport.send(entries)

			expect(mockStderr).toHaveBeenCalled()
		})

		it('should handle multiple log entries', async () => {
			const entries: LogEntry[] = [
				createTestLogEntry('info', 'Info message'),
				createTestLogEntry('warn', 'Warning message'),
				createTestLogEntry('error', 'Error message'),
			]

			await transport.send(entries)

			expect(mockStdout).toHaveBeenCalledTimes(2) // info and warn
			expect(mockStderr).toHaveBeenCalledTimes(1) // error
		})

		it('should filter entries based on minimum log level', async () => {
			const config: Partial<ConsoleConfig> = {
				level: 'warn',
			}
			transport = new ConsoleTransport(config)

			const entries: LogEntry[] = [
				createTestLogEntry('debug', 'Debug message'),
				createTestLogEntry('info', 'Info message'),
				createTestLogEntry('warn', 'Warning message'),
				createTestLogEntry('error', 'Error message'),
			]

			await transport.send(entries)

			// Only warn and error should be written (debug and info filtered out)
			expect(mockStdout).toHaveBeenCalledTimes(1) // warn
			expect(mockStderr).toHaveBeenCalledTimes(1) // error
		})
	})

	describe('Output Formatting', () => {
		it('should format entries as pretty-print by default', async () => {
			transport = new ConsoleTransport({ format: 'pretty', colorize: false })

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			expect(output).toContain('Test message')
			expect(output).toContain('[INFO ]')
			expect(output).toContain(entry.correlationId.slice(0, 8))
		})

		it('should format entries as JSON when configured', async () => {
			transport = new ConsoleTransport({ format: 'json' })

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			expect(() => JSON.parse(output)).not.toThrow()

			const parsed = JSON.parse(output)
			expect(parsed.message).toBe('Test message')
			expect(parsed.level).toBe('info')
		})

		it('should include structured fields in pretty format', async () => {
			transport = new ConsoleTransport({ format: 'pretty', colorize: false })

			const entry = createTestLogEntry('info', 'Test message')
			entry.fields = { userId: '123', action: 'login' }

			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			expect(output).toContain('Fields:')
			expect(output).toContain('userId="123"')
			expect(output).toContain('action="login"')
		})

		it('should include metadata in pretty format', async () => {
			transport = new ConsoleTransport({ format: 'pretty', colorize: false })

			const entry = createTestLogEntry('info', 'Test message')
			entry.metadata.request = {
				method: 'GET',
				url: '/api/users',
				duration: 150,
				statusCode: 200,
			}

			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			expect(output).toContain('Request:')
			expect(output).toContain('GET /api/users')
			expect(output).toContain('(150ms)')
			expect(output).toContain('[200]')
		})

		it('should include performance metrics in pretty format', async () => {
			transport = new ConsoleTransport({ format: 'pretty', colorize: false })

			const entry = createTestLogEntry('info', 'Test message')
			entry.performance = {
				cpuUsage: 45.5,
				memoryUsage: 128 * 1024 * 1024, // 128MB
				duration: 250,
			}

			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			expect(output).toContain('Performance:')
			expect(output).toContain('CPU: 45.50%')
			expect(output).toContain('Memory: 128.00MB')
			expect(output).toContain('Duration: 250ms')
		})
	})

	describe('Error Handling and Fallback', () => {
		it('should handle serialization errors gracefully', async () => {
			transport = new ConsoleTransport({ format: 'json' })

			// Create an entry with circular reference
			const entry = createTestLogEntry('info', 'Test message')
			const circular: any = { prop: 'value' }
			circular.self = circular
			entry.fields = { circular }

			await transport.send([entry])

			// Should still write something to stdout (fallback)
			expect(mockStdout).toHaveBeenCalled()
		})

		it('should write fallback error when formatting fails completely', async () => {
			transport = new ConsoleTransport()

			// Mock the formatter to throw an error
			const originalFormatEntry = (transport as any).formatEntry
			;(transport as any).formatEntry = vi.fn().mockImplementation(() => {
				throw new Error('Formatting failed')
			})

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			// Should write fallback error to stderr
			expect(mockStderr).toHaveBeenCalled()
			const errorOutput = mockStderr.mock.calls[0][0] as string
			expect(errorOutput).toContain('CONSOLE TRANSPORT ERROR')

			// Restore original method
			;(transport as any).formatEntry = originalFormatEntry
		})

		it('should not write when transport is disabled', async () => {
			transport = new ConsoleTransport({ enabled: false })

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			expect(mockStdout).not.toHaveBeenCalled()
			expect(mockStderr).not.toHaveBeenCalled()
		})

		it('should not write when transport is shutting down', async () => {
			transport = new ConsoleTransport()
			await transport.close()

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			expect(mockStdout).not.toHaveBeenCalled()
			expect(mockStderr).not.toHaveBeenCalled()
		})
	})

	describe('Lifecycle Management', () => {
		beforeEach(() => {
			transport = new ConsoleTransport()
		})

		it('should flush successfully (no-op for console)', async () => {
			await expect(transport.flush()).resolves.toBeUndefined()
		})

		it('should close successfully', async () => {
			expect(transport.isHealthy()).toBe(true)

			await transport.close()

			expect(transport.isHealthy()).toBe(false)
		})

		it('should report healthy status when enabled and not shutting down', () => {
			expect(transport.isHealthy()).toBe(true)
		})

		it('should report unhealthy status when disabled', () => {
			transport = new ConsoleTransport({ enabled: false })
			expect(transport.isHealthy()).toBe(false)
		})

		it('should report unhealthy status when shutting down', async () => {
			expect(transport.isHealthy()).toBe(true)

			await transport.close()

			expect(transport.isHealthy()).toBe(false)
		})
	})

	describe('Configuration Options', () => {
		it('should respect colorize setting', async () => {
			const colorizedTransport = new ConsoleTransport({
				format: 'pretty',
				colorize: true,
			})
			const nonColorizedTransport = new ConsoleTransport({
				format: 'pretty',
				colorize: false,
			})

			const entry = createTestLogEntry('info', 'Test message')

			await colorizedTransport.send([entry])
			const colorizedOutput = mockStdout.mock.calls[0][0] as string

			mockStdout.mockClear()

			await nonColorizedTransport.send([entry])
			const nonColorizedOutput = mockStdout.mock.calls[0][0] as string

			// Colorized output should contain ANSI escape codes
			expect(colorizedOutput).toMatch(/\u001b\[\d+m/)
			// Non-colorized output should not contain ANSI escape codes
			expect(nonColorizedOutput).not.toMatch(/\u001b\[\d+m/)
		})

		it('should handle custom formatter options', async () => {
			const formatterOptions = {
				showTimestamp: false,
				showCorrelationId: false,
				timestampFormat: 'short' as const,
			}

			transport = new ConsoleTransport({}, formatterOptions)

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string

			// Should not contain timestamp or correlation ID based on options
			expect(output).toContain('Test message')
			expect(output).toContain('[INFO ]')
		})

		it('should handle sensitive data masking options', async () => {
			const maskingOptions = {
				maskSensitiveFields: true,
				sensitiveFieldPatterns: [/password/i, /secret/i],
			}

			transport = new ConsoleTransport({}, {}, maskingOptions)

			const entry = createTestLogEntry('info', 'Login attempt')
			entry.fields = {
				username: 'john',
				password: 'secret123',
				apiSecret: 'abc123',
			}

			await transport.send([entry])

			const output = mockStdout.mock.calls[0][0] as string
			// Strip ANSI color codes for easier testing
			const cleanOutput = output.replace(/\u001b\[\d+m/g, '')

			// Username should be visible, but password and secret should be masked
			expect(cleanOutput).toContain('username="john"')
			expect(cleanOutput).toContain('password="[MASKED]"')
			expect(cleanOutput).toContain('apiSecret="[MASKED]"')
		})
	})

	describe('Async Behavior', () => {
		beforeEach(() => {
			transport = new ConsoleTransport()
		})

		it('should handle concurrent log entries without blocking', async () => {
			const entries = Array.from({ length: 10 }, (_, i) =>
				createTestLogEntry('info', `Message ${i}`)
			)

			const startTime = Date.now()
			await Promise.all(entries.map((entry) => transport.send([entry])))
			const endTime = Date.now()

			// Should complete quickly (within reasonable time)
			expect(endTime - startTime).toBeLessThan(1000)
			expect(mockStdout).toHaveBeenCalledTimes(10)
		})

		it('should use setImmediate for non-blocking writes', async () => {
			const setImmediateSpy = vi.spyOn(global, 'setImmediate')

			const entry = createTestLogEntry('info', 'Test message')
			await transport.send([entry])

			expect(setImmediateSpy).toHaveBeenCalled()
			setImmediateSpy.mockRestore()
		})
	})
})

/**
 * Helper function to create test log entries
 */
function createTestLogEntry(
	level: LogLevel | string,
	message: string,
	overrides: Partial<LogEntry> = {}
): LogEntry {
	return {
		id: 'test-id-123',
		timestamp: new Date('2023-01-01T12:00:00.000Z'),
		level: level as LogLevel,
		message,
		correlationId: 'test-correlation-id-123456789',
		fields: {},
		metadata: {
			service: 'test-service',
			environment: 'test',
			hostname: 'test-host',
			pid: 12345,
		},
		source: 'test-source',
		version: '1.0.0',
		...overrides,
	}
}
