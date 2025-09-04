import { describe, expect, it } from 'vitest'

import { ConfigManager } from '../core/config'
import {
	ConfigBuilder,
	ConfigMigration,
	ConfigPresets,
	ConfigValidators,
} from '../utils/config-helpers'

describe('ConfigBuilder', () => {
	it('should build configuration fluently', () => {
		const config = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.apiVersion('v2')
			.timeout(45000)
			.environment('production')
			.withApiKey('test-key')
			.withRetry({
				enabled: true,
				maxAttempts: 5,
			})
			.withCache({
				enabled: true,
				defaultTtlMs: 600000,
			})
			.withLogging({
				level: 'warn',
				maskSensitiveData: true,
			})
			.withHeaders({
				'X-Custom': 'value',
			})
			.build()

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.apiVersion).toBe('v2')
		expect(config.timeout).toBe(45000)
		expect(config.environment).toBe('production')
		expect(config.authentication?.type).toBe('apiKey')
		expect(config.authentication?.apiKey).toBe('test-key')
		expect(config.retry?.enabled).toBe(true)
		expect(config.retry?.maxAttempts).toBe(5)
		expect(config.cache?.enabled).toBe(true)
		expect(config.cache?.defaultTtlMs).toBe(600000)
		expect(config.logging?.level).toBe('warn')
		expect(config.logging?.maskSensitiveData).toBe(true)
		expect(config.customHeaders).toEqual({ 'X-Custom': 'value' })
	})

	it('should support different authentication methods', () => {
		const apiKeyConfig = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withApiKey('api-key')
			.build()

		expect(apiKeyConfig.authentication?.type).toBe('apiKey')
		expect(apiKeyConfig.authentication?.apiKey).toBe('api-key')

		const bearerConfig = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withBearerToken('bearer-token', true)
			.build()

		expect(bearerConfig.authentication?.type).toBe('bearer')
		expect(bearerConfig.authentication?.bearerToken).toBe('bearer-token')
		expect(bearerConfig.authentication?.autoRefresh).toBe(true)

		const sessionConfig = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withSessionToken('session-token')
			.build()

		expect(sessionConfig.authentication?.type).toBe('session')
		expect(sessionConfig.authentication?.sessionToken).toBe('session-token')

		const customConfig = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withCustomAuth({ 'X-Auth': 'custom' })
			.build()

		expect(customConfig.authentication?.type).toBe('custom')
		expect(customConfig.authentication?.customHeaders).toEqual({ 'X-Auth': 'custom' })
	})

	it('should create ConfigManager instance', () => {
		const manager = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withApiKey('test-key')
			.createManager()

		expect(manager).toBeInstanceOf(ConfigManager)
		expect(manager.getConfig().baseUrl).toBe('https://api.example.com')
	})
})

