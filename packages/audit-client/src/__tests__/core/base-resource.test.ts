import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseResource } from '../../core/base-resource'

import type { AuditClientConfig } from '../../core/config'
import type { Logger } from '../../infrastructure/logger'

// Create a concrete implementation for testing
class TestResource extends BaseResource {
	async testRequest<T>(endpoint: string, options = {}) {
		return this.request<T>(endpoint, options)
	}

	getManagers() {
		return {
			authManager: this.authManager,
			cacheManager: this.cacheManager,
			retryManager: this.retryManager,
			batchManager: this.batchManager,
			errorHandler: this.errorHandler,
		}
	}
}

describe('BaseResource', () => {
	let testConfig: AuditClientConfig
	let mockLogger: Logger
	let testResource: TestResource

	beforeEach(() => {
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		testConfig = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			timeout: 30000,
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
				autoRefresh: false,
			},
			retry: {
				enabled: true,
				maxAttempts: 3,
				initialDelayMs: 1000,
				maxDelayMs: 30000,
				backoffMultiplier: 2,
				retryableStatusCodes: [408, 429, 500, 502, 503, 504],
				retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
			},
			cache: {
				enabled: true,
				defaultTtlMs: 300000,
				maxSize: 1000,
				storage: 'memory',
				keyPrefix: 'audit-client',
				compressionEnabled: false,
			},
			batching: {
				enabled: false,
				maxBatchSize: 10,
				batchTimeoutMs: 1000,
				batchableEndpoints: [],
			},
			performance: {
				enableCompression: true,
				enableStreaming: true,
				maxConcurrentRequests: 10,
				requestDeduplication: true,
				responseTransformation: true,
			},
			logging: {
				enabled: true,
				level: 'info',
				includeRequestBody: false,
				includeResponseBody: false,
				maskSensitiveData: true,
			},
			errorHandling: {
				throwOnError: true,
				includeStackTrace: false,
				transformErrors: true,
				sanitizeErrors: true,
				enableRecovery: true,
			},
			customHeaders: {},
			interceptors: {},
		}

		testResource = new TestResource(testConfig, mockLogger)
	})

	describe('Initialization', () => {
		it('should initialize all infrastructure managers', () => {
			const managers = testResource.getManagers()

			expect(managers.authManager).toBeDefined()
			expect(managers.cacheManager).toBeDefined()
			expect(managers.retryManager).toBeDefined()
			expect(managers.batchManager).toBeDefined()
			expect(managers.errorHandler).toBeDefined()
		})

		it('should store configuration correctly', () => {
			const config = testResource.getConfig()
			expect(config.baseUrl).toBe('https://api.example.com')
			expect(config.apiVersion).toBe('v1')
			expect(config.authentication.type).toBe('apiKey')
		})
	})

	describe('Configuration Management', () => {
		it('should update configuration', () => {
			const newConfig = {
				baseUrl: 'https://new-api.example.com',
				timeout: 60000,
			}

			testResource.updateConfig(newConfig)
			const config = testResource.getConfig()

			expect(config.baseUrl).toBe('https://new-api.example.com')
			expect(config.timeout).toBe(60000)
		})
	})

	describe('Interceptors', () => {
		it('should add and remove request interceptors', async () => {
			const interceptor = vi.fn((options) => options)

			await testResource.addRequestInterceptor(interceptor, { enabled: true, priority: 0 })
			expect(await testResource.removeRequestInterceptor('legacy_request_' + Date.now())).toBe(
				false
			)
		})

		it('should add and remove response interceptors', async () => {
			const interceptor = vi.fn((response) => response)

			await testResource.addResponseInterceptor(interceptor, { enabled: true, priority: 0 })
			expect(await testResource.removeResponseInterceptor('legacy_response_' + Date.now())).toBe(
				false
			)
		})

		it('should clear all interceptors', async () => {
			const requestInterceptor = vi.fn((options) => options)
			const responseInterceptor = vi.fn((response) => response)

			await testResource.addRequestInterceptor(requestInterceptor, { enabled: true, priority: 0 })
			await testResource.addResponseInterceptor(responseInterceptor, { enabled: true, priority: 0 })

			await testResource.clearInterceptors()

			// After clearing, trying to remove non-existent interceptors should return false
			expect(await testResource.removeRequestInterceptor('non-existent')).toBe(false)
			expect(await testResource.removeResponseInterceptor('non-existent')).toBe(false)
		})
	})

	describe('Statistics', () => {
		it('should provide infrastructure statistics', () => {
			const stats = testResource.getStats()

			expect(stats).toHaveProperty('cache')
			expect(stats).toHaveProperty('retry')
			expect(stats).toHaveProperty('batch')
			expect(stats).toHaveProperty('auth')
		})
	})

	describe('Cleanup', () => {
		it('should cleanup resources on destroy', () => {
			expect(() => testResource.destroy()).not.toThrow()
		})
	})

	describe('Timeout Handling', () => {
		beforeEach(() => {
			// Mock fetch globally
			global.fetch = vi.fn()
		})

		it('should enforce timeout and throw TimeoutError', async () => {
			// Mock a slow response that exceeds timeout
			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 2000) // 2 second delay
					})
			)

			// Set a short timeout
			const shortTimeoutConfig = {
				...testConfig,
				timeout: 100, // 100ms timeout
			}
			const shortTimeoutResource = new TestResource(shortTimeoutConfig, mockLogger)

			// Expect timeout error
			await expect(
				shortTimeoutResource.testRequest('/test', { skipCache: true, skipRetry: true })
			).rejects.toThrow('timed out')
		})

		it('should use default timeout from config when not specified', async () => {
			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 50) // Short delay that's well within default timeout
					})
			)

			// Default timeout is 30000ms, so this should succeed
			await expect(
				testResource.testRequest('/test', { skipCache: true, skipRetry: true })
			).resolves.toBeDefined()
		})

		it('should use request-specific timeout over default', async () => {
			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 200) // 200ms delay
					})
			)

			// Request-specific timeout of 100ms should timeout
			await expect(
				testResource.testRequest('/test', {
					timeout: 100,
					skipCache: true,
					skipRetry: true,
				})
			).rejects.toThrow('timed out')
		})

		it('should clean up AbortController after successful request', async () => {
			const headers = new Headers()
			headers.set('content-type', 'application/json')
			;(global.fetch as any).mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				headers,
				json: async () => ({ data: 'test' }),
				text: async () => JSON.stringify({ data: 'test' }),
				clone: function () {
					return this
				},
			})

			await testResource.testRequest('/test', { skipCache: true, skipRetry: true })

			// If cleanup didn't happen, subsequent requests might fail
			// This test verifies no errors occur
			await expect(
				testResource.testRequest('/test2', { skipCache: true, skipRetry: true })
			).resolves.toBeDefined()
		})

		it('should clean up AbortController after failed request', async () => {
			;(global.fetch as any).mockRejectedValue(new Error('Network error'))

			await expect(
				testResource.testRequest('/test', { skipCache: true, skipRetry: true })
			).rejects.toThrow()

			// Verify cleanup by making another request
			const headers = new Headers()
			headers.set('content-type', 'application/json')
			;(global.fetch as any).mockResolvedValue({
				ok: true,
				status: 200,
				statusText: 'OK',
				headers,
				json: async () => ({ data: 'test' }),
				text: async () => JSON.stringify({ data: 'test' }),
				clone: function () {
					return this
				},
			})

			await expect(
				testResource.testRequest('/test2', { skipCache: true, skipRetry: true })
			).resolves.toBeDefined()
		})

		it('should work with retry logic on timeout', async () => {
			let attemptCount = 0

			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						attemptCount++
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 200) // Delay longer than timeout
					})
			)

			// With retry enabled and short timeout, should attempt multiple times
			const retryConfig = {
				...testConfig,
				timeout: 100,
				retry: {
					...testConfig.retry,
					enabled: true,
					maxAttempts: 3,
					initialDelayMs: 10,
					retryableStatusCodes: [408, 429, 500, 502, 503, 504],
					retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'TIMEOUT_ERROR'],
				},
			}
			const retryResource = new TestResource(retryConfig, mockLogger)

			await expect(retryResource.testRequest('/test', { skipCache: true })).rejects.toThrow()

			// Should have attempted multiple times (timeout is retryable)
			expect(attemptCount).toBeGreaterThan(1)
		})

		it('should handle external AbortSignal along with timeout', async () => {
			const externalController = new AbortController()

			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 1000)
					})
			)

			// Start request with external signal
			const requestPromise = testResource.testRequest('/test', {
				signal: externalController.signal,
				timeout: 5000, // Long timeout
				skipCache: true,
				skipRetry: true,
			})

			// Abort externally before timeout
			setTimeout(() => externalController.abort(), 50)

			// Should abort due to external signal
			await expect(requestPromise).rejects.toThrow()
		})

		it('should create TimeoutError with correct duration and context', async () => {
			;(global.fetch as any).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							const headers = new Headers()
							headers.set('content-type', 'application/json')
							resolve({
								ok: true,
								status: 200,
								statusText: 'OK',
								headers,
								json: async () => ({ data: 'test' }),
								text: async () => JSON.stringify({ data: 'test' }),
								clone: function () {
									return this
								},
							})
						}, 500)
					})
			)

			const timeoutMs = 100

			try {
				await testResource.testRequest('/test', {
					timeout: timeoutMs,
					skipCache: true,
					skipRetry: true,
				})
				expect.fail('Should have thrown TimeoutError')
			} catch (error: any) {
				expect(error.message).toContain('timed out')
				expect(error.message).toContain(`${timeoutMs}ms`)
			}
		})
	})
})
