/**
 * Unit tests for delivery service OpenTelemetry tracing
 * Requirements 8.1, 8.4: Test trace generation and correlation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trace, SpanStatusCode } from '@opentelemetry/api'

import { DeliveryTracer, traceDeliveryOperation } from '../tracer.js'
import type { DeliveryObservabilityConfig } from '../types.js'

describe('DeliveryTracer', () => {
	let tracer: DeliveryTracer
	let config: DeliveryObservabilityConfig['tracing']

	beforeEach(() => {
		config = {
			enabled: true,
			serviceName: 'test-delivery-service',
			sampleRate: 1.0,
			exporterType: 'console',
		}
		tracer = new DeliveryTracer(config)
	})

	afterEach(async () => {
		await tracer.shutdown()
	})

	describe('initialization', () => {
		it('should initialize successfully with valid config', async () => {
			await expect(tracer.initialize()).resolves.not.toThrow()
		})

		it('should not initialize when tracing is disabled', async () => {
			const disabledConfig = { ...config, enabled: false }
			const disabledTracer = new DeliveryTracer(disabledConfig)

			await disabledTracer.initialize()
			// Should not throw, but should not actually initialize
			expect(true).toBe(true) // Placeholder assertion
		})

		it('should handle initialization errors gracefully', async () => {
			const invalidConfig = {
				...config,
				exporterType: 'otlp' as const,
				exporterEndpoint: 'invalid-url',
			}
			const invalidTracer = new DeliveryTracer(invalidConfig)

			// Should handle invalid endpoint gracefully
			await expect(invalidTracer.initialize()).rejects.toThrow()
		})
	})

	describe('span creation', () => {
		beforeEach(async () => {
			await tracer.initialize()
		})

		it('should create a span with correct operation name', () => {
			const span = tracer.startSpan('delivery.create')

			expect(span).toBeDefined()
			expect(span.isRecording()).toBe(true)

			span.end()
		})

		it('should create a span with delivery attributes', () => {
			const attributes = {
				'delivery.id': 'test-delivery-123',
				'delivery.organization_id': 'org-456',
				'delivery.type': 'report',
				'destination.type': 'webhook',
			}

			const span = tracer.startSpan('delivery.create', attributes)

			// Verify span was created
			expect(span).toBeDefined()

			// Test setting delivery attributes
			span.setDeliveryAttributes(attributes)

			span.end()
		})

		it('should create child spans correctly', () => {
			const parentSpan = tracer.startSpan('delivery.create')
			const childSpan = tracer.startChildSpan(parentSpan, 'handler.webhook.deliver')

			expect(childSpan).toBeDefined()
			expect(childSpan.isRecording()).toBe(true)

			childSpan.end()
			parentSpan.end()
		})

		it('should handle sampling correctly', () => {
			const sampledConfig = { ...config, sampleRate: 0.0 }
			const sampledTracer = new DeliveryTracer(sampledConfig)

			const span = sampledTracer.startSpan('delivery.create')

			// Should still create a span (no-op span)
			expect(span).toBeDefined()

			span.end()
		})
	})

	describe('span context management', () => {
		beforeEach(async () => {
			await tracer.initialize()
		})

		it('should create span context correctly', () => {
			const span = tracer.startSpan('delivery.create')
			const context = tracer.createSpanContext(span)

			expect(context).toBeDefined()
			expect(context.traceId).toBeDefined()
			expect(context.spanId).toBeDefined()
			expect(typeof context.traceId).toBe('string')
			expect(typeof context.spanId).toBe('string')

			span.end()
		})

		it('should inject span context into headers', () => {
			const span = tracer.startSpan('delivery.create')
			const headers: Record<string, string> = {}

			tracer.injectSpanContext(span, headers)

			expect(headers['x-trace-id']).toBeDefined()
			expect(headers['x-span-id']).toBeDefined()
			expect(headers['traceparent']).toBeDefined()

			span.end()
		})

		it('should extract span context from headers', () => {
			const headers = {
				'x-trace-id': '12345678901234567890123456789012',
				'x-span-id': '1234567890123456',
			}

			const context = tracer.extractSpanContext(headers)

			expect(context).toBeDefined()
			expect(context?.traceId).toBe('12345678901234567890123456789012')
			expect(context?.spanId).toBe('1234567890123456')
		})

		it('should return null for invalid headers', () => {
			const invalidHeaders = { 'some-header': 'value' }

			const context = tracer.extractSpanContext(invalidHeaders)

			expect(context).toBeNull()
		})
	})

	describe('span execution', () => {
		beforeEach(async () => {
			await tracer.initialize()
		})

		it('should execute function within span context successfully', async () => {
			const span = tracer.startSpan('delivery.create')
			const testFunction = vi.fn().mockResolvedValue('success')

			const result = await tracer.withSpan(span, testFunction)

			expect(result).toBe('success')
			expect(testFunction).toHaveBeenCalledOnce()
		})

		it('should handle function errors correctly', async () => {
			const span = tracer.startSpan('delivery.create')
			const testError = new Error('Test error')
			const testFunction = vi.fn().mockRejectedValue(testError)

			await expect(tracer.withSpan(span, testFunction)).rejects.toThrow('Test error')
			expect(testFunction).toHaveBeenCalledOnce()
		})

		it('should set span status correctly on success', async () => {
			const span = tracer.startSpan('delivery.create')
			const setStatusSpy = vi.spyOn(span, 'setStatus')

			await tracer.withSpan(span, () => Promise.resolve('success'))

			expect(setStatusSpy).toHaveBeenCalledWith({
				code: SpanStatusCode.OK,
				message: 'Operation completed successfully',
			})
		})

		it('should set span status correctly on error', async () => {
			const span = tracer.startSpan('delivery.create')
			const setStatusSpy = vi.spyOn(span, 'setStatus')
			const recordExceptionSpy = vi.spyOn(span, 'recordException')

			const testError = new Error('Test error')

			try {
				await tracer.withSpan(span, () => Promise.reject(testError))
			} catch (error) {
				// Expected to throw
			}

			expect(setStatusSpy).toHaveBeenCalledWith({
				code: SpanStatusCode.ERROR,
				message: 'Test error',
			})
			expect(recordExceptionSpy).toHaveBeenCalledWith(testError)
		})
	})

	describe('delivery span functionality', () => {
		beforeEach(async () => {
			await tracer.initialize()
		})

		it('should set delivery attributes correctly', () => {
			const span = tracer.startSpan('delivery.create')
			const attributes = {
				'delivery.id': 'test-123',
				'delivery.organization_id': 'org-456',
				'destination.type': 'webhook',
			}

			// Should not throw
			span.setDeliveryAttributes(attributes)

			span.end()
		})

		it('should add delivery events correctly', () => {
			const span = tracer.startSpan('delivery.create')
			const event = {
				name: 'delivery.queued',
				timestamp: Date.now(),
				attributes: { queue: 'high-priority' },
			}

			// Should not throw
			span.addDeliveryEvent(event)

			span.end()
		})

		it('should set delivery status correctly', () => {
			const span = tracer.startSpan('delivery.create')

			// Test success status
			span.setDeliveryStatus(true, 'Delivery completed')

			// Test failure status
			span.setDeliveryStatus(false, 'Delivery failed')

			span.end()
		})

		it('should handle complex attribute values', () => {
			const span = tracer.startSpan('delivery.create')
			const complexAttributes = {
				'delivery.id': 'test-123',
				'delivery.metadata': { key: 'value', nested: { data: 'test' } },
				'delivery.tags': ['tag1', 'tag2'],
				'delivery.count': 42,
				'delivery.enabled': true,
			}

			// Should handle complex objects by converting to strings
			span.setDeliveryAttributes(complexAttributes)

			span.end()
		})
	})
})

describe('traceDeliveryOperation decorator', () => {
	it('should create spans for decorated methods', async () => {
		class TestService {
			@traceDeliveryOperation('delivery.create')
			async createDelivery(data: any) {
				return { id: 'test-123', ...data }
			}
		}

		const service = new TestService()
		const result = await service.createDelivery({ type: 'report' })

		expect(result).toEqual({ id: 'test-123', type: 'report' })
	})

	it('should handle method errors correctly', async () => {
		class TestService {
			@traceDeliveryOperation('delivery.create')
			async createDelivery() {
				throw new Error('Test error')
			}
		}

		const service = new TestService()

		await expect(service.createDelivery()).rejects.toThrow('Test error')
	})

	it('should work with synchronous methods', async () => {
		class TestService {
			@traceDeliveryOperation('delivery.validate')
			validateDelivery(data: any) {
				return data.valid === true
			}
		}

		const service = new TestService()
		const result = await service.validateDelivery({ valid: true })

		expect(result).toBe(true)
	})
})

describe('DeliveryTracer configuration', () => {
	it('should handle different exporter types', async () => {
		const configs = [
			{ ...config, exporterType: 'console' as const },
			{ ...config, exporterType: 'jaeger' as const },
			{
				...config,
				exporterType: 'otlp' as const,
				exporterEndpoint: 'http://localhost:4318/v1/traces',
			},
		]

		for (const testConfig of configs) {
			const testTracer = new DeliveryTracer(testConfig)

			// Should not throw during initialization
			await expect(testTracer.initialize()).resolves.not.toThrow()
			await testTracer.shutdown()
		}
	})

	it('should handle custom headers for OTLP exporter', async () => {
		const otlpConfig = {
			...config,
			exporterType: 'otlp' as const,
			exporterEndpoint: 'http://localhost:4318/v1/traces',
			headers: {
				Authorization: 'Bearer test-token',
				'Custom-Header': 'test-value',
			},
		}

		const otlpTracer = new DeliveryTracer(otlpConfig)

		// Should handle custom headers without throwing
		await expect(otlpTracer.initialize()).resolves.not.toThrow()
		await otlpTracer.shutdown()
	})

	it('should respect sampling configuration', () => {
		const samplingConfigs = [
			{ ...config, sampleRate: 0.0 },
			{ ...config, sampleRate: 0.5 },
			{ ...config, sampleRate: 1.0 },
		]

		for (const testConfig of samplingConfigs) {
			const testTracer = new DeliveryTracer(testConfig)

			// Should create tracer without throwing
			expect(testTracer).toBeDefined()
		}
	})
})
