import { beforeEach, describe, expect, it } from 'vitest'

import { IdGenerator } from '../id-generator.js'

describe('IdGenerator', () => {
	let generator: IdGenerator

	beforeEach(() => {
		generator = new IdGenerator()
	})

	describe('Configuration', () => {
		it('should use default configuration', () => {
			const config = generator.getConfig()
			expect(config.correlationIdPrefix).toBe('corr')
			expect(config.requestIdPrefix).toBe('req')
			expect(config.traceIdPrefix).toBe('trace')
			expect(config.useShortFormat).toBe(false)
		})

		it('should accept custom configuration', () => {
			generator = new IdGenerator({
				correlationIdPrefix: 'custom-corr',
				requestIdPrefix: 'custom-req',
				traceIdPrefix: 'custom-trace',
				useShortFormat: true,
			})

			const config = generator.getConfig()
			expect(config.correlationIdPrefix).toBe('custom-corr')
			expect(config.requestIdPrefix).toBe('custom-req')
			expect(config.traceIdPrefix).toBe('custom-trace')
			expect(config.useShortFormat).toBe(true)
		})

		it('should handle empty prefixes', () => {
			generator = new IdGenerator({
				correlationIdPrefix: '',
				requestIdPrefix: '',
				traceIdPrefix: '',
			})

			const correlationId = generator.generateCorrelationId()
			const requestId = generator.generateRequestId()
			const traceId = generator.generateTraceId()

			expect(correlationId).not.toContain('_')
			expect(requestId).not.toContain('_')
			expect(traceId).not.toContain('_')
		})
	})

	describe('Correlation ID Generation', () => {
		it('should generate unique correlation IDs', () => {
			const id1 = generator.generateCorrelationId()
			const id2 = generator.generateCorrelationId()

			expect(id1).not.toBe(id2)
			expect(id1).toMatch(/^corr_[0-9a-f-]{36}$/)
			expect(id2).toMatch(/^corr_[0-9a-f-]{36}$/)
		})

		it('should generate short format when configured', () => {
			generator = new IdGenerator({ useShortFormat: true })
			const id = generator.generateCorrelationId()

			expect(id).toMatch(/^corr_[0-9a-f]{8}$/)
		})

		it('should generate collision-resistant IDs', () => {
			const ids = new Set<string>()
			const count = 1000

			for (let i = 0; i < count; i++) {
				ids.add(generator.generateCorrelationId())
			}

			expect(ids.size).toBe(count) // All IDs should be unique
		})
	})

	describe('Request ID Generation', () => {
		it('should generate unique request IDs', () => {
			const id1 = generator.generateRequestId()
			const id2 = generator.generateRequestId()

			expect(id1).not.toBe(id2)
			expect(id1).toMatch(/^req_[0-9a-f-]{36}$/)
			expect(id2).toMatch(/^req_[0-9a-f-]{36}$/)
		})

		it('should generate short format when configured', () => {
			generator = new IdGenerator({ useShortFormat: true })
			const id = generator.generateRequestId()

			expect(id).toMatch(/^req_[0-9a-f]{8}$/)
		})
	})

	describe('Trace ID Generation', () => {
		it('should generate valid trace IDs', () => {
			const traceId = generator.generateTraceId()

			expect(traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(generator.isValidTraceId(traceId)).toBe(true)
		})

		it('should generate unique trace IDs', () => {
			const id1 = generator.generateTraceId()
			const id2 = generator.generateTraceId()

			expect(id1).not.toBe(id2)
		})

		it('should generate 32-character hex strings', () => {
			generator = new IdGenerator({ traceIdPrefix: '' })
			const traceId = generator.generateTraceId()

			expect(traceId).toMatch(/^[0-9a-f]{32}$/)
			expect(traceId.length).toBe(32)
		})
	})

	describe('Span ID Generation', () => {
		it('should generate valid span IDs', () => {
			const spanId = generator.generateSpanId()

			expect(spanId).toMatch(/^[0-9a-f]{16}$/)
			expect(spanId.length).toBe(16)
			expect(generator.isValidSpanId(spanId)).toBe(true)
		})

		it('should generate unique span IDs', () => {
			const id1 = generator.generateSpanId()
			const id2 = generator.generateSpanId()

			expect(id1).not.toBe(id2)
		})
	})

	describe('Trace Context Generation', () => {
		it('should generate complete trace context', () => {
			const context = generator.generateTraceContext()

			expect(context.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
			expect(context.traceFlags).toBe(1)
			expect(context.parentSpanId).toBeUndefined()
		})

		it('should include parent span ID when provided', () => {
			const parentSpanId = generator.generateSpanId()
			const context = generator.generateTraceContext(parentSpanId)

			expect(context.parentSpanId).toBe(parentSpanId)
		})

		it('should create child trace context', () => {
			const parentContext = generator.generateTraceContext()
			const childContext = generator.createChildTraceContext(parentContext)

			expect(childContext.traceId).toBe(parentContext.traceId)
			expect(childContext.spanId).not.toBe(parentContext.spanId)
			expect(childContext.parentSpanId).toBe(parentContext.spanId)
			expect(childContext.traceFlags).toBe(parentContext.traceFlags)
		})
	})

	describe('W3C Trace Context Parsing', () => {
		it('should parse valid trace context header', () => {
			const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
			const context = generator.parseTraceContext(traceParent)

			expect(context).not.toBeNull()
			expect(context!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
			expect(context!.parentSpanId).toBe('00f067aa0ba902b7')
			expect(context!.traceFlags).toBe(1)
			expect(context!.spanId).toMatch(/^[0-9a-f]{16}$/)
		})

		it('should return null for invalid trace context header', () => {
			expect(generator.parseTraceContext('invalid')).toBeNull()
			expect(generator.parseTraceContext('01-invalid-format-00')).toBeNull()
			expect(generator.parseTraceContext('00-short-span-01')).toBeNull()
		})

		it('should format trace context as W3C header', () => {
			const context = {
				traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
				spanId: '00f067aa0ba902b7',
				traceFlags: 1,
			}

			const header = generator.formatTraceContext(context)
			expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
		})

		it('should handle trace flags correctly', () => {
			const context = {
				traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
				spanId: '00f067aa0ba902b7',
				traceFlags: 0,
			}

			const header = generator.formatTraceContext(context)
			expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00')
		})
	})

	describe('Other ID Types', () => {
		it('should generate session IDs', () => {
			const sessionId = generator.generateSessionId()
			expect(sessionId).toMatch(/^sess_[0-9a-f-]{36}$/)
		})

		it('should generate transaction IDs', () => {
			const txnId = generator.generateTransactionId()
			expect(txnId).toMatch(/^txn_[0-9a-f-]{36}$/)
		})

		it('should generate batch IDs', () => {
			const batchId = generator.generateBatchId()
			expect(batchId).toMatch(/^batch_[0-9a-f-]{36}$/)
		})

		it('should generate short format for other ID types', () => {
			generator = new IdGenerator({ useShortFormat: true })

			const sessionId = generator.generateSessionId()
			const txnId = generator.generateTransactionId()
			const batchId = generator.generateBatchId()

			expect(sessionId).toMatch(/^sess_[0-9a-f]{8}$/)
			expect(txnId).toMatch(/^txn_[0-9a-f]{8}$/)
			expect(batchId).toMatch(/^batch_[0-9a-f]{8}$/)
		})
	})

	describe('Validation Methods', () => {
		it('should validate UUID format', () => {
			const validUuid = '550e8400-e29b-41d4-a716-446655440000'
			const invalidUuid = 'not-a-uuid'

			expect(generator.isValidUuid(validUuid)).toBe(true)
			expect(generator.isValidUuid(invalidUuid)).toBe(false)
		})

		it('should validate trace ID format', () => {
			const validTraceId = 'trace_4bf92f3577b34da6a3ce929d0e0e4736'
			const validTraceIdNoPrefix = '4bf92f3577b34da6a3ce929d0e0e4736'
			const invalidTraceId = 'trace_short'

			expect(generator.isValidTraceId(validTraceId)).toBe(true)
			expect(generator.isValidTraceId(validTraceIdNoPrefix)).toBe(true)
			expect(generator.isValidTraceId(invalidTraceId)).toBe(false)
		})

		it('should validate span ID format', () => {
			const validSpanId = '00f067aa0ba902b7'
			const invalidSpanId = 'short'

			expect(generator.isValidSpanId(validSpanId)).toBe(true)
			expect(generator.isValidSpanId(invalidSpanId)).toBe(false)
		})
	})

	describe('ID Extraction', () => {
		it('should extract correlation ID from prefixed ID', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000'
			const prefixedId = `corr_${uuid}`

			expect(generator.extractCorrelationId(prefixedId)).toBe(uuid)
			expect(generator.extractCorrelationId(uuid)).toBe(uuid) // No prefix
		})

		it('should extract request ID from prefixed ID', () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000'
			const prefixedId = `req_${uuid}`

			expect(generator.extractRequestId(prefixedId)).toBe(uuid)
			expect(generator.extractRequestId(uuid)).toBe(uuid) // No prefix
		})
	})

	describe('Request Context Generation', () => {
		it('should generate complete request context', () => {
			const context = generator.generateRequestContext()

			expect(context.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/)
			expect(context.requestId).toMatch(/^req_[0-9a-f-]{36}$/)
			expect(context.traceContext.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(context.traceContext.spanId).toMatch(/^[0-9a-f]{16}$/)
		})

		it('should use provided trace parent', () => {
			const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
			const context = generator.generateRequestContext(traceParent)

			expect(context.traceContext.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
			expect(context.traceContext.parentSpanId).toBe('00f067aa0ba902b7')
		})

		it('should generate new trace context for invalid trace parent', () => {
			const context = generator.generateRequestContext('invalid-trace-parent')

			expect(context.traceContext.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(context.traceContext.parentSpanId).toBeUndefined()
		})
	})
})
