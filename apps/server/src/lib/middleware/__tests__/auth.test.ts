/**
 * Authentication Middleware Tests
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	requireApiKey,
	requireAuth,
	requireAuthOrApiKey,
	requireOrganizationAccess,
	requireRole,
} from '../auth'

import type { Session } from '@repo/auth'
import type { HonoEnv } from '../../hono/context'

// Mock services
const mockServices = {
	error: {
		handleError: vi.fn(),
	},
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
	db: {
		auth: {
			query: {
				apiKey: {
					findFirst: vi.fn(),
				},
			},
		},
	},
}

// Mock session
const mockSession: Session = {
	session: {
		id: 'session-123',
		token: 'token-123',
		userId: 'user-123',
		expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
		createdAt: new Date(),
		updatedAt: new Date(),
		ipAddress: '127.0.0.1',
		userAgent: 'test-agent',
		activeOrganizationId: 'org-123',
		activeOrganizationRole: 'admin',
	},
	user: {
		id: 'user-123',
		name: 'Test User',
		email: 'test@example.com',
		emailVerified: true,
		createdAt: new Date(),
		updatedAt: new Date(),
		role: 'user',
		banned: false,
	},
}

describe('Authentication Middleware', () => {
	let app: Hono<HonoEnv>

	beforeEach(() => {
		app = new Hono<HonoEnv>()
		vi.clearAllMocks()
	})

	describe('requireAuth', () => {
		it('should pass when session exists and is valid', async () => {
			app.use('*', (c, next) => {
				c.set('session', mockSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuth)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(200)
		})

		it('should throw 401 when no session exists', async () => {
			app.use('*', (c, next) => {
				c.set('session', null)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuth)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(401)
		})

		it('should throw 401 when session is expired', async () => {
			const expiredSession = {
				...mockSession,
				session: {
					...mockSession.session,
					expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
				},
			}

			app.use('*', (c, next) => {
				c.set('session', expiredSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuth)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(401)
		})

		it('should throw 403 when user is banned', async () => {
			const bannedSession = {
				...mockSession,
				user: {
					...mockSession.user,
					banned: true,
					banReason: 'Test ban',
				},
			}

			app.use('*', (c, next) => {
				c.set('session', bannedSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuth)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(403)
		})
	})

	describe('requireRole', () => {
		it('should pass when user has required role', async () => {
			app.use('*', (c, next) => {
				c.set('session', mockSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireRole(['user', 'admin']))
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(200)
		})

		it('should throw 403 when user does not have required role', async () => {
			app.use('*', (c, next) => {
				c.set('session', mockSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireRole(['admin']))
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(403)
		})
	})

	describe('requireOrganizationAccess', () => {
		it('should pass when user has active organization', async () => {
			app.use('*', (c, next) => {
				c.set('session', mockSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireOrganizationAccess())
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(200)
		})

		it('should throw 403 when user has no active organization', async () => {
			const sessionWithoutOrg = {
				...mockSession,
				session: {
					...mockSession.session,
					activeOrganizationId: null,
				},
			}

			app.use('*', (c, next) => {
				c.set('session', sessionWithoutOrg)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireOrganizationAccess())
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(403)
		})

		it('should pass for super admin even without active organization', async () => {
			const adminSession = {
				...mockSession,
				user: {
					...mockSession.user,
					role: 'admin' as const,
				},
				session: {
					...mockSession.session,
					activeOrganizationId: null,
				},
			}

			app.use('*', (c, next) => {
				c.set('session', adminSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireOrganizationAccess(true))
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(200)
		})
	})

	describe('requireApiKey', () => {
		it('should pass with valid API key', async () => {
			const mockApiKeyRecord = {
				id: 'api-key-123',
				key: 'test-api-key',
				userId: 'user-123',
				expiresAt: new Date(Date.now() + 3600000),
				createdAt: new Date(),
				updatedAt: new Date(),
				user: {
					...mockSession.user,
					organizations: [
						{
							organizationId: 'org-123',
							role: 'admin',
						},
					],
				},
			}

			mockServices.db.auth.query.apiKey.findFirst.mockResolvedValue(mockApiKeyRecord)

			app.use('*', (c, next) => {
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test', {
				headers: {
					'X-API-Key': 'test-api-key',
				},
			})

			expect(res.status).toBe(200)
			expect(mockServices.db.auth.query.apiKey.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function),
				with: {
					user: {
						with: {
							organizations: true,
						},
					},
				},
			})
		})

		it('should throw 401 when no API key provided', async () => {
			app.use('*', (c, next) => {
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(401)
		})

		it('should throw 401 when API key is invalid', async () => {
			mockServices.db.auth.query.apiKey.findFirst.mockResolvedValue(null)

			app.use('*', (c, next) => {
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test', {
				headers: {
					'X-API-Key': 'invalid-api-key',
				},
			})

			expect(res.status).toBe(401)
		})
	})

	describe('requireAuthOrApiKey', () => {
		it('should pass with valid session', async () => {
			app.use('*', (c, next) => {
				c.set('session', mockSession)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuthOrApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(200)
		})

		it('should pass with valid API key', async () => {
			const mockApiKeyRecord = {
				id: 'api-key-123',
				key: 'test-api-key',
				userId: 'user-123',
				expiresAt: new Date(Date.now() + 3600000),
				createdAt: new Date(),
				updatedAt: new Date(),
				user: {
					...mockSession.user,
					organizations: [
						{
							organizationId: 'org-123',
							role: 'admin',
						},
					],
				},
			}

			mockServices.db.auth.query.apiKey.findFirst.mockResolvedValue(mockApiKeyRecord)

			app.use('*', (c, next) => {
				c.set('session', null)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuthOrApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test', {
				headers: {
					'X-API-Key': 'test-api-key',
				},
			})

			expect(res.status).toBe(200)
		})

		it('should throw 401 when neither session nor API key provided', async () => {
			app.use('*', (c, next) => {
				c.set('session', null)
				c.set('services', mockServices as any)
				c.set('requestId', 'req-123')
				return next()
			})
			app.use('*', requireAuthOrApiKey)
			app.get('/test', (c) => c.json({ success: true }))

			const res = await app.request('/test')
			expect(res.status).toBe(401)
		})
	})
})
