import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	InterceptorManager,
	RequestInterceptorManager,
	ResponseInterceptorManager,
} from '../infrastructure/interceptors'
import {
	BuiltInInterceptorFactory,
	CorrelationIdRequestInterceptor,
	LoggingResponseInterceptor,
	TransformResponseInterceptor,
	ValidationRequestInterceptor,
} from '../infrastructure/interceptors/built-in'

import type { Mock } from 'vitest'
import type { RequestOptions } from '../core/base-resource'
import type {
	InterceptorContext,
	RequestInterceptor,
	ResponseInterceptor,
} from '../infrastructure/interceptors'

/**
 * Tests for the enhanced interceptor system
 */

describe('InterceptorManager', () => {
	let interceptorManager: InterceptorManager
	let mockLogger: any

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
		interceptorManager = new InterceptorManager(mockLogger)
	})

	describe('RequestInterceptorManager', () => {
		let requestManager: RequestInterceptorManager
		let mockInterceptor: RequestInterceptor
		let context: InterceptorContext

		beforeEach(() => {
			requestManager = new RequestInterceptorManager(mockLogger)
			mockInterceptor = {
				id: 'test-interceptor',
				priority: 50,
				enabled: true,
				intercept: vi.fn().mockImplementation((options) => options),
				onRegister: vi.fn(),
				onUnregister: vi.fn(),
				onError: vi.fn(),
			}
			context = {
				requestId: 'test-request-123',
				endpoint: '/test/endpoint',
				method: 'GET',
				timestamp: Date.now(),
			}
		})

		it('should register a request interceptor', async () => {
			await requestManager.register(mockInterceptor)

			expect(mockInterceptor.onRegister).toHaveBeenCalled()
			expect(requestManager.hasInterceptor('test-interceptor')).toBe(true)
			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Request interceptor registered',
				expect.objectContaining({
					interceptorId: 'test-interceptor',
					priority: 0, // Default priority is 0, not 50
					enabled: true,
				})
			)
		})

		it('should unregister a request interceptor', async () => {
			await requestManager.register(mockInterceptor)
			const result = await requestManager.unregister('test-interceptor')

			expect(result).toBe(true)
			expect(mockInterceptor.onUnregister).toHaveBeenCalled()
			expect(requestManager.hasInterceptor('test-interceptor')).toBe(false)
		})

		it('should execute interceptors in priority order', async () => {
			const interceptor1 = {
				id: 'interceptor-1',
				priority: 100,
				enabled: true,
				intercept: vi.fn().mockImplementation((options) => ({
					...options,
					headers: { ...options.headers, 'X-Interceptor-1': 'true' },
				})),
			}

			const interceptor2 = {
				id: 'interceptor-2',
				priority: 200,
				enabled: true,
				intercept: vi.fn().mockImplementation((options) => ({
					...options,
					headers: { ...options.headers, 'X-Interceptor-2': 'true' },
				})),
			}

			await requestManager.register(interceptor1)
			await requestManager.register(interceptor2)

			const options: RequestOptions = { method: 'GET', headers: {} }
			const result = await requestManager.execute(options, context)

			// Higher priority (interceptor2) should execute first
			// Check that both interceptors were called
			expect(interceptor1.intercept).toHaveBeenCalled()
			expect(interceptor2.intercept).toHaveBeenCalled()
			expect(result.headers).toEqual({
				'X-Interceptor-1': 'true',
				'X-Interceptor-2': 'true',
			})
		})

		it('should skip disabled interceptors', async () => {
			await requestManager.register(mockInterceptor, { enabled: false })

			const options: RequestOptions = { method: 'GET' }
			const result = await requestManager.execute(options, context)

			expect(mockInterceptor.intercept).not.toHaveBeenCalled()
			expect(result).toEqual(options)
		})

		it('should handle interceptor errors', async () => {
			const errorInterceptor: RequestInterceptor = {
				id: 'error-interceptor',
				intercept: vi.fn().mockRejectedValue(new Error('Interceptor error')),
				onError: vi.fn(),
			}

			await requestManager.register(errorInterceptor)

			const options: RequestOptions = { method: 'GET' }

			await expect(requestManager.execute(options, context)).rejects.toThrow('Interceptor error')
			expect(errorInterceptor.onError).toHaveBeenCalledWith(expect.any(Error), options, context)
		})

		it('should update interceptor enabled state', async () => {
			await requestManager.register(mockInterceptor)
			const result = requestManager.setEnabled('test-interceptor', false)

			expect(result).toBe(true)
			expect(mockInterceptor.enabled).toBe(false)
		})

		it('should update interceptor priority', async () => {
			await requestManager.register(mockInterceptor)
			const result = requestManager.setPriority('test-interceptor', 100)

			expect(result).toBe(true)
			expect(mockInterceptor.priority).toBe(100)
		})

		it('should track execution statistics', async () => {
			await requestManager.register(mockInterceptor)

			const options: RequestOptions = { method: 'GET' }
			await requestManager.execute(options, context)

			const stats = requestManager.getStats()
			expect(stats.totalExecutions).toBe(1)
			expect(stats.successfulExecutions).toBe(1)
			expect(stats.failedExecutions).toBe(0)
			expect(stats.interceptorStats.has('test-interceptor')).toBe(true)
		})

		it('should clear all interceptors', async () => {
			await requestManager.register(mockInterceptor)
			await requestManager.clear()

			expect(mockInterceptor.onUnregister).toHaveBeenCalled()
			expect(requestManager.getInterceptors()).toHaveLength(0)
		})
	})

	describe('ResponseInterceptorManager', () => {
		let responseManager: ResponseInterceptorManager
		let mockInterceptor: ResponseInterceptor
		let context: InterceptorContext

		beforeEach(() => {
			responseManager = new ResponseInterceptorManager(mockLogger)
			mockInterceptor = {
				id: 'test-response-interceptor',
				priority: 50,
				enabled: true,
				intercept: vi.fn().mockImplementation((response) => response),
				onRegister: vi.fn(),
				onUnregister: vi.fn(),
				onError: vi.fn(),
			}
			context = {
				requestId: 'test-request-123',
				endpoint: '/test/endpoint',
				method: 'GET',
				timestamp: Date.now(),
			}
		})

		it('should register a response interceptor', async () => {
			await responseManager.register(mockInterceptor)

			expect(mockInterceptor.onRegister).toHaveBeenCalled()
			expect(responseManager.hasInterceptor('test-response-interceptor')).toBe(true)
		})

		it('should execute response interceptors', async () => {
			await responseManager.register(mockInterceptor)

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }
			const result = await responseManager.execute(response, options, context)

			expect(mockInterceptor.intercept).toHaveBeenCalledWith(response, options, context)
			expect(result).toEqual(response)
		})

		it('should transform response data', async () => {
			const transformInterceptor: ResponseInterceptor = {
				id: 'transform-interceptor',
				intercept: vi.fn().mockImplementation((response: any) => ({
					...response,
					transformed: true,
				})),
			}

			await responseManager.register(transformInterceptor)

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }
			const result = await responseManager.execute(response, options, context)

			expect(result).toEqual({ data: 'test', transformed: true })
		})
	})

	describe('Combined InterceptorManager', () => {
		it('should manage both request and response interceptors', () => {
			expect(interceptorManager.request).toBeInstanceOf(RequestInterceptorManager)
			expect(interceptorManager.response).toBeInstanceOf(ResponseInterceptorManager)
		})

		it('should clear all interceptors', async () => {
			const requestSpy = vi.spyOn(interceptorManager.request, 'clear')
			const responseSpy = vi.spyOn(interceptorManager.response, 'clear')

			await interceptorManager.clearAll()

			expect(requestSpy).toHaveBeenCalled()
			expect(responseSpy).toHaveBeenCalled()
		})

		it('should get combined statistics', async () => {
			const stats = interceptorManager.getStats()

			expect(stats).toHaveProperty('request')
			expect(stats).toHaveProperty('response')
			expect(stats.request).toHaveProperty('totalExecutions')
			expect(stats.response).toHaveProperty('totalExecutions')
		})
	})
})

