// ============================================================================
// Plugin System Usage Examples
// ============================================================================

import { AuditClient } from '../core/client'
import { BuiltInPluginFactory } from '../infrastructure/plugins/built-in'

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
	ValidationResult,
} from '../infrastructure/plugins'

// ============================================================================
// Example 1: Using Built-in Plugins
// ============================================================================

export async function exampleBuiltInPlugins() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		plugins: {
			enabled: true,
			autoLoad: true,
			middleware: {
				enabled: true,
				plugins: ['request-logging', 'correlation-id', 'rate-limiting'],
			},
			storage: {
				enabled: true,
				plugins: {
					'redis-storage': {
						host: 'localhost',
						port: 6379,
						keyPrefix: 'audit-cache',
					},
				},
			},
			auth: {
				enabled: true,
				plugins: {
					'jwt-auth': {
						token: 'your-jwt-token',
						refreshEndpoint: '/auth/refresh',
					},
				},
			},
		},
	})

	// Plugins are automatically loaded due to autoLoad: true
	console.log('Plugin stats:', client.plugins.getRegistry().getStats())

	// Use the client normally - plugins work transparently
	const events = await client.events.query({
		filter: { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
	})

	console.log('Retrieved events:', events.events.length)
}

// ============================================================================
// Example 2: Creating Custom Middleware Plugin
// ============================================================================

class CustomTimingPlugin implements MiddlewarePlugin {
	readonly name = 'custom-timing'
	readonly version = '1.0.0'
	readonly description = 'Adds custom timing headers to requests'
	readonly type = 'middleware' as const

	private config: CustomTimingConfig = {}

	async initialize(config: CustomTimingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		// Add timing header
		request.headers['X-Request-Start-Time'] = Date.now().toString()

		// Add custom client identifier
		if (this.config.clientId) {
			request.headers['X-Client-ID'] = this.config.clientId
		}

		return request
	}

	async processResponse(
		response: MiddlewareResponse,
		next: MiddlewareNext
	): Promise<MiddlewareResponse> {
		// Calculate request duration
		const startTime = response.metadata.startTime
		if (startTime) {
			const duration = Date.now() - startTime
			response.headers['X-Request-Duration'] = duration.toString()
		}

		return response
	}

	validateConfig(config: CustomTimingConfig): ValidationResult {
		const errors: string[] = []

		if (config.clientId && typeof config.clientId !== 'string') {
			errors.push('clientId must be a string')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private defaultConfig(): CustomTimingConfig {
		return {
			clientId: 'audit-client',
		}
	}
}

interface CustomTimingConfig {
	clientId?: string
}

export async function exampleCustomMiddleware() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		plugins: {
			enabled: true,
			autoLoad: false, // We'll load plugins manually
		},
	})

	// Register custom middleware plugin
	const timingPlugin = new CustomTimingPlugin()
	await client.plugins.getRegistry().register(timingPlugin, {
		clientId: 'my-custom-client',
	})

	console.log('Custom plugin registered:', timingPlugin.name)

	// Use the client - custom timing headers will be added
	const health = await client.health.check()
	console.log('Health check:', health)
}

// ============================================================================
// Example 3: Creating Custom Storage Plugin
// ============================================================================

class FileSystemStoragePlugin implements StoragePlugin {
	readonly name = 'filesystem-storage'
	readonly version = '1.0.0'
	readonly description = 'File system-based cache storage'
	readonly type = 'storage' as const

	async initialize(config: FileSystemStorageConfig, context: PluginContext): Promise<void> {
		// Validate that we're in Node.js environment
		if (typeof require === 'undefined') {
			throw new Error('FileSystem storage plugin requires Node.js environment')
		}
	}

	createStorage(config: FileSystemStorageConfig): CacheStorage {
		return new FileSystemStorage(config)
	}

