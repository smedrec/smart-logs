// ============================================================================
// Plugin System Tests
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultLogger } from '../infrastructure/logger'
import {
	PluginError,
	PluginManager,
	PluginRegistrationError,
	PluginRegistry,
} from '../infrastructure/plugins'
import {
	BuiltInPluginFactory,
	CorrelationIdPlugin,
	RequestLoggingPlugin,
} from '../infrastructure/plugins/built-in'
// ============================================================================
// Plugin Lazy Loading Tests
// ============================================================================

import { PluginLoader } from '../infrastructure/plugins/plugin-loader'
import {
	discoverPlugins,
	PluginPerformanceTracker,
	validateMiddlewarePlugin,
	validatePlugin,
} from '../infrastructure/plugins/utils'

import type { CacheStorage } from '../infrastructure/cache'
import type {
	AuthContext,
	AuthPlugin,
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	MiddlewareResponse,
	Plugin,
	PluginContext,
	StoragePlugin,
} from '../infrastructure/plugins'
import type { ValidationResult } from '../types/shared-schemas'

// ============================================================================
// Mock Plugins for Testing
// ============================================================================

class MockPlugin implements Plugin {
	readonly name = 'mock-plugin'
	readonly version = '1.0.0'
	readonly description = 'Mock plugin for testing'

	async initialize(config: any, context: PluginContext): Promise<void> {
		// Mock initialization
	}

	validateConfig(config: any): ValidationResult {
		return { valid: true }
	}
}

class MockMiddlewarePlugin implements MiddlewarePlugin {
	readonly name = 'mock-middleware'
	readonly version = '1.0.0'
	readonly type = 'middleware' as const

	async initialize(config: any, context: PluginContext): Promise<void> {
		// Mock initialization
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		request.headers['X-Mock-Middleware'] = 'processed'
		return request
	}

	async processResponse(
		response: MiddlewareResponse,
		next: MiddlewareNext
	): Promise<MiddlewareResponse> {
		response.headers['X-Mock-Response'] = 'processed'
		return response
	}
}

class MockStoragePlugin implements StoragePlugin {
	readonly name = 'mock-storage'
	readonly version = '1.0.0'
	readonly type = 'storage' as const

	async initialize(config: any, context: PluginContext): Promise<void> {
		// Mock initialization
	}

	createStorage(config: any): CacheStorage {
		return new MockStorage()
	}
}

class MockStorage implements CacheStorage {
	private data = new Map<string, string>()

	async get(key: string): Promise<string | null> {
		return this.data.get(key) || null
	}

	async set(key: string, value: string): Promise<void> {
		this.data.set(key, value)
	}

	async delete(key: string): Promise<void> {
		this.data.delete(key)
	}

	async clear(): Promise<void> {
		this.data.clear()
	}

	async has(key: string): Promise<boolean> {
		return this.data.has(key)
	}

	async keys(): Promise<string[]> {
		return Array.from(this.data.keys())
	}

	async size(): Promise<number> {
		return this.data.size
	}
}

class MockAuthPlugin implements AuthPlugin {
	readonly name = 'mock-auth'
	readonly version = '1.0.0'
	readonly type = 'auth' as const

	async initialize(config: any, context: PluginContext): Promise<void> {
		// Mock initialization
	}

	async getAuthHeaders(config: any, context: AuthContext): Promise<Record<string, string>> {
		return {
			'X-Mock-Auth': 'authenticated',
			'X-Mock-Timestamp': context.timestamp.toString(),
		}
	}
}

// ============================================================================
// Plugin Registry Tests
// ============================================================================

