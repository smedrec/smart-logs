// ============================================================================
// Plugin Architecture System
// ============================================================================

import type { AuditClientConfig } from '../core/config'
import type { CacheStorage } from './cache'
import type { Logger } from './logger'

// ============================================================================
// Core Plugin Interfaces
// ============================================================================

/**
 * Base plugin interface that all plugins must implement
 */
export interface Plugin {
	/** Unique identifier for the plugin */
	readonly name: string
	/** Plugin version */
	readonly version: string
	/** Plugin description */
	readonly description?: string
	/** Plugin dependencies (other plugin names) */
	readonly dependencies?: string[]
	/** Plugin configuration schema */
	readonly configSchema?: Record<string, any>

	/**
	 * Initialize the plugin with configuration
	 * @param config Plugin-specific configuration
	 * @param context Plugin initialization context
	 */
	initialize(config: any, context: PluginContext): Promise<void> | void

	/**
	 * Cleanup plugin resources
	 */
	destroy?(): Promise<void> | void

	/**
	 * Validate plugin configuration
	 * @param config Configuration to validate
	 */
	validateConfig?(config: any): ValidationResult
}

/**
 * Plugin initialization context
 */
export interface PluginContext {
	/** Client configuration */
	clientConfig: AuditClientConfig
	/** Logger instance */
	logger: Logger
	/** Plugin registry for accessing other plugins */
	registry: PluginRegistry
}

/**
 * Plugin validation result
 */
export interface ValidationResult {
	valid: boolean
	errors?: string[]
	warnings?: string[]
}

// ============================================================================
// Middleware Plugin System
// ============================================================================

/**
 * Middleware plugin for request/response processing
 */
export interface MiddlewarePlugin extends Plugin {
	readonly type: 'middleware'

	/**
	 * Process outgoing request
	 * @param request Request object
	 * @param next Next middleware in chain
	 */
	processRequest?(request: MiddlewareRequest, next: MiddlewareNext): Promise<MiddlewareRequest>

	/**
	 * Process incoming response
	 * @param response Response object
	 * @param next Next middleware in chain
	 */
	processResponse?(response: MiddlewareResponse, next: MiddlewareNext): Promise<MiddlewareResponse>

	/**
	 * Handle errors in the middleware chain
	 * @param error Error object
	 * @param context Error context
	 */
	handleError?(error: Error, context: MiddlewareErrorContext): Promise<void> | void
}

/**
 * Middleware request object
 */
export interface MiddlewareRequest {
	url: string
	method: string
	headers: Record<string, string>
	body?: any
	metadata: Record<string, any>
}

/**
 * Middleware response object
 */
export interface MiddlewareResponse {
	status: number
	statusText: string
	headers: Record<string, string>
	body: any
	metadata: Record<string, any>
}

/**
 * Middleware error context
 */
export interface MiddlewareErrorContext {
	request: MiddlewareRequest
	response?: MiddlewareResponse
	phase: 'request' | 'response'
	pluginName: string
}

/**
 * Middleware next function
 */
export type MiddlewareNext = () => Promise<any>

// ============================================================================
// Storage Plugin System
// ============================================================================

/**
 * Storage plugin for custom cache backends
 */
export interface StoragePlugin extends Plugin {
	readonly type: 'storage'

	/**
	 * Create a storage instance
	 * @param config Storage-specific configuration
	 */
	createStorage(config: any): CacheStorage
}

/**
 * Enhanced cache storage interface with plugin support
 */
export interface PluginCacheStorage extends CacheStorage {
	/** Plugin that created this storage */
	readonly plugin: StoragePlugin
	/** Storage-specific configuration */
	readonly config: any

	/**
	 * Get storage statistics
	 */
	getStats?(): Promise<StorageStats> | StorageStats

	/**
	 * Perform storage maintenance
	 */
	maintenance?(): Promise<void> | void
}

/**
 * Storage statistics
 */