	validateConfig(config: FileSystemStorageConfig): ValidationResult {
		const errors: string[] = []

		if (!config.cacheDir) {
			errors.push('cacheDir is required')
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

interface FileSystemStorageConfig {
	cacheDir: string
	maxFileSize?: number
	cleanupInterval?: number
}

class FileSystemStorage implements CacheStorage {
	private config: FileSystemStorageConfig
	private fs: any
	private path: any

	constructor(config: FileSystemStorageConfig) {
		this.config = config
		// In a real implementation, you would require fs and path modules
		// this.fs = require('fs')
		// this.path = require('path')
	}

	async get(key: string): Promise<string | null> {
		// File system implementation
		return null
	}

	async set(key: string, value: string): Promise<void> {
		// File system implementation
	}

	async delete(key: string): Promise<void> {
		// File system implementation
	}

	async clear(): Promise<void> {
		// File system implementation
	}

	async has(key: string): Promise<boolean> {
		// File system implementation
		return false
	}

	async keys(pattern?: string): Promise<string[]> {
		// File system implementation
		return []
	}

	async size(): Promise<number> {
		// File system implementation
		return 0
	}
}

export async function exampleCustomStorage() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		plugins: {
			enabled: true,
			autoLoad: false,
		},
	})

	// Register custom storage plugin
	const fsStoragePlugin = new FileSystemStoragePlugin()
	await client.plugins.getRegistry().register(fsStoragePlugin, {
		cacheDir: '/tmp/audit-cache',
		maxFileSize: 1024 * 1024, // 1MB
		cleanupInterval: 3600000, // 1 hour
	})

	// Create storage instance
	const storage = client.plugins.createStorage('filesystem-storage', {
		cacheDir: '/tmp/audit-cache',
	})

	console.log('Custom storage created:', storage)
}

// ============================================================================
// Example 4: Creating Custom Authentication Plugin
// ============================================================================

class CustomSignatureAuthPlugin implements AuthPlugin {
	readonly name = 'custom-signature-auth'
	readonly version = '1.0.0'
	readonly description = 'Custom signature-based authentication'
	readonly type = 'auth' as const

	async initialize(config: CustomSignatureAuthConfig, context: PluginContext): Promise<void> {
		// Validate configuration
		if (!config.secretKey) {
			throw new Error('secretKey is required for signature authentication')
		}
	}

	async getAuthHeaders(
		config: CustomSignatureAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const timestamp = context.timestamp.toString()
		const nonce = this.generateNonce()

		// Create signature string
		const signatureString = `${context.method}|${context.url}|${timestamp}|${nonce}`
		const signature = await this.createSignature(signatureString, config.secretKey)

		return {
			'X-Auth-Timestamp': timestamp,
			'X-Auth-Nonce': nonce,
			'X-Auth-Signature': signature,
			'X-Auth-Algorithm': config.algorithm || 'HMAC-SHA256',
		}
	}

	validateAuthConfig(config: CustomSignatureAuthConfig): ValidationResult {
		const errors: string[] = []

		if (!config.secretKey) {
			errors.push('secretKey is required')
		}

		if (config.algorithm && !['HMAC-SHA256', 'HMAC-SHA512'].includes(config.algorithm)) {
			errors.push('algorithm must be HMAC-SHA256 or HMAC-SHA512')
		}

		const result: ValidationResult = {
			valid: errors.length === 0,
		}

		if (errors.length > 0) {
			result.errors = errors
		}

		return result
	}

	private generateNonce(): string {
		return Math.random().toString(36).substring(2, 15)
	}

	private async createSignature(data: string, secretKey: string): Promise<string> {
		// In a real implementation, you would use crypto module
		// const crypto = require('crypto')
		// return crypto.createHmac('sha256', secretKey).update(data).digest('hex')
		return 'mock-signature'
	}
}

interface CustomSignatureAuthConfig {
	secretKey: string
	algorithm?: 'HMAC-SHA256' | 'HMAC-SHA512'
}

