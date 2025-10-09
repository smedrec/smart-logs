import { describe, expect, it } from 'vitest'

import { LogLevel } from '../../types/logger.js'
import { LogSerializer } from '../serializer.js'

import type { LogEntry } from '../../types/log-entry.js'

describe('LogSerializer', () => {
	const createTestLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
		id: 'test-id-123',
		timestamp: new Date('2023-01-01T00:00:00.000Z'),
		level: LogLevel.INFO,
		message: 'Test message',
		correlationId: 'test-correlation-123',
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
	})

	describe('serialize method', () => {
		it('should serialize basic log entry correctly', () => {
			const entry = createTestLogEntry()
			const serialized = LogSerializer.serialize(entry)
			const parsed = JSON.parse(serialized)

			expect(parsed['@timestamp']).toBe('2023-01-01T00:00:00.000Z')
			expect(parsed['@id']).toBe('test-id-123')
			expect(parsed.level).toBe('info')
			expect(parsed.message).toBe('Test message')
			expect(parsed.correlationId).toBe('test-correlation-123')
			expect(parsed.source).toBe('test-source')
			expect(parsed.version).toBe('1.0.0')
		})

		it('should include optional fields when present', () => {
			const entry = createTestLogEntry({
				requestId: 'test-request-456',
				traceId: 'test-trace-789',
				spanId: 'test-span-012',
			})

			const serialized = LogSerializer.serialize(entry)
			const parsed = JSON.parse(serialized)

			expect(parsed.requestId).toBe('test-request-456')
			expect(parsed.traceId).toBe('test-trace-789')
			expect(parsed.spanId).toBe('test-span-012')
		})

		it('should include fields when present', () => {
			const entry = createTestLogEntry({
				fields: {
					userId: 123,
					action: 'login',
					success: true,
				},
			})

			const serialized = LogSerializer.serialize(entry)
			const parsed = JSON.parse(serialized)

			expect(parsed.fields.userId).toBe(123)
			expect(parsed.fields.action).toBe('login')
			expect(parsed.fields.success).toBe(true)
		})
	})

	describe('compression functionality', () => {
		it('should compress string data', () => {
			const testData = 'This is a test string for compression'
			const compressed = LogSerializer.compress(testData)

			expect(compressed).toBeInstanceOf(Buffer)
			expect(compressed.length).toBeGreaterThan(0)
		})

		it('should compress batch data', () => {
			const entries = ['entry1', 'entry2', 'entry3']
			const compressed = LogSerializer.compressBatch(entries)

			expect(compressed).toBeInstanceOf(Buffer)
			expect(compressed.length).toBeGreaterThan(0)
		})
	})

	describe('batch serialization', () => {
		it('should serialize multiple entries', () => {
			const entries = [
				createTestLogEntry({ message: 'Message 1' }),
				createTestLogEntry({ message: 'Message 2' }),
				createTestLogEntry({ message: 'Message 3' }),
			]

			const serialized = LogSerializer.serializeBatch(entries)

			expect(serialized).toHaveLength(3)
			expect(serialized.every((s) => typeof s === 'string')).toBe(true)

			const parsed = serialized.map((s) => JSON.parse(s))
			expect(parsed[0].message).toBe('Message 1')
			expect(parsed[1].message).toBe('Message 2')
			expect(parsed[2].message).toBe('Message 3')
		})
	})
})