describe('PluginRegistry', () => {
	let registry: PluginRegistry
	let logger: DefaultLogger

	beforeEach(() => {
		logger = new DefaultLogger()
		registry = new PluginRegistry(logger)
	})

	afterEach(async () => {
		// Cleanup all plugins in reverse dependency order
		const plugins = registry.getAllPlugins()
		// Sort by dependencies - plugins with dependencies first
		const sortedPlugins = plugins.sort((a, b) => {
			const aDeps = a.dependencies?.length || 0
			const bDeps = b.dependencies?.length || 0
			return bDeps - aDeps // Reverse order - dependents first
		})

		for (const plugin of sortedPlugins) {
			try {
				await registry.unregister(plugin.name)
			} catch (error) {
				// Ignore errors during cleanup
			}
		}
	})

	describe('Plugin Registration', () => {
		it('should register a basic plugin', async () => {
			const plugin = new MockPlugin()
			await registry.register(plugin)

			expect(registry.hasPlugin('mock-plugin')).toBe(true)
			expect(registry.getPlugin('mock-plugin')).toBe(plugin)
		})

		it('should register a middleware plugin', async () => {
			const plugin = new MockMiddlewarePlugin()
			await registry.register(plugin)

			expect(registry.hasPlugin('mock-middleware')).toBe(true)
			expect(registry.getMiddlewareChain()).toContain(plugin)
		})

		it('should register a storage plugin', async () => {
			const plugin = new MockStoragePlugin()
			await registry.register(plugin)

			expect(registry.hasPlugin('mock-storage')).toBe(true)
			expect(registry.getStoragePlugin('mock-storage')).toBe(plugin)
		})

		it('should register an auth plugin', async () => {
			const plugin = new MockAuthPlugin()
			await registry.register(plugin)

			expect(registry.hasPlugin('mock-auth')).toBe(true)
			expect(registry.getAuthPlugin('mock-auth')).toBe(plugin)
		})

		it('should throw error when registering duplicate plugin', async () => {
			const plugin1 = new MockPlugin()
			const plugin2 = new MockPlugin()

			await registry.register(plugin1)
			await expect(registry.register(plugin2)).rejects.toThrow('already registered')
		})

		it('should validate plugin configuration', async () => {
			const plugin = new MockPlugin()
			plugin.validateConfig = vi.fn().mockReturnValue({
				valid: false,
				errors: ['Invalid configuration'],
			})

			await expect(registry.register(plugin, {})).rejects.toThrow('Invalid configuration')
		})
	})

	describe('Plugin Dependencies', () => {
		it('should handle plugin dependencies', async () => {
			const basePlugin = new MockPlugin()
			const dependentPlugin = new MockPlugin()
			dependentPlugin.name = 'dependent-plugin'
			dependentPlugin.dependencies = ['mock-plugin']

			await registry.register(basePlugin)
			await registry.register(dependentPlugin)

			expect(registry.hasPlugin('dependent-plugin')).toBe(true)

			// Clean up in correct order
			await registry.unregister('dependent-plugin')
			await registry.unregister('mock-plugin')
		})

		it('should throw error for missing dependencies', async () => {
			const dependentPlugin = new MockPlugin()
			dependentPlugin.dependencies = ['missing-plugin']

			await expect(registry.register(dependentPlugin)).rejects.toThrow('not registered')
		})

		it('should prevent unregistering plugin with dependents', async () => {
			const basePlugin = new MockPlugin()
			const dependentPlugin = new MockPlugin()
			dependentPlugin.name = 'dependent-plugin'
			dependentPlugin.dependencies = ['mock-plugin']

			await registry.register(basePlugin)
			await registry.register(dependentPlugin)

			await expect(registry.unregister('mock-plugin')).rejects.toThrow('depends on it')

			// Clean up in correct order
			await registry.unregister('dependent-plugin')
			await registry.unregister('mock-plugin')
		})
	})

	describe('Plugin Statistics', () => {
		it('should provide registry statistics', async () => {
			const middlewarePlugin = new MockMiddlewarePlugin()
			const storagePlugin = new MockStoragePlugin()
			const authPlugin = new MockAuthPlugin()

			await registry.register(middlewarePlugin)
			await registry.register(storagePlugin)
			await registry.register(authPlugin)

			const stats = registry.getStats()
			expect(stats.totalPlugins).toBe(3)
			expect(stats.middlewarePlugins).toBe(1)
			expect(stats.storagePlugins).toBe(1)
			expect(stats.authPlugins).toBe(1)
		})
	})
})

// ============================================================================
// Plugin Manager Tests
// ============================================================================

