// ============================================================================
// Built-in Plugins for Common Use Cases
// ============================================================================

import type { CacheStorage } from '../cache'
import type {
	AuthContext,
	AuthPlugin,
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	MiddlewareResponse,
	PluginCacheStorage,
	PluginContext,
	StoragePlugin,
	ValidationResult,
} from '../plugins'

// ============================================================================
// Built-in Middleware Plugins
// ============================================================================

/**
 * Request logging middleware plugin
 */
export class RequestLoggingPlugin implements MiddlewarePlugin {
	readonly name = 'request-logging'
	readonly version = '1.0.0'
	readonly description = 'Logs all HTTP requests and responses'
	readonly type = 'middleware' as const

	private config: RequestLoggingConfig = {}
	private logger?: any

	async initialize(config: RequestLoggingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
		this.logger = context.logger
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		if (this.config.logRequests) {
			const logData = {
				method: request.method,
				url: request.url,
				headers: this.config.logHeaders ? request.headers : undefined,
				body: this.config.logBodies ? request.body : undefined,
			}
			this.logger?.info('Outgoing request', logData)
		}

		const startTime = Date.now()
		request.metadata.startTime = startTime

		return request
	}

	async processResponse(
		response: MiddlewareResponse,
		next: MiddlewareNext
	): Promise<MiddlewareResponse> {
		if (this.config.logResponses) {
			const duration = response.metadata.startTime
				? Date.now() - response.metadata.startTime
				: undefined
			const logData = {
				status: response.status,
				statusText: response.statusText,
				duration,
				headers: this.config.logHeaders ? response.headers : undefined,
				body: this.config.logBodies ? response.body : undefined,
			}
			this.logger?.info('Incoming response', logData)
		}

		return response
	}

