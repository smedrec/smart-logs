import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticationError, AuthManager } from '../../infrastructure/auth'

import type { AuthenticationConfig } from '../../core/config'

// Mock document.cookie for browser environment tests
const mockDocumentCookie = vi.fn()
Object.defineProperty(global, 'document', {
	value: {
		get cookie() {
			return mockDocumentCookie()
		},
	},
	writable: true,
})

describe('AuthManager - Cookie Authentication', () => {
	let authManager: AuthManager

	beforeEach(() => {
		vi.clearAllMocks()
		mockDocumentCookie.mockReturnValue('')
	})

	describe('Cookie Authentication Type', () => {
		it('should handle explicit cookies', async () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					'session-token': 'abc123',
					'csrf-token': 'xyz789',
				},
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Cookie: 'session-token=abc123; csrf-token=xyz789',
			})
		})

		it('should handle browser cookies when enabled', async () => {
			mockDocumentCookie.mockReturnValue('session=value1; auth=value2; other=value3')

			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Cookie: 'session=value1; auth=value2; other=value3',
			})
		})

		it('should combine explicit cookies with browser cookies', async () => {
			mockDocumentCookie.mockReturnValue('browser-cookie=browser-value')

			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					'explicit-cookie': 'explicit-value',
				},
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers.Cookie).toContain('explicit-cookie=explicit-value')
			expect(headers.Cookie).toContain('browser-cookie=browser-value')
		})

		it('should throw error when no cookies are available', async () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: false,
			}

			authManager = new AuthManager(config)

			await expect(authManager.getAuthHeaders()).rejects.toThrow(
				new AuthenticationError(
					'No cookies available for cookie authentication type',
					'MISSING_COOKIES'
				)
			)
		})

		it('should handle empty browser cookies gracefully', async () => {
			mockDocumentCookie.mockReturnValue('')

			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					session: 'test-session',
				},
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Cookie: 'session=test-session',
			})
		})

		it('should handle malformed browser cookies', async () => {
			mockDocumentCookie.mockReturnValue('valid=cookie; ; invalid; another=valid')

			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			// Should include all non-empty cookies (including malformed ones)
			expect(headers.Cookie).toBe('valid=cookie; invalid; another=valid')
		})

		it('should work with explicit cookies only', async () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					'server-cookie': 'server-value',
				},
				includeBrowserCookies: false, // Explicitly disable browser cookies
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Cookie: 'server-cookie=server-value',
			})
		})
	})

	describe('Cookie Authentication Validation', () => {
		it('should validate cookie configuration correctly', () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					session: 'test',
				},
			}

			authManager = new AuthManager(config)
			const validation = authManager.validateConfig()

			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})

		it('should validate browser cookie configuration correctly', () => {
			mockDocumentCookie.mockReturnValue('some=cookie')

			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const validation = authManager.validateConfig()

			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})

		it('should fail validation when no cookies are configured', () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: false, // Disabled
				// No explicit cookies either
			}

			authManager = new AuthManager(config)
			const validation = authManager.validateConfig()

			expect(validation.isValid).toBe(false)
			expect(validation.errors).toContain(
				'Either explicit cookies or browser cookies must be available for cookie authentication'
			)
		})

		it('should fail validation when cookies object is empty', () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {},
				includeBrowserCookies: false,
			}

			authManager = new AuthManager(config)
			const validation = authManager.validateConfig()

			expect(validation.isValid).toBe(false)
			expect(validation.errors).toContain(
				'Either explicit cookies or browser cookies must be available for cookie authentication'
			)
		})
	})

	describe('Better Auth Integration', () => {
		it('should handle typical Better Auth cookies', async () => {
			const config: AuthenticationConfig = {
				type: 'cookie',
				cookies: {
					'better-auth.session_token': 'session-abc123',
					'better-auth.csrf_token': 'csrf-xyz789',
				},
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers).toEqual({
				Cookie: 'better-auth.session_token=session-abc123; better-auth.csrf_token=csrf-xyz789',
			})
		})

		it('should work with browser cookies containing Better Auth tokens', async () => {
			mockDocumentCookie.mockReturnValue(
				'better-auth.session_token=browser-session; better-auth.csrf_token=browser-csrf; other=value'
			)

			const config: AuthenticationConfig = {
				type: 'cookie',
				includeBrowserCookies: true,
			}

			authManager = new AuthManager(config)
			const headers = await authManager.getAuthHeaders()

			expect(headers.Cookie).toContain('better-auth.session_token=browser-session')
			expect(headers.Cookie).toContain('better-auth.csrf_token=browser-csrf')
			expect(headers.Cookie).toContain('other=value')
		})
	})
})
