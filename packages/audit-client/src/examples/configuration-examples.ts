/**
 * Configuration Examples
 *
 * This file demonstrates various ways to configure the Audit Client Library
 * using the comprehensive configuration management system.
 */

import {
	AuditClientConfig,
	ConfigBuilder,
	ConfigManager,
	ConfigMigration,
	ConfigPresets,
	ConfigValidators,
	PartialAuditClientConfig,
} from '../index'

// Example 1: Basic Configuration
export function basicConfiguration() {
	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key-here',
		},
	}

	const manager = new ConfigManager(config)
	return manager
}

// Example 2: Using ConfigBuilder for Fluent Configuration
export function fluentConfiguration() {
	const manager = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.apiVersion('v2')
		.timeout(45000)
		.environment('production')
		.withApiKey('your-api-key-here')
		.withRetry({
			enabled: true,
			maxAttempts: 5,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
		})
		.withCache({
			enabled: true,
			defaultTtlMs: 600000, // 10 minutes
			storage: 'memory',
		})
		.withLogging({
			enabled: true,
			level: 'info',
			maskSensitiveData: true,
		})
		.withPerformance({
			enableCompression: true,
			maxConcurrentRequests: 20,
		})
		.createManager()

	return manager
}

// Example 3: Environment-Specific Configuration
export function environmentConfiguration() {
	// Base configuration
	const baseConfig: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key-here',
		},
	}

	const manager = new ConfigManager(baseConfig)

	// Load development-specific settings
	manager.loadEnvironmentConfig('development', {
		logging: {
			level: 'debug',
			includeRequestBody: true,
			includeResponseBody: true,
		},
		errorHandling: {
			includeStackTrace: true,
		},
		retry: {
			maxAttempts: 2, // Fewer retries in development
		},
	})

	// Load production-specific settings
	manager.loadEnvironmentConfig('production', {
		logging: {
			level: 'warn',
			maskSensitiveData: true,
		},
		performance: {
			enableCompression: true,
			maxConcurrentRequests: 50,
		},
		cache: {
			enabled: true,
			defaultTtlMs: 300000, // 5 minutes
		},
	})

	return manager
}

// Example 4: Configuration from Environment Variables
export function environmentVariableConfiguration() {
	// This would read from process.env with AUDIT_CLIENT_ prefix
	const envConfig = ConfigManager.fromEnvironment()

	// Merge with defaults
	const finalConfig = {
		...envConfig,
		baseUrl: envConfig.baseUrl || 'https://api.example.com',
		authentication: envConfig.authentication || {
			type: 'apiKey' as const,
			apiKey: process.env.API_KEY || 'default-key',
		},
	}

	return new ConfigManager(finalConfig)
}

// Example 5: Using Configuration Presets
export function presetConfigurations() {
	// Development preset
	const devConfig = ConfigPresets.development('https://dev-api.example.com', 'dev-key')
	const devManager = new ConfigManager(devConfig)

	// Production preset
	const prodConfig = ConfigPresets.production('https://api.example.com', 'prod-key')
	const prodManager = new ConfigManager(prodConfig)

	// High-performance preset
	const perfConfig = ConfigPresets.highPerformance('https://api.example.com', 'perf-key')
	const perfManager = new ConfigManager(perfConfig)

	// Mobile preset
	const mobileConfig = ConfigPresets.mobile('https://api.example.com', 'mobile-key')
	const mobileManager = new ConfigManager(mobileConfig)

	return {
		development: devManager,
		production: prodManager,
		performance: perfManager,
		mobile: mobileManager,
	}
}

// Example 6: Advanced Authentication Configurations
export function authenticationExamples() {
	// API Key Authentication
	const apiKeyConfig = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.withApiKey('your-api-key')
		.createManager()

	// Bearer Token Authentication with Auto-Refresh
	const bearerConfig = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.withBearerToken('your-bearer-token', true) // Enable auto-refresh
		.createManager()

	// Session Token Authentication
	const sessionConfig = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.withSessionToken('your-session-token')
		.createManager()

	// Custom Authentication Headers
	const customConfig = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.withCustomAuth({
			'X-API-Key': 'your-api-key',
			'X-Client-ID': 'your-client-id',
			Authorization: 'Custom your-token',
		})
		.createManager()

	return {
		apiKey: apiKeyConfig,
		bearer: bearerConfig,
		session: sessionConfig,
		custom: customConfig,
	}
}

// Example 7: Performance Optimization Configuration
export function performanceOptimizedConfiguration() {
	const manager = new ConfigBuilder()
		.baseUrl('https://api.example.com')
		.withApiKey('your-api-key')
		.withPerformance({
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: 100,
			requestDeduplication: true,
			responseTransformation: true,
		})
		.withCache({
			enabled: true,
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 10000,
			storage: 'memory',
			compressionEnabled: true,
		})
		.withRetry({
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 500,
			maxDelayMs: 10000,
			backoffMultiplier: 2,
		})
		.createManager()

	return manager
}

