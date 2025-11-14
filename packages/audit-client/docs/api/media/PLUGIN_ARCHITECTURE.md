# Plugin Architecture System

The Audit Client Library includes a comprehensive plugin architecture that allows developers to extend functionality through custom middleware, storage backends, and authentication methods.

## Overview

The plugin system provides:

- **Middleware Plugins**: Process requests and responses
- **Storage Plugins**: Custom cache storage backends
- **Authentication Plugins**: Custom authentication methods
- **Plugin Registry**: Centralized plugin management
- **Plugin Manager**: Orchestrates plugin operations
- **Built-in Plugins**: Ready-to-use common functionality

## Core Concepts

### Plugin Interface

All plugins must implement the base `Plugin` interface:

```typescript
interface Plugin {
	readonly name: string
	readonly version: string
	readonly description?: string
	readonly dependencies?: string[]
	readonly configSchema?: Record<string, any>

	initialize(config: any, context: PluginContext): Promise<void> | void
	destroy?(): Promise<void> | void
	validateConfig?(config: any): ValidationResult
}
```

### Plugin Types

#### Middleware Plugin

Processes HTTP requests and responses:

```typescript
interface MiddlewarePlugin extends Plugin {
	readonly type: 'middleware'

	processRequest?(request: MiddlewareRequest, next: MiddlewareNext): Promise<MiddlewareRequest>
	processResponse?(response: MiddlewareResponse, next: MiddlewareNext): Promise<MiddlewareResponse>
	handleError?(error: Error, context: MiddlewareErrorContext): Promise<void> | void
}
```

#### Storage Plugin

Creates custom cache storage backends:

```typescript
interface StoragePlugin extends Plugin {
	readonly type: 'storage'

	createStorage(config: any): CacheStorage
}
```

#### Authentication Plugin

Provides custom authentication methods:

```typescript
interface AuthPlugin extends Plugin {
	readonly type: 'auth'

	getAuthHeaders(config: any, context: AuthContext): Promise<Record<string, string>>
	refreshToken?(config: any, context: AuthContext): Promise<string | null>
	validateAuthConfig?(config: any): ValidationResult
	handleAuthError?(error: Error, config: any, context: AuthContext): Promise<void> | void
}
```

## Built-in Plugins

### Middleware Plugins

#### Request Logging Plugin

Logs all HTTP requests and responses with configurable detail levels.

```typescript
const client = new AuditClient({
	plugins: {
		middleware: {
			enabled: true,
			plugins: ['request-logging'],
		},
	},
})
```

Configuration:

```typescript
{
  logRequests: true,
  logResponses: true,
  logHeaders: false,
  logBodies: false,
  logLevel: 'info'
}
```

#### Correlation ID Plugin

Adds correlation IDs to requests for distributed tracing.

```typescript
const client = new AuditClient({
	plugins: {
		middleware: {
			enabled: true,
			plugins: ['correlation-id'],
		},
	},
})
```

Configuration:

```typescript
{
  headerName: 'X-Correlation-ID',
  idLength: 16
}
```

#### Rate Limiting Plugin

Client-side rate limiting for API requests.

```typescript
const client = new AuditClient({
	plugins: {
		middleware: {
			enabled: true,
			plugins: ['rate-limiting'],
		},
	},
})
```

Configuration:

```typescript
{
  maxRequests: 100,
  windowMs: 60000 // 1 minute
}
```

### Storage Plugins

#### Redis Storage Plugin

Redis-based cache storage for distributed caching.

```typescript
const client = new AuditClient({
	plugins: {
		storage: {
			enabled: true,
			plugins: {
				'redis-storage': {
					host: 'localhost',
					port: 6379,
					password: 'redis-password',
					keyPrefix: 'audit-cache',
				},
			},
		},
	},
})
```

#### IndexedDB Storage Plugin

Browser-based IndexedDB storage for client-side caching.

```typescript
const client = new AuditClient({
	plugins: {
		storage: {
			enabled: true,
			plugins: {
				'indexeddb-storage': {
					databaseName: 'audit-cache',
					version: 1,
					storeName: 'cache',
				},
			},
		},
	},
})
```

### Authentication Plugins

#### JWT Authentication Plugin

JWT-based authentication with automatic token refresh.

```typescript
const client = new AuditClient({
	plugins: {
		auth: {
			enabled: true,
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
```

#### OAuth2 Authentication Plugin

OAuth2 client credentials flow authentication.

