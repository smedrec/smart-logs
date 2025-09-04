/**
 * Authentication examples demonstrating various authentication methods
 * and advanced features of the AuthManager
 */

import { AuthenticationError, AuthManager } from '../infrastructure/auth'

import type { AuthenticationConfig } from '../core/config'

// Example 1: API Key Authentication
async function apiKeyAuthExample() {
	console.log('=== API Key Authentication Example ===')

	const config: AuthenticationConfig = {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
		autoRefresh: false,
	}

	const authManager = new AuthManager(config)

	try {
		const headers = await authManager.getAuthHeaders()
		console.log('API Key Headers:', headers)
		// Output: { 'X-API-Key': 'your-api-key-here' }
	} catch (error) {
		console.error('API Key Auth Error:', error)
	}
}

// Example 2: Session Token Authentication with Auto Refresh
async function sessionTokenWithRefreshExample() {
	console.log('=== Session Token with Auto Refresh Example ===')

	const config: AuthenticationConfig = {
		type: 'session',
		sessionToken: 'your-session-token',
		autoRefresh: true,
		refreshEndpoint: 'https://api.example.com/auth/refresh',
	}

	const authManager = new AuthManager(config)

	try {
		// Set token as expired to demonstrate refresh
		authManager.setTokenCache('your-session-token', 'session', -3600) // Expired 1 hour ago

		const headers = await authManager.getAuthHeaders()
		console.log('Session Headers (after refresh):', headers)
		// Will automatically refresh the token and return new headers
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.error('Session Auth Error:', error.message, 'Code:', error.code)
		}
	}
}

// Example 3: Bearer Token Authentication
async function bearerTokenExample() {
	console.log('=== Bearer Token Authentication Example ===')

	const config: AuthenticationConfig = {
		type: 'bearer',
		bearerToken: 'your-bearer-token',
		autoRefresh: false,
	}

	const authManager = new AuthManager(config)

	try {
		const headers = await authManager.getAuthHeaders()
		console.log('Bearer Headers:', headers)
		// Output: { 'Authorization': 'Bearer your-bearer-token' }
	} catch (error) {
		console.error('Bearer Auth Error:', error)
	}
}

// Example 4: Custom Authentication Headers
async function customAuthExample() {
	console.log('=== Custom Authentication Example ===')

	const config: AuthenticationConfig = {
		type: 'custom',
		customHeaders: {
			'X-Custom-Auth': 'custom-auth-value',
			'X-Client-ID': 'client-12345',
			'X-Signature': 'hmac-sha256-signature',
		},
		autoRefresh: false,
	}

	const authManager = new AuthManager(config)

	try {
		const headers = await authManager.getAuthHeaders()
		console.log('Custom Headers:', headers)
		// Output: All custom headers as specified
	} catch (error) {
		console.error('Custom Auth Error:', error)
	}
}

// Example 5: Token Caching and Management
async function tokenCachingExample() {
	console.log('=== Token Caching Example ===')

	const config: AuthenticationConfig = {
		type: 'session',
		sessionToken: 'cached-token',
		autoRefresh: false,
	}

	const authManager = new AuthManager(config)

	// Manually cache a token with 1 hour expiration
	authManager.setTokenCache('cached-token', 'session', 3600)

	// Check cache statistics
	let stats = authManager.getCacheStats()
	console.log('Cache Stats:', stats)
	// Output: { totalTokens: 1, expiredTokens: 0, activeRefreshes: 0 }

	// Add an expired token
	authManager.setTokenCache('expired-token', 'session', -1800)

	stats = authManager.getCacheStats()
	console.log('Cache Stats with expired token:', stats)
	// Output: { totalTokens: 2, expiredTokens: 1, activeRefreshes: 0 }

	// Clean up expired tokens
	const cleanedCount = authManager.cleanupExpiredTokens()
	console.log('Cleaned expired tokens:', cleanedCount)

	stats = authManager.getCacheStats()
	console.log('Cache Stats after cleanup:', stats)
	// Output: { totalTokens: 1, expiredTokens: 0, activeRefreshes: 0 }
}

// Example 6: Configuration Validation
async function configValidationExample() {
	console.log('=== Configuration Validation Example ===')

	// Valid configuration
	const validConfig: AuthenticationConfig = {
		type: 'apiKey',
		apiKey: 'valid-key',
		autoRefresh: false,
	}

	const authManager = new AuthManager(validConfig)
	let validation = authManager.validateConfig()
	console.log('Valid config validation:', validation)
	// Output: { isValid: true, errors: [] }

	// Invalid configuration - missing API key
	authManager.updateConfig({ apiKey: undefined })
	validation = authManager.validateConfig()
	console.log('Invalid config validation:', validation)
	// Output: { isValid: false, errors: ['API key is required for apiKey authentication'] }

	// Invalid configuration - auto refresh without endpoint
	authManager.updateConfig({
		type: 'session',
		sessionToken: 'token',
		autoRefresh: true,
		refreshEndpoint: undefined,
	})
	validation = authManager.validateConfig()
	console.log('Invalid refresh config validation:', validation)
	// Output: { isValid: false, errors: ['Refresh endpoint is required when auto refresh is enabled'] }
}

