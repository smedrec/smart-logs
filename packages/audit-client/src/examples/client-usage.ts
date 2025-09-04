/**
 * AuditClient Usage Examples
 *
 * This file demonstrates how to use the main AuditClient class
 * with various configuration options and service interactions.
 */

import { AuditClient } from '../core/client'

import type { PartialAuditClientConfig } from '../core/config'

// Example 1: Basic client initialization
export async function basicClientExample() {
	console.log('🚀 Basic AuditClient Example\n')

	// Create client with minimal configuration
	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key-here',
		},
	})

	console.log('✅ Client initialized successfully')
	console.log('📊 Client state:', client.getState())
	console.log('🔧 Client ready:', client.isReady())

	// Access services
	console.log('\n📋 Available services:')
	console.log('- Events service:', !!client.events)
	console.log('- Compliance service:', !!client.compliance)
	console.log('- Scheduled reports service:', !!client.scheduledReports)
	console.log('- Presets service:', !!client.presets)
	console.log('- Metrics service:', !!client.metrics)
	console.log('- Health service:', !!client.health)

	// Get client statistics
	const stats = client.getStats()
	console.log('\n📈 Client statistics:')
	console.log('- Uptime:', stats.uptime, 'ms')
	console.log('- Request count:', stats.requestCount)
	console.log('- Error count:', stats.errorCount)

	// Cleanup
	await client.destroy()
	console.log('🧹 Client destroyed successfully\n')
}

// Example 2: Advanced configuration
export async function advancedConfigurationExample() {
	console.log('⚙️ Advanced Configuration Example\n')

	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		apiVersion: 'v2',
		timeout: 60000,
		environment: 'development',

		authentication: {
			type: 'bearer',
			bearerToken: 'your-bearer-token',
			autoRefresh: true,
			refreshEndpoint: '/auth/refresh',
		},

		retry: {
			enabled: true,
			maxAttempts: 5,
			initialDelayMs: 2000,
			maxDelayMs: 30000,
			backoffMultiplier: 2.5,
		},

		cache: {
			enabled: true,
			defaultTtlMs: 600000, // 10 minutes
			maxSize: 2000,
			storage: 'memory',
			keyPrefix: 'audit-dev',
			compressionEnabled: true,
		},

		performance: {
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 15,
			requestDeduplication: true,
			responseTransformation: true,
		},

		logging: {
			enabled: true,
			level: 'debug',
			includeRequestBody: true,
			includeResponseBody: true,
			maskSensitiveData: true,
		},

		errorHandling: {
			throwOnError: true,
			includeStackTrace: true,
			transformErrors: true,
			sanitizeErrors: true,
			enableRecovery: true,
		},

		customHeaders: {
			'X-Client-Version': '1.0.0',
			'X-Environment': 'development',
		},
	}

	const client = new AuditClient(config)

	console.log('✅ Advanced client initialized')
	console.log('🔧 Configuration applied:')
	const appliedConfig = client.getConfig()
	console.log('- Base URL:', appliedConfig.baseUrl)
	console.log('- API Version:', appliedConfig.apiVersion)
	console.log('- Environment:', appliedConfig.environment)
	console.log('- Auth type:', appliedConfig.authentication.type)
	console.log('- Cache enabled:', appliedConfig.cache.enabled)
	console.log('- Retry enabled:', appliedConfig.retry.enabled)

	await client.destroy()
	console.log('🧹 Advanced client destroyed\n')
}

// Example 3: Environment-specific clients
export async function environmentSpecificExample() {
	console.log('🌍 Environment-Specific Client Example\n')

	// Development client
	const devClient = AuditClient.createForEnvironment('development', 'https://dev-api.example.com', {
		type: 'apiKey',
		apiKey: 'dev-key',
	})

	console.log('🔧 Development client created')
	console.log('- Environment:', devClient.getConfig().environment)
	console.log('- Base URL:', devClient.getConfig().baseUrl)

	// Production client
	const prodClient = AuditClient.createForEnvironment(
		'production',
		'https://api.example.com',
		{ type: 'bearer', bearerToken: 'prod-token' },
		{
			cache: { enabled: true, defaultTtlMs: 300000 },
			performance: { maxConcurrentRequests: 50 },
		}
	)

	console.log('🚀 Production client created')
	console.log('- Environment:', prodClient.getConfig().environment)
	console.log('- Cache TTL:', prodClient.getConfig().cache.defaultTtlMs)

	// Cleanup
	await Promise.all([devClient.destroy(), prodClient.destroy()])
	console.log('🧹 Environment clients destroyed\n')
}