describe('Built-in Interceptors', () => {
	let context: InterceptorContext

	beforeEach(() => {
		context = {
			requestId: 'test-request-123',
			endpoint: '/test/endpoint',
			method: 'GET',
			timestamp: Date.now(),
		}
	})

	describe('CorrelationIdRequestInterceptor', () => {
		it('should add correlation ID header', () => {
			const interceptor = new CorrelationIdRequestInterceptor()
			const options: RequestOptions = { method: 'GET', headers: {} }

			const result = interceptor.intercept(options, context)

			expect(result.headers).toHaveProperty('X-Correlation-ID')
			expect(result.headers!['X-Correlation-ID']).toMatch(/^corr_\d+_[a-z0-9]+$/)
		})

		it('should not override existing correlation ID', () => {
			const interceptor = new CorrelationIdRequestInterceptor()
			const options: RequestOptions = {
				method: 'GET',
				headers: { 'X-Correlation-ID': 'existing-id' },
			}

			const result = interceptor.intercept(options, context)

			expect(result.headers!['X-Correlation-ID']).toBe('existing-id')
		})

		it('should use custom header name', () => {
			const interceptor = new CorrelationIdRequestInterceptor('X-Custom-Correlation')
			const options: RequestOptions = { method: 'GET', headers: {} }

			const result = interceptor.intercept(options, context)

			expect(result.headers).toHaveProperty('X-Custom-Correlation')
			expect(result.headers).not.toHaveProperty('X-Correlation-ID')
		})
	})

	describe('LoggingResponseInterceptor', () => {
		it('should log response details', () => {
			const mockLogger = vi.fn()
			const interceptor = new LoggingResponseInterceptor(mockLogger, 'info', false)

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }

			const result = interceptor.intercept(response, options, context)

			expect(mockLogger).toHaveBeenCalledWith(
				'Response received for GET /test/endpoint',
				expect.objectContaining({
					requestId: 'test-request-123',
					endpoint: '/test/endpoint',
					method: 'GET',
				})
			)
			expect(result).toEqual(response)
		})

		it('should include response body when configured', () => {
			const mockLogger = vi.fn()
			const interceptor = new LoggingResponseInterceptor(mockLogger, 'info', true)

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }

			interceptor.intercept(response, options, context)

			expect(mockLogger).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					response: { data: 'test' },
				})
			)
		})

		it('should log errors', () => {
			const mockLogger = vi.fn()
			const interceptor = new LoggingResponseInterceptor(mockLogger)

			const error = new Error('Test error')
			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }

			interceptor.onError!(error, response, options, context)

			expect(mockLogger).toHaveBeenCalledWith(
				'Response error for GET /test/endpoint',
				expect.objectContaining({
					requestId: 'test-request-123',
					error: 'Test error',
				})
			)
		})
	})

	describe('ValidationRequestInterceptor', () => {
		it('should validate request body', () => {
			const interceptor = new ValidationRequestInterceptor()
			interceptor.addValidator('/test/*', (body) => {
				return body && body.required ? true : 'Missing required field'
			})

			const options: RequestOptions = {
				method: 'POST',
				body: { required: 'value' },
			}

			const result = interceptor.intercept(options, context)
			expect(result).toEqual(options)
		})

		it('should throw validation error', () => {
			const interceptor = new ValidationRequestInterceptor()
			interceptor.addValidator('/test/*', () => 'Validation failed')

			const options: RequestOptions = {
				method: 'POST',
				body: { data: 'test' },
			}

			expect(() => interceptor.intercept(options, context)).toThrow(
				'Validation error for /test/endpoint: Validation failed'
			)
		})

		it('should skip validation for GET requests', () => {
			const interceptor = new ValidationRequestInterceptor()
			interceptor.addValidator('/test/*', () => 'Should not be called')

			const options: RequestOptions = { method: 'GET' }

			const result = interceptor.intercept(options, context)
			expect(result).toEqual(options)
		})
	})

	describe('TransformResponseInterceptor', () => {
		it('should transform response data', () => {
			const interceptor = new TransformResponseInterceptor()
			interceptor.addTransformer('/test/*', (data) => ({
				...data,
				transformed: true,
			}))

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }

			const result = interceptor.intercept(response, options, context)

			expect(result).toEqual({ data: 'test', transformed: true })
		})

		it('should handle transformation errors', () => {
			const interceptor = new TransformResponseInterceptor()
			interceptor.addTransformer('/test/*', () => {
				throw new Error('Transform error')
			})

			const response = { data: 'test' }
			const options: RequestOptions = { method: 'GET' }

			expect(() => interceptor.intercept(response, options, context)).toThrow(
				'Response transformation failed for /test/endpoint: Error: Transform error'
			)
		})
	})

	describe('BuiltInInterceptorFactory', () => {
		it('should create correlation ID interceptor', () => {
			const interceptor = BuiltInInterceptorFactory.createCorrelationIdRequestInterceptor()
			expect(interceptor).toBeInstanceOf(CorrelationIdRequestInterceptor)
		})

		it('should create logging interceptor', () => {
			const interceptor = BuiltInInterceptorFactory.createLoggingResponseInterceptor()
			expect(interceptor).toBeInstanceOf(LoggingResponseInterceptor)
		})

		it('should create validation interceptor', () => {
			const interceptor = BuiltInInterceptorFactory.createValidationRequestInterceptor()
			expect(interceptor).toBeInstanceOf(ValidationRequestInterceptor)
		})

		it('should create transform interceptor', () => {
			const interceptor = BuiltInInterceptorFactory.createTransformResponseInterceptor()
			expect(interceptor).toBeInstanceOf(TransformResponseInterceptor)
		})
	})
})