// Example 7: Dynamic Configuration Updates
async function dynamicConfigExample() {
	console.log('=== Dynamic Configuration Example ===')

	// Start with API key authentication
	const config: AuthenticationConfig = {
		type: 'apiKey',
		apiKey: 'initial-api-key',
		autoRefresh: false,
	}

	const authManager = new AuthManager(config)

	let headers = await authManager.getAuthHeaders()
	console.log('Initial headers:', headers)

	// Switch to bearer token authentication
	authManager.updateConfig({
		type: 'bearer',
		bearerToken: 'new-bearer-token',
	})

	headers = await authManager.getAuthHeaders()
	console.log('Updated headers:', headers)

	// Get current configuration
	const currentConfig = authManager.getConfig()
	console.log('Current config type:', currentConfig.type)
	console.log('Current bearer token:', currentConfig.bearerToken)
}

// Example 8: Error Handling and Recovery
async function errorHandlingExample() {
	console.log('=== Error Handling Example ===')

	// Configuration without required fields
	const incompleteConfig: AuthenticationConfig = {
		type: 'apiKey',
		autoRefresh: false,
		// Missing apiKey
	}

	const authManager = new AuthManager(incompleteConfig)

	try {
		await authManager.getAuthHeaders()
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.log('Caught AuthenticationError:')
			console.log('  Message:', error.message)
			console.log('  Code:', error.code)
			console.log('  Status Code:', error.statusCode)
		}
	}

	// Demonstrate token refresh failure handling
	const refreshConfig: AuthenticationConfig = {
		type: 'session',
		sessionToken: 'token-to-refresh',
		autoRefresh: true,
		refreshEndpoint: 'https://invalid-endpoint.example.com/refresh',
	}

	const refreshAuthManager = new AuthManager(refreshConfig)

	// Set expired token to trigger refresh
	refreshAuthManager.setTokenCache('token-to-refresh', 'session', -3600)

	try {
		await refreshAuthManager.getAuthHeaders()
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.log('Token refresh failed:')
			console.log('  Message:', error.message)
			console.log('  Code:', error.code)
		}
	}
}

// Example 9: Manual Token Refresh
async function manualTokenRefreshExample() {
	console.log('=== Manual Token Refresh Example ===')

	const config: AuthenticationConfig = {
		type: 'session',
		sessionToken: 'token-to-refresh',
		autoRefresh: true,
		refreshEndpoint: 'https://api.example.com/auth/refresh',
	}

	const authManager = new AuthManager(config)

	try {
		// Manually trigger token refresh
		const refreshResult = await authManager.refreshToken('token-to-refresh', 'session')

		if (refreshResult.success) {
			console.log('Token refreshed successfully:')
			console.log('  New token:', refreshResult.token)
			console.log('  Expires in:', refreshResult.expiresIn, 'seconds')
		} else {
			console.log('Token refresh failed:', refreshResult.error)
		}
	} catch (error) {
		console.error('Manual refresh error:', error)
	}
}

// Example 10: Multiple Authentication Types in One Application
async function multipleAuthTypesExample() {
	console.log('=== Multiple Authentication Types Example ===')

	// API service authentication
	const apiServiceAuth = new AuthManager({
		type: 'apiKey',
		apiKey: 'service-api-key',
		autoRefresh: false,
	})

	// User session authentication
	const userSessionAuth = new AuthManager({
		type: 'session',
		sessionToken: 'user-session-token',
		autoRefresh: true,
		refreshEndpoint: 'https://api.example.com/auth/refresh',
	})

	// Admin bearer token authentication
	const adminAuth = new AuthManager({
		type: 'bearer',
		bearerToken: 'admin-bearer-token',
		autoRefresh: false,
	})

	try {
		const apiHeaders = await apiServiceAuth.getAuthHeaders()
		const userHeaders = await userSessionAuth.getAuthHeaders()
		const adminHeaders = await adminAuth.getAuthHeaders()

		console.log('API Service Headers:', apiHeaders)
		console.log('User Session Headers:', userHeaders)
		console.log('Admin Headers:', adminHeaders)
	} catch (error) {
		console.error('Multi-auth error:', error)
	}
}

// Run all examples
async function runAllAuthExamples() {
	console.log('🔐 Running Authentication Manager Examples\n')

	await apiKeyAuthExample()
	console.log()

	await bearerTokenExample()
	console.log()

	await customAuthExample()
	console.log()

	await tokenCachingExample()
	console.log()

	await configValidationExample()
	console.log()

	await dynamicConfigExample()
	console.log()

	await errorHandlingExample()
	console.log()

	await multipleAuthTypesExample()
	console.log()

	console.log('✅ All authentication examples completed!')
}

// Export individual examples for selective usage
export {
	apiKeyAuthExample,
	sessionTokenWithRefreshExample,
	bearerTokenExample,
	customAuthExample,
	tokenCachingExample,
	configValidationExample,
	dynamicConfigExample,
	errorHandlingExample,
	manualTokenRefreshExample,
	multipleAuthTypesExample,
}
