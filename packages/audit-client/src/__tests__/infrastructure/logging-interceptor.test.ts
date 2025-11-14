import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	DetailedLoggingInterceptorFactory,
	DetailedLoggingRequestInterceptor,
	DetailedLoggingResponseInterceptor,
} from '../../infrastructure/interceptors/built-in/logging-interceptor'

import type { RequestOptions } from '../../core/base-resource'
import type { InterceptorContext } from '../../infrastructure/interceptors'
import type { Logger } from '../../infrastructure/logger'

describe('DetailedLoggingInterceptor', () => {
	let mockLogger: Logger
	let context: InterceptorContext

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			setLevel: vi.fn(),
			setRequestId: vi.fn(),
			setCorrelationId: vi.fn(),
			flush: vi.fn(),
			getBuffer: vi.fn(),
			clearBuffer: vi.fn(),
		}

		context = {
			requestId: 'test-request-123',
			endpoint: '/api/events',
			method: 'POST',
			timestamp: Date.now(),
		}
	})

	describe('DetailedLoggingRequestInterceptor', () => {
		describe('Request Logging', () => {
			it('should log basic request details', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = {
					method: 'POST',
					body: { data: 'test' },
				}

				const result = interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Request: POST /api/events',
					expect.objectContaining({
						requestId: 'test-request-123',
						method: 'POST',
						endpoint: '/api/events',
						timestamp: expect.any(String),
					})
				)
				expect(result).toEqual(options)
			})

			it('should log request with query parameters', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = {
					method: 'GET',
					query: { page: 1, limit: 10 },
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						query: { page: 1, limit: 10 },
					})
				)
			})

			it('should use configured log level', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					successLogLevel: 'info',
				})
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(options, context)

				expect(mockLogger.info).toHaveBeenCalled()
				expect(mockLogger.debug).not.toHaveBeenCalled()
			})

			it('should track request timing', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(options, context)

				const startTime = interceptor.getRequestStartTime(context.requestId)
				expect(startTime).toBeDefined()
				expect(typeof startTime).toBe('number')
			})
		})

		describe('Header Logging', () => {
			it('should log headers when configured', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logHeaders: true,
					maskSensitiveData: false,
				})
				const options: RequestOptions = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Custom-Header': 'value',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							'Content-Type': 'application/json',
							'X-Custom-Header': 'value',
						},
					})
				)
			})

			it('should not log headers when not configured', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logHeaders: false,
				})
				const options: RequestOptions = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
				}

				interceptor.intercept(options, context)

				const logCall = (mockLogger.debug as any).mock.calls[0]
				expect(logCall[1]).not.toHaveProperty('headers')
			})
		})

		describe('Header Masking', () => {
			it('should mask sensitive headers', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logHeaders: true,
					maskSensitiveData: true,
				})
				const options: RequestOptions = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: 'Bearer secret-token',
						'X-API-Key': 'api-key-123',
						Cookie: 'session=abc123',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							'Content-Type': 'application/json',
							Authorization: '***REDACTED***',
							'X-API-Key': '***REDACTED***',
							Cookie: '***REDACTED***',
						},
					})
				)
			})

			it('should not mask headers when masking is disabled', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logHeaders: true,
					maskSensitiveData: false,
				})
				const options: RequestOptions = {
					method: 'POST',
					headers: {
						Authorization: 'Bearer secret-token',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							Authorization: 'Bearer secret-token',
						},
					})
				)
			})
		})

		describe('Body Logging', () => {
			it('should log request body when configured', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: false,
				})
				const options: RequestOptions = {
					method: 'POST',
					body: {
						username: 'testuser',
						email: 'test@example.com',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: {
							username: 'testuser',
							email: 'test@example.com',
						},
					})
				)
			})

			it('should not log body when not configured', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: false,
				})
				const options: RequestOptions = {
					method: 'POST',
					body: { data: 'test' },
				}

				interceptor.intercept(options, context)

				const logCall = (mockLogger.debug as any).mock.calls[0]
				expect(logCall[1]).not.toHaveProperty('body')
			})
		})

		describe('Body Masking', () => {
			it('should mask sensitive fields in request body', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: true,
				})
				const options: RequestOptions = {
					method: 'POST',
					body: {
						username: 'testuser',
						password: 'secret123',
						apiKey: 'key-123',
						token: 'token-456',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: {
							username: 'testuser',
							password: '***REDACTED***',
							apiKey: '***REDACTED***',
							token: '***REDACTED***',
						},
					})
				)
			})

			it('should mask nested sensitive fields', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: true,
				})
				const options: RequestOptions = {
					method: 'POST',
					body: {
						user: {
							name: 'testuser',
							credentials: {
								password: 'secret123',
								apiKey: 'key-123',
							},
						},
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: {
							user: {
								name: 'testuser',
								credentials: {
									password: '***REDACTED***',
									apiKey: '***REDACTED***',
								},
							},
						},
					})
				)
			})

			it('should mask custom sensitive fields', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: true,
					customSensitiveFields: ['customSecret', 'privateData'],
				})
				const options: RequestOptions = {
					method: 'POST',
					body: {
						publicData: 'visible',
						customSecret: 'should-be-masked',
						privateData: 'also-masked',
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: {
							publicData: 'visible',
							customSecret: '***REDACTED***',
							privateData: '***REDACTED***',
						},
					})
				)
			})

			it('should handle arrays in body', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: true,
				})
				const options: RequestOptions = {
					method: 'POST',
					body: {
						users: [
							{ name: 'user1', password: 'pass1' },
							{ name: 'user2', password: 'pass2' },
						],
					},
				}

				interceptor.intercept(options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						body: {
							users: [
								{ name: 'user1', password: '***REDACTED***' },
								{ name: 'user2', password: '***REDACTED***' },
							],
						},
					})
				)
			})
		})

		describe('Error Handling', () => {
			it('should log request errors', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger, {
					errorLogLevel: 'error',
				})
				const options: RequestOptions = { method: 'POST' }
				const error = new Error('Request failed')

				interceptor.onError(error, options, context)

				expect(mockLogger.error).toHaveBeenCalledWith(
					'Request failed: POST /api/events',
					expect.objectContaining({
						requestId: 'test-request-123',
						method: 'POST',
						endpoint: '/api/events',
						error: 'Request failed',
						errorName: 'Error',
					})
				)
			})

			it('should include duration in error logs', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = { method: 'POST' }

				// First intercept to start timing
				interceptor.intercept(options, context)

				// Wait a bit
				const error = new Error('Request failed')
				interceptor.onError(error, options, context)

				expect(mockLogger.error).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						duration: expect.stringMatching(/^\d+ms$/),
					})
				)
			})

			it('should clean up timing data after error', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = { method: 'POST' }

				interceptor.intercept(options, context)
				const error = new Error('Request failed')
				interceptor.onError(error, options, context)

				const startTime = interceptor.getRequestStartTime(context.requestId)
				expect(startTime).toBeUndefined()
			})
		})

		describe('Timing Management', () => {
			it('should clear all timings', () => {
				const interceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const options: RequestOptions = { method: 'POST' }

				interceptor.intercept(options, context)
				expect(interceptor.getRequestStartTime(context.requestId)).toBeDefined()

				interceptor.clearTimings()
				expect(interceptor.getRequestStartTime(context.requestId)).toBeUndefined()
			})
		})
	})

	describe('DetailedLoggingResponseInterceptor', () => {
		describe('Response Logging', () => {
			it('should log basic response details', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger)
				const response = { data: 'test' }
				const options: RequestOptions = { method: 'POST' }

				const result = interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.stringContaining('Response: POST /api/events'),
					expect.objectContaining({
						requestId: 'test-request-123',
						method: 'POST',
						endpoint: '/api/events',
					})
				)
				expect(result).toEqual(response)
			})

			it('should log response with status', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger)
				const response = {
					status: 200,
					statusText: 'OK',
					data: 'test',
				}
				const options: RequestOptions = { method: 'POST' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					'Response: POST /api/events - 200',
					expect.objectContaining({
						status: 200,
						statusText: 'OK',
					})
				)
			})

			it('should use error log level for error responses', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					errorLogLevel: 'error',
				})
				const response = {
					status: 500,
					statusText: 'Internal Server Error',
					data: 'error',
				}
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.error).toHaveBeenCalled()
				expect(mockLogger.debug).not.toHaveBeenCalled()
			})
		})

		describe('Timing Tracking', () => {
			it('should include duration when paired with request interceptor', () => {
				const requestInterceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const responseInterceptor = new DetailedLoggingResponseInterceptor(
					mockLogger,
					{},
					requestInterceptor
				)

				const options: RequestOptions = { method: 'GET' }

				// Start timing
				requestInterceptor.intercept(options, context)

				// Log response
				const response = { data: 'test' }
				responseInterceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						duration: expect.stringMatching(/^\d+ms$/),
					})
				)
			})

			it('should work without request interceptor', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger)
				const response = { data: 'test' }
				const options: RequestOptions = { method: 'GET' }

				const result = interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalled()
				expect(result).toEqual(response)
			})
		})

		describe('Header Logging', () => {
			it('should log response headers when configured', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					logHeaders: true,
					maskSensitiveData: false,
				})
				const response = {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'X-Response-Time': '50ms',
					},
					data: 'test',
				}
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							'Content-Type': 'application/json',
							'X-Response-Time': '50ms',
						},
					})
				)
			})

			it('should mask sensitive response headers', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					logHeaders: true,
					maskSensitiveData: true,
				})
				const response = {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Set-Cookie': 'session=abc123',
					},
					data: 'test',
				}
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: {
							'Content-Type': 'application/json',
							'Set-Cookie': '***REDACTED***',
						},
					})
				)
			})
		})

		describe('Body Logging', () => {
			it('should log response body when configured', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: false,
				})
				const response = {
					id: '123',
					name: 'Test',
					data: 'value',
				}
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						response: {
							id: '123',
							name: 'Test',
							data: 'value',
						},
					})
				)
			})

			it('should mask sensitive fields in response body', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					logBody: true,
					maskSensitiveData: true,
				})
				const response = {
					user: {
						id: '123',
						name: 'Test User',
						apiKey: 'key-123',
						token: 'token-456',
					},
				}
				const options: RequestOptions = { method: 'GET' }

				interceptor.intercept(response, options, context)

				expect(mockLogger.debug).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						response: {
							user: {
								id: '123',
								name: 'Test User',
								apiKey: '***REDACTED***',
								token: '***REDACTED***',
							},
						},
					})
				)
			})
		})

		describe('Error Handling', () => {
			it('should log response errors', () => {
				const interceptor = new DetailedLoggingResponseInterceptor(mockLogger, {
					errorLogLevel: 'error',
				})
				const response = { status: 500, data: 'error' }
				const options: RequestOptions = { method: 'POST' }
				const error = new Error('Response processing failed')

				interceptor.onError(error, response, options, context)

				expect(mockLogger.error).toHaveBeenCalledWith(
					'Response error: POST /api/events',
					expect.objectContaining({
						requestId: 'test-request-123',
						error: 'Response processing failed',
						errorName: 'Error',
						status: 500,
					})
				)
			})

			it('should include duration in error logs when paired', () => {
				const requestInterceptor = new DetailedLoggingRequestInterceptor(mockLogger)
				const responseInterceptor = new DetailedLoggingResponseInterceptor(
					mockLogger,
					{},
					requestInterceptor
				)

				const options: RequestOptions = { method: 'GET' }

				// Start timing
				requestInterceptor.intercept(options, context)

				// Log error
				const response = { status: 500 }
				const error = new Error('Response error')
				responseInterceptor.onError(error, response, options, context)

				expect(mockLogger.error).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						duration: expect.stringMatching(/^\d+ms$/),
					})
				)
			})
		})
	})

	describe('DetailedLoggingInterceptorFactory', () => {
		it('should create paired interceptors', () => {
			const { request, response } = DetailedLoggingInterceptorFactory.createPair(mockLogger)

			expect(request).toBeInstanceOf(DetailedLoggingRequestInterceptor)
			expect(response).toBeInstanceOf(DetailedLoggingResponseInterceptor)
		})

		it('should create paired interceptors with shared timing', () => {
			const { request, response } = DetailedLoggingInterceptorFactory.createPair(mockLogger)

			const options: RequestOptions = { method: 'GET' }

			// Start timing with request interceptor
			request.intercept(options, context)

			// Response interceptor should have access to timing
			const responseData = { data: 'test' }
			response.intercept(responseData, options, context)

			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					duration: expect.stringMatching(/^\d+ms$/),
				})
			)
		})

		it('should create standalone request interceptor', () => {
			const interceptor = DetailedLoggingInterceptorFactory.createRequestInterceptor(mockLogger)

			expect(interceptor).toBeInstanceOf(DetailedLoggingRequestInterceptor)
		})

		it('should create standalone response interceptor', () => {
			const interceptor = DetailedLoggingInterceptorFactory.createResponseInterceptor(mockLogger)

			expect(interceptor).toBeInstanceOf(DetailedLoggingResponseInterceptor)
		})

		it('should pass configuration to created interceptors', () => {
			const config = {
				logHeaders: true,
				logBody: true,
				maskSensitiveData: false,
			}

			const { request, response } = DetailedLoggingInterceptorFactory.createPair(mockLogger, config)

			const options: RequestOptions = {
				method: 'POST',
				headers: { Authorization: 'Bearer token' },
				body: { password: 'secret' },
			}

			request.intercept(options, context)

			// Should log headers and body without masking
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: { Authorization: 'Bearer token' },
					body: { password: 'secret' },
				})
			)
		})
	})
})