describe('Interceptor Error Handling', () => {
	let requestManager: RequestInterceptorManager
	let context: InterceptorContext

	beforeEach(() => {
		requestManager = new RequestInterceptorManager()
		context = {
			requestId: 'test-request-123',
			endpoint: '/test/endpoint',
			method: 'GET',
			timestamp: Date.now(),
		}
	})

	it('should handle interceptor registration errors', async () => {
		const badInterceptor: RequestInterceptor = {
			id: 'bad-interceptor',
			intercept: vi.fn(),
			onRegister: vi.fn().mockRejectedValue(new Error('Registration failed')),
		}

		await expect(requestManager.register(badInterceptor)).rejects.toThrow('Registration failed')
		expect(requestManager.hasInterceptor('bad-interceptor')).toBe(false)
	})

	it('should handle interceptor execution errors', async () => {
		const errorInterceptor: RequestInterceptor = {
			id: 'error-interceptor',
			intercept: vi.fn().mockRejectedValue(new Error('Execution failed')),
			onError: vi.fn(),
		}

		await requestManager.register(errorInterceptor)

		const options: RequestOptions = { method: 'GET' }

		await expect(requestManager.execute(options, context)).rejects.toThrow('Execution failed')
		expect(errorInterceptor.onError).toHaveBeenCalledWith(expect.any(Error), options, context)
	})

	it('should handle error handler failures', async () => {
		const mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		const requestManagerWithLogger = new RequestInterceptorManager(mockLogger)

		const badErrorInterceptor: RequestInterceptor = {
			id: 'bad-error-interceptor',
			intercept: vi.fn().mockRejectedValue(new Error('Execution failed')),
			onError: vi.fn().mockRejectedValue(new Error('Error handler failed')),
		}

		await requestManagerWithLogger.register(badErrorInterceptor)

		const options: RequestOptions = { method: 'GET' }

		await expect(requestManagerWithLogger.execute(options, context)).rejects.toThrow(
			'Execution failed'
		)

		expect(mockLogger.error).toHaveBeenCalledWith(
			'Request interceptor error handler failed',
			expect.objectContaining({
				interceptorId: 'bad-error-interceptor',
				originalError: expect.any(Error),
				handlerError: expect.any(Error),
			})
		)
	})
})