	validateConfig(config: RequestLoggingConfig): ValidationResult {
		const errors: string[] = []

		if (config.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
			errors.push('logLevel must be one of: debug, info, warn, error')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private defaultConfig(): RequestLoggingConfig {
		return {
			logRequests: true,
			logResponses: true,
			logHeaders: false,
			logBodies: false,
			logLevel: 'info',
		}
	}
}

interface RequestLoggingConfig {
	logRequests?: boolean
	logResponses?: boolean
	logHeaders?: boolean
	logBodies?: boolean
	logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Request correlation ID middleware plugin
 */
export class CorrelationIdPlugin implements MiddlewarePlugin {
	readonly name = 'correlation-id'
	readonly version = '1.0.0'
	readonly description = 'Adds correlation IDs to requests for tracing'
	readonly type = 'middleware' as const

	private config: CorrelationIdConfig = {}

	async initialize(config: CorrelationIdConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		const correlationId = this.generateCorrelationId()
		request.headers[this.config.headerName!] = correlationId
		request.metadata.correlationId = correlationId
		return request
	}

	validateConfig(config: CorrelationIdConfig): ValidationResult {
		const errors: string[] = []

		if (config.headerName && typeof config.headerName !== 'string') {
			errors.push('headerName must be a string')
		}

		if (config.idLength && (config.idLength < 8 || config.idLength > 64)) {
			errors.push('idLength must be between 8 and 64')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private generateCorrelationId(): string {
		const length = this.config.idLength || 16
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		let result = ''
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length))
		}
		return result
	}

	private defaultConfig(): CorrelationIdConfig {
		return {
			headerName: 'X-Correlation-ID',
			idLength: 16,
		}
	}
}

interface CorrelationIdConfig {
	headerName?: string
	idLength?: number
}

/**
 * Request rate limiting middleware plugin
 */
export class RateLimitingPlugin implements MiddlewarePlugin {
	readonly name = 'rate-limiting'
	readonly version = '1.0.0'
	readonly description = 'Client-side rate limiting for API requests'
	readonly type = 'middleware' as const

	private config: RateLimitingConfig = {}
	private requestCounts = new Map<string, { count: number; resetTime: number }>()

	async initialize(config: RateLimitingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		const key = this.getRateLimitKey(request)
		const now = Date.now()
		const windowMs = this.config.windowMs!

		let bucket = this.requestCounts.get(key)
		if (!bucket || now >= bucket.resetTime) {
			bucket = { count: 0, resetTime: now + windowMs }
			this.requestCounts.set(key, bucket)
		}

		if (bucket.count >= this.config.maxRequests!) {
			const waitTime = bucket.resetTime - now
			throw new Error(`Rate limit exceeded. Try again in ${waitTime}ms`)
		}

		bucket.count++
		return request
	}

	validateConfig(config: RateLimitingConfig): ValidationResult {
		const errors: string[] = []

		if (config.maxRequests && config.maxRequests <= 0) {
			errors.push('maxRequests must be greater than 0')
		}

		if (config.windowMs && config.windowMs <= 0) {
			errors.push('windowMs must be greater than 0')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private getRateLimitKey(request: MiddlewareRequest): string {
		// Simple key based on method and base URL
		const url = new URL(request.url)
		return `${request.method}:${url.origin}`
	}

	private defaultConfig(): RateLimitingConfig {
		return {
			maxRequests: 100,
			windowMs: 60000, // 1 minute
		}
	}
}

interface RateLimitingConfig {
	maxRequests?: number
	windowMs?: number
}

// ============================================================================
// Built-in Storage Plugins
// ============================================================================

/**
 * Redis storage plugin
 */
export class RedisStoragePlugin implements StoragePlugin {
	readonly name = 'redis-storage'
	readonly version = '1.0.0'
	readonly description = 'Redis-based cache storage'
	readonly type = 'storage' as const

	async initialize(config: RedisStorageConfig, context: PluginContext): Promise<void> {
		// Validate Redis connection if needed
	}

	createStorage(config: RedisStorageConfig): CacheStorage {
		return new RedisStorage(config)
	}

	validateConfig(config: RedisStorageConfig): ValidationResult {
		const errors: string[] = []

		if (!config.host) {
			errors.push('host is required')
		}

		if (config.port && (config.port < 1 || config.port > 65535)) {
			errors.push('port must be between 1 and 65535')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}
}

interface RedisStorageConfig {
	host: string
	port?: number
	password?: string
	database?: number
	keyPrefix?: string
}

class RedisStorage implements CacheStorage {
	private config: RedisStorageConfig
	private client: any // Would be Redis client

	constructor(config: RedisStorageConfig) {
		this.config = config
		// Initialize Redis client here
	}

	async get(key: string): Promise<string | null> {
		// Redis implementation
		return null
	}

	async set(key: string, value: string): Promise<void> {
		// Redis implementation
	}

	async delete(key: string): Promise<void> {
		// Redis implementation
	}

	async clear(): Promise<void> {
		// Redis implementation
	}

	async has(key: string): Promise<boolean> {
		// Redis implementation
		return false
	}

	async keys(pattern?: string): Promise<string[]> {
		// Redis implementation
		return []
	}

	async size(): Promise<number> {
		// Redis implementation
		return 0
	}
}

/**
 * IndexedDB storage plugin for browsers
 */
export class IndexedDBStoragePlugin implements StoragePlugin {
	readonly name = 'indexeddb-storage'
	readonly version = '1.0.0'
	readonly description = 'IndexedDB-based cache storage for browsers'
	readonly type = 'storage' as const

	async initialize(config: IndexedDBStorageConfig, context: PluginContext): Promise<void> {
		// Check if IndexedDB is available
		if (typeof window === 'undefined' || !window.indexedDB) {
			throw new Error('IndexedDB is not available in this environment')
		}
	}

	createStorage(config: IndexedDBStorageConfig): CacheStorage {
		return new IndexedDBStorage(config)
	}

	validateConfig(config: IndexedDBStorageConfig): ValidationResult {
		const errors: string[] = []

		if (!config.databaseName) {
			errors.push('databaseName is required')
		}

		if (config.version && config.version < 1) {
			errors.push('version must be greater than 0')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}
}

interface IndexedDBStorageConfig {
	databaseName: string
	version?: number
	storeName?: string
}

class IndexedDBStorage implements CacheStorage {
	private config: IndexedDBStorageConfig
	private db?: IDBDatabase

	constructor(config: IndexedDBStorageConfig) {
		this.config = config
	}

	async get(key: string): Promise<string | null> {
		// IndexedDB implementation
		return null
	}

	async set(key: string, value: string): Promise<void> {
		// IndexedDB implementation
	}

	async delete(key: string): Promise<void> {
		// IndexedDB implementation
	}

	async clear(): Promise<void> {
		// IndexedDB implementation
	}

	async has(key: string): Promise<boolean> {
		// IndexedDB implementation
		return false
	}

	async keys(pattern?: string): Promise<string[]> {
		// IndexedDB implementation
		return []
	}

	async size(): Promise<number> {
		// IndexedDB implementation
		return 0
	}
}

// ============================================================================
// Built-in Authentication Plugins
// ============================================================================

/**
 * JWT authentication plugin
 */
export class JWTAuthPlugin implements AuthPlugin {
	readonly name = 'jwt-auth'
	readonly version = '1.0.0'
	readonly description = 'JWT-based authentication'
	readonly type = 'auth' as const

	private config: JWTAuthConfig = {}

	async initialize(config: JWTAuthConfig, context: PluginContext): Promise<void> {
		this.config = config
	}

	async getAuthHeaders(
		config: JWTAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const token = await this.getToken(config)
		if (!token) {
			throw new Error('No JWT token available')
		}

		return {
			Authorization: `Bearer ${token}`,
		}
	}

	async refreshToken(config: JWTAuthConfig, context: AuthContext): Promise<string | null> {
		if (!config.refreshToken || !config.refreshEndpoint) {
			return null
		}

		try {
			const response = await fetch(config.refreshEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					refreshToken: config.refreshToken,
				}),
			})

			if (!response.ok) {
				throw new Error(`Token refresh failed: ${response.statusText}`)
			}

			const data = await response.json()
			return data.accessToken || data.token
		} catch (error) {
			console.error('Token refresh failed:', error)
			return null
		}
	}

	validateAuthConfig(config: JWTAuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.token && !config.tokenProvider) {
			errors.push('Either token or tokenProvider must be provided')
		}

		if (config.refreshEndpoint && !config.refreshToken) {
			errors.push('refreshToken is required when refreshEndpoint is provided')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private async getToken(config: JWTAuthConfig): Promise<string | null> {
		if (config.token) {
			return config.token
		}

		if (config.tokenProvider) {
			return config.tokenProvider()
		}

		return null
	}
}

interface JWTAuthConfig {
	token?: string
	tokenProvider?: () => Promise<string> | string
	refreshToken?: string
	refreshEndpoint?: string
}

/**
 * OAuth2 authentication plugin
 */
export class OAuth2AuthPlugin implements AuthPlugin {
	readonly name = 'oauth2-auth'
	readonly version = '1.0.0'
	readonly description = 'OAuth2-based authentication'
	readonly type = 'auth' as const

	private config: Partial<OAuth2AuthConfig> = {}
	private tokenCache: { token: string; expiresAt: number } | null = null

	async initialize(config: OAuth2AuthConfig, context: PluginContext): Promise<void> {
		this.config = config
	}

	async getAuthHeaders(
		config: OAuth2AuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const token = await this.getAccessToken(config)
		if (!token) {
			throw new Error('No OAuth2 access token available')
		}

		return {
			Authorization: `Bearer ${token}`,
		}
	}

	async refreshToken(config: OAuth2AuthConfig, context: AuthContext): Promise<string | null> {
		if (!config.clientId || !config.clientSecret || !config.tokenEndpoint) {
			return null
		}

		try {
			const response = await fetch(config.tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
				},
				body: new URLSearchParams({
					grant_type: 'client_credentials',
					scope: config.scope || '',
				}),
			})

			if (!response.ok) {
				throw new Error(`OAuth2 token request failed: ${response.statusText}`)
			}

			const data = await response.json()
			const expiresIn = data.expires_in || 3600

			this.tokenCache = {
				token: data.access_token,
				expiresAt: Date.now() + expiresIn * 1000,
			}

			return data.access_token
		} catch (error) {
			console.error('OAuth2 token request failed:', error)
			return null
		}
	}

	validateAuthConfig(config: OAuth2AuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.clientId) {
			errors.push('clientId is required')
		}

		if (!config.clientSecret) {
			errors.push('clientSecret is required')
		}

		if (!config.tokenEndpoint) {
			errors.push('tokenEndpoint is required')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private async getAccessToken(config: OAuth2AuthConfig): Promise<string | null> {
		// Check if we have a valid cached token
		if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
			return this.tokenCache.token
		}

		// Refresh token
		return this.refreshToken(config, {} as AuthContext)
	}
}

interface OAuth2AuthConfig {
	clientId: string
	clientSecret: string
	tokenEndpoint: string
	scope?: string
}

/**
 * Custom header authentication plugin
 */
export class CustomHeaderAuthPlugin implements AuthPlugin {
	readonly name = 'custom-header-auth'
	readonly version = '1.0.0'
	readonly description = 'Custom header-based authentication'
	readonly type = 'auth' as const

	async initialize(config: CustomHeaderAuthConfig, context: PluginContext): Promise<void> {
		// No initialization needed
	}

	async getAuthHeaders(
		config: CustomHeaderAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const headers: Record<string, string> = {}

		for (const [headerName, headerValue] of Object.entries(config.headers)) {
			if (typeof headerValue === 'function') {
				headers[headerName] = await headerValue(context)
			} else {
				headers[headerName] = headerValue
			}
		}

		return headers
	}

	validateAuthConfig(config: CustomHeaderAuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.headers || Object.keys(config.headers).length === 0) {
			errors.push('At least one header must be provided')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}
}

interface CustomHeaderAuthConfig {
	headers: Record<string, string | ((context: AuthContext) => Promise<string> | string)>
}

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Factory for creating built-in plugins
 */
export class BuiltInPluginFactory {
	/**
	 * Create a request logging plugin
	 */
	static createRequestLoggingPlugin(config?: Partial<RequestLoggingConfig>): RequestLoggingPlugin {
		return new RequestLoggingPlugin()
	}

	/**
	 * Create a correlation ID plugin
	 */
	static createCorrelationIdPlugin(config?: Partial<CorrelationIdConfig>): CorrelationIdPlugin {
		return new CorrelationIdPlugin()
	}

	/**
	 * Create a rate limiting plugin
	 */
	static createRateLimitingPlugin(config?: Partial<RateLimitingConfig>): RateLimitingPlugin {
		return new RateLimitingPlugin()
	}

	/**
	 * Create a Redis storage plugin
	 */
	static createRedisStoragePlugin(): RedisStoragePlugin {
		return new RedisStoragePlugin()
	}

	/**
	 * Create an IndexedDB storage plugin
	 */
	static createIndexedDBStoragePlugin(): IndexedDBStoragePlugin {
		return new IndexedDBStoragePlugin()
	}

	/**
	 * Create a JWT auth plugin
	 */
	static createJWTAuthPlugin(): JWTAuthPlugin {
		return new JWTAuthPlugin()
	}

	/**
	 * Create an OAuth2 auth plugin
	 */
	static createOAuth2AuthPlugin(): OAuth2AuthPlugin {
		return new OAuth2AuthPlugin()
	}

	/**
	 * Create a custom header auth plugin
	 */
	static createCustomHeaderAuthPlugin(): CustomHeaderAuthPlugin {
		return new CustomHeaderAuthPlugin()
	}
}
