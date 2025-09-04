import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AuditClient } from '../../core/client'

import type { PartialAuditClientConfig } from '../../core/config'

describe('AuditClient', () => {
	let client: AuditClient
	const baseConfig: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'test-api-key',
		},
	}

	afterEach(async () => {
		if (client && !client.isDestroyed()) {
			await client.destroy()
		}
	})

	describe('initialization', () => {
		it('should initialize successfully with valid configuration', () => {
			client = new AuditClient(baseConfig)

			expect(client.isReady()).toBe(true)
			expect(client.getState()).toBe('ready')
			expect(client.isDestroyed()).toBe(false)
		})

		it('should throw error with invalid configuration', () => {
			expect(() => {
				client = new AuditClient({} as PartialAuditClientConfig)
			}).toThrow()
		})

		it('should have all services available', () => {
			client = new AuditClient(baseConfig)

			expect(client.events).toBeDefined()
			expect(client.compliance).toBeDefined()
			expect(client.scheduledReports).toBeDefined()
			expect(client.presets).toBeDefined()
			expect(client.metrics).toBeDefined()
			expect(client.health).toBeDefined()
		})
	})

	describe('configuration management', () => {
		beforeEach(() => {
			client = new AuditClient(baseConfig)
		})

		it('should return current configuration', () => {
			const config = client.getConfig()

			expect(config.baseUrl).toBe(baseConfig.baseUrl)
			expect(config.authentication.type).toBe('apiKey')
			expect(config.authentication.apiKey).toBe('test-api-key')
		})

		it('should update configuration', () => {
			const updates = {
				timeout: 60000,
				logging: {
					enabled: true,
					level: 'debug' as const,
					includeRequestBody: true,
					includeResponseBody: true,
					maskSensitiveData: false,
				},
			}

			client.updateConfig(updates)
			const config = client.getConfig()

			expect(config.timeout).toBe(60000)
			expect(config.logging.level).toBe('debug')
		})

		it('should load environment configuration', () => {
			const envConfig = {
				cache: {
					enabled: true,
					defaultTtlMs: 600000,
					maxSize: 2000,
					storage: 'memory' as const,
					keyPrefix: 'test-cache',
					compressionEnabled: true,
				},
			}

			client.loadEnvironmentConfig('development', envConfig)
			// Environment config is loaded but not applied unless it matches current environment
		})
	})

	describe('lifecycle management', () => {
		beforeEach(() => {
			client = new AuditClient(baseConfig)
		})

		it('should perform health check', async () => {
			const healthResult = await client.healthCheck()

			expect(healthResult).toHaveProperty('overall')
			expect(healthResult).toHaveProperty('services')
			expect(healthResult).toHaveProperty('timestamp')
			expect(['healthy', 'degraded', 'unhealthy']).toContain(healthResult.overall)
		})

		it('should get client statistics', () => {
			const stats = client.getStats()

			expect(stats).toHaveProperty('state')
			expect(stats).toHaveProperty('uptime')
			expect(stats).toHaveProperty('requestCount')
			expect(stats).toHaveProperty('errorCount')
			expect(stats).toHaveProperty('cacheStats')
			expect(stats).toHaveProperty('retryStats')
			expect(stats).toHaveProperty('batchStats')
			expect(stats).toHaveProperty('authStats')
		})

		it('should get infrastructure statistics', () => {
			const stats = client.getInfrastructureStats()

			expect(stats).toHaveProperty('cache')
			expect(stats).toHaveProperty('retry')
			expect(stats).toHaveProperty('batch')
			expect(stats).toHaveProperty('auth')
		})

		it('should get service statistics', () => {
			const stats = client.getServiceStats()

			expect(stats).toHaveProperty('events')
			expect(stats).toHaveProperty('compliance')
			expect(stats).toHaveProperty('scheduledReports')
			expect(stats).toHaveProperty('presets')
			expect(stats).toHaveProperty('metrics')
			expect(stats).toHaveProperty('health')
		})

		it('should destroy client properly', async () => {
			await client.destroy()

			expect(client.isDestroyed()).toBe(true)
			expect(client.getState()).toBe('destroyed')
			expect(client.isReady()).toBe(false)
		})

		it('should throw error when using destroyed client', async () => {
			await client.destroy()

			expect(() => client.events).toThrow('AuditClient has been destroyed and cannot be used')
			expect(() => client.getConfig()).toThrow('AuditClient has been destroyed and cannot be used')
		})
	})

	describe('interceptor management', () => {
		beforeEach(() => {
			client = new AuditClient(baseConfig)
		})

		it('should add request interceptors to all services', () => {
			const interceptor = (options: any) => {
				options.headers = { ...options.headers, 'X-Test': 'true' }
				return options
			}

			expect(() => client.addRequestInterceptor(interceptor)).not.toThrow()
		})

		it('should add response interceptors to all services', () => {
			const interceptor = (response: any) => {
				return { ...response, intercepted: true }
			}

			expect(() => client.addResponseInterceptor(interceptor)).not.toThrow()
		})

		it('should clear all interceptors', () => {
			const requestInterceptor = (options: any) => options
			const responseInterceptor = (response: any) => response

			client.addRequestInterceptor(requestInterceptor)
			client.addResponseInterceptor(responseInterceptor)

			expect(() => client.clearInterceptors()).not.toThrow()
		})
	})

	describe('static factory methods', () => {
		it('should create client for development environment', () => {
			client = AuditClient.createForEnvironment('development', 'https://dev-api.example.com', {
				type: 'apiKey',
				apiKey: 'dev-key',
			})

			expect(client.isReady()).toBe(true)
			const config = client.getConfig()
			expect(config.environment).toBe('development')
			expect(config.baseUrl).toBe('https://dev-api.example.com')
		})

		it('should create client for production environment', () => {
			client = AuditClient.createForEnvironment('production', 'https://api.example.com', {
				type: 'bearer',
				bearerToken: 'prod-token',
			})

			expect(client.isReady()).toBe(true)
			const config = client.getConfig()
			expect(config.environment).toBe('production')
			expect(config.authentication.type).toBe('bearer')
		})

		it('should validate configuration without creating instance', () => {
			const validConfig = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'apiKey' as const, apiKey: 'test' },
			}

			const result = AuditClient.validateConfig(validConfig)
			expect(result.isValid).toBe(true)
			expect(result.errors).toBeUndefined()
		})

		it('should detect invalid configuration', () => {
			const invalidConfig = {
				baseUrl: 'invalid-url',
				authentication: { type: 'apiKey' as const },
			}

			const result = AuditClient.validateConfig(invalidConfig)
			expect(result.isValid).toBe(false)
			expect(result.errors).toBeDefined()
		})
	})
})
