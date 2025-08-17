/**
 * Tests for distributed tracing implementation
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { AuditTracer, AuditSpan, trace } from '../tracer.js'

describe('AuditTracer', () => {
	let tracer: AuditTracer

	beforeEach(() => {
		tracer = new AuditTracer({
			enabled: true,
			serviceName: 'test-service',
			sampleRate: 1.0,
			exporterType: 'console',
		})
	})

	describe('startSpan', () => {
		it('should create a new span with correct properties', () => {
			const span = tracer.startSpan('test-operation')

			expect(span.operationName).toBe('test-operation')
			expect(span.traceId).toBeDefined()
			expect(span.spanId).toBeDefined()
			expect(span.startTime).toBeDefined()
			expect(span.tags['service.name']).toBe('test-service')
		})

		it('should create child span with parent context', () => {
			const parentContext = {
				traceId: 'parent-trace-id',
				spanId: 'parent-span-id',
			}

			const span = tracer.startSpan('child-operation', parentContext)

			expect(span.traceId).toBe('parent-trace-id')
			expect(span.parentSpanId).toBe('parent-span-id')
		})
	})

	describe('finishSpan', () => {
		it('should finish span and calculate duration', () => {
			const span = tracer.startSpan('test-operation')

			// Wait a bit to ensure duration > 0
			setTimeout(() => {
				tracer.finishSpan(span)

				expect(span.endTime).toBeDefined()
				expect(span.duration).toBeDefined()
				expect(span.duration!).toBeGreaterThan(0)
			}, 10)
		})
	})

	describe('injectContext', () => {
		it('should create trace context from span', () => {
			const span = tracer.startSpan('test-operation')
			const context = tracer.injectContext(span)

			expect(context.traceId).toBe(span.traceId)
			expect(context.spanId).toBe(span.spanId)
			expect(context.parentSpanId).toBe(span.parentSpanId)
		})
	})

	describe('extractContext', () => {
		it('should extract context from headers', () => {
			const headers = {
				'x-trace-id': 'test-trace-id',
				'x-span-id': 'test-span-id',
				'x-parent-span-id': 'test-parent-span-id',
			}

			const context = tracer.extractContext(headers)

			expect(context).toBeDefined()
			expect(context!.traceId).toBe('test-trace-id')
			expect(context!.spanId).toBe('test-span-id')
			expect(context!.parentSpanId).toBe('test-parent-span-id')
		})

		it('should return null for invalid headers', () => {
			const headers = {
				'some-other-header': 'value',
			}

			const context = tracer.extractContext(headers)

			expect(context).toBeNull()
		})
	})

	describe('createChildSpan', () => {
		it('should create child span with parent relationship', () => {
			const parentSpan = tracer.startSpan('parent-operation')
			const childSpan = tracer.createChildSpan(parentSpan, 'child-operation')

			expect(childSpan.traceId).toBe(parentSpan.traceId)
			expect(childSpan.parentSpanId).toBe(parentSpan.spanId)
			expect(childSpan.operationName).toBe('child-operation')
			expect(childSpan.tags['parent.operation']).toBe('parent-operation')
		})
	})
})

describe('AuditSpan', () => {
	let span: AuditSpan

	beforeEach(() => {
		span = new AuditSpan('test-operation')
	})

	describe('setTag', () => {
		it('should set a single tag', () => {
			span.setTag('key', 'value')
			expect(span.tags.key).toBe('value')
		})
	})

	describe('setTags', () => {
		it('should set multiple tags', () => {
			const tags = { key1: 'value1', key2: 'value2' }
			span.setTags(tags)

			expect(span.tags.key1).toBe('value1')
			expect(span.tags.key2).toBe('value2')
		})
	})

	describe('log', () => {
		it('should add log entry', () => {
			span.log('info', 'test message', { field: 'value' })

			expect(span.logs).toHaveLength(1)
			expect(span.logs[0].level).toBe('info')
			expect(span.logs[0].message).toBe('test message')
			expect(span.logs[0].fields).toEqual({ field: 'value' })
		})
	})

	describe('setStatus', () => {
		it('should set span status', () => {
			span.setStatus('ERROR', 'Something went wrong')

			expect(span.status.code).toBe('ERROR')
			expect(span.status.message).toBe('Something went wrong')
		})
	})

	describe('finish', () => {
		it('should set end time and calculate duration', () => {
			const startTime = span.startTime

			setTimeout(() => {
				span.finish()

				expect(span.endTime).toBeDefined()
				expect(span.duration).toBeDefined()
				expect(span.endTime!).toBeGreaterThan(startTime)
				expect(span.duration!).toBeGreaterThan(0)
			}, 10)
		})
	})
})

describe('trace decorator', () => {
	class TestClass {
		public tracer = new AuditTracer({
			enabled: true,
			serviceName: 'test-service',
			sampleRate: 1.0,
			exporterType: 'console',
		})

		@trace('custom-operation')
		async testMethod(value: string): Promise<string> {
			return `processed: ${value}`
		}

		@trace()
		async errorMethod(): Promise<void> {
			throw new Error('Test error')
		}
	}

	let testInstance: TestClass

	beforeEach(() => {
		testInstance = new TestClass()
	})

	it('should trace successful method execution', async () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

		const result = await testInstance.testMethod('test-value')

		expect(result).toBe('processed: test-value')
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})

	it('should trace method execution with error', async () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

		await expect(testInstance.errorMethod()).rejects.toThrow('Test error')
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})
})