describe('PluginManager', () => {
	let manager: PluginManager
	let logger: DefaultLogger

	beforeEach(() => {
		logger = new DefaultLogger()
		manager = new PluginManager(logger)
	})

	afterEach(async () => {
		await manager.cleanup()
	})

	describe('Middleware Execution', () => {
		it('should execute middleware chain for requests', async () => {
			const plugin = new MockMiddlewarePlugin()
			await manager.getRegistry().register(plugin)

			const request: MiddlewareRequest = {
				url: 'https://api.example.com/test',
				method: 'GET',
				headers: {},
				metadata: {},
			}

			const processedRequest = await manager.executeRequestMiddleware(request)
			expect(processedRequest.headers['X-Mock-Middleware']).toBe('processed')
		})

		it('should execute middleware chain for responses', async () => {
			const plugin = new MockMiddlewarePlugin()
			await manager.getRegistry().register(plugin)

			const response: MiddlewareResponse = {
				status: 200,
				statusText: 'OK',
				headers: {},
				body: {},
				metadata: {},
			}

			const processedResponse = await manager.executeResponseMiddleware(response)
			expect(processedResponse.headers['X-Mock-Response']).toBe('processed')
		})
	})

	describe('Storage Management', () => {
		it('should create storage from plugin', async () => {
			const plugin = new MockStoragePlugin()
			await manager.getRegistry().register(plugin)

			const storage = manager.createStorage('mock-storage', {})
			expect(storage).toBeDefined()
			expect(storage.plugin).toBe(plugin)
		})

		it('should throw error for unknown storage plugin', () => {
			expect(() => manager.createStorage('unknown-storage', {})).toThrow('not found')
		})
	})

	describe('Authentication Management', () => {
		it('should get auth headers from plugin', async () => {
			const plugin = new MockAuthPlugin()
			await manager.getRegistry().register(plugin)

			const context: AuthContext = {
				url: 'https://api.example.com/test',
				method: 'GET',
				timestamp: Date.now(),
				metadata: {},
			}

			const headers = await manager.getAuthHeaders('mock-auth', {}, context)
			expect(headers['X-Mock-Auth']).toBe('authenticated')
			expect(headers['X-Mock-Timestamp']).toBeDefined()
		})

		it('should throw error for unknown auth plugin', async () => {
			const context: AuthContext = {
				url: 'https://api.example.com/test',
				method: 'GET',
				timestamp: Date.now(),
				metadata: {},
			}

			await expect(manager.getAuthHeaders('unknown-auth', {}, context)).rejects.toThrow('not found')
		})
	})
})

// ============================================================================
// Built-in Plugin Tests
// ============================================================================

describe('Built-in Plugins', () => {
	let registry: PluginRegistry
	let logger: DefaultLogger

	beforeEach(() => {
		logger = new DefaultLogger()
		registry = new PluginRegistry(logger)
	})

	describe('Plugin Factory', () => {
		it('should create request logging plugin', () => {
			const plugin = BuiltInPluginFactory.createRequestLoggingPlugin()
			expect(plugin.name).toBe('request-logging')
			expect(plugin.type).toBe('middleware')
		})

		it('should create correlation ID plugin', () => {
			const plugin = BuiltInPluginFactory.createCorrelationIdPlugin()
			expect(plugin.name).toBe('correlation-id')
			expect(plugin.type).toBe('middleware')
		})

		it('should create rate limiting plugin', () => {
			const plugin = BuiltInPluginFactory.createRateLimitingPlugin()
			expect(plugin.name).toBe('rate-limiting')
			expect(plugin.type).toBe('middleware')
		})
	})

	describe('Request Logging Plugin', () => {
		it('should process requests and responses', async () => {
			const plugin = new RequestLoggingPlugin()
			await plugin.initialize(
				{},
				{
					clientConfig: {} as any,
					logger,
					registry,
				}
			)

			const request: MiddlewareRequest = {
				url: 'https://api.example.com/test',
				method: 'GET',
				headers: {},
				metadata: {},
			}

			const processedRequest = await plugin.processRequest!(request, async () => request)
			expect(processedRequest.metadata.startTime).toBeDefined()

			const response: MiddlewareResponse = {
				status: 200,
				statusText: 'OK',
				headers: {},
				body: {},
				metadata: { startTime: Date.now() - 100 },
			}

			const processedResponse = await plugin.processResponse!(response, async () => response)
			expect(processedResponse).toBeDefined()
		})

		it('should validate configuration', () => {
			const plugin = new RequestLoggingPlugin()
			const validation = plugin.validateConfig!({
				logLevel: 'invalid',
			})

			expect(validation.valid).toBe(false)
			expect(validation.errors).toContain('logLevel must be one of: debug, info, warn, error')
		})
	})

	describe('Correlation ID Plugin', () => {
		it('should add correlation ID to requests', async () => {
			const plugin = new CorrelationIdPlugin()
			await plugin.initialize(
				{},
				{
					clientConfig: {} as any,
					logger,
					registry,
				}
			)

			const request: MiddlewareRequest = {
				url: 'https://api.example.com/test',
				method: 'GET',
				headers: {},
				metadata: {},
			}

			const processedRequest = await plugin.processRequest!(request, async () => request)
			expect(processedRequest.headers['X-Correlation-ID']).toBeDefined()
			expect(processedRequest.metadata.correlationId).toBeDefined()
		})
	})
})

