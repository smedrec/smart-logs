import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigLoader } from '../config-loader.js'

import type { LoggingConfig } from '../../types/config.js'

describe('ConfigLoader', () => {
	const testConfigPath = resolve(process.cwd(), 'test-config.json')
	const originalEnv = process.env

	beforeEach(() => {
		// Reset environment variables
		process.env = { ...originalEnv }

		// Clean up any existing test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv

		// Clean up test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}
	})

	describe('load()', () => {
		it('should load configuration with defaults', () => {
			const config = ConfigLoader.load()

			expect(config.level).toBe('info')
			expect(config.service).toBe('application')
			expect(config.environment).toBe('development')
			expect(config.version).toBe('1.0.0')
			expect(config.shutdownTimeoutMs).toBe(30000)
			expect(config.enableCorrelationIds).toBe(true)
		})

		it('should merge provided configuration with defaults', () => {
			const providedConfig: Partial<LoggingConfig> = {
				level: 'debug',
				service: 'test-service',
				console: {
					enabled: true,
					format: 'json',
				},
			}

			const config = ConfigLoader.load(providedConfig)

			expect(config.level).toBe('debug')
			expect(config.service).toBe('test-service')
			expect(config.console?.enabled).toBe(true)
			expect(config.console?.format).toBe('json')
			expect(config.environment).toBe('development') // Should keep default
		})

		it('should load configuration from environment variables', () => {
			process.env.LOG_LEVEL = 'error'
			process.env.LOG_SERVICE = 'env-service'
			process.env.LOG_CONSOLE_ENABLED = 'true'
			process.env.LOG_CONSOLE_FORMAT = 'json'
			process.env.LOG_FILE_ENABLED = 'true'
			process.env.LOG_FILE_FILENAME = '/var/log/app.log'

			const config = ConfigLoader.load()

			expect(config.level).toBe('error')
			expect(config.service).toBe('env-service')
			expect(config.console?.enabled).toBe(true)
			expect(config.console?.format).toBe('json')
			expect(config.file?.enabled).toBe(true)
			expect(config.file?.filename).toBe('/var/log/app.log')
		})

		it('should handle boolean environment variables correctly', () => {
			// Test various boolean formats
			process.env.LOG_CONSOLE_ENABLED = 'true'
			process.env.LOG_FILE_ENABLED = '1'
			process.env.LOG_PERFORMANCE_ENABLED = 'yes'
			process.env.LOG_ENABLE_CORRELATION_IDS = 'false'
			process.env.LOG_ENABLE_REQUEST_TRACKING = '0'

			const config = ConfigLoader.load()

			expect(config.console?.enabled).toBe(true)
			expect(config.file?.enabled).toBe(true)
			expect(config.performance?.enabled).toBe(true)
			expect(config.enableCorrelationIds).toBe(false)
			expect(config.enableRequestTracking).toBe(false)
		})

		it('should handle numeric environment variables correctly', () => {
			process.env.LOG_SHUTDOWN_TIMEOUT_MS = '60000'
			process.env.LOG_FILE_MAX_SIZE = '20971520' // 20MB
			process.env.LOG_REDIS_PORT = '6380'
			process.env.LOG_PERFORMANCE_SAMPLE_RATE = '0.5'

			const config = ConfigLoader.load()

			expect(config.shutdownTimeoutMs).toBe(60000)
			expect(config.file?.maxSize).toBe(20971520)
			expect(config.redis?.port).toBe(6380)
			expect(config.performance?.sampleRate).toBe(0.5)
		})

		it('should throw error for invalid boolean values', () => {
			process.env.LOG_CONSOLE_ENABLED = 'invalid'

			expect(() => ConfigLoader.load()).toThrow('Invalid boolean value: invalid')
		})

		it('should throw error for invalid numeric values', () => {
			process.env.LOG_SHUTDOWN_TIMEOUT_MS = 'not-a-number'

			expect(() => ConfigLoader.load()).toThrow(
				'Invalid number value for LOG_SHUTDOWN_TIMEOUT_MS: not-a-number'
			)
		})

		it('should parse JSON headers for OTLP configuration', () => {
			process.env.LOG_OTLP_HEADERS = '{"Authorization": "Bearer token", "X-Custom": "value"}'

			const config = ConfigLoader.load()

			expect(config.otlp?.headers).toEqual({
				Authorization: 'Bearer token',
				'X-Custom': 'value',
			})
		})

		it('should throw error for invalid JSON headers', () => {
			process.env.LOG_OTLP_HEADERS = 'invalid-json'

			expect(() => ConfigLoader.load()).toThrow('Invalid JSON in LOG_OTLP_HEADERS')
		})
	})

	describe('loadFromFile()', () => {
		it('should load configuration from JSON file', () => {
			const fileConfig = {
				level: 'warn',
				service: 'file-service',
				console: {
					enabled: false,
					format: 'pretty',
				},
			}

			writeFileSync(testConfigPath, JSON.stringify(fileConfig, null, 2))

			const config = ConfigLoader.loadFromFile(testConfigPath)

			expect(config.level).toBe('warn')
			expect(config.service).toBe('file-service')
			expect(config.console?.enabled).toBe(false)
		})

		it('should return empty object if file does not exist', () => {
			const config = ConfigLoader.loadFromFile('/non/existent/path.json')

			expect(config).toEqual({})
		})

		it('should throw error for invalid JSON', () => {
			writeFileSync(testConfigPath, 'invalid json content')

			expect(() => ConfigLoader.loadFromFile(testConfigPath)).toThrow(
				'Failed to load configuration'
			)
		})

		it('should throw error for JavaScript files (not yet supported)', () => {
			const jsConfigPath = testConfigPath.replace('.json', '.js')
			writeFileSync(jsConfigPath, 'module.exports = { level: "debug" }')

			expect(() => ConfigLoader.loadFromFile(jsConfigPath)).toThrow(
				'JavaScript config files are not yet supported'
			)

			unlinkSync(jsConfigPath)
		})

		it('should search for default config files', () => {
			const defaultConfigPath = resolve(process.cwd(), 'logging.config.json')
			const fileConfig = { level: 'debug', service: 'default-config' }

			writeFileSync(defaultConfigPath, JSON.stringify(fileConfig))

			try {
				const config = ConfigLoader.loadFromFile()
				expect(config.level).toBe('debug')
				expect(config.service).toBe('default-config')
			} finally {
				unlinkSync(defaultConfigPath)
			}
		})
	})

	describe('loadFromPath()', () => {
		it('should load and validate configuration from specific path', () => {
			const fileConfig = {
				level: 'debug',
				service: 'path-service',
				console: { enabled: true },
			}

			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = ConfigLoader.loadFromPath(testConfigPath)

			expect(config.level).toBe('debug')
			expect(config.service).toBe('path-service')
			expect(config.console?.enabled).toBe(true)
			// Should include defaults
			expect(config.environment).toBe('development')
		})

		it('should merge file config with provided config', () => {
			const fileConfig = { level: 'debug', service: 'file-service' }
			const providedConfig = { service: 'override-service', environment: 'production' }

			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = ConfigLoader.loadFromPath(testConfigPath, providedConfig)

			expect(config.level).toBe('debug') // From file
			expect(config.service).toBe('override-service') // Overridden by provided
			expect(config.environment).toBe('production') // From provided
		})
	})

	describe('validate()', () => {
		it('should validate valid configuration', () => {
			const validConfig = {
				level: 'info',
				service: 'test-service',
				environment: 'test',
			}

			const config = ConfigLoader.validate(validConfig)

			expect(config.level).toBe('info')
			expect(config.service).toBe('test-service')
			expect(config.environment).toBe('test')
		})

		it('should throw error for invalid configuration', () => {
			const invalidConfig = {
				level: 'invalid-level',
				service: '',
			}

			expect(() => ConfigLoader.validate(invalidConfig)).toThrow('Configuration validation failed')
		})

		it('should provide detailed error messages', () => {
			const invalidConfig = {
				level: 'invalid',
				service: '',
				file: {
					filename: '',
					maxSize: -1,
				},
			}

			expect(() => ConfigLoader.validate(invalidConfig)).toThrow(
				/level.*service.*filename.*maxSize/
			)
		})
	})

	describe('validatePartial()', () => {
		it('should validate partial configuration', () => {
			const partialConfig = {
				level: 'debug',
				console: { enabled: true },
			}

			const config = ConfigLoader.validatePartial(partialConfig)

			expect(config.level).toBe('debug')
			expect(config.console?.enabled).toBe(true)
			// Partial validation should not include defaults, so service should be undefined
			expect(Object.hasOwnProperty.call(config, 'service')).toBe(false)
		})

		it('should throw error for invalid partial configuration', () => {
			const invalidPartialConfig = {
				level: 'invalid-level',
			}

			expect(() => ConfigLoader.validatePartial(invalidPartialConfig)).toThrow(
				'Partial configuration validation failed'
			)
		})
	})

	describe('getDefaults()', () => {
		it('should return default configuration values', () => {
			const defaults = ConfigLoader.getDefaults()

			expect(defaults.level).toBe('info')
			expect(defaults.service).toBe('application')
			expect(defaults.environment).toBe('development')
			expect(defaults.version).toBe('1.0.0')
			expect(defaults.shutdownTimeoutMs).toBe(30000)
			expect(defaults.enableCorrelationIds).toBe(true)
			expect(defaults.enableRequestTracking).toBe(true)
		})
	})

	describe('configuration precedence', () => {
		it('should apply correct precedence: defaults < file < env < provided', () => {
			// Setup file config
			const fileConfig = {
				level: 'warn',
				service: 'file-service',
				environment: 'staging',
			}
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			// Setup environment config
			process.env.LOG_LEVEL = 'error'
			process.env.LOG_SERVICE = 'env-service'

			// Setup provided config
			const providedConfig = {
				service: 'provided-service',
			}

			const config = ConfigLoader.loadFromPath(testConfigPath, providedConfig)

			// Provided should win
			expect(config.service).toBe('provided-service')
			// Environment should win over file
			expect(config.level).toBe('error')
			// File should win over defaults
			expect(config.environment).toBe('staging')
			// Defaults should be used when not overridden
			expect(config.version).toBe('1.0.0')
		})
	})
})