// Example 8: Configuration Validation
export function configurationValidation() {
	const config: PartialAuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'your-api-key',
		},
		environment: 'production',
		logging: {
			level: 'debug', // This will generate a warning for production
		},
	}

	// Validate configuration
	const validationResult = ConfigManager.validateConfig(config)

	if (!validationResult.isValid) {
		console.error('Configuration validation failed:', validationResult.errors)
		return null
	}

	// Check for authentication issues
	const authErrors = ConfigValidators.validateAuthentication(config)
	if (authErrors.length > 0) {
		console.error('Authentication validation errors:', authErrors)
	}

	// Check for performance warnings
	const perfWarnings = ConfigValidators.validatePerformance(config)
	if (perfWarnings.length > 0) {
		console.warn('Performance warnings:', perfWarnings)
	}

	// Check for environment-specific warnings
	const envWarnings = ConfigValidators.validateEnvironment(config)
	if (envWarnings.length > 0) {
		console.warn('Environment warnings:', envWarnings)
	}

	return new ConfigManager(config)
}

// Example 9: Legacy Configuration Migration
export function legacyConfigurationMigration() {
	// Legacy configuration format
	const legacyConfig = {
		baseUrl: 'https://api.example.com',
		apiKey: 'your-api-key',
		version: 'v1',
		retries: 3,
		backoffMs: 1000,
		maxBackoffMs: 30000,
		headers: {
			'X-Custom': 'value',
		},
	}

	// Get migration warnings
	const warnings = ConfigMigration.getMigrationWarnings(legacyConfig)
	if (warnings.length > 0) {
		console.warn('Migration warnings:', warnings)
	}

	// Migrate to new format
	const migratedConfig = ConfigMigration.migrateLegacyConfig(legacyConfig)

	// Create manager with migrated config
	return new ConfigManager(migratedConfig)
}

// Example 10: Dynamic Configuration Updates
export function dynamicConfigurationUpdates() {
	// Start with basic configuration
	const manager = new ConfigManager({
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'initial-key',
		},
	})

	// Update authentication
	manager.updateConfig({
		authentication: {
			type: 'bearer',
			bearerToken: 'new-bearer-token',
			autoRefresh: true,
		},
	})

	// Update performance settings
	manager.updateConfig({
		performance: {
			maxConcurrentRequests: 50,
			enableCompression: true,
		},
	})

	// Update logging level
	manager.updateConfig({
		logging: {
			level: 'debug',
		},
	})

	return manager
}

// Example 11: Complete Real-World Configuration
export function realWorldConfiguration() {
	const manager = new ConfigBuilder()
		.baseUrl(process.env.AUDIT_API_URL || 'https://api.example.com')
		.apiVersion('v2')
		.timeout(30000)
		.environment((process.env.NODE_ENV as any) || 'development')
		.withApiKey(process.env.AUDIT_API_KEY || 'default-key')
		.withRetry({
			enabled: true,
			maxAttempts: 3,
			initialDelayMs: 1000,
			maxDelayMs: 30000,
			backoffMultiplier: 2,
			retryableStatusCodes: [408, 429, 500, 502, 503, 504],
		})
		.withCache({
			enabled: process.env.NODE_ENV === 'production',
			defaultTtlMs: 300000, // 5 minutes
			maxSize: 1000,
			storage: 'memory',
			keyPrefix: 'audit-client',
		})
		.withLogging({
			enabled: true,
			level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
			includeRequestBody: process.env.NODE_ENV !== 'production',
			includeResponseBody: process.env.NODE_ENV !== 'production',
			maskSensitiveData: true,
		})
		.withPerformance({
			enableCompression: true,
			enableStreaming: true,
			maxConcurrentRequests: process.env.NODE_ENV === 'production' ? 50 : 10,
			requestDeduplication: true,
		})
		.withHeaders({
			'User-Agent': 'AuditClient/1.0.0',
			'X-Client-Version': '1.0.0',
		})
		.createManager()

	// Load environment-specific overrides
	if (process.env.NODE_ENV === 'development') {
		manager.loadEnvironmentConfig('development', {
			errorHandling: {
				includeStackTrace: true,
			},
		})
	}

	return manager
}

// Example 12: Configuration Testing Utilities
export function configurationTesting() {
	// Create test configuration
	const testConfig = ConfigPresets.debugging('https://test-api.example.com', 'test-key')

	// Validate test configuration
	const validation = ConfigManager.validateConfig(testConfig)

	if (!validation.isValid) {
		throw new Error('Test configuration is invalid')
	}

	// Create manager for testing
	const manager = new ConfigManager(testConfig)

	// Verify configuration values
	const config = manager.getConfig()

	console.log('Test Configuration Summary:')
	console.log('- Base URL:', config.baseUrl)
	console.log('- Authentication:', config.authentication.type)
	console.log('- Logging Level:', config.logging.level)
	console.log('- Retry Enabled:', config.retry.enabled)
	console.log('- Cache Enabled:', config.cache.enabled)

	return manager
}

// Export all examples
export const ConfigurationExamples = {
	basic: basicConfiguration,
	fluent: fluentConfiguration,
	environment: environmentConfiguration,
	environmentVariables: environmentVariableConfiguration,
	presets: presetConfigurations,
	authentication: authenticationExamples,
	performance: performanceOptimizedConfiguration,
	validation: configurationValidation,
	migration: legacyConfigurationMigration,
	dynamic: dynamicConfigurationUpdates,
	realWorld: realWorldConfiguration,
	testing: configurationTesting,
}
