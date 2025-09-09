import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AuditClientConfig,
	ConfigManager,
	ConfigurationError,
	PartialAuditClientConfig,
} from '../../core/config'

describe('ConfigManager', () => {
	let validConfig: PartialAuditClientConfig

	beforeEach(() => {
		validConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
		}
	})

	describe('constructor and validation', () => {
		it('should create ConfigManager with valid configuration', () => {
			const manager = new ConfigManager(validConfig)
			expect(manager).toBeInstanceOf(ConfigManager)
		})

		it('should throw ConfigurationError for invalid baseUrl', () => {
			const invalidConfig = {
				...validConfig,
				baseUrl: 'not-a-url',
			}

			expect(() => new ConfigManager(invalidConfig)).toThrow(ConfigurationError)
		})

		it('should throw ConfigurationError for missing required fields', () => {
			const invalidConfig = {
				authentication: {
					type: 'apiKey' as const,
				},
			}

			expect(() => new ConfigManager(invalidConfig)).toThrow(ConfigurationError)
		})

		it('should apply default values for optional fields', () => {
			const manager = new ConfigManager(validConfig)
			const config = manager.getConfig()

			expect(config.apiVersion).toBe('v1')
			expect(config.timeout).toBe(30000)
			expect(config.retry.enabled).toBe(true)
			expect(config.retry.maxAttempts).toBe(3)
			expect(config.cache.enabled).toBe(true)
			expect(config.logging.enabled).toBe(true)
		})
	})

	describe('getConfig', () => {
		it('should return a copy of the configuration', () => {
			const manager = new ConfigManager(validConfig)
			const config1 = manager.getConfig()
			const config2 = manager.getConfig()

			expect(config1).toEqual(config2)
			expect(config1).not.toBe(config2) // Different objects
		})
	})

	describe('updateConfig', () => {
		it('should update configuration with new values', () => {
			const manager = new ConfigManager(validConfig)

			manager.updateConfig({
				timeout: 60000,
				retry: {
					maxAttempts: 5,
				},
			})

			const config = manager.getConfig()
			expect(config.timeout).toBe(60000)
			expect(config.retry.maxAttempts).toBe(5)
			// Other values should remain unchanged
			expect(config.baseUrl).toBe(validConfig.baseUrl)
		})

		it('should validate updated configuration', () => {
			const manager = new ConfigManager(validConfig)

			expect(() => {
				manager.updateConfig({
					timeout: -1000, // Invalid timeout
				})
			}).toThrow(ConfigurationError)
		})

		it('should deep merge nested objects', () => {
			const manager = new ConfigManager(validConfig)

			manager.updateConfig({
				retry: {
					maxAttempts: 5,
					// initialDelayMs should keep default value
				},
			})

			const config = manager.getConfig()
			expect(config.retry.maxAttempts).toBe(5)
			expect(config.retry.initialDelayMs).toBe(1000) // Default value
			expect(config.retry.enabled).toBe(true) // Default value
		})
	})

	describe('loadEnvironmentConfig', () => {
		it('should load environment-specific configuration', () => {
			const manager = new ConfigManager({
				...validConfig,
				environment: 'development',
			})

			manager.loadEnvironmentConfig('development', {
				logging: {
					level: 'debug',
				},
			})

			const config = manager.getConfig()
			expect(config.logging.level).toBe('debug')
		})

		it('should not apply environment config if environment does not match', () => {
			const manager = new ConfigManager({
				...validConfig,
				environment: 'production',
			})

			manager.loadEnvironmentConfig('development', {
				logging: {
					level: 'debug',
				},
			})

			const config = manager.getConfig()
			expect(config.logging.level).toBe('info') // Default value
		})
	})

	describe('validateConfig static method', () => {
		it('should return valid result for correct configuration', () => {
			const result = ConfigManager.validateConfig(validConfig)

			expect(result.isValid).toBe(true)
			expect(result.config).toBeDefined()
			expect(result.errors).toBeUndefined()
		})

		it('should return invalid result for incorrect configuration', () => {
			const invalidConfig = {
				baseUrl: 'not-a-url',
				authentication: {
					type: 'apiKey' as const,
				},
			}

			const result = ConfigManager.validateConfig(invalidConfig)

			expect(result.isValid).toBe(false)
			expect(result.config).toBeUndefined()
			expect(result.errors).toBeDefined()
		})
	})

	describe('fromEnvironment static method', () => {
		beforeEach(() => {
			// Mock process.env
			vi.stubGlobal('process', {
				env: {
					AUDIT_CLIENT_BASE_URL: 'https://api.example.com',
					AUDIT_CLIENT_API_VERSION: 'v2',
					AUDIT_CLIENT_TIMEOUT: '45000',
					AUDIT_CLIENT_ENVIRONMENT: 'staging',
					AUDIT_CLIENT_AUTH_TYPE: 'bearer',
					AUDIT_CLIENT_BEARER_TOKEN: 'test-bearer-token',
					AUDIT_CLIENT_AUTH_AUTO_REFRESH: 'true',
					AUDIT_CLIENT_RETRY_ENABLED: 'false',
					AUDIT_CLIENT_CACHE_ENABLED: 'true',
					AUDIT_CLIENT_CACHE_DEFAULT_TTL_MS: '600000',
					AUDIT_CLIENT_LOGGING_ENABLED: 'true',
					AUDIT_CLIENT_LOGGING_LEVEL: 'debug',
					AUDIT_CLIENT_LOGGING_INCLUDE_REQUEST_BODY: 'true',
					AUDIT_CLIENT_CUSTOM_HEADERS: '{"X-Custom": "value"}',
				},
			})
		})

		it('should create configuration from environment variables', () => {
			const config = ConfigManager.fromEnvironment()

			expect(config.baseUrl).toBe('https://api.example.com')
			expect(config.apiVersion).toBe('v2')
			expect(config.timeout).toBe(45000)
			expect(config.environment).toBe('staging')
			expect(config.authentication?.type).toBe('bearer')
			expect(config.authentication?.bearerToken).toBe('test-bearer-token')
			expect(config.authentication?.autoRefresh).toBe(true)
			expect(config.retry?.enabled).toBe(false)
			expect(config.cache?.enabled).toBe(true)
			expect(config.cache?.defaultTtlMs).toBe(600000)
			expect(config.logging?.enabled).toBe(true)
			expect(config.logging?.level).toBe('debug')
			expect(config.logging?.includeRequestBody).toBe(true)
			expect(config.customHeaders).toEqual({ 'X-Custom': 'value' })
		})

		it('should use custom prefix for environment variables', () => {
			vi.stubGlobal('process', {
				env: {
					CUSTOM_BASE_URL: 'https://custom.example.com',
					CUSTOM_API_VERSION: 'v3',
				},
			})

			const config = ConfigManager.fromEnvironment('CUSTOM_')

			expect(config.baseUrl).toBe('https://custom.example.com')
			expect(config.apiVersion).toBe('v3')
		})

		it('should handle missing environment variables gracefully', () => {
			vi.stubGlobal('process', { env: {} })

			const config = ConfigManager.fromEnvironment()

			expect(config).toEqual({})
		})
	})

	describe('createDefaultConfig static method', () => {
		it('should create development configuration', () => {
			const config = ConfigManager.createDefaultConfig('development')

			expect(config.environment).toBe('development')
			expect(config.logging?.level).toBe('debug')
			expect(config.logging?.includeRequestBody).toBe(true)
			expect(config.logging?.includeResponseBody).toBe(true)
			expect(config.errorHandling?.includeStackTrace).toBe(true)
			expect(config.retry?.maxAttempts).toBe(2)
		})

		it('should create staging configuration', () => {
			const config = ConfigManager.createDefaultConfig('staging')

			expect(config.environment).toBe('staging')
			expect(config.logging?.level).toBe('info')
			expect(config.logging?.includeRequestBody).toBe(false)
			expect(config.logging?.includeResponseBody).toBe(false)
			expect(config.errorHandling?.includeStackTrace).toBe(false)
			expect(config.performance?.enableCompression).toBe(true)
		})

		it('should create production configuration', () => {
			const config = ConfigManager.createDefaultConfig('production')

			expect(config.environment).toBe('production')
			expect(config.logging?.level).toBe('warn')
			expect(config.logging?.maskSensitiveData).toBe(true)
			expect(config.errorHandling?.includeStackTrace).toBe(false)
			expect(config.performance?.maxConcurrentRequests).toBe(20)
			expect(config.cache?.enabled).toBe(true)
			expect(config.cache?.defaultTtlMs).toBe(600000)
		})
	})

	describe('configuration validation edge cases', () => {
		it('should validate retry configuration bounds', () => {
			expect(() => {
				new ConfigManager({
					...validConfig,
					retry: {
						maxAttempts: 0, // Below minimum
					},
				})
			}).toThrow(ConfigurationError)

			expect(() => {
				new ConfigManager({
					...validConfig,
					retry: {
						maxAttempts: 15, // Above maximum
					},
				})
			}).toThrow(ConfigurationError)
		})

		it('should validate cache configuration bounds', () => {
			expect(() => {
				new ConfigManager({
					...validConfig,
					cache: {
						defaultTtlMs: 500, // Below minimum
					},
				})
			}).toThrow(ConfigurationError)

			expect(() => {
				new ConfigManager({
					...validConfig,
					cache: {
						maxSize: 5, // Below minimum
					},
				})
			}).toThrow(ConfigurationError)
		})

		it('should validate timeout bounds', () => {
			expect(() => {
				new ConfigManager({
					...validConfig,
					timeout: 500, // Below minimum
				})
			}).toThrow(ConfigurationError)

			expect(() => {
				new ConfigManager({
					...validConfig,
					timeout: 400000, // Above maximum
				})
			}).toThrow(ConfigurationError)
		})
	})

	describe('ConfigurationError', () => {
		it('should create error with message and validation errors', () => {
			const zodErrors = [
				{
					code: 'invalid_type' as const,
					expected: 'string',
					received: 'number',
					path: ['baseUrl'],
					message: 'Expected string, received number',
				},
			]

			const error = new ConfigurationError('Test error', zodErrors)

			expect(error.name).toBe('ConfigurationError')
			expect(error.message).toBe('Test error')
			expect(error.errors).toEqual(zodErrors)
		})

		it('should format errors correctly', () => {
			const zodErrors = [
				{
					code: 'invalid_type' as const,
					expected: 'string',
					received: 'number',
					path: ['baseUrl'],
					message: 'Expected string, received number',
				},
				{
					code: 'too_small' as const,
					minimum: 1,
					type: 'number' as const,
					inclusive: true,
					exact: false,
					path: ['retry', 'maxAttempts'],
					message: 'Number must be greater than or equal to 1',
				},
			]

			const error = new ConfigurationError('Validation failed', zodErrors)
			const formatted = error.getFormattedErrors()

			expect(formatted).toContain('baseUrl: Expected string, received number')
			expect(formatted).toContain('retry.maxAttempts: Number must be greater than or equal to 1')
		})

		it('should handle empty errors array', () => {
			const error = new ConfigurationError('Simple error')
			const formatted = error.getFormattedErrors()

			expect(formatted).toBe('Simple error')
		})
	})
})

describe('Configuration Integration', () => {
	it('should work with complete configuration workflow', () => {
		// Create base configuration
		const baseConfig: PartialAuditClientConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
		}

		// Create manager
		const manager = new ConfigManager(baseConfig)

		// Load environment-specific config
		manager.loadEnvironmentConfig('development', {
			logging: {
				level: 'debug',
			},
			retry: {
				maxAttempts: 2,
			},
		})

		// Update with runtime config
		manager.updateConfig({
			timeout: 45000,
			cache: {
				enabled: false,
			},
		})

		// Verify final configuration
		const finalConfig = manager.getConfig()
		expect(finalConfig.baseUrl).toBe('https://api.example.com')
		expect(finalConfig.authentication.type).toBe('apiKey')
		expect(finalConfig.authentication.apiKey).toBe('test-key')
		expect(finalConfig.timeout).toBe(45000)
		expect(finalConfig.cache.enabled).toBe(false)
		expect(finalConfig.retry.maxAttempts).toBe(3) // Default since no environment applied
	})
})