// Example 4: Configuration updates and interceptors
export async function configurationAndInterceptorsExample() {
	console.log('🔄 Configuration Updates & Interceptors Example\n')

	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: { type: 'apiKey', apiKey: 'initial-key' },
	})

	// Update configuration
	console.log('📝 Updating configuration...')
	client.updateConfig({
		timeout: 45000,
		logging: {
			enabled: true,
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
	})

	console.log('✅ Configuration updated')
	console.log('- New timeout:', client.getConfig().timeout)
	console.log('- Logging level:', client.getConfig().logging.level)

	// Add request interceptor
	console.log('\n🔌 Adding request interceptor...')
	client.addRequestInterceptor((options) => {
		console.log('🔍 Request interceptor: Adding custom header')
		return {
			...options,
			headers: {
				...options.headers,
				'X-Custom-Header': 'intercepted-request',
			},
		}
	})

	// Add response interceptor
	console.log('🔌 Adding response interceptor...')
	client.addResponseInterceptor((response) => {
		console.log('🔍 Response interceptor: Processing response')
		return {
			...response,
			intercepted: true,
			timestamp: new Date().toISOString(),
		}
	})

	console.log('✅ Interceptors added')

	// Clear interceptors
	console.log('\n🧹 Clearing interceptors...')
	client.clearInterceptors()
	console.log('✅ Interceptors cleared')

	await client.destroy()
	console.log('🧹 Client destroyed\n')
}

// Example 5: Health checks and monitoring
export async function healthCheckAndMonitoringExample() {
	console.log('🏥 Health Check & Monitoring Example\n')

	const client = new AuditClient({
		baseUrl: 'https://api.example.com',
		authentication: { type: 'apiKey', apiKey: 'monitor-key' },
	})

	// Get infrastructure statistics
	console.log('📊 Infrastructure statistics:')
	const infraStats = client.getInfrastructureStats()
	console.log('- Cache stats available:', !!infraStats.cache)
	console.log('- Retry stats available:', !!infraStats.retry)
	console.log('- Batch stats available:', !!infraStats.batch)
	console.log('- Auth stats available:', !!infraStats.auth)

	// Get service statistics
	console.log('\n📋 Service statistics:')
	const serviceStats = client.getServiceStats()
	console.log('- Events service stats:', !!serviceStats.events)
	console.log('- Compliance service stats:', !!serviceStats.compliance)
	console.log('- Health service stats:', !!serviceStats.health)

	// Perform health check (this will fail with the example URL, but shows the structure)
	console.log('\n🏥 Performing health check...')
	try {
		const healthResult = await client.healthCheck()
		console.log('✅ Health check result:')
		console.log('- Overall status:', healthResult.overall)
		console.log('- Services:', Object.keys(healthResult.services).length)
		console.log('- Timestamp:', healthResult.timestamp)
	} catch (error) {
		console.log('❌ Health check failed (expected with example URL)')
		console.log('- This is normal for the example - real API would work')
	}

	await client.destroy()
	console.log('🧹 Monitoring client destroyed\n')
}

// Example 6: Configuration validation
export function configurationValidationExample() {
	console.log('✅ Configuration Validation Example\n')

	// Valid configuration
	const validConfig = {
		baseUrl: 'https://api.example.com',
		authentication: { type: 'apiKey' as const, apiKey: 'test-key' },
	}

	const validResult = AuditClient.validateConfig(validConfig)
	console.log('✅ Valid configuration check:')
	console.log('- Is valid:', validResult.isValid)
	console.log('- Has errors:', !!validResult.errors)

	// Invalid configuration
	const invalidConfig = {
		baseUrl: 'not-a-valid-url',
		authentication: { type: 'apiKey' as const }, // Missing apiKey
	}

	const invalidResult = AuditClient.validateConfig(invalidConfig)
	console.log('\n❌ Invalid configuration check:')
	console.log('- Is valid:', invalidResult.isValid)
	console.log('- Has errors:', !!invalidResult.errors)
	if (invalidResult.errors) {
		console.log('- Error count:', invalidResult.errors.errors.length)
	}

	console.log('✅ Configuration validation completed\n')
}

// Run all examples
export async function runAllExamples() {
	console.log('🎯 AuditClient Usage Examples\n')
	console.log('='.repeat(50))

	try {
		await basicClientExample()
		await advancedConfigurationExample()
		await environmentSpecificExample()
		await configurationAndInterceptorsExample()
		await healthCheckAndMonitoringExample()
		configurationValidationExample()

		console.log('🎉 All examples completed successfully!')
	} catch (error) {
		console.error('❌ Example failed:', error)
	}
}

// Run examples if this file is executed directly
if (require.main === module) {
	runAllExamples()
}