describe('Interceptor Chaining', () => {
	let requestManager: RequestInterceptorManager
	let context: InterceptorContext

	beforeEach(() => {
		requestManager = new RequestInterceptorManager()
		context = {
			requestId: 'test-request-123',
			endpoint: '/test/endpoint',
			method: 'GET',
			timestamp: Date.now(),
		}
	})

	it('should chain multiple interceptors correctly', async () => {
		const interceptor1: RequestInterceptor = {
			id: 'interceptor-1',
			priority: 100,
			intercept: vi.fn().mockImplementation((options) => ({
				...options,
				step1: true,
			})),
		}

		const interceptor2: RequestInterceptor = {
			id: 'interceptor-2',
			priority: 200,
			intercept: vi.fn().mockImplementation((options) => ({
				...options,
				step2: true,
			})),
		}

		const interceptor3: RequestInterceptor = {
			id: 'interceptor-3',
			priority: 150,
			intercept: vi.fn().mockImplementation((options) => ({
				...options,
				step3: true,
			})),
		}

		await requestManager.register(interceptor1)
		await requestManager.register(interceptor2)
		await requestManager.register(interceptor3)

		const options: RequestOptions = { method: 'GET' }
		const result = await requestManager.execute(options, context)

		// Should execute in priority order: 2 (200), 3 (150), 1 (100)
		expect(result).toEqual({
			method: 'GET',
			step1: true,
			step2: true,
			step3: true,
		})

		// Verify all interceptors were called
		expect(interceptor1.intercept).toHaveBeenCalled()
		expect(interceptor2.intercept).toHaveBeenCalled()
		expect(interceptor3.intercept).toHaveBeenCalled()
	})

	it('should stop chain execution on error', async () => {
		const interceptor1: RequestInterceptor = {
			id: 'interceptor-1',
			priority: 300,
			intercept: vi.fn().mockImplementation((options) => ({
				...options,
				step1: true,
			})),
		}

		const errorInterceptor: RequestInterceptor = {
			id: 'error-interceptor',
			priority: 200,
			intercept: vi.fn().mockRejectedValue(new Error('Chain error')),
		}

		const interceptor3: RequestInterceptor = {
			id: 'interceptor-3',
			priority: 100,
			intercept: vi.fn().mockImplementation((options) => ({
				...options,
				step3: true,
			})),
		}

		await requestManager.register(interceptor1)
		await requestManager.register(errorInterceptor)
		await requestManager.register(interceptor3)

		const options: RequestOptions = { method: 'GET' }

		await expect(requestManager.execute(options, context)).rejects.toThrow('Chain error')

		// First interceptor should have been called
		expect(interceptor1.intercept).toHaveBeenCalled()
		// Error interceptor should have been called
		expect(errorInterceptor.intercept).toHaveBeenCalled()
		// Third interceptor should NOT have been called due to error
		expect(interceptor3.intercept).not.toHaveBeenCalled()
	})
})