export interface StorageStats {
	totalKeys: number
	totalSize: number
	hitRate: number
	missRate: number
	evictionCount: number
	lastAccessed?: Date
}

// ============================================================================
// Authentication Plugin System
// ============================================================================

/**
 * Authentication plugin for custom auth methods
 */
export interface AuthPlugin extends Plugin {
	readonly type: 'auth'

	/**
	 * Get authentication headers
	 * @param config Auth-specific configuration
	 * @param context Authentication context
	 */
	getAuthHeaders(config: any, context: AuthContext): Promise<Record<string, string>>

	/**
	 * Refresh authentication token if supported
	 * @param config Auth-specific configuration
	 * @param context Authentication context
	 */
	refreshToken?(config: any, context: AuthContext): Promise<string | null>

	/**
	 * Validate authentication configuration
	 * @param config Configuration to validate
	 */
	validateAuthConfig?(config: any): ValidationResult

	/**
	 * Handle authentication errors
	 * @param error Authentication error
	 * @param config Auth configuration
	 * @param context Authentication context
	 */
	handleAuthError?(error: Error, config: any, context: AuthContext): Promise<void> | void
}

/**
 * Authentication context
 */
export interface AuthContext {
	/** Request URL */
	url: string
	/** Request method */
	method: string
	/** Current timestamp */
	timestamp: number
	/** Request metadata */
	metadata: Record<string, any>
}

// ============================================================================
// Plugin Registry
// ============================================================================

/**
 * Plugin registry for managing all plugins
 */
export class PluginRegistry {
	private plugins = new Map<string, Plugin>()
	private middlewareChain: MiddlewarePlugin[] = []
	private storagePlugins = new Map<string, StoragePlugin>()
	private authPlugins = new Map<string, AuthPlugin>()
	private logger: Logger

	constructor(logger: Logger) {
		this.logger = logger
	}

	/**
	 * Register a plugin
	 * @param plugin Plugin to register
	 * @param config Plugin configuration
	 */
	async register(plugin: Plugin, config: any = {}): Promise<void> {
		// Validate plugin
		if (this.plugins.has(plugin.name)) {
			throw new Error(`Plugin '${plugin.name}' is already registered`)
		}

		// Validate configuration if plugin supports it
		if (plugin.validateConfig) {
			const validation = plugin.validateConfig(config)
			if (!validation.valid) {
				throw new Error(
					`Invalid configuration for plugin '${plugin.name}': ${validation.errors?.join(', ')}`
				)
			}
		}

		// Check dependencies
		if (plugin.dependencies) {
			for (const dep of plugin.dependencies) {
				if (!this.plugins.has(dep)) {
					throw new Error(`Plugin '${plugin.name}' depends on '${dep}' which is not registered`)
				}
			}
		}

		// Initialize plugin
		const context: PluginContext = {
			clientConfig: {} as AuditClientConfig, // Will be set by client
			logger: this.logger,
			registry: this,
		}

		await plugin.initialize(config, context)

		// Register plugin
		this.plugins.set(plugin.name, plugin)

		// Add to specific plugin collections
		switch ((plugin as any).type) {
			case 'middleware':
				this.middlewareChain.push(plugin as MiddlewarePlugin)
				break
			case 'storage':
				this.storagePlugins.set(plugin.name, plugin as StoragePlugin)
				break
			case 'auth':
				this.authPlugins.set(plugin.name, plugin as AuthPlugin)
				break
		}

		this.logger.info(`Plugin '${plugin.name}' registered successfully`)
	}

	/**
	 * Unregister a plugin
	 * @param name Plugin name
	 */
	async unregister(name: string): Promise<void> {
		const plugin = this.plugins.get(name)
		if (!plugin) {
			throw new Error(`Plugin '${name}' is not registered`)
		}

		// Check if other plugins depend on this one
		for (const [pluginName, p] of Array.from(this.plugins.entries())) {
			if (p.dependencies?.includes(name)) {
				throw new Error(`Cannot unregister plugin '${name}' because '${pluginName}' depends on it`)
			}
		}

		// Cleanup plugin
		if (plugin.destroy) {
			await plugin.destroy()
		}

		// Remove from collections
		this.plugins.delete(name)
		this.middlewareChain = this.middlewareChain.filter((p) => p.name !== name)
		this.storagePlugins.delete(name)
		this.authPlugins.delete(name)

		this.logger.info(`Plugin '${name}' unregistered successfully`)
	}