export async function exampleCustomAuth() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'custom', // Use custom auth
		},
		plugins: {
			enabled: true,
			autoLoad: false,
		},
	})

	// Register custom auth plugin
	const signatureAuthPlugin = new CustomSignatureAuthPlugin()
	await client.plugins.getRegistry().register(signatureAuthPlugin, {
		secretKey: 'your-secret-key',
		algorithm: 'HMAC-SHA256',
	})

	// Get auth headers using the plugin
	const authHeaders = await client.plugins.getAuthHeaders(
		'custom-signature-auth',
		{
			secretKey: 'your-secret-key',
		},
		{
			url: 'https://api.example.com/audit/events',
			method: 'GET',
			timestamp: Date.now(),
			metadata: {},
		}
	)

	console.log('Custom auth headers:', authHeaders)
}

// ============================================================================
// Example 5: Plugin Performance Monitoring
// ============================================================================

export async function examplePluginPerformance() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		plugins: {
			enabled: true,
			autoLoad: true,
			middleware: {
				enabled: true,
				plugins: ['request-logging', 'correlation-id'],
			},
		},
	})

	// Get plugin performance metrics
	const { PluginPerformanceTracker } = await import('../infrastructure/plugins/utils')
	const tracker = new PluginPerformanceTracker()

	// Track plugin execution
	await tracker.trackExecution('request-logging', async () => {
		// Simulate plugin execution
		await new Promise((resolve) => setTimeout(resolve, 100))
	})

	// Get metrics
	const metrics = tracker.getMetrics('request-logging')
	console.log('Plugin performance metrics:', metrics)

	// Get all metrics
	const allMetrics = tracker.getAllMetrics()
	console.log('All plugin metrics:', allMetrics)
}

// ============================================================================
// Example 6: Plugin Discovery and Validation
// ============================================================================

export async function examplePluginDiscovery() {
	// Discover plugins from constructors
	const { discoverPlugins, validatePlugin } = await import('../infrastructure/plugins/utils')

	const pluginConstructors = [
		CustomTimingPlugin,
		FileSystemStoragePlugin,
		CustomSignatureAuthPlugin,
	]

	const discovery = discoverPlugins(pluginConstructors)
	console.log(
		'Discovered plugins:',
		discovery.plugins.map((p) => p.name)
	)
	console.log('Discovery errors:', discovery.errors)

	// Validate individual plugin
	const timingPlugin = new CustomTimingPlugin()
	const validation = validatePlugin(timingPlugin)
	console.log('Plugin validation:', validation)
}

// ============================================================================
// Example 7: Complete Plugin Configuration
// ============================================================================

export async function exampleCompletePluginConfig() {
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		plugins: {
			enabled: true,
			autoLoad: true,
			plugins: [
				{
					name: 'request-logging',
					type: 'middleware',
					enabled: true,
					config: {
						logRequests: true,
						logResponses: true,
						logHeaders: false,
						logBodies: false,
					},
					priority: 1,
				},
				{
					name: 'correlation-id',
					type: 'middleware',
					enabled: true,
					config: {
						headerName: 'X-Correlation-ID',
						idLength: 16,
					},
					priority: 2,
				},
			],
			middleware: {
				enabled: true,
				plugins: ['request-logging', 'correlation-id'],
			},
			storage: {
				enabled: true,
				defaultPlugin: 'redis-storage',
				plugins: {
					'redis-storage': {
						host: 'localhost',
						port: 6379,
						password: 'redis-password',
						database: 0,
						keyPrefix: 'audit-cache',
					},
				},
			},
			auth: {
				enabled: true,
				defaultPlugin: 'jwt-auth',
				plugins: {
					'jwt-auth': {
						token: 'your-jwt-token',
						refreshToken: 'your-refresh-token',
						refreshEndpoint: '/auth/refresh',
					},
				},
			},
		},
	})

	// Get plugin registry stats
	const stats = client.plugins.getRegistry().getStats()
	console.log('Plugin registry stats:', stats)

	// Use the client with all plugins active
	const events = await client.events.query({
		filter: { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
	})

	console.log('Retrieved events with plugins:', events.events.length)
}