```typescript
const client = new AuditClient({
	plugins: {
		auth: {
			enabled: true,
			plugins: {
				'oauth2-auth': {
					clientId: 'your-client-id',
					clientSecret: 'your-client-secret',
					tokenEndpoint: 'https://auth.example.com/token',
					scope: 'audit:read audit:write',
				},
			},
		},
	},
})
```

#### Custom Header Authentication Plugin

Custom header-based authentication.

```typescript
const client = new AuditClient({
	plugins: {
		auth: {
			enabled: true,
			plugins: {
				'custom-header-auth': {
					headers: {
						'X-API-Key': 'your-api-key',
						'X-Client-ID': 'your-client-id',
					},
				},
			},
		},
	},
})
```

## Creating Custom Plugins

### Custom Middleware Plugin

```typescript
import type {
	MiddlewareNext,
	MiddlewarePlugin,
	MiddlewareRequest,
	PluginContext,
} from '@smedrec/audit-client'

class CustomTimingPlugin implements MiddlewarePlugin {
	readonly name = 'custom-timing'
	readonly version = '1.0.0'
	readonly description = 'Adds custom timing headers'
	readonly type = 'middleware' as const

	private config: CustomTimingConfig = {}

	async initialize(config: CustomTimingConfig, context: PluginContext): Promise<void> {
		this.config = { ...this.defaultConfig(), ...config }
	}

	async processRequest(
		request: MiddlewareRequest,
		next: MiddlewareNext
	): Promise<MiddlewareRequest> {
		request.headers['X-Request-Start-Time'] = Date.now().toString()
		return request
	}

	private defaultConfig(): CustomTimingConfig {
		return {
			includeClientId: true,
		}
	}
}

interface CustomTimingConfig {
	includeClientId?: boolean
}

// Register the plugin
const client = new AuditClient({
	/* config */
})
const timingPlugin = new CustomTimingPlugin()
await client.plugins.getRegistry().register(timingPlugin, {
	includeClientId: true,
})
```

### Custom Storage Plugin

```typescript
import type { CacheStorage, StoragePlugin } from '@smedrec/audit-client'

class FileSystemStoragePlugin implements StoragePlugin {
	readonly name = 'filesystem-storage'
	readonly version = '1.0.0'
	readonly type = 'storage' as const

	createStorage(config: FileSystemStorageConfig): CacheStorage {
		return new FileSystemStorage(config)
	}
}

class FileSystemStorage implements CacheStorage {
	constructor(private config: FileSystemStorageConfig) {}

	async get(key: string): Promise<string | null> {
		// Implementation
		return null
	}

	async set(key: string, value: string): Promise<void> {
		// Implementation
	}

	// ... other CacheStorage methods
}

interface FileSystemStorageConfig {
	cacheDir: string
	maxFileSize?: number
}
```

### Custom Authentication Plugin

```typescript
import type { AuthContext, AuthPlugin } from '@smedrec/audit-client'

class SignatureAuthPlugin implements AuthPlugin {
	readonly name = 'signature-auth'
	readonly version = '1.0.0'
	readonly type = 'auth' as const

	async getAuthHeaders(
		config: SignatureAuthConfig,
		context: AuthContext
	): Promise<Record<string, string>> {
		const timestamp = context.timestamp.toString()
		const signature = await this.createSignature(context, config.secretKey)

		return {
			'X-Timestamp': timestamp,
			'X-Signature': signature,
		}
	}

	private async createSignature(context: AuthContext, secretKey: string): Promise<string> {
		// Implementation
		return 'signature'
	}
}

interface SignatureAuthConfig {
	secretKey: string
}
```

## Plugin Configuration

### Complete Configuration Example

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'custom', // Use plugin-based auth
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
					logLevel: 'info',
				},
				priority: 1,
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
				},
			},
		},
		auth: {
			enabled: true,
			defaultPlugin: 'jwt-auth',
			plugins: {
				'jwt-auth': {
					token: 'your-token',
				},
			},
		},
	},
})
```

### Environment-based Configuration

```typescript
// Load from environment variables
const config = ConfigManager.fromEnvironment('AUDIT_CLIENT_')

// Or use environment-specific defaults
const config = ConfigManager.createDefaultConfig('production')
```

## Plugin Management

### Manual Plugin Registration

```typescript
const client = new AuditClient({
	plugins: { enabled: true, autoLoad: false },
})

// Register plugins manually
const loggingPlugin = BuiltInPluginFactory.createRequestLoggingPlugin()
await client.plugins.getRegistry().register(loggingPlugin, {
	logLevel: 'debug',
})