describe('ConfigPresets', () => {
	it('should create minimal configuration', () => {
		const config = ConfigPresets.minimal('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.authentication?.type).toBe('apiKey')
		expect(config.authentication?.apiKey).toBe('test-key')
	})

	it('should create development configuration', () => {
		const config = ConfigPresets.development('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.environment).toBe('development')
		expect(config.logging?.level).toBe('debug')
		expect(config.logging?.includeRequestBody).toBe(true)
		expect(config.errorHandling?.includeStackTrace).toBe(true)
	})

	it('should create production configuration', () => {
		const config = ConfigPresets.production('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.environment).toBe('production')
		expect(config.logging?.level).toBe('warn')
		expect(config.logging?.maskSensitiveData).toBe(true)
		expect(config.errorHandling?.includeStackTrace).toBe(false)
		expect(config.performance?.maxConcurrentRequests).toBe(20)
	})

	it('should create high-performance configuration', () => {
		const config = ConfigPresets.highPerformance('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.performance?.enableCompression).toBe(true)
		expect(config.performance?.maxConcurrentRequests).toBe(50)
		expect(config.cache?.enabled).toBe(true)
		expect(config.cache?.maxSize).toBe(5000)
		expect(config.batching?.enabled).toBe(true)
		expect(config.batching?.maxBatchSize).toBe(20)
	})

	it('should create debugging configuration', () => {
		const config = ConfigPresets.debugging('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.logging?.level).toBe('debug')
		expect(config.logging?.includeRequestBody).toBe(true)
		expect(config.logging?.includeResponseBody).toBe(true)
		expect(config.logging?.maskSensitiveData).toBe(false)
		expect(config.errorHandling?.includeStackTrace).toBe(true)
		expect(config.retry?.enabled).toBe(false)
		expect(config.cache?.enabled).toBe(false)
	})

	it('should create mobile configuration', () => {
		const config = ConfigPresets.mobile('https://api.example.com', 'test-key')

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.timeout).toBe(15000)
		expect(config.retry?.maxAttempts).toBe(2)
		expect(config.cache?.storage).toBe('memory')
		expect(config.cache?.maxSize).toBe(500)
		expect(config.performance?.maxConcurrentRequests).toBe(5)
		expect(config.logging?.level).toBe('warn')
	})
})

describe('ConfigValidators', () => {
	describe('validateAuthentication', () => {
		it('should validate missing authentication', () => {
			const config = { baseUrl: 'https://api.example.com' }
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toContain('Authentication configuration is required')
		})

		it('should validate missing API key', () => {
			const config = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'apiKey' as const },
			}
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toContain('API key is required for apiKey authentication')
		})

		it('should validate missing session token', () => {
			const config = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'session' as const },
			}
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toContain('Session token is required for session authentication')
		})

		it('should validate missing bearer token', () => {
			const config = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'bearer' as const },
			}
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toContain('Bearer token is required for bearer authentication')
		})

		it('should validate missing custom headers', () => {
			const config = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'custom' as const },
			}
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toContain('Custom headers are required for custom authentication')
		})

		it('should pass validation for valid authentication', () => {
			const config = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'apiKey' as const, apiKey: 'test-key' },
			}
			const errors = ConfigValidators.validateAuthentication(config)

			expect(errors).toHaveLength(0)
		})
	})

	describe('validatePerformance', () => {
		it('should warn about high concurrent requests', () => {
			const config = {
				performance: { maxConcurrentRequests: 150 },
			}
			const warnings = ConfigValidators.validatePerformance(config)

			expect(warnings).toContain('High concurrent request limit may cause performance issues')
		})

		it('should warn about large cache size', () => {
			const config = {
				cache: { maxSize: 15000 },
			}
			const warnings = ConfigValidators.validatePerformance(config)

			expect(warnings).toContain('Large cache size may consume significant memory')
		})

		it('should warn about high retry attempts', () => {
			const config = {
				retry: { maxAttempts: 10 },
			}
			const warnings = ConfigValidators.validatePerformance(config)

			expect(warnings).toContain('High retry attempts may cause long delays')
		})
	})

	describe('validateEnvironment', () => {
		it('should warn about debug logging in production', () => {
			const config = {
				environment: 'production' as const,
				logging: { level: 'debug' as const },
			}
			const warnings = ConfigValidators.validateEnvironment(config)

			expect(warnings).toContain('Debug logging is not recommended for production')
		})

		it('should warn about including request bodies in production', () => {
			const config = {
				environment: 'production' as const,
				logging: { includeRequestBody: true },
			}
			const warnings = ConfigValidators.validateEnvironment(config)

			expect(warnings).toContain(
				'Including request/response bodies in logs is not recommended for production'
			)
		})

		it('should warn about stack traces in production', () => {
			const config = {
				environment: 'production' as const,
				errorHandling: { includeStackTrace: true },
			}
			const warnings = ConfigValidators.validateEnvironment(config)

			expect(warnings).toContain('Including stack traces is not recommended for production')
		})

		it('should warn about disabled sensitive data masking in production', () => {
			const config = {
				environment: 'production' as const,
				logging: { maskSensitiveData: false },
			}
			const warnings = ConfigValidators.validateEnvironment(config)

			expect(warnings).toContain('Sensitive data masking should be enabled in production')
		})
	})
})

