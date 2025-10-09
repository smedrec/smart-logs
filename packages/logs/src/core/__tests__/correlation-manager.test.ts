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

	describe('correlation ID generation', () => {
		it('should generate unique correlation IDs', () => {
			const id1 = correlationManager.generateCorrelationId()
			const id2 = correlationManager.generateCorrelationId()

			expect(id1).toBeDefined()
			expect(id2).toBeDefined()
			expect(id1).not.toBe(id2)
			expect(typeof id1).toBe('string')
			expect(typeof id2).toBe('string')
		})

		it('should generate UUIDs', () => {
			const id = correlationManager.generateCorrelationId()
			// UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			expect(id).toMatch(uuidPattern)
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
})