// Create custom storage
const storage = client.plugins.createStorage('redis-storage', {
	host: 'localhost',
})

// Get auth headers
const headers = await client.plugins.getAuthHeaders(
	'jwt-auth',
	{
		token: 'your-token',
	},
	{
		url: 'https://api.example.com',
		method: 'GET',
		timestamp: Date.now(),
		metadata: {},
	}
)
```

### Plugin Statistics and Monitoring

```typescript
// Performance tracking
import { PluginPerformanceTracker } from '@smedrec/audit-client'

// Get plugin registry statistics
const stats = client.plugins.getRegistry().getStats()
console.log('Total plugins:', stats.totalPlugins)
console.log('Middleware plugins:', stats.middlewarePlugins)

const tracker = new PluginPerformanceTracker()
await tracker.trackExecution('my-plugin', async () => {
	// Plugin operation
})

const metrics = tracker.getMetrics('my-plugin')
console.log('Execution count:', metrics.executionCount)
console.log('Average time:', metrics.averageExecutionTime)
```

## Plugin Utilities

### Plugin Validation

```typescript
import { validateMiddlewarePlugin, validatePlugin } from '@smedrec/audit-client'

const plugin = new MyCustomPlugin()
const validation = validatePlugin(plugin)

if (!validation.valid) {
	console.error('Plugin validation failed:', validation.errors)
}
```

### Plugin Discovery

```typescript
import { discoverPlugins } from '@smedrec/audit-client'

const pluginConstructors = [Plugin1, Plugin2, Plugin3]
const result = discoverPlugins(pluginConstructors)

console.log(
	'Discovered plugins:',
	result.plugins.map((p) => p.name)
)
console.log('Discovery errors:', result.errors)
```

### Dependency Resolution

```typescript
import { resolveDependencies } from '@smedrec/audit-client'

const plugins = [pluginA, pluginB, pluginC] // pluginC depends on pluginA
const sortedPlugins = resolveDependencies(plugins)
// Returns: [pluginA, pluginB, pluginC] (dependency order)
```

## Best Practices

### Plugin Development

1. **Follow the Plugin Interface**: Always implement the required methods
2. **Validate Configuration**: Provide comprehensive config validation
3. **Handle Errors Gracefully**: Don't let plugin errors crash the client
4. **Document Dependencies**: Clearly specify plugin dependencies
5. **Version Compatibility**: Use semantic versioning for plugins

### Performance Considerations

1. **Minimize Middleware Overhead**: Keep middleware processing lightweight
2. **Cache Plugin Results**: Cache expensive operations when possible
3. **Use Async Operations**: Don't block the main thread
4. **Monitor Performance**: Use the performance tracker to identify bottlenecks

### Security Considerations

1. **Validate Input**: Always validate plugin configuration and input
2. **Sanitize Data**: Clean sensitive data in logs and errors
3. **Secure Storage**: Use secure storage for sensitive plugin data
4. **Authentication Security**: Follow security best practices for auth plugins

## Troubleshooting

### Common Issues

1. **Plugin Not Loading**: Check plugin registration and dependencies
2. **Configuration Errors**: Validate plugin configuration schema
3. **Performance Issues**: Use performance tracking to identify slow plugins
4. **Memory Leaks**: Ensure proper cleanup in plugin destroy methods

### Debugging

```typescript
// Enable debug logging
const client = new AuditClient({
	logging: {
		level: 'debug',
		includeRequestBody: true,
		includeResponseBody: true,
	},
	plugins: {
		enabled: true,
	},
})

// Check plugin status
const registry = client.plugins.getRegistry()
console.log(
	'Registered plugins:',
	registry.getAllPlugins().map((p) => p.name)
)
console.log(
	'Middleware chain:',
	registry.getMiddlewareChain().map((p) => p.name)
)
```

## Examples

See the [plugin usage examples](../examples/plugin-usage.ts) for complete working examples of:

- Using built-in plugins
- Creating custom middleware plugins
- Creating custom storage plugins
- Creating custom authentication plugins
- Plugin performance monitoring
- Plugin discovery and validation
- Complete plugin configuration

## API Reference

For detailed API documentation, see the TypeScript definitions in:

- [plugins.ts](./plugins.ts) - Core plugin interfaces
- [built-in.ts](./built-in.ts) - Built-in plugin implementations
- [utils.ts](./utils.ts) - Plugin utilities and helpers