// ============================================================================
// Plugin Utilities Tests
// ============================================================================

describe('Plugin Utilities', () => {
	describe('Plugin Validation', () => {
		it('should validate valid plugin', () => {
			const plugin = new MockPlugin()
			const validation = validatePlugin(plugin)
			expect(validation.valid).toBe(true)
		})

		it('should validate invalid plugin', () => {
			const invalidPlugin = {
				// Missing required properties
			}
			const validation = validatePlugin(invalidPlugin)
			expect(validation.valid).toBe(false)
			expect(validation.errors).toBeDefined()
		})

		it('should validate middleware plugin', () => {
			const plugin = new MockMiddlewarePlugin()
			const validation = validateMiddlewarePlugin(plugin)
			expect(validation.valid).toBe(true)
		})
	})

	describe('Plugin Discovery', () => {
		it('should discover plugins from constructors', () => {
			const constructors = [MockPlugin, MockMiddlewarePlugin]
			const result = discoverPlugins(constructors)

			expect(result.plugins).toHaveLength(2)
			expect(result.errors).toHaveLength(0)
		})

		it('should handle discovery errors', () => {
			const invalidConstructor = class {
				// Invalid plugin constructor
			}
			const result = discoverPlugins([invalidConstructor as any])

			expect(result.plugins).toHaveLength(0)
			expect(result.errors).toHaveLength(1)
		})
	})

	describe('Performance Tracking', () => {
		it('should track plugin execution', async () => {
			const tracker = new PluginPerformanceTracker()

			await tracker.trackExecution('test-plugin', async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
			})

			const metrics = tracker.getMetrics('test-plugin')
			expect(metrics).toBeDefined()
			expect(metrics!.executionCount).toBe(1)
			expect(metrics!.totalExecutionTime).toBeGreaterThan(0)
		})

		it('should track plugin errors', async () => {
			const tracker = new PluginPerformanceTracker()

			try {
				await tracker.trackExecution('test-plugin', async () => {
					throw new Error('Test error')
				})
			} catch (error) {
				// Expected error
			}

			const metrics = tracker.getMetrics('test-plugin')
			expect(metrics!.errorCount).toBe(1)
		})
	})
})

// ============================================================================
// Plugin Error Tests
// ============================================================================

describe('Plugin Errors', () => {
	it('should create plugin error', () => {
		const error = new PluginError('Test error', 'test-plugin')
		expect(error.message).toBe('Test error')
		expect(error.pluginName).toBe('test-plugin')
		expect(error.name).toBe('PluginError')
	})

	it('should create plugin registration error', () => {
		const error = new PluginRegistrationError('test-plugin', 'Registration failed')
		expect(error.message).toContain('test-plugin')
		expect(error.message).toContain('Registration failed')
		expect(error.name).toBe('PluginRegistrationError')
	})
})

