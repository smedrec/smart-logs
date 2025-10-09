import { beforeEach, describe, expect, it } from 'vitest'

import { CorrelationManager } from '../correlation-manager.js'

describe('CorrelationManager', () => {
	let correlationManager: CorrelationManager

	beforeEach(() => {
		correlationManager = CorrelationManager.getInstance()
	})

	describe('singleton pattern', () => {
		it('should return the same instance', () => {
			const instance1 = CorrelationManager.getInstance()
			const instance2 = CorrelationManager.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe('ID generation', () => {
		it('should generate unique correlation IDs', () => {
			const id1 = correlationManager.generateCorrelationId()
			const id2 = correlationManager.generateCorrelationId()

			expect(id1).toBeDefined()
			expect(id2).toBeDefined()
			expect(id1).not.toBe(id2)
			expect(typeof id1).toBe('string')
			expect(typeof id2).toBe('string')
			expect(id1).toMatch(/^corr_[0-9a-f-]{36}$/)
		})

		it('should generate unique request IDs', () => {
			const id1 = correlationManager.generateRequestId()
			const id2 = correlationManager.generateRequestId()

			expect(id1).toBeDefined()
			expect(id2).toBeDefined()
			expect(id1).not.toBe(id2)
			expect(id1).toMatch(/^req_[0-9a-f-]{36}$/)
		})

		it('should generate trace contexts', () => {
			const context = correlationManager.generateTraceContext()

			expect(context.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
			expect(context.traceFlags).toBe(1)
		})

		it('should generate trace context with parent span', () => {
			const parentSpanId = '00f067aa0ba902b7'
			const context = correlationManager.generateTraceContext(parentSpanId)

			expect(context.parentSpanId).toBe(parentSpanId)
		})
	})

	describe('context management', () => {
		it('should return undefined when no context is set', () => {
			const context = correlationManager.getContext()
			expect(context).toBeUndefined()
		})

		it('should run function with context', () => {
			const testContext = {
				correlationId: 'test-correlation-123',
				requestId: 'test-request-456',
			}

			const result = correlationManager.runWithContext(testContext, () => {
				const context = correlationManager.getContext()
				return context
			})

			expect(result).toEqual(testContext)
		})

		it('should isolate context between different runs', () => {
			const context1 = { correlationId: 'id1', requestId: 'req1' }
			const context2 = { correlationId: 'id2', requestId: 'req2' }

			const result1 = correlationManager.runWithContext(context1, () => {
				return correlationManager.getContext()
			})

			const result2 = correlationManager.runWithContext(context2, () => {
				return correlationManager.getContext()
			})

			expect(result1).toEqual(context1)
			expect(result2).toEqual(context2)
		})
	})

	describe('correlation ID management', () => {
		it('should get correlation ID from context', () => {
			const testCorrelationId = 'test-correlation-789'

			correlationManager.runWithContext({ correlationId: testCorrelationId }, () => {
				const id = correlationManager.getCorrelationId()
				expect(id).toBe(testCorrelationId)
			})
		})

		it('should generate new correlation ID when no context', () => {
			const id = correlationManager.getCorrelationId()
			expect(id).toBeDefined()
			expect(typeof id).toBe('string')
		})

		it('should set correlation ID in current context', () => {
			const testCorrelationId = 'new-correlation-id'

			correlationManager.runWithContext({ correlationId: 'old-id' }, () => {
				correlationManager.setCorrelationId(testCorrelationId)
				const context = correlationManager.getContext()
				expect(context?.correlationId).toBe(testCorrelationId)
			})
		})
	})

	describe('request ID management', () => {
		it('should get request ID from context', () => {
			const testRequestId = 'test-request-123'

			correlationManager.runWithContext({ requestId: testRequestId }, () => {
				const id = correlationManager.getRequestId()
				expect(id).toBe(testRequestId)
			})
		})

		it('should return undefined when no request ID in context', () => {
			correlationManager.runWithContext({ correlationId: 'test' }, () => {
				const id = correlationManager.getRequestId()
				expect(id).toBeUndefined()
			})
		})

		it('should set request ID in current context', () => {
			const testRequestId = 'new-request-id'

			correlationManager.runWithContext({ correlationId: 'test' }, () => {
				correlationManager.setRequestId(testRequestId)
				const context = correlationManager.getContext()
				expect(context?.requestId).toBe(testRequestId)
			})
		})
	})

	describe('trace context management', () => {
		it('should parse W3C trace context', () => {
			const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
			const context = correlationManager.parseTraceContext(traceParent)

			expect(context).not.toBeNull()
			expect(context!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
			expect(context!.parentSpanId).toBe('00f067aa0ba902b7')
		})

		it('should create child trace context', () => {
			const parentContext = correlationManager.generateTraceContext()
			const childContext = correlationManager.createChildTraceContext(parentContext)

			expect(childContext.traceId).toBe(parentContext.traceId)
			expect(childContext.spanId).not.toBe(parentContext.spanId)
			expect(childContext.parentSpanId).toBe(parentContext.spanId)
		})

		it('should set trace context in current context', () => {
			const traceContext = correlationManager.generateTraceContext()

			correlationManager.runWithContext({ correlationId: 'test' }, () => {
				correlationManager.setTraceContext(traceContext)
				const context = correlationManager.getContext()
				expect(context?.traceId).toBe(traceContext.traceId)
				expect(context?.spanId).toBe(traceContext.spanId)
			})
		})

		it('should get trace and span IDs from context', () => {
			const traceContext = correlationManager.generateTraceContext()

			correlationManager.runWithContext(
				{
					correlationId: 'test',
					traceId: traceContext.traceId,
					spanId: traceContext.spanId,
				},
				() => {
					expect(correlationManager.getTraceId()).toBe(traceContext.traceId)
					expect(correlationManager.getSpanId()).toBe(traceContext.spanId)
				}
			)
		})
	})

	describe('request context generation', () => {
		it('should generate complete request context', () => {
			const context = correlationManager.generateRequestContext()

			expect(context.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/)
			expect(context.requestId).toMatch(/^req_[0-9a-f-]{36}$/)
			expect(context.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(context.spanId).toMatch(/^[0-9a-f]{16}$/)
		})

		it('should use provided trace parent', () => {
			const traceParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
			const context = correlationManager.generateRequestContext(traceParent)

			expect(context.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
		})

		it('should run function with request context', () => {
			const result = correlationManager.runWithRequestContext(undefined, () => {
				const context = correlationManager.getContext()
				return context
			})

			expect(result?.correlationId).toMatch(/^corr_[0-9a-f-]{36}$/)
			expect(result?.requestId).toMatch(/^req_[0-9a-f-]{36}$/)
			expect(result?.traceId).toMatch(/^trace_[0-9a-f]{32}$/)
			expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/)
		})
	})
})
