// ============================================================================
// Built-in Plugins - Re-exports for backward compatibility
// ============================================================================

// Middleware plugins
import { CustomHeaderAuthPlugin as CustomHeaderAuthPluginClass } from './built-in/auth/custom-header-auth'
// Auth plugins
import { JWTAuthPlugin as JWTAuthPluginClass } from './built-in/auth/jwt-auth'
import { OAuth2AuthPlugin as OAuth2AuthPluginClass } from './built-in/auth/oauth2-auth'
import { CorrelationIdPlugin as CorrelationIdPluginClass } from './built-in/middleware/correlation-id'
import { RateLimitingPlugin as RateLimitingPluginClass } from './built-in/middleware/rate-limiting'
import { RequestLoggingPlugin as RequestLoggingPluginClass } from './built-in/middleware/request-logging'
import { IndexedDBStoragePlugin as IndexedDBStoragePluginClass } from './built-in/storage/indexeddb-storage'
// Storage plugins
import { RedisStoragePlugin as RedisStoragePluginClass } from './built-in/storage/redis-storage'

// Re-export for external use
export { RequestLoggingPluginClass as RequestLoggingPlugin }
export type { RequestLoggingConfig } from './built-in/middleware/request-logging'

export { CorrelationIdPluginClass as CorrelationIdPlugin }
export type { CorrelationIdConfig } from './built-in/middleware/correlation-id'

export { RateLimitingPluginClass as RateLimitingPlugin }
export type { RateLimitingConfig } from './built-in/middleware/rate-limiting'

export { RedisStoragePluginClass as RedisStoragePlugin }
export type { RedisStorageConfig } from './built-in/storage/redis-storage'

export { IndexedDBStoragePluginClass as IndexedDBStoragePlugin }
export type { IndexedDBStorageConfig } from './built-in/storage/indexeddb-storage'

export { JWTAuthPluginClass as JWTAuthPlugin }
export type { JWTAuthConfig } from './built-in/auth/jwt-auth'

export { OAuth2AuthPluginClass as OAuth2AuthPlugin }
export type { OAuth2AuthConfig } from './built-in/auth/oauth2-auth'

export { CustomHeaderAuthPluginClass as CustomHeaderAuthPlugin }
export type { CustomHeaderAuthConfig } from './built-in/auth/custom-header-auth'

// ============================================================================
// Plugin Factory (Deprecated - kept for backward compatibility)
// ============================================================================

/**
 * Factory for creating built-in plugins
 * @deprecated Use dynamic imports with PluginLoader instead
 */
export class BuiltInPluginFactory {
	/**
	 * Create a request logging plugin
	 * @deprecated Import RequestLoggingPlugin directly
	 */
	static createRequestLoggingPlugin(): RequestLoggingPluginClass {
		return new RequestLoggingPluginClass()
	}

	/**
	 * Create a correlation ID plugin
	 * @deprecated Import CorrelationIdPlugin directly
	 */
	static createCorrelationIdPlugin(): CorrelationIdPluginClass {
		return new CorrelationIdPluginClass()
	}

	/**
	 * Create a rate limiting plugin
	 * @deprecated Import RateLimitingPlugin directly
	 */
	static createRateLimitingPlugin(): RateLimitingPluginClass {
		return new RateLimitingPluginClass()
	}

	/**
	 * Create a Redis storage plugin
	 * @deprecated Import RedisStoragePlugin directly
	 */
	static createRedisStoragePlugin(): RedisStoragePluginClass {
		return new RedisStoragePluginClass()
	}

	/**
	 * Create an IndexedDB storage plugin
	 * @deprecated Import IndexedDBStoragePlugin directly
	 */
	static createIndexedDBStoragePlugin(): IndexedDBStoragePluginClass {
		return new IndexedDBStoragePluginClass()
	}

	/**
	 * Create a JWT auth plugin
	 * @deprecated Import JWTAuthPlugin directly
	 */
	static createJWTAuthPlugin(): JWTAuthPluginClass {
		return new JWTAuthPluginClass()
	}

	/**
	 * Create an OAuth2 auth plugin
	 * @deprecated Import OAuth2AuthPlugin directly
	 */
	static createOAuth2AuthPlugin(): OAuth2AuthPluginClass {
		return new OAuth2AuthPluginClass()
	}

	/**
	 * Create a custom header auth plugin
	 * @deprecated Import CustomHeaderAuthPlugin directly
	 */
	static createCustomHeaderAuthPlugin(): CustomHeaderAuthPluginClass {
		return new CustomHeaderAuthPluginClass()
	}
}