describe('PluginLoader', () => {
	let loader: PluginLoader

	beforeEach(() => {
		loader = new PluginLoader()
	})

	afterEach(() => {
		loader.clear()
	})

	describe('Lazy Loading', () => {
		it('should load plugin on demand', async () => {
			const plugin = await loader.loadBuiltInPlugin('request-logging')

			expect(plugin).toBeDefined()
			expect(plugin?.name).toBe('request-logging')
			expect(plugin?.version).toBe('1.0.0')
		})

		it('should return null for unknown plugin', async () => {
			const plugin = await loader.loadBuiltInPlugin('unknown-plugin')
			expect(plugin).toBeNull()
		})

		it('should cache loaded plugins', async () => {
			const plugin1 = await loader.loadBuiltInPlugin('correlation-id')
			const plugin2 = await loader.loadBuiltInPlugin('correlation-id')

			expect(plugin1).toBe(plugin2) // Same instance
			expect(loader.isLoaded('correlation-id')).toBe(true)
		})

		it('should deduplicate concurrent loads', async () => {
			// Load the same plugin concurrently
			const [plugin1, plugin2, plugin3] = await Promise.all([
				loader.loadBuiltInPlugin('rate-limiting'),
				loader.loadBuiltInPlugin('rate-limiting'),
				loader.loadBuiltInPlugin('rate-limiting'),
			])

			expect(plugin1).toBe(plugin2)
			expect(plugin2).toBe(plugin3)
			expect(loader.isLoaded('rate-limiting')).toBe(true)
		})

		it('should load multiple different plugins', async () => {
			const plugins = await Promise.all([
				loader.loadBuiltInPlugin('request-logging'),
				loader.loadBuiltInPlugin('correlation-id'),
				loader.loadBuiltInPlugin('rate-limiting'),
			])

			expect(plugins).toHaveLength(3)
			expect(plugins.every((p) => p !== null)).toBe(true)
			expect(loader.getLoadedPlugins()).toHaveLength(3)
		})

		it('should handle errors for unknown plugins', async () => {
			await expect(loader.loadBuiltInPlugin('invalid-plugin')).rejects.toThrow(
				'Unknown built-in plugin'
			)
		})
	})

	describe('Plugin Types', () => {
		it('should load middleware plugins', async () => {
			const requestLogging = await loader.loadBuiltInPlugin('request-logging')
			const correlationId = await loader.loadBuiltInPlugin('correlation-id')
			const rateLimiting = await loader.loadBuiltInPlugin('rate-limiting')

			expect(requestLogging?.type).toBe('middleware')
			expect(correlationId?.type).toBe('middleware')
			expect(rateLimiting?.type).toBe('middleware')
		})

		it('should load storage plugins', async () => {
			const redis = await loader.loadBuiltInPlugin('redis-storage')
			const indexeddb = await loader.loadBuiltInPlugin('indexeddb-storage')

			expect(redis?.type).toBe('storage')
			expect(indexeddb?.type).toBe('storage')
		})

		it('should load auth plugins', async () => {
			const jwt = await loader.loadBuiltInPlugin('jwt-auth')
			const oauth2 = await loader.loadBuiltInPlugin('oauth2-auth')
			const customHeader = await loader.loadBuiltInPlugin('custom-header-auth')

			expect(jwt?.type).toBe('auth')
			expect(oauth2?.type).toBe('auth')
			expect(customHeader?.type).toBe('auth')
		})
	})

	describe('Cache Management', () => {
		it('should track loaded plugins', async () => {
			expect(loader.getLoadedPlugins()).toHaveLength(0)

			await loader.loadBuiltInPlugin('request-logging')
			expect(loader.getLoadedPlugins()).toHaveLength(1)

			await loader.loadBuiltInPlugin('correlation-id')
			expect(loader.getLoadedPlugins()).toHaveLength(2)
		})

		it('should check if plugin is loaded', async () => {
			expect(loader.isLoaded('request-logging')).toBe(false)

			await loader.loadBuiltInPlugin('request-logging')
			expect(loader.isLoaded('request-logging')).toBe(true)
		})

		it('should clear all loaded plugins', async () => {
			await loader.loadBuiltInPlugin('request-logging')
			await loader.loadBuiltInPlugin('correlation-id')

			expect(loader.getLoadedPlugins()).toHaveLength(2)

			loader.clear()
			expect(loader.getLoadedPlugins()).toHaveLength(0)
			expect(loader.isLoaded('request-logging')).toBe(false)
		})
	})
})

// ============================================================================
// Bundle Size Impact Tests
// ============================================================================

describe('Bundle Size Optimization', () => {
	it('should not load plugins until requested', () => {
		const loader = new PluginLoader()

		// No plugins should be loaded initially
		expect(loader.getLoadedPlugins()).toHaveLength(0)
	})

	it('should load plugins independently', async () => {
		const loader = new PluginLoader()

		// Load only one plugin
		await loader.loadBuiltInPlugin('request-logging')

		// Only one plugin should be loaded
		expect(loader.getLoadedPlugins()).toHaveLength(1)
		expect(loader.isLoaded('request-logging')).toBe(true)
		expect(loader.isLoaded('correlation-id')).toBe(false)
	})

	it('should support tree-shaking by loading only used plugins', async () => {
		const loader = new PluginLoader()

		// Simulate loading only specific plugins
		const usedPlugins = ['request-logging', 'jwt-auth']

		for (const pluginName of usedPlugins) {
			await loader.loadBuiltInPlugin(pluginName)
		}

		// Only the used plugins should be loaded
		expect(loader.getLoadedPlugins()).toHaveLength(2)
		expect(loader.isLoaded('request-logging')).toBe(true)
		expect(loader.isLoaded('jwt-auth')).toBe(true)
		expect(loader.isLoaded('correlation-id')).toBe(false)
		expect(loader.isLoaded('rate-limiting')).toBe(false)
	})
})