	/**
	 * Get a registered plugin
	 * @param name Plugin name
	 */
	getPlugin<T extends Plugin = Plugin>(name: string): T | undefined {
		return this.plugins.get(name) as T
	}

	/**
	 * Get all registered plugins
	 */
	getAllPlugins(): Plugin[] {
		return Array.from(this.plugins.values())
	}

	/**
	 * Get middleware chain
	 */
	getMiddlewareChain(): MiddlewarePlugin[] {
		return [...this.middlewareChain]
	}

	/**
	 * Get storage plugin by name
	 * @param name Plugin name
	 */
	getStoragePlugin(name: string): StoragePlugin | undefined {
		return this.storagePlugins.get(name)
	}

	/**
	 * Get all storage plugins
	 */
	getStoragePlugins(): StoragePlugin[] {
		return Array.from(this.storagePlugins.values())
	}

	/**
	 * Get authentication plugin by name
	 * @param name Plugin name
	 */
	getAuthPlugin(name: string): AuthPlugin | undefined {
		return this.authPlugins.get(name)
	}

	/**
	 * Get all authentication plugins
	 */
	getAuthPlugins(): AuthPlugin[] {
		return Array.from(this.authPlugins.values())
	}

	/**
	 * Check if plugin is registered
	 * @param name Plugin name
	 */
	hasPlugin(name: string): boolean {
		return this.plugins.has(name)
	}

	/**
	 * Get plugin registry statistics
	 */
	getStats(): PluginRegistryStats {
		return {
			totalPlugins: this.plugins.size,
			middlewarePlugins: this.middlewareChain.length,
			storagePlugins: this.storagePlugins.size,
			authPlugins: this.authPlugins.size,
			plugins: Array.from(this.plugins.values()).map((p) => ({
				name: p.name,
				version: p.version,
				type: (p as any).type || 'unknown',
				dependencies: p.dependencies || [],
			})),
		}
	}
}

/**
 * Plugin registry statistics
 */
export interface PluginRegistryStats {
	totalPlugins: number
	middlewarePlugins: number
	storagePlugins: number
	authPlugins: number
	plugins: Array<{
		name: string
		version: string
		type: string
		dependencies: string[]
	}>
}

// ============================================================================
// Plugin Manager
// ============================================================================

/**
 * Plugin manager for coordinating plugin operations
 */
export class PluginManager {
	private registry: PluginRegistry
	private logger: Logger
	private clientConfig?: AuditClientConfig

	constructor(logger: Logger) {
		this.registry = new PluginRegistry(logger)
		this.logger = logger
	}

	/**
	 * Set client configuration
	 * @param config Client configuration
	 */
	setClientConfig(config: AuditClientConfig): void {
		this.clientConfig = config
	}

	/**
	 * Get plugin registry
	 */
	getRegistry(): PluginRegistry {
		return this.registry
	}

	/**
	 * Execute middleware chain for request processing
	 * @param request Request object
	 */
	async executeRequestMiddleware(request: MiddlewareRequest): Promise<MiddlewareRequest> {
		let processedRequest = request
		const middlewares = this.registry.getMiddlewareChain()

		for (const middleware of middlewares) {
			if (middleware.processRequest) {
				try {
					const next: MiddlewareNext = async () => processedRequest
					processedRequest = await middleware.processRequest(processedRequest, next)
				} catch (error) {
					this.logger.error(`Error in middleware '${middleware.name}' during request processing`, {
						error,
					})

					if (middleware.handleError) {
						await middleware.handleError(error as Error, {
							request: processedRequest,
							phase: 'request',
							pluginName: middleware.name,
						})
					}

					throw error
				}
			}
		}

		return processedRequest
	}

