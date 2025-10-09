import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ConfigWatcher } from '../config-watcher.js'

import type { LoggingConfig } from '../../types/config.js'

describe('ConfigWatcher', () => {
	const testConfigPath = resolve(process.cwd(), 'test-watcher-config.json')
	let watcher: ConfigWatcher

	beforeEach(() => {
		// Clean up any existing test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}

		watcher = new ConfigWatcher({ reloadDebounceMs: 100 })
	})

	afterEach(() => {
		watcher.stopWatching()

		// Clean up test config file
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}
	})

	describe('startWatching()', () => {
		it('should load initial configuration and start watching', () => {
			const initialConfig = {
				level: 'debug',
				service: 'watcher-test',
				environment: 'test',
			}

			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const config = watcher.startWatching(testConfigPath)

			expect(config.level).toBe('debug')
			expect(config.service).toBe('watcher-test')
			expect(config.environment).toBe('test')
		})

		it('should emit loaded event on successful start', async () => {
			const initialConfig = {
				level: 'info',
				service: 'test-service',
			}

			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const loadedPromise = new Promise<LoggingConfig>((resolve) => {
				watcher.on('loaded', (config) => {
					resolve(config)
				})
			})

			watcher.startWatching(testConfigPath)

			const config = await loadedPromise
			expect(config.level).toBe('info')
			expect(config.service).toBe('test-service')
		})

		it('should throw error if initial configuration is invalid', () => {
			const invalidConfig = {
				level: 'invalid-level',
				service: '',
			}

			writeFileSync(testConfigPath, JSON.stringify(invalidConfig))

			expect(() => watcher.startWatching(testConfigPath)).toThrow(
				'Failed to load initial configuration'
			)
		})

		it('should throw error if config file does not exist', () => {
			expect(() => watcher.startWatching('/non/existent/config.json')).toThrow()
		})

		it('should merge initial config with provided config', () => {
			const fileConfig = { level: 'debug', service: 'file-service' }
			const providedConfig = { service: 'provided-service', environment: 'production' }

			writeFileSync(testConfigPath, JSON.stringify(fileConfig))

			const config = watcher.startWatching(testConfigPath, providedConfig)

			expect(config.level).toBe('debug') // From file
			expect(config.service).toBe('provided-service') // Overridden
			expect(config.environment).toBe('production') // From provided
		})
	})

	describe('configuration reloading', () => {
		it('should reload configuration when file changes', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const reloadedPromise = new Promise((resolve) => {
				watcher.on('reloaded', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			// Wait a bit then update the file
			setTimeout(() => {
				const updatedConfig = { level: 'warn', service: 'updated' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await reloadedPromise) as any
			expect(data.current.level).toBe('warn')
			expect(data.current.service).toBe('updated')
			expect(data.previous?.service).toBe('initial')
			expect(data.changes).toHaveLength(2) // level and service changed
		})

		it('should debounce multiple rapid file changes', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			let reloadCount = 0
			watcher.on('reloaded', () => {
				reloadCount++
			})

			watcher.startWatching(testConfigPath)

			// Make multiple rapid changes
			setTimeout(() => {
				writeFileSync(testConfigPath, JSON.stringify({ level: 'debug', service: 'change1' }))
				writeFileSync(testConfigPath, JSON.stringify({ level: 'warn', service: 'change2' }))
				writeFileSync(testConfigPath, JSON.stringify({ level: 'error', service: 'final' }))
			}, 50)

			// Wait for debounce period
			await new Promise((resolve) => setTimeout(resolve, 300))
			expect(reloadCount).toBe(1) // Should only reload once due to debouncing
		})

		it('should emit reload-error on invalid configuration', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const errorPromise = new Promise((resolve) => {
				watcher.on('reload-error', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const invalidConfig = { level: 'invalid-level', service: '' }
				writeFileSync(testConfigPath, JSON.stringify(invalidConfig))
			}, 50)

			const data = (await errorPromise) as any
			expect(data.error.message).toContain('Configuration reload failed')
			expect(data.previous?.service).toBe('initial')
			expect(data.fallback?.service).toBe('initial') // Should fallback to previous
		})

		it('should emit critical-changes warning for service name changes', async () => {
			const initialConfig = { level: 'info', service: 'original-service' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const criticalChangesPromise = new Promise((resolve) => {
				watcher.on('critical-changes', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = { level: 'info', service: 'new-service' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await criticalChangesPromise) as any
			expect(data.changes).toContain(
				'Service name changed from "original-service" to "new-service"'
			)
			expect(data.previous.service).toBe('original-service')
			expect(data.next.service).toBe('new-service')
		})
	})

	describe('manual reload', () => {
		it('should manually reload configuration', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			watcher.startWatching(testConfigPath)

			// Update file without triggering watcher
			const updatedConfig = { level: 'debug', service: 'manual-update' }
			writeFileSync(testConfigPath, JSON.stringify(updatedConfig))

			const newConfig = await watcher.reloadConfig()

			expect(newConfig.level).toBe('debug')
			expect(newConfig.service).toBe('manual-update')
		})

		it('should throw error when trying to reload without watching', async () => {
			await expect(watcher.reloadConfig()).rejects.toThrow('No configuration file is being watched')
		})

		it('should merge provided config during manual reload', async () => {
			const initialConfig = { level: 'info', service: 'initial' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			watcher.startWatching(testConfigPath)

			const providedConfig = { environment: 'production' }
			const newConfig = await watcher.reloadConfig(providedConfig)

			expect(newConfig.level).toBe('info') // From file
			expect(newConfig.service).toBe('initial') // From file
			expect(newConfig.environment).toBe('production') // From provided
		})
	})

	describe('configuration change detection', () => {
		it('should detect added configuration properties', async () => {
			const initialConfig = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const reloadedPromise = new Promise((resolve) => {
				watcher.on('reloaded', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = {
					level: 'info',
					service: 'test',
					version: '2.0.0', // This will be different from default '1.0.0'
				}
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await reloadedPromise) as any
			const modifiedChanges = data.changes.filter((c: any) => c.type === 'modified')
			expect(modifiedChanges.length).toBeGreaterThan(0)
			const versionChange = modifiedChanges.find((c: any) => c.path === 'version')
			expect(versionChange).toBeDefined()
			expect(versionChange.previous).toBe('1.0.0')
			expect(versionChange.current).toBe('2.0.0')
		})

		it('should detect removed configuration properties', async () => {
			const initialConfig = {
				level: 'info',
				service: 'test',
				version: '2.0.0',
				enableDebugMode: true,
			}
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const reloadedPromise = new Promise((resolve) => {
				watcher.on('reloaded', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = { level: 'info', service: 'test' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await reloadedPromise) as any
			const modifiedChanges = data.changes.filter((c: any) => c.type === 'modified')
			expect(modifiedChanges.length).toBeGreaterThan(0)
			// Check that version changed back to default
			const versionChange = modifiedChanges.find((c: any) => c.path === 'version')
			expect(versionChange).toBeDefined()
			expect(versionChange.previous).toBe('2.0.0')
			expect(versionChange.current).toBe('1.0.0')
		})

		it('should detect modified configuration properties', async () => {
			const initialConfig = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const reloadedPromise = new Promise((resolve) => {
				watcher.on('reloaded', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = { level: 'debug', service: 'test' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await reloadedPromise) as any
			const modifiedChanges = data.changes.filter((c: any) => c.type === 'modified')
			expect(modifiedChanges).toHaveLength(1)
			expect(modifiedChanges[0].path).toBe('level')
			expect(modifiedChanges[0].previous).toBe('info')
			expect(modifiedChanges[0].current).toBe('debug')
		})

		it('should detect nested configuration changes', async () => {
			const initialConfig = {
				level: 'info',
				service: 'test',
				console: { enabled: true, format: 'pretty' },
			}
			writeFileSync(testConfigPath, JSON.stringify(initialConfig))

			const reloadedPromise = new Promise((resolve) => {
				watcher.on('reloaded', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				const updatedConfig = {
					level: 'info',
					service: 'test',
					console: { enabled: true, format: 'json' },
				}
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			const data = (await reloadedPromise) as any
			const nestedChanges = data.changes.filter((c: any) => c.path.includes('console'))
			expect(nestedChanges).toHaveLength(1)
			expect(nestedChanges[0].path).toBe('console.format')
			expect(nestedChanges[0].previous).toBe('pretty')
			expect(nestedChanges[0].current).toBe('json')
		})
	})

	describe('getCurrentConfig()', () => {
		it('should return current configuration', () => {
			const config = { level: 'debug', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(config))

			watcher.startWatching(testConfigPath)

			const currentConfig = watcher.getCurrentConfig()
			expect(currentConfig?.level).toBe('debug')
			expect(currentConfig?.service).toBe('test')
		})

		it('should return undefined when not watching', () => {
			expect(watcher.getCurrentConfig()).toBeUndefined()
		})
	})

	describe('stopWatching()', () => {
		it('should stop watching and clean up resources', () => {
			const config = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(config))

			watcher.startWatching(testConfigPath)
			expect(watcher.getCurrentConfig()).toBeDefined()

			watcher.stopWatching()
			expect(watcher.getCurrentConfig()).toBeUndefined()
		})

		it('should not emit events after stopping', async () => {
			const config = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(config))

			let eventEmitted = false
			watcher.on('reloaded', () => {
				eventEmitted = true
			})

			watcher.startWatching(testConfigPath)
			watcher.stopWatching()

			// Try to trigger a reload after stopping
			setTimeout(() => {
				const updatedConfig = { level: 'debug', service: 'updated' }
				writeFileSync(testConfigPath, JSON.stringify(updatedConfig))
			}, 50)

			// Wait and check that no event was emitted
			await new Promise((resolve) => setTimeout(resolve, 200))
			expect(eventEmitted).toBe(false)
		})
	})

	describe('error handling', () => {
		it('should emit error event on file watcher errors', async () => {
			const config = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(config))

			const errorPromise = new Promise((resolve) => {
				watcher.on('error', (error) => {
					resolve(error)
				})
			})

			watcher.startWatching(testConfigPath)

			// Simulate watcher error by emitting error on the internal watcher
			setTimeout(() => {
				// @ts-ignore - accessing private property for testing
				watcher.watcher?.emit('error', new Error('Simulated watcher error'))
			}, 50)

			const error = (await errorPromise) as Error
			expect(error.message).toContain('Configuration file watcher error')
		})

		it('should handle JSON parse errors gracefully', async () => {
			const config = { level: 'info', service: 'test' }
			writeFileSync(testConfigPath, JSON.stringify(config))

			const errorPromise = new Promise((resolve) => {
				watcher.on('reload-error', (data) => {
					resolve(data)
				})
			})

			watcher.startWatching(testConfigPath)

			setTimeout(() => {
				writeFileSync(testConfigPath, 'invalid json content')
			}, 50)

			const data = (await errorPromise) as any
			expect(data.error.message).toContain('Configuration reload failed')
		})
	})
})
