import { beforeEach, describe, expect, it } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { ConsoleFormatter } from '../console-formatter.js'

import type { ConsoleConfig } from '../../types/config.js'
import type { LogEntry } from '../../types/log-entry.js'

/**
 * Test suite for ConsoleFormatter
 * Addresses requirement 10.1 and 10.3: Unit test coverage for formatting options
 */
describe('ConsoleFormatter', () => {
	let formatter: ConsoleFormatter
	let baseConfig: ConsoleConfig

	beforeEach(() => {
		baseConfig = {
			name: 'console',
			enabled: true,
			format: 'pretty',
			colorize: false, // Disable colors for easier testing
		}
	})

	describe('Pretty Format Output', () => {
		beforeEach(() => {
			formatter = new ConsoleFormatter(baseConfig)
		})

		it('should format basic log entry with all components', () => {
			const entry = createTestLogEntry('info', 'Test message')
			const output = formatter.formatPretty(entry)

			expect(output).toContain('Test message')
			expect(output).toContain('[INFO ]')
			expect(output).toContain('2023-01-01 12:00:00.000')
			expect(output).toContain('[test-cor]') // Short correlation ID
		})

		it('should include request ID when present', () => {
			const entry = createTestLogEntry('info', 'Test message')
			entry.requestId = 'req-123456789'

			const output = formatter.formatPretty(entry)

			expect(output).toContain('[req:req-1234]') // Short request ID
		})

		it('should format structured fields', () => {
			const entry = createTestLogEntry('info', 'Test message')
			entry.fields = {
				userId: '123',
				action: 'login',
				count: 42,
				success: true,
				data: null,
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Fields:')
			expect(output).toContain('userId="123"')
			expect(output).toContain('action="login"')
			expect(output).toContain('count=42')
			expect(output).toContain('success=true')
			expect(output).toContain('data=null')
		})

		it('should format request metadata', () => {
			const entry = createTestLogEntry('info', 'Request processed')
			entry.metadata.request = {
				method: 'POST',
				url: '/api/users',
				duration: 150,
				statusCode: 201,
				ip: '192.168.1.1',
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Request: POST /api/users')
			expect(output).toContain('(150ms)')
			expect(output).toContain('[201]')
			expect(output).toContain('from 192.168.1.1')
		})

		it('should format database metadata', () => {
			const entry = createTestLogEntry('info', 'Database operation')
			entry.metadata.database = {
				operation: 'SELECT',
				table: 'users',
				duration: 25,
				rowsAffected: 5,
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Database: SELECT')
			expect(output).toContain('on users')
			expect(output).toContain('(25ms)')
			expect(output).toContain('[5 rows]')
		})

		it('should format security metadata', () => {
			const entry = createTestLogEntry('warn', 'Security event')
			entry.metadata.security = {
				event: 'failed_login',
				severity: 'medium',
				userId: 'user123',
				action: 'authenticate',
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Security: failed_login')
			expect(output).toContain('[medium]')
			expect(output).toContain('user:user123')
			expect(output).toContain('action:authenticate')
		})

		it('should format service metadata', () => {
			const entry = createTestLogEntry('info', 'Service info')
			entry.metadata.service = 'auth-service'
			entry.metadata.environment = 'production'
			entry.metadata.hostname = 'server-01'

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Service:')
			expect(output).toContain('service:auth-service')
			expect(output).toContain('env:production')
			expect(output).toContain('host:server-01')
		})

		it('should format performance metrics', () => {
			const entry = createTestLogEntry('info', 'Performance data')
			entry.performance = {
				cpuUsage: 75.5,
				memoryUsage: 256 * 1024 * 1024, // 256MB
				duration: 500,
				operationCount: 10,
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Performance:')
			expect(output).toContain('CPU: 75.50%')
			expect(output).toContain('Memory: 256.00MB')
			expect(output).toContain('Duration: 500ms')
			expect(output).toContain('Operations: 10')
		})
	})

	describe('JSON Format Output', () => {
		beforeEach(() => {
			formatter = new ConsoleFormatter({ ...baseConfig, format: 'json' })
		})

		it('should format entry as valid JSON', () => {
			const entry = createTestLogEntry('info', 'Test message')
			const output = formatter.formatJson(entry)

			expect(() => JSON.parse(output)).not.toThrow()

			const parsed = JSON.parse(output)
			expect(parsed.message).toBe('Test message')
			expect(parsed.level).toBe('info')
			expect(parsed.correlationId).toBe(entry.correlationId)
		})

		it('should include all entry fields in JSON', () => {
			const entry = createTestLogEntry('info', 'Test message')
			entry.fields = { userId: '123', action: 'test' }
			entry.requestId = 'req-123'

			const output = formatter.formatJson(entry)
			const parsed = JSON.parse(output)

			expect(parsed.fields.userId).toBe('123')
			expect(parsed.fields.action).toBe('test')
			expect(parsed.requestId).toBe('req-123')
		})

		it('should handle serialization errors gracefully', () => {
			const entry = createTestLogEntry('info', 'Test message')

			// Create circular reference
			const circular: any = { prop: 'value' }
			circular.self = circular
			entry.fields = { circular }

			const output = formatter.formatJson(entry)

			// Should still produce valid JSON (fallback)
			expect(() => JSON.parse(output)).not.toThrow()

			const parsed = JSON.parse(output)
			expect(parsed.message).toBe('Test message')
			if (parsed['@error']) {
				expect(parsed['@error']).toContain('Serialization failed')
			}
		})
	})

	describe('Formatter Options', () => {
		it('should respect timestamp format options', () => {
			const isoFormatter = new ConsoleFormatter(baseConfig, { timestampFormat: 'iso' })
			const shortFormatter = new ConsoleFormatter(baseConfig, { timestampFormat: 'short' })
			const localFormatter = new ConsoleFormatter(baseConfig, { timestampFormat: 'local' })

			const entry = createTestLogEntry('info', 'Test message')

			const isoOutput = isoFormatter.formatPretty(entry)
			const shortOutput = shortFormatter.formatPretty(entry)
			const localOutput = localFormatter.formatPretty(entry)

			expect(isoOutput).toContain('2023-01-01 12:00:00.000')
			expect(shortOutput).toContain('12:00:00')
			expect(localOutput).toContain(':') // Should contain time separator
		})

		it('should respect field visibility options', () => {
			const minimalFormatter = new ConsoleFormatter(baseConfig, {
				showTimestamp: false,
				showCorrelationId: false,
				showRequestId: false,
				showFields: false,
				showMetadata: false,
				showPerformance: false,
			})

			const entry = createTestLogEntry('info', 'Test message')
			entry.requestId = 'req-123'
			entry.fields = { userId: '123' }
			entry.performance = { cpuUsage: 50 }

			const output = minimalFormatter.formatPretty(entry)

			expect(output).toContain('Test message')
			expect(output).toContain('[INFO ]')
			expect(output).not.toContain('2023-01-01')
			expect(output).not.toContain('[test-cor]')
			expect(output).not.toContain('[req:')
			expect(output).not.toContain('Fields:')
			expect(output).not.toContain('Performance:')
		})

		it('should respect text truncation options', () => {
			const truncatingFormatter = new ConsoleFormatter(baseConfig, {
				maxMessageLength: 10,
				maxFieldLength: 5,
			})

			const entry = createTestLogEntry(
				'info',
				'This is a very long message that should be truncated'
			)
			entry.fields = { longField: 'This is a very long field value' }

			const output = truncatingFormatter.formatPretty(entry)

			expect(output).toContain('This is...')
			expect(output).toContain('longField="Th..."')
		})

		it('should apply field filtering', () => {
			const filteringFormatter = new ConsoleFormatter(baseConfig, {
				fieldFilter: ['userId', 'action'],
			})

			const entry = createTestLogEntry('info', 'Test message')
			entry.fields = {
				userId: '123',
				action: 'login',
				password: 'secret',
				internal: 'data',
			}

			const output = filteringFormatter.formatPretty(entry)

			expect(output).toContain('userId="123"')
			expect(output).toContain('action="login"')
			expect(output).not.toContain('password')
			expect(output).not.toContain('internal')
		})
	})

	describe('Sensitive Data Masking', () => {
		it('should mask sensitive fields by default', () => {
			const maskingFormatter = new ConsoleFormatter(
				baseConfig,
				{},
				{
					maskSensitiveFields: true,
				}
			)

			const entry = createTestLogEntry('info', 'User data')
			entry.fields = {
				username: 'john',
				password: 'secret123',
				apiKey: 'abc123',
				token: 'xyz789',
				normalField: 'visible',
			}

			const output = maskingFormatter.formatPretty(entry)

			expect(output).toContain('username="john"')
			expect(output).toContain('normalField="visible"')
			expect(output).toContain('password="[MASKED]"')
			expect(output).toContain('apiKey="[MASKED]"')
			expect(output).toContain('token="[MASKED]"')
		})

		it('should respect custom sensitive field patterns', () => {
			const customMaskingFormatter = new ConsoleFormatter(
				baseConfig,
				{},
				{
					maskSensitiveFields: true,
					sensitiveFieldPatterns: [/custom/i, /private/i],
				}
			)

			const entry = createTestLogEntry('info', 'Custom masking')
			entry.fields = {
				customField: 'should be masked',
				privateData: 'should be masked',
				password: 'should not be masked', // Not in custom patterns
				publicField: 'visible',
			}

			const output = customMaskingFormatter.formatPretty(entry)

			expect(output).toContain('publicField="visible"')
			expect(output).toContain('password="should not be masked"')
			expect(output).toContain('customField="[MASKED]"')
			expect(output).toContain('privateData="[MASKED]"')
		})

		it('should preserve length when configured', () => {
			const lengthPreservingFormatter = new ConsoleFormatter(
				baseConfig,
				{},
				{
					maskSensitiveFields: true,
					preserveLength: true,
					maskingChar: '*',
				}
			)

			const entry = createTestLogEntry('info', 'Length preservation')
			entry.fields = {
				password: 'secret123', // 9 characters
			}

			const output = lengthPreservingFormatter.formatPretty(entry)

			expect(output).toContain('password="*********"') // 9 asterisks
		})

		it('should disable masking when configured', () => {
			const noMaskingFormatter = new ConsoleFormatter(
				baseConfig,
				{},
				{
					maskSensitiveFields: false,
				}
			)

			const entry = createTestLogEntry('info', 'No masking')
			entry.fields = {
				password: 'secret123',
				token: 'abc123',
			}

			const output = noMaskingFormatter.formatPretty(entry)

			expect(output).toContain('password="secret123"')
			expect(output).toContain('token="abc123"')
		})
	})

	describe('Color Support', () => {
		it('should apply colors when enabled', () => {
			const colorFormatter = new ConsoleFormatter({ ...baseConfig, colorize: true })

			const entry = createTestLogEntry('error', 'Error message')
			const output = colorFormatter.formatPretty(entry)

			// Should contain ANSI escape codes for colors
			expect(output).toMatch(/\u001b\[\d+m/)
		})

		it('should not apply colors when disabled', () => {
			const noColorFormatter = new ConsoleFormatter({ ...baseConfig, colorize: false })

			const entry = createTestLogEntry('error', 'Error message')
			const output = noColorFormatter.formatPretty(entry)

			// Should not contain ANSI escape codes
			expect(output).not.toMatch(/\u001b\[\d+m/)
		})
	})

	describe('Log Level Indicators', () => {
		beforeEach(() => {
			formatter = new ConsoleFormatter(baseConfig)
		})

		it('should include appropriate indicators for each log level', () => {
			const levels: Array<[LogLevel, string]> = [
				[LogLevel.DEBUG, '🔍'],
				[LogLevel.INFO, 'ℹ️'],
				[LogLevel.WARN, '⚠️'],
				[LogLevel.ERROR, '❌'],
				[LogLevel.FATAL, '💀'],
			]

			levels.forEach(([level, expectedIndicator]) => {
				const entry = createTestLogEntry(level, `${level} message`)
				const output = formatter.formatPretty(entry)

				expect(output).toContain(expectedIndicator)
				expect(output).toContain(`[${level.toUpperCase().padEnd(5)}]`)
			})
		})
	})

	describe('Edge Cases', () => {
		beforeEach(() => {
			formatter = new ConsoleFormatter(baseConfig)
		})

		it('should handle empty fields object', () => {
			const entry = createTestLogEntry('info', 'Test message')
			entry.fields = {}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Test message')
			expect(output).not.toContain('Fields:')
		})

		it('should handle missing optional properties', () => {
			const entry = createTestLogEntry('info', 'Test message')
			delete entry.requestId
			delete entry.performance
			entry.metadata = {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 12345,
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('Test message')
			expect(output).not.toContain('[req:')
			expect(output).not.toContain('Performance:')
		})

		it('should handle complex nested objects in fields', () => {
			const entry = createTestLogEntry('info', 'Complex data')
			entry.fields = {
				nested: {
					level1: {
						level2: 'deep value',
						array: [1, 2, 3],
					},
				},
			}

			const output = formatter.formatPretty(entry)

			expect(output).toContain('nested=')
			expect(output).toContain('deep value')
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
