import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'

import { AuthenticationError, AuthManager } from '../../infrastructure/auth'

import type { AuthenticationConfig } from '../../core/config'

// Mock fetch globally
const mockFetch = vi.fn() as Mock
global.fetch = mockFetch

describe('AuthManager', () => {
	let authManager: AuthManager
	let mockConfig: AuthenticationConfig

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('API Key Authentication', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'apiKey',
				apiKey: 'test-api-key-123',
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should return API key headers for apiKey authentication', async () => {
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				'X-API-Key': 'test-api-key-123',
			})
		})

		it('should throw error when API key is missing', async () => {
			const configWithoutKey = { ...mockConfig, apiKey: undefined }
			authManager = new AuthManager(configWithoutKey)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('API key is required')
		})

		it('should validate API key configuration correctly', () => {
			const validation = authManager.validateConfig()
			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})

		it('should fail validation when API key is missing', () => {
			const configWithoutKey = { ...mockConfig, apiKey: undefined }
			authManager = new AuthManager(configWithoutKey)

			const validation = authManager.validateConfig()
			expect(validation.isValid).toBe(false)
			expect(validation.errors).toContain('API key is required for apiKey authentication')
		})
	})

	describe('Session Token Authentication', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'session',
				sessionToken: 'test-session-token-123',
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should return bearer headers for session authentication', async () => {
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Authorization: 'Bearer test-session-token-123',
			})
		})

		it('should throw error when session token is missing', async () => {
			const configWithoutToken = { ...mockConfig, sessionToken: undefined }
			authManager = new AuthManager(configWithoutToken)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Session token is required')
		})

		it('should handle token expiration without auto refresh', async () => {
			const configWithExpiredToken = { ...mockConfig, sessionToken: 'expired-token' }
			authManager = new AuthManager(configWithExpiredToken)

			// Set a token in cache that's expired
			authManager.setTokenCache('expired-token', 'session', -3600) // Expired 1 hour ago

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Session token has expired')
		})

		it('should refresh expired token when auto refresh is enabled', async () => {
			const configWithRefresh = {
				...mockConfig,
				autoRefresh: true,
				refreshEndpoint: 'https://api.example.com/auth/refresh',
			}
			authManager = new AuthManager(configWithRefresh)

			// Set expired token in cache
			authManager.setTokenCache('expired-token', 'session', -3600)

			// Mock successful refresh response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					token: 'new-refreshed-token',
					expiresIn: 3600,
				}),
			})

			const configWithExpiredToken = { ...configWithRefresh, sessionToken: 'expired-token' }
			authManager.updateConfig(configWithExpiredToken)

			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Authorization: 'Bearer new-refreshed-token',
			})

			expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/auth/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer expired-token',
				},
				body: JSON.stringify({
					tokenType: 'session',
					token: 'expired-token',
				}),
			})
		})

		it('should handle refresh failure gracefully', async () => {
			const configWithRefresh = {
				...mockConfig,
				autoRefresh: true,
				refreshEndpoint: 'https://api.example.com/auth/refresh',
			}
			authManager = new AuthManager(configWithRefresh)

			// Set expired token in cache
			authManager.setTokenCache('expired-token', 'session', -3600)

			// Mock failed refresh response
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			})

			const configWithExpiredToken = { ...configWithRefresh, sessionToken: 'expired-token' }
			authManager.updateConfig(configWithExpiredToken)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Token refresh failed')
		})
	})

	describe('Bearer Token Authentication', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'bearer',
				bearerToken: 'test-bearer-token-123',
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should return bearer headers for bearer authentication', async () => {
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Authorization: 'Bearer test-bearer-token-123',
			})
		})

		it('should throw error when bearer token is missing', async () => {
			const configWithoutToken = { ...mockConfig, bearerToken: undefined }
			authManager = new AuthManager(configWithoutToken)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Bearer token is required')
		})

		it('should handle bearer token refresh', async () => {
			const configWithRefresh = {
				...mockConfig,
				autoRefresh: true,
				refreshEndpoint: 'https://api.example.com/auth/refresh',
			}
			authManager = new AuthManager(configWithRefresh)

			// Set expired token in cache
			authManager.setTokenCache('expired-bearer', 'bearer', -3600)

			// Mock successful refresh response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					token: 'new-bearer-token',
					expiresIn: 7200,
				}),
			})

			const configWithExpiredToken = { ...configWithRefresh, bearerToken: 'expired-bearer' }
			authManager.updateConfig(configWithExpiredToken)

			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Authorization: 'Bearer new-bearer-token',
			})
		})
	})

	describe('Custom Authentication', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'custom',
				customHeaders: {
					'X-Custom-Auth': 'custom-value',
					'X-Client-ID': 'client-123',
				},
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should return custom headers for custom authentication', async () => {
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				'X-Custom-Auth': 'custom-value',
				'X-Client-ID': 'client-123',
			})
		})

		it('should throw error when custom headers are missing', async () => {
			const configWithoutHeaders = { ...mockConfig, customHeaders: undefined }
			authManager = new AuthManager(configWithoutHeaders)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Custom headers are required')
		})

		it('should validate custom headers configuration', () => {
			const validation = authManager.validateConfig()
			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})
	})

	describe('Token Caching and Expiration', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'session',
				sessionToken: 'test-token',
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should cache tokens with expiration', () => {
			authManager.setTokenCache('test-token', 'session', 3600)

			const stats = authManager.getCacheStats()
			expect(stats.totalTokens).toBe(1)
			expect(stats.expiredTokens).toBe(0)
		})

		it('should detect expired tokens', () => {
			authManager.setTokenCache('expired-token', 'session', -3600)

			const stats = authManager.getCacheStats()
			expect(stats.totalTokens).toBe(1)
			expect(stats.expiredTokens).toBe(1)
		})

		it('should clean up expired tokens', () => {
			authManager.setTokenCache('valid-token', 'session', 3600)
			authManager.setTokenCache('expired-token-1', 'session', -3600)
			authManager.setTokenCache('expired-token-2', 'bearer', -1800)

			const cleanedCount = authManager.cleanupExpiredTokens()
			expect(cleanedCount).toBe(2)

			const stats = authManager.getCacheStats()
			expect(stats.totalTokens).toBe(1)
			expect(stats.expiredTokens).toBe(0)
		})

		it('should clear specific token from cache', () => {
			authManager.setTokenCache('token-1', 'session', 3600)
			authManager.setTokenCache('token-2', 'bearer', 3600)

			authManager.clearTokenCache('token-1', 'session')

			const stats = authManager.getCacheStats()
			expect(stats.totalTokens).toBe(1)
		})

		it('should clear all tokens from cache', () => {
			authManager.setTokenCache('token-1', 'session', 3600)
			authManager.setTokenCache('token-2', 'bearer', 3600)

			authManager.clearAllTokenCache()

			const stats = authManager.getCacheStats()
			expect(stats.totalTokens).toBe(0)
		})
	})

	describe('Token Refresh Mechanism', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'session',
				sessionToken: 'test-token',
				autoRefresh: true,
				refreshEndpoint: 'https://api.example.com/auth/refresh',
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should refresh token successfully', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					token: 'new-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				}),
			})

			const result = await authManager.refreshToken('old-token', 'session')

			expect(result.success).toBe(true)
			expect(result.token).toBe('new-token')
			expect(result.refreshToken).toBe('new-refresh-token')
			expect(result.expiresIn).toBe(3600)
		})

		it('should handle refresh network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'))

			const result = await authManager.refreshToken('old-token', 'session')

			expect(result.success).toBe(false)
			expect(result.error).toBe('Network error')
		})

		it('should handle refresh HTTP errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
			})

			const result = await authManager.refreshToken('old-token', 'session')

			expect(result.success).toBe(false)
			expect(result.error).toBe('HTTP 401: Unauthorized')
		})

		it('should handle missing token in refresh response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			})

			const result = await authManager.refreshToken('old-token', 'session')

			expect(result.success).toBe(false)
			expect(result.error).toBe('No token returned from refresh endpoint')
		})

		it('should prevent concurrent refresh requests for same token', async () => {
			let resolveCount = 0
			mockFetch.mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							resolveCount++
							resolve({
								ok: true,
								json: async () => ({
									token: `new-token-${resolveCount}`,
									expiresIn: 3600,
								}),
							})
						}, 100)
					})
			)

			// Start two concurrent refresh requests
			const promise1 = authManager.refreshToken('same-token', 'session')
			const promise2 = authManager.refreshToken('same-token', 'session')

			vi.advanceTimersByTime(150)

			const [result1, result2] = await Promise.all([promise1, promise2])

			// Both should get the same result (only one actual request made)
			expect(result1.token).toBe(result2.token)
			expect(resolveCount).toBe(1)
		})

		it('should fail refresh when not configured', async () => {
			const configWithoutRefresh = {
				...mockConfig,
				autoRefresh: false,
				refreshEndpoint: undefined,
			}
			authManager = new AuthManager(configWithoutRefresh)

			const result = await authManager.refreshToken('token', 'session')

			expect(result.success).toBe(false)
			expect(result.error).toBe('Token refresh is not configured')
		})
	})

	describe('Configuration Management', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'apiKey',
				apiKey: 'test-key',
				autoRefresh: false,
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should get current configuration', () => {
			const config = authManager.getConfig()

			expect(config).toEqual(mockConfig)
			expect(config).not.toBe(mockConfig) // Should be a copy
		})

		it('should update configuration', () => {
			authManager.updateConfig({
				type: 'bearer',
				bearerToken: 'new-bearer-token',
			})

			const config = authManager.getConfig()
			expect(config.type).toBe('bearer')
			expect(config.bearerToken).toBe('new-bearer-token')
		})

		it('should clear cache when authentication type changes', () => {
			authManager.setTokenCache('test-token', 'session', 3600)

			const statsBefore = authManager.getCacheStats()
			expect(statsBefore.totalTokens).toBe(1)

			authManager.updateConfig({ type: 'bearer' })

			const statsAfter = authManager.getCacheStats()
			expect(statsAfter.totalTokens).toBe(0)
		})

		it('should validate refresh configuration', () => {
			authManager.updateConfig({
				autoRefresh: true,
				refreshEndpoint: undefined,
			})

			const validation = authManager.validateConfig()
			expect(validation.isValid).toBe(false)
			expect(validation.errors).toContain(
				'Refresh endpoint is required when auto refresh is enabled'
			)
		})
	})

	describe('Error Handling', () => {
		it('should throw AuthenticationError for unsupported auth type', async () => {
			const invalidConfig = {
				type: 'invalid' as any,
				autoRefresh: false,
			}
			authManager = new AuthManager(invalidConfig)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow('Unsupported authentication type')
		})

		it('should wrap unknown errors in AuthenticationError', async () => {
			// Create a mock that will throw an unexpected error
			const originalGetCustomHeaders = AuthManager.prototype['getCustomHeaders']
			AuthManager.prototype['getCustomHeaders'] = vi.fn().mockImplementation(() => {
				throw new Error('Unexpected error')
			})

			const configWithError = {
				type: 'custom' as const,
				customHeaders: { 'X-Test': 'test' },
				autoRefresh: false,
			}
			authManager = new AuthManager(configWithError)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(AuthenticationError)
			await expect(authManager.getAuthHeaders()).rejects.toThrow(
				'Failed to get authentication headers'
			)

			// Restore original method
			AuthManager.prototype['getCustomHeaders'] = originalGetCustomHeaders
		})

		it('should include error codes in AuthenticationError', async () => {
			const configWithoutKey = {
				type: 'apiKey' as const,
				autoRefresh: false,
			}
			authManager = new AuthManager(configWithoutKey)

			try {
				await authManager.getAuthHeaders()
			} catch (error) {
				expect(error).toBeInstanceOf(AuthenticationError)
				expect((error as AuthenticationError).code).toBe('MISSING_API_KEY')
			}
		})
	})

	describe('Cache Statistics and Monitoring', () => {
		beforeEach(() => {
			mockConfig = {
				type: 'session',
				sessionToken: 'test-token',
				autoRefresh: true,
				refreshEndpoint: 'https://api.example.com/auth/refresh',
			}
			authManager = new AuthManager(mockConfig)
		})

		it('should provide accurate cache statistics', () => {
			authManager.setTokenCache('token-1', 'session', 3600)
			authManager.setTokenCache('token-2', 'bearer', -1800) // Expired
			authManager.setTokenCache('token-3', 'session', 7200)

			const stats = authManager.getCacheStats()

			expect(stats.totalTokens).toBe(3)
			expect(stats.expiredTokens).toBe(1)
			expect(stats.activeRefreshes).toBe(0)
		})

		it('should track active refresh operations', async () => {
			// Mock a slow refresh response
			mockFetch.mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => {
							resolve({
								ok: true,
								json: async () => ({
									token: 'new-token',
									expiresIn: 3600,
								}),
							})
						}, 1000)
					})
			)

			// Start refresh but don't await
			const refreshPromise = authManager.refreshToken('token', 'session')

			// Check stats while refresh is in progress
			const stats = authManager.getCacheStats()
			expect(stats.activeRefreshes).toBe(1)

			// Complete the refresh
			vi.advanceTimersByTime(1100)
			await refreshPromise

			// Check stats after refresh completes
			const finalStats = authManager.getCacheStats()
			expect(finalStats.activeRefreshes).toBe(0)
		})
	})
})