	/**
	 * Execute middleware chain for response processing
	 * @param response Response object
	 */
	async executeResponseMiddleware(response: MiddlewareResponse): Promise<MiddlewareResponse> {
		let processedResponse = response
		const middlewares = this.registry.getMiddlewareChain().reverse() // Reverse for response processing

		for (const middleware of middlewares) {
			if (middleware.processResponse) {
				try {
					const next: MiddlewareNext = async () => processedResponse
					processedResponse = await middleware.processResponse(processedResponse, next)
				} catch (error) {
					this.logger.error(`Error in middleware '${middleware.name}' during response processing`, {
						error,
					})

					if (middleware.handleError) {
						await middleware.handleError(error as Error, {
							request: {} as MiddlewareRequest, // Would need to be passed from context
							response: processedResponse,
							phase: 'response',
							pluginName: middleware.name,
						})
					}

					throw error
				}
			}
		}

		return processedResponse
	}

	/**
	 * Create storage instance from plugin
	 * @param pluginName Storage plugin name
	 * @param config Storage configuration
	 */
	createStorage(pluginName: string, config: any): PluginCacheStorage {
		const plugin = this.registry.getStoragePlugin(pluginName)
		if (!plugin) {
			throw new Error(`Storage plugin '${pluginName}' not found`)
		}

		const storage = plugin.createStorage(config)
		return {
			...storage,
			plugin,
			config,
		} as PluginCacheStorage
	}

	/**
	 * Get authentication headers from plugin
	 * @param pluginName Auth plugin name
	 * @param config Auth configuration
	 * @param context Auth context
	 */
	async getAuthHeaders(
		pluginName: string,
		config: any,
		context: AuthContext
	): Promise<Record<string, string>> {
		const plugin = this.registry.getAuthPlugin(pluginName)
		if (!plugin) {
			throw new Error(`Auth plugin '${pluginName}' not found`)
		}

		return plugin.getAuthHeaders(config, context)
	}

	/**
	 * Refresh token using auth plugin
	 * @param pluginName Auth plugin name
	 * @param config Auth configuration
	 * @param context Auth context
	 */
	async refreshToken(
		pluginName: string,
		config: any,
		context: AuthContext
	): Promise<string | null> {
		const plugin = this.registry.getAuthPlugin(pluginName)
		if (!plugin?.refreshToken) {
			return null
		}

		return plugin.refreshToken(config, context)
	}

	/**
	 * Cleanup all plugins
	 */
	async cleanup(): Promise<void> {
		const plugins = this.registry.getAllPlugins()

		for (const plugin of plugins) {
			try {
				await this.registry.unregister(plugin.name)
			} catch (error) {
				this.logger.error(`Error cleaning up plugin '${plugin.name}'`, { error })
			}
		}
	}
}

// ============================================================================
// Plugin Errors
// ============================================================================

export class PluginError extends Error {
	constructor(
		message: string,
		public readonly pluginName: string,
		public readonly cause?: Error
	) {
		super(message)
		this.name = 'PluginError'
	}
}

export class PluginRegistrationError extends PluginError {
	constructor(pluginName: string, message: string, cause?: Error) {
		super(`Failed to register plugin '${pluginName}': ${message}`, pluginName, cause)
		this.name = 'PluginRegistrationError'
	}
}

export class PluginConfigurationError extends PluginError {
	constructor(pluginName: string, message: string, cause?: Error) {
		super(`Invalid configuration for plugin '${pluginName}': ${message}`, pluginName, cause)
		this.name = 'PluginConfigurationError'
	}
}

export class PluginExecutionError extends PluginError {
	constructor(pluginName: string, operation: string, cause?: Error) {
		super(`Error executing '${operation}' in plugin '${pluginName}'`, pluginName, cause)
		this.name = 'PluginExecutionError'
	}
}
