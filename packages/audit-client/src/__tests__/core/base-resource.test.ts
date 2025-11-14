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
})
