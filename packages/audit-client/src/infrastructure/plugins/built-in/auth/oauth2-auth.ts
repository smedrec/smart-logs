// ============================================================================
// OAuth2 Authentication Plugin
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type { AuthContext, AuthPlugin, PluginContext } from '../../../plugins'

export interface OAuth2AuthConfig {
	clientId: string
	clientSecret: string
	tokenEndpoint: string
	scope?: string
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
			isValid: errors.length === 0,
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
