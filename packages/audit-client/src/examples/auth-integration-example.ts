/**
 * Example showing how AuthManager integrates with HTTP requests
 * This demonstrates the pattern that will be used in BaseResource (task 8)
 */

import { AuthManager } from '../infrastructure/auth'

import type { AuthenticationConfig } from '../core/config'

/**
 * Example HTTP client that uses AuthManager for authentication
 * This shows the integration pattern that will be implemented in BaseResource
 */
class ExampleHttpClient {
	private authManager: AuthManager

	constructor(authConfig: AuthenticationConfig) {
		this.authManager = new AuthManager(authConfig)
	}

	/**
	 * Example method showing how to use AuthManager in HTTP requests
	 */
	async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
		try {
			// Get authentication headers from AuthManager
			const authHeaders = await this.authManager.getAuthHeaders()

			// Merge with existing headers
			const headers = {
				'Content-Type': 'application/json',
				'User-Agent': 'audit-client/0.1.0',
				...options.headers,
				...authHeaders, // Auth headers take precedence
			}

			// Make the request with authentication
			const response = await fetch(url, {
				...options,
				headers,
				credentials: 'include', // Important for session-based auth
			})

			return response
		} catch (error) {
			console.error('Authenticated request failed:', error)
			throw error
		}
	}

	/**
	 * Example method showing how to handle authentication errors
	 */
	async makeRequestWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
		try {
			return await this.makeAuthenticatedRequest(url, options)
		} catch (error) {
			// If authentication fails, we could implement retry logic here
			// For example, clearing token cache and retrying
			if (error instanceof Error && error.message.includes('401')) {
				console.log('Authentication failed, clearing token cache and retrying...')
				this.authManager.clearAllTokenCache()

				// Retry once with fresh authentication
				return await this.makeAuthenticatedRequest(url, options)
			}
			throw error
		}
	}

	/**
	 * Get the underlying AuthManager for advanced operations
	 */
	getAuthManager(): AuthManager {
		return this.authManager
	}

	/**
	 * Update authentication configuration
	 */
	updateAuthConfig(newConfig: Partial<AuthenticationConfig>): void {
		this.authManager.updateConfig(newConfig)
	}
}

// Usage examples
export async function demonstrateAuthIntegration() {
	console.log('=== AuthManager Integration Example ===')

	// Example 1: API Key authentication
	const apiKeyClient = new ExampleHttpClient({
		type: 'apiKey',
		apiKey: 'your-api-key',
		autoRefresh: false,
	})

	try {
		const response = await apiKeyClient.makeAuthenticatedRequest(
			'https://api.example.com/audit/events'
		)
		console.log('API Key request status:', response.status)
	} catch (error) {
		console.error('API Key request failed:', error)
	}

	// Example 2: Session token with auto-refresh
	const sessionClient = new ExampleHttpClient({
		type: 'session',
		sessionToken: 'your-session-token',
		autoRefresh: true,
		refreshEndpoint: 'https://api.example.com/auth/refresh',
	})

	try {
		const response = await sessionClient.makeAuthenticatedRequest(
			'https://api.example.com/audit/events',
			{
				method: 'POST',
				body: JSON.stringify({
					action: 'user.login',
					principalId: 'user123',
					organizationId: 'org456',
				}),
			}
		)
		console.log('Session request status:', response.status)
	} catch (error) {
		console.error('Session request failed:', error)
	}

	// Example 3: Dynamic authentication switching
	const dynamicClient = new ExampleHttpClient({
		type: 'apiKey',
		apiKey: 'initial-key',
		autoRefresh: false,
	})

	// Make initial request with API key
	try {
		await dynamicClient.makeAuthenticatedRequest('https://api.example.com/health')
		console.log('Initial API key request successful')
	} catch (error) {
		console.error('Initial request failed:', error)
	}

	// Switch to bearer token authentication
	dynamicClient.updateAuthConfig({
		type: 'bearer',
		bearerToken: 'new-bearer-token',
	})

	// Make request with new authentication
	try {
		await dynamicClient.makeAuthenticatedRequest('https://api.example.com/audit/events')
		console.log('Bearer token request successful')
	} catch (error) {
		console.error('Bearer token request failed:', error)
	}

	// Example 4: Monitoring authentication cache
	const authManager = dynamicClient.getAuthManager()
	const cacheStats = authManager.getCacheStats()
	console.log('Authentication cache stats:', cacheStats)

	// Clean up expired tokens
	const cleanedCount = authManager.cleanupExpiredTokens()
	console.log('Cleaned expired tokens:', cleanedCount)
}

// Export the example client for use in other examples
export { ExampleHttpClient }
