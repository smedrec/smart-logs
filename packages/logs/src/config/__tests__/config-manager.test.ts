import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigManager } from '../config-manager.js'

import type { LoggingConfig } from '../../types/config.js'

describe('ConfigManager', () => {
	const testConfigPath = resolve(process.cwd(), 'test-manager-config.json')
	let manager: ConfigManager
	const originalEnv = process.env

	beforeEach(() => {
		// Reset environment variables
		process.env = { ...originalEnv }

		// Clean up any existing test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}

		manager = new ConfigManager()
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv

		manager.destroy()

		// Clean up test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}
	})

	describe('load()', () => {
		it('should load configuration with defaults', () => {
			const config = manager.load()

			expect(config.level).toBe('info')
			expect(config.service).toBe('application')
			expect(config.environment).toBe('development')
		})

		it('should emit loaded event', async () => {
			const loadedPromise = new Promise<LoggingConfig>((resolve) => {
				manager.on('loaded', (config) => {
					resolve(config)
				})
			})

			manager.load({ level: 'debug', service: 'test-service' })

			const config = await loadedPromise
			expect(config.level).toBe('debug')
			expect(config.service).toBe('test-service')
		})

		it('should merge provided configuration', () => {
			const providedConfig: Partial<LoggingConfig> = {
				level: 'warn',
				service: 'custom-service',
				console: { enabled: false },
			}

			const config = manager.load(providedConfig)

			expect(config.level).toBe('warn')
			expect(config.service).toBe('custom-service')
			expect(config.console?.enabled).toBe(false)
		})
	})

	describe('loadFromPath()', () => {
		it('should load configuration from file path', () => {
			const fileConfig = {
				level: 'debug',
				service: 'file-service',
				environment: 'staging',
			}

			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = manager.loadFromPath(testConfigPath)

			expect(config.level).toBe('debug')
			expect(config.service).toBe('file-service')
			expect(config.environment).toBe('staging')
		})

		it('should emit loaded event for file loading', async () => {
			const fileConfig = { level: 'error', service: 'error-service' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const loadedPromise = new Promise<LoggingConfig>((resolve) => {
				manager.on('loaded', (config) => {
					resolve(config)
				})
			})

			manager.loadFromPath(testConfigPath)

			const config = await loadedPromise
			expect(config.level).toBe('error')
			expect(config.service).toBe('error-service')
		})
	})

	describe('configuration watching', () => {
		it('should start watching configuration file', () => {
			const fileConfig = { level: 'info', service: 'watched-service' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = manager.startWatching(testConfigPath)

			expect(config.level).toBe('info')
			expect(config.service).toBe('watched-service')
			expect(manager.isWatchingConfig()).toBe(true)
		})

		it('should emit loaded event when starting to watch', async () => {
			const fileConfig = { level: 'debug', service: 'watch-test' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const loadedPromise = new Promise<LoggingConfig>((resolve) => {
				manager.on('loaded', (config) => {
					resolve(config)
				})
			})

			manager.startWatching(testConfigPath)

			const config = await loadedPromise
			expect(config.level).toBe('debug')
			expect(config.service).toBe('watch-test')
		})

		it('should emit reloaded event on file changes', (done) => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			manager.on('reloaded', (data) => {
				expect(data.current.level).toBe('warn')
				expect(data.current.service).toBe('updated')
				expect(data.previous?.service).toBe('initial')
				done()
			})

			manager.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = { level: 'warn', service: 'updated' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)
		})

		it('should emit reload-error event on invalid configuration', (done) => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			manager.on('reload-error', (data) => {
				expect(data.error.message).toContain('Configuration reload failed')
				expect(data.previous?.service).toBe('initial')
				done()
			})

			manager.startWatching(testConfigPath)

			setTimeout(() => {
				const invalidConfig = { level: 'invalid-level', service: '' }
				writeFileSync(testConfigPath, JSON.stringify(invalidConfig))
			}, 50)
		})

		it('should emit critical-changes event for important changes', (done) => {
			const initialConfig = { level: 'info', service: 'original-service' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			manager.on('critical-changes', (data) => {
				expect(data.changes).toContain(
					'Service name changed from "original-service" to "new-service"'
				)
				done()
			})

			manager.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = { level: 'info', service: 'new-service' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)
		})

		it('should throw error when trying to start watching while already watching', () => {
			const fileConfig = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.startWatching(testConfigPath)

			expect(() => manager.startWatching(testConfigPath)).toThrow(
				'Configuration watcher is already active'
			)
		})

		it('should stop watching configuration', () => {
			const fileConfig = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.startWatching(testConfigPath)
			expect(manager.isWatchingConfig()).toBe(true)

			manager.stopWatching()
			expect(manager.isWatchingConfig()).toBe(false)
		})
	})

	describe('manual configuration reload', () => {
		it('should manually reload configuration', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			manager.startWatching(testConfigPath)

			// Update file
			const updatedConfig = { level: 'debug', service: 'manual-update' }
			writeFileSync(testConfigPath, JSON.stringify(updatedConfig))

			const newConfig = await manager.reloadConfig()

			expect(newConfig.level).toBe('debug')
			expect(newConfig.service).toBe('manual-update')
		})

		it('should throw error when trying to reload without watching', async () => {
			await expect(manager.reloadConfig()).rejects.toThrow('Configuration watcher is not active')
		})

		it('should merge provided config during manual reload', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			manager.startWatching(testConfigPath)

			const providedConfig = { environment: 'production' }
			const newConfig = await manager.reloadConfig(providedConfig)

			expect(newConfig.environment).toBe('production')
		})
	})

	describe('getCurrentConfig()', () => {
		it('should return current configuration', () => {
			const config = manager.load({ level: 'debug', service: 'current-test' })

			const currentConfig = manager.getCurrentConfig()
			expect(currentConfig?.level).toBe('debug')
			expect(currentConfig?.service).toBe('current-test')
		})

		it('should return undefined when no configuration is loaded', () => {
			expect(manager.getCurrentConfig()).toBeUndefined()
		})

		it('should update current config when watching', () => {
			const fileConfig = { level: 'info', service: 'watched' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.startWatching(testConfigPath)

			const currentConfig = manager.getCurrentConfig()
			expect(currentConfig?.service).toBe('watched')
		})
	})

	describe('validation methods', () => {
		it('should validate configuration', () => {
			const validConfig = {
				level: 'info',
				service: 'test-service',
				environment: 'test',
			}

			const config = manager.validate(validConfig)

			expect(config.level).toBe('info')
			expect(config.service).toBe('test-service')
		})

		it('should validate partial configuration', () => {
			const partialConfig = {
				level: 'debug',
				console: { enabled: true },
			}

			const config = manager.validatePartial(partialConfig)

			expect(config.level).toBe('debug')
			expect(config.console?.enabled).toBe(true)
		})

		it('should throw error for invalid configuration', () => {
			const invalidConfig = {
				level: 'invalid-level',
				service: '',
			}

			expect(() => manager.validate(invalidConfig)).toThrow('Configuration validation failed')
		})
	})

	describe('configuration merging', () => {
		it('should merge multiple configurations', () => {
			const config1 = { level: 'debug', service: 'service1' }
			const config2 = { service: 'service2', environment: 'production' }
			const config3 = { version: '2.0.0' }

			const merged = manager.mergeConfigs(config1, config2, config3)

			expect(merged.level).toBe('debug') // From config1
			expect(merged.service).toBe('service2') // Overridden by config2
			expect(merged.environment).toBe('production') // From config2
			expect(merged.version).toBe('2.0.0') // From config3
		})

		it('should include defaults in merged configuration', () => {
			const config1 = { level: 'debug' }
			const config2 = { service: 'custom-service' }

			const merged = manager.mergeConfigs(config1, config2)

			expect(merged.level).toBe('debug')
			expect(merged.service).toBe('custom-service')
			expect(merged.environment).toBe('development') // Default value
		})
	})

	describe('configuration snapshots', () => {
		it('should create configuration snapshot', () => {
			const config = manager.load({ level: 'debug', service: 'snapshot-test' })

			const snapshot = manager.createSnapshot()

			expect(snapshot.config?.level).toBe('debug')
			expect(snapshot.config?.service).toBe('snapshot-test')
			expect(snapshot.isWatching).toBe(false)
			expect(snapshot.source).toBe('static-load')
			expect(snapshot.timestamp).toBeInstanceOf(Date)
		})

		it('should create snapshot with watching information', () => {
			const fileConfig = { level: 'info', service: 'watched-snapshot' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.startWatching(testConfigPath)

			const snapshot = manager.createSnapshot()

			expect(snapshot.isWatching).toBe(true)
			expect(snapshot.source).toBe('file-watcher')
		})

		it('should create snapshot with undefined config when not loaded', () => {
			const snapshot = manager.createSnapshot()

			expect(snapshot.config).toBeUndefined()
			expect(snapshot.isWatching).toBe(false)
		})
	})

	describe('getDefaults()', () => {
		it('should return default configuration values', () => {
			const defaults = manager.getDefaults()

			expect(defaults.level).toBe('info')
			expect(defaults.service).toBe('application')
			expect(defaults.environment).toBe('development')
		})
	})

	describe('destroy()', () => {
		it('should clean up all resources', () => {
			const fileConfig = { level: 'info', service: 'cleanup-test' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.startWatching(testConfigPath)
			expect(manager.isWatchingConfig()).toBe(true)
			expect(manager.getCurrentConfig()).toBeDefined()

			manager.destroy()

			expect(manager.isWatchingConfig()).toBe(false)
			expect(manager.getCurrentConfig()).toBeUndefined()
		})

		it('should remove all event listeners', () => {
			let eventEmitted = false
			manager.on('loaded', () => {
				eventEmitted = true
			})

			manager.destroy()
			manager.emit('loaded', {} as LoggingConfig)

			expect(eventEmitted).toBe(false)
		})
	})

	describe('error handling', () => {
		it('should forward watcher errors', (done) => {
			const fileConfig = { level: 'info', service: 'error-test' }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			manager.on('error', (error) => {
				expect(error.message).toContain('Configuration file watcher error')
				done()
			})

			manager.startWatching(testConfigPath)

			// Simulate watcher error
			setTimeout(() => {
				// @ts-ignore - accessing private property for testing
				manager.watcher?.emit('error', new Error('Simulated watcher error'))
			}, 50)
		})

		it('should handle invalid initial configuration when watching', () => {
			const invalidConfig = { level: 'invalid-level', service: '' }
			writeFileSync(testConfigPath, JSON.stringify(invalidConfig))

			expect(() => manager.startWatching(testConfigPath)).toThrow(
				'Failed to load initial configuration'
			)
		})
	})

	describe('integration with environment variables', () => {
		it('should load configuration with environment variables', () => {
			process.env.LOG_LEVEL = 'error'
			process.env.LOG_SERVICE = 'env-service'
			process.env.LOG_CONSOLE_ENABLED = 'false'

			const config = manager.load()

			expect(config.level).toBe('error')
			expect(config.service).toBe('env-service')
			expect(config.console?.enabled).toBe(false)
		})

		it('should merge environment variables with file configuration when watching', () => {
			process.env.LOG_LEVEL = 'warn'
			process.env.LOG_ENVIRONMENT = 'production'

			const fileConfig = { service: 'file-service', console: { enabled: true } }
			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = manager.startWatching(testConfigPath)

			expect(config.level).toBe('warn') // From environment
			expect(config.service).toBe('file-service') // From file
			expect(config.environment).toBe('production') // From environment
			expect(config.console?.enabled).toBe(true) // From file
		})
	})
})