describe('ConfigMigration', () => {
	describe('migrateLegacyConfig', () => {
		it('should migrate legacy configuration fields', () => {
			const legacyConfig = {
				baseUrl: 'https://api.example.com',
				apiKey: 'test-key',
				version: 'v2',
				retries: 5,
				backoffMs: 2000,
				maxBackoffMs: 60000,
				headers: { 'X-Custom': 'value' },
			}

			const migratedConfig = ConfigMigration.migrateLegacyConfig(legacyConfig)

			expect(migratedConfig.baseUrl).toBe('https://api.example.com')
			expect(migratedConfig.authentication?.type).toBe('apiKey')
			expect(migratedConfig.authentication?.apiKey).toBe('test-key')
			expect(migratedConfig.apiVersion).toBe('v2')
			expect(migratedConfig.retry?.enabled).toBe(true)
			expect(migratedConfig.retry?.maxAttempts).toBe(5)
			expect(migratedConfig.retry?.initialDelayMs).toBe(2000)
			expect(migratedConfig.retry?.maxDelayMs).toBe(60000)
			expect(migratedConfig.customHeaders).toEqual({ 'X-Custom': 'value' })
		})

		it('should handle disabled retries', () => {
			const legacyConfig = {
				baseUrl: 'https://api.example.com',
				apiKey: 'test-key',
				retries: 0,
			}

			const migratedConfig = ConfigMigration.migrateLegacyConfig(legacyConfig)

			expect(migratedConfig.retry?.enabled).toBe(false)
			expect(migratedConfig.retry?.maxAttempts).toBe(0)
		})

		it('should handle missing fields gracefully', () => {
			const legacyConfig = {
				baseUrl: 'https://api.example.com',
			}

			const migratedConfig = ConfigMigration.migrateLegacyConfig(legacyConfig)

			expect(migratedConfig.baseUrl).toBe('https://api.example.com')
			expect(migratedConfig.authentication).toBeUndefined()
		})
	})

	describe('getMigrationWarnings', () => {
		it('should generate warnings for deprecated options', () => {
			const legacyConfig = {
				retries: 3,
				backoffMs: 1000,
				maxBackoffMs: 30000,
				version: 'v1',
				headers: {},
			}

			const warnings = ConfigMigration.getMigrationWarnings(legacyConfig)

			expect(warnings).toContain('The "retries" option has been moved to "retry.maxAttempts"')
			expect(warnings).toContain('The "backoffMs" option has been moved to "retry.initialDelayMs"')
			expect(warnings).toContain('The "maxBackoffMs" option has been moved to "retry.maxDelayMs"')
			expect(warnings).toContain('The "version" option has been renamed to "apiVersion"')
			expect(warnings).toContain('The "headers" option has been moved to "customHeaders"')
		})

		it('should return empty array for new configuration', () => {
			const newConfig = {
				baseUrl: 'https://api.example.com',
				authentication: { type: 'apiKey', apiKey: 'test' },
			}

			const warnings = ConfigMigration.getMigrationWarnings(newConfig)

			expect(warnings).toHaveLength(0)
		})
	})
})

describe('Configuration Integration with Helpers', () => {
	it('should work with ConfigBuilder and ConfigManager', () => {
		const manager = new ConfigBuilder()
			.baseUrl('https://api.example.com')
			.withApiKey('test-key')
			.withRetry({ maxAttempts: 5 })
			.withCache({ enabled: true })
			.createManager()

		const config = manager.getConfig()

		expect(config.baseUrl).toBe('https://api.example.com')
		expect(config.authentication.type).toBe('apiKey')
		expect(config.retry.maxAttempts).toBe(5)
		expect(config.cache.enabled).toBe(true)
	})

	it('should validate preset configurations', () => {
		const productionConfig = ConfigPresets.production('https://api.example.com', 'test-key')
		const validationResult = ConfigManager.validateConfig(productionConfig)

		expect(validationResult.isValid).toBe(true)
		expect(validationResult.config).toBeDefined()
	})

	it('should migrate and validate legacy configuration', () => {
		const legacyConfig = {
			baseUrl: 'https://api.example.com',
			apiKey: 'test-key',
			retries: 3,
		}

		const migratedConfig = ConfigMigration.migrateLegacyConfig(legacyConfig)
		const validationResult = ConfigManager.validateConfig(migratedConfig)

		expect(validationResult.isValid).toBe(true)
		expect(validationResult.config?.retry?.maxAttempts).toBe(3)
	})
})
