import type { AuthenticationConfig } from '../core/config'

/**
 * Token cache entry interface
 */
interface TokenCacheEntry {
	token: string
	expiresAt: number
	refreshToken?: string | undefined
}

/**
 * Authentication error class
 */
export class AuthenticationError extends Error {
	public readonly code: string
	public readonly statusCode?: number | undefined

	constructor(message: string, code: string = 'AUTH_ERROR', statusCode?: number | undefined) {
		super(message)
		this.name = 'AuthenticationError'
		this.code = code
		this.statusCode = statusCode
	}
}

/**
 * Token refresh result interface
 */
interface TokenRefreshResult {
	success: boolean
	token?: string | undefined
	refreshToken?: string | undefined
	expiresIn?: number | undefined
	error?: string | undefined
}

/**
 * Enhanced authentication manager with multiple authentication types,
 * automatic token refresh, and token caching with expiration handling
 */
export class AuthManager {
	private config: AuthenticationConfig
	private tokenCache: Map<string, TokenCacheEntry> = new Map()
	private refreshPromises: Map<string, Promise<TokenRefreshResult>> = new Map()

	constructor(config: AuthenticationConfig) {
		this.config = config
	}

	/**
	 * Gets authentication headers based on the configured authentication type
	 * Handles token expiration and automatic refresh if configured
	 */
	async getAuthHeaders(): Promise<Record<string, string>> {
		const headers: Record<string, string> = {}

		try {
			switch (this.config.type) {
				case 'apiKey':
					return this.getApiKeyHeaders()

				case 'session':
					return await this.getSessionHeaders()

				case 'bearer':
					return await this.getBearerHeaders()

				case 'custom':
					return this.getCustomHeaders()

				default:
					throw new AuthenticationError(
						`Unsupported authentication type: ${this.config.type}`,
						'UNSUPPORTED_AUTH_TYPE'
					)
			}
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error
			}
			throw new AuthenticationError(
				`Failed to get authentication headers: ${error instanceof Error ? error.message : 'Unknown error'}`,
				'AUTH_HEADER_ERROR'
			)
		}
	}

	/**
	 * Gets API key authentication headers
	 */
	private getApiKeyHeaders(): Record<string, string> {
		if (!this.config.apiKey) {
			throw new AuthenticationError(
				'API key is required for apiKey authentication type',
				'MISSING_API_KEY'
			)
		}

		return {
			'X-API-Key': this.config.apiKey,
		}
	}

	/**
	 * Gets session-based authentication headers
	 * Handles token expiration and refresh if configured
	 */
	private async getSessionHeaders(): Promise<Record<string, string>> {
		if (!this.config.sessionToken) {
			throw new AuthenticationError(
				'Session token is required for session authentication type',
				'MISSING_SESSION_TOKEN'
			)
		}

		let token = this.config.sessionToken

		// Check if token is cached and handle expiration
		const cacheKey = `session:${token}`
		const cached = this.tokenCache.get(cacheKey)

		if (cached) {
			if (this.isTokenExpired(cached)) {
				if (this.config.autoRefresh) {
					const refreshResult = await this.refreshToken(token, 'session')
					if (refreshResult.success && refreshResult.token) {
						token = refreshResult.token
						this.updateTokenCache(cacheKey, token, refreshResult.expiresIn)
					} else {
						throw new AuthenticationError(
							`Token refresh failed: ${refreshResult.error || 'Unknown error'}`,
							'TOKEN_REFRESH_FAILED'
						)
					}
				} else {
					throw new AuthenticationError('Session token has expired', 'TOKEN_EXPIRED')
				}
			} else {
				token = cached.token
			}
		}

		return {
			Authorization: `Bearer ${token}`,
		}
	}

	/**
	 * Gets bearer token authentication headers
	 * Handles token expiration and refresh if configured
	 */
	private async getBearerHeaders(): Promise<Record<string, string>> {
		if (!this.config.bearerToken) {
			throw new AuthenticationError(
				'Bearer token is required for bearer authentication type',
				'MISSING_BEARER_TOKEN'
			)
		}

		let token = this.config.bearerToken

		// Check if token is cached and handle expiration
		const cacheKey = `bearer:${token}`
		const cached = this.tokenCache.get(cacheKey)

		if (cached) {
			if (this.isTokenExpired(cached)) {
				if (this.config.autoRefresh) {
					const refreshResult = await this.refreshToken(token, 'bearer')
					if (refreshResult.success && refreshResult.token) {
						token = refreshResult.token
						this.updateTokenCache(cacheKey, token, refreshResult.expiresIn)
					} else {
						throw new AuthenticationError(
							`Token refresh failed: ${refreshResult.error || 'Unknown error'}`,
							'TOKEN_REFRESH_FAILED'
						)
					}
				} else {
					throw new AuthenticationError('Bearer token has expired', 'TOKEN_EXPIRED')
				}
			} else {
				token = cached.token
			}
		}

		return {
			Authorization: `Bearer ${token}`,
		}
	}

	/**
	 * Gets custom authentication headers
	 */
	private getCustomHeaders(): Record<string, string> {
		if (!this.config.customHeaders) {
			throw new AuthenticationError(
				'Custom headers are required for custom authentication type',
				'MISSING_CUSTOM_HEADERS'
			)
		}

		return { ...this.config.customHeaders }
	}

	/**
	 * Refreshes an expired token using the configured refresh endpoint
	 */
	async refreshToken(token: string, tokenType: 'session' | 'bearer'): Promise<TokenRefreshResult> {
		if (!this.config.autoRefresh || !this.config.refreshEndpoint) {
			return {
				success: false,
				error: 'Token refresh is not configured',
			}
		}

		const refreshKey = `${tokenType}:${token}`

		// Check if refresh is already in progress for this token
		const existingRefresh = this.refreshPromises.get(refreshKey)
		if (existingRefresh) {
			return existingRefresh
		}

		// Start new refresh process
		const refreshPromise = this.performTokenRefresh(token, tokenType)
		this.refreshPromises.set(refreshKey, refreshPromise)

		try {
			const result = await refreshPromise
			return result
		} finally {
			// Clean up the refresh promise
			this.refreshPromises.delete(refreshKey)
		}
	}

	/**
	 * Performs the actual token refresh request
	 */
	private async performTokenRefresh(
		token: string,
		tokenType: 'session' | 'bearer'
	): Promise<TokenRefreshResult> {
		try {
			const response = await fetch(this.config.refreshEndpoint!, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					tokenType,
					token,
				}),
			})

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				}
			}

			const data = await response.json()

			if (!data.token) {
				return {
					success: false,
					error: 'No token returned from refresh endpoint',
				}
			}

			return {
				success: true,
				token: data.token,
				refreshToken: data.refreshToken,
				expiresIn: data.expiresIn,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown refresh error',
			}
		}
	}

	/**
	 * Checks if a token is expired based on cache entry
	 */
	isTokenExpired(cacheEntry: TokenCacheEntry): boolean {
		return Date.now() >= cacheEntry.expiresAt
	}

	/**
	 * Updates the token cache with a new token and expiration
	 */
	private updateTokenCache(cacheKey: string, token: string, expiresIn?: number): void {
		const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 3600000 // Default 1 hour

		this.tokenCache.set(cacheKey, {
			token,
			expiresAt,
		})
	}

	/**
	 * Manually sets a token in the cache with expiration
	 */
	setTokenCache(token: string, tokenType: 'session' | 'bearer', expiresIn?: number): void {
		const cacheKey = `${tokenType}:${token}`
		this.updateTokenCache(cacheKey, token, expiresIn)
	}

	/**
	 * Clears a specific token from the cache
	 */
	clearTokenCache(token: string, tokenType: 'session' | 'bearer'): void {
		const cacheKey = `${tokenType}:${token}`
		this.tokenCache.delete(cacheKey)
	}

	/**
	 * Clears all tokens from the cache
	 */
	clearAllTokenCache(): void {
		this.tokenCache.clear()
		this.refreshPromises.clear()
	}

	/**
	 * Gets the current authentication configuration
	 */
	getConfig(): AuthenticationConfig {
		return { ...this.config }
	}

	/**
	 * Updates the authentication configuration
	 */
	updateConfig(newConfig: Partial<AuthenticationConfig>): void {
		const oldType = this.config.type
		this.config = { ...this.config, ...newConfig }

		// Clear cache if authentication type changed
		if (newConfig.type && newConfig.type !== oldType) {
			this.clearAllTokenCache()
		}
	}

	/**
	 * Validates the current authentication configuration
	 */
	validateConfig(): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		switch (this.config.type) {
			case 'apiKey':
				if (!this.config.apiKey) {
					errors.push('API key is required for apiKey authentication')
				}
				break

			case 'session':
				if (!this.config.sessionToken) {
					errors.push('Session token is required for session authentication')
				}
				break

			case 'bearer':
				if (!this.config.bearerToken) {
					errors.push('Bearer token is required for bearer authentication')
				}
				break

			case 'custom':
				if (!this.config.customHeaders || Object.keys(this.config.customHeaders).length === 0) {
					errors.push('Custom headers are required for custom authentication')
				}
				break

			default:
				errors.push(`Unsupported authentication type: ${this.config.type}`)
		}

		// Validate refresh configuration
		if (this.config.autoRefresh && !this.config.refreshEndpoint) {
			errors.push('Refresh endpoint is required when auto refresh is enabled')
		}

		return {
			isValid: errors.length === 0,
			errors,
		}
	}

	/**
	 * Gets cache statistics for monitoring
	 */
	getCacheStats(): {
		totalTokens: number
		expiredTokens: number
		activeRefreshes: number
	} {
		let expiredTokens = 0
		const now = Date.now()

		Array.from(this.tokenCache.values()).forEach((entry) => {
			if (now >= entry.expiresAt) {
				expiredTokens++
			}
		})

		return {
			totalTokens: this.tokenCache.size,
			expiredTokens,
			activeRefreshes: this.refreshPromises.size,
		}
	}

	/**
	 * Cleans up expired tokens from the cache
	 */
	cleanupExpiredTokens(): number {
		const now = Date.now()
		let cleanedCount = 0

		Array.from(this.tokenCache.entries()).forEach(([key, entry]) => {
			if (now >= entry.expiresAt) {
				this.tokenCache.delete(key)
				cleanedCount++
			}
		})

		return cleanedCount
	}
}
