// ============================================================================
// Plugin Loader for Lazy Loading Built-in Plugins
// ============================================================================

import type { Plugin } from '../plugins'

/**
 * Plugin module interface for dynamic imports
 */
export interface PluginModule {
	default: Plugin
}

/**
 * Plugin loader for lazy loading built-in plugins on-demand
 *
 * This class implements:
 * - Dynamic imports with webpack/vite code splitting
 * - Deduplication of concurrent plugin loads
 * - Caching of loaded plugins
 * - Error handling for unknown plugins
 */
export class PluginLoader {
	private loadedPlugins: Map<string, Plugin> = new Map()
	private loadingPromises: Map<string, Promise<Plugin>> = new Map()

	/**
	 * Load a built-in plugin by name
	 *
	 * @param name - Plugin name (e.g., 'request-logging', 'correlation-id')
	 * @returns The loaded plugin instance, or null if not found
	 */
	async loadBuiltInPlugin(name: string): Promise<Plugin | null> {
		// Check if already loaded
		if (this.loadedPlugins.has(name)) {
			return this.loadedPlugins.get(name)!
		}

		// Check if currently loading (deduplicate concurrent loads)
		if (this.loadingPromises.has(name)) {
			return this.loadingPromises.get(name)!
		}

		// Start loading
		const loadPromise = this.loadPlugin(name)
		this.loadingPromises.set(name, loadPromise)

		try {
			const plugin = await loadPromise
			this.loadedPlugins.set(name, plugin)
			return plugin
		} finally {
			// Clean up loading promise
			this.loadingPromises.delete(name)
		}
	}

	/**
	 * Get all loaded plugins
	 *
	 * @returns Array of loaded plugin instances
	 */
	getLoadedPlugins(): Plugin[] {
		return Array.from(this.loadedPlugins.values())
	}

	/**
	 * Check if a plugin is loaded
	 *
	 * @param name - Plugin name
	 * @returns True if the plugin is loaded
	 */
	isLoaded(name: string): boolean {
		return this.loadedPlugins.has(name)
	}

	/**
	 * Clear all loaded plugins
	 */
	clear(): void {
		this.loadedPlugins.clear()
		this.loadingPromises.clear()
	}

	/**
	 * Load a plugin dynamically with code splitting
	 *
	 * @param name - Plugin name
	 * @returns The loaded plugin instance
	 * @throws Error if plugin is not found
	 */
	private async loadPlugin(name: string): Promise<Plugin> {
		switch (name) {
			// Middleware plugins
			case 'request-logging': {
				const { RequestLoggingPlugin } = await import(
					/* webpackChunkName: "plugin-request-logging" */
					/* vite: { chunkName: "plugin-request-logging" } */
					'./built-in/middleware/request-logging'
				)
				return new RequestLoggingPlugin()
			}

			case 'correlation-id': {
				const { CorrelationIdPlugin } = await import(
					/* webpackChunkName: "plugin-correlation-id" */
					/* vite: { chunkName: "plugin-correlation-id" } */
					'./built-in/middleware/correlation-id'
				)
				return new CorrelationIdPlugin()
			}

			case 'rate-limiting': {
				const { RateLimitingPlugin } = await import(
					/* webpackChunkName: "plugin-rate-limiting" */
					/* vite: { chunkName: "plugin-rate-limiting" } */
					'./built-in/middleware/rate-limiting'
				)
				return new RateLimitingPlugin()
			}

			// Storage plugins
			case 'redis-storage': {
				const { RedisStoragePlugin } = await import(
					/* webpackChunkName: "plugin-redis-storage" */
					/* vite: { chunkName: "plugin-redis-storage" } */
					'./built-in/storage/redis-storage'
				)
				return new RedisStoragePlugin()
			}

			case 'indexeddb-storage': {
				const { IndexedDBStoragePlugin } = await import(
					/* webpackChunkName: "plugin-indexeddb-storage" */
					/* vite: { chunkName: "plugin-indexeddb-storage" } */
					'./built-in/storage/indexeddb-storage'
				)
				return new IndexedDBStoragePlugin()
			}

			// Auth plugins
			case 'jwt-auth': {
				const { JWTAuthPlugin } = await import(
					/* webpackChunkName: "plugin-jwt-auth" */
					/* vite: { chunkName: "plugin-jwt-auth" } */
					'./built-in/auth/jwt-auth'
				)
				return new JWTAuthPlugin()
			}

			case 'oauth2-auth': {
				const { OAuth2AuthPlugin } = await import(
					/* webpackChunkName: "plugin-oauth2-auth" */
					/* vite: { chunkName: "plugin-oauth2-auth" } */
					'./built-in/auth/oauth2-auth'
				)
				return new OAuth2AuthPlugin()
			}

			case 'custom-header-auth': {
				const { CustomHeaderAuthPlugin } = await import(
					/* webpackChunkName: "plugin-custom-header-auth" */
					/* vite: { chunkName: "plugin-custom-header-auth" } */
					'./built-in/auth/custom-header-auth'
				)
				return new CustomHeaderAuthPlugin()
			}

			default:
				throw new Error(`Unknown built-in plugin: ${name}`)
		}
	}
}
