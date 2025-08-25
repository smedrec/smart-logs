import { TRPCError } from '@trpc/server'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import type { Context } from 'hono'
import type { Session } from '@repo/auth'
import type { HonoEnv } from '../hono/context.js'

/**
 * Authentication middleware that validates session tokens
 */
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
	const session = c.get('session')
	const { audit, error, logger } = c.get('services')
	const requestId = c.get('requestId')

	if (!session) {
		const err = new HTTPException(401, {
			message: 'Authentication required',
		})

		await error.handleError(
			err,
			{
				requestId,
				metadata: {
					path: c.req.path,
					method: c.req.method,
					userAgent: c.req.header('user-agent'),
				},
			},
			'auth-middleware',
			'requireAuth'
		)

		throw err
	}

	// Validate session is not expired
	if (session.session.expiresAt < new Date()) {
		const err = new HTTPException(401, {
			message: 'Session expired',
		})

		await error.handleError(
			err,
			{
				requestId,
				userId: session.session.userId,
				sessionId: session.session.id,
				metadata: {
					expiresAt: session.session.expiresAt,
					path: c.req.path,
					method: c.req.method,
				},
			},
			'auth-middleware',
			'requireAuth'
		)

		throw err
	}

	// Check if user is banned
	if (session.user.banned) {
		const err = new HTTPException(403, {
			message: session.user.banReason || 'Account is banned',
		})

		await audit.log({
			principalId: session.user.id,
			organizationId: session.session.activeOrganizationId,
			action: `auth.account.banned`,
			status: 'failure',
			outcomeDescription: session.user.banReason || 'Account is banned',
			sessionContext: {
				sessionId: 'sess-abc123',
				ipAddress: session.session.ipAddress,
				userAgent: session.session.userAgent,
				banReason: session.user.banReason,
				banExpires: session.user.banExpires,
			},
			dataClassification: 'INTERNAL',
			retntionPolicy: 'auth-logs-1-year',
			metadata: {
				path: c.req.path,
				method: c.req.method,
			},
		})

		await error.handleError(
			err,
			{
				requestId,
				userId: session.session.userId,
				sessionId: session.session.id,
				metadata: {
					banReason: session.user.banReason,
					banExpires: session.user.banExpires,
					path: c.req.path,
					method: c.req.method,
				},
			},
			'auth-middleware',
			'requireAuth'
		)

		throw err
	}

	await next()
})

/**
 * Role-based access control middleware
 */
export const requireRole = (roles: string[]) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const session = c.get('session')
		const { error } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		const userRole = session.user.role
		if (!roles.includes(userRole)) {
			const err = new HTTPException(403, {
				message: `Access denied. Required roles: ${roles.join(', ')}`,
			})

			await error.handleError(
				err,
				{
					requestId,
					userId: session.session.userId,
					sessionId: session.session.id,
					metadata: {
						userRole,
						requiredRoles: roles,
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requireRole'
			)

			throw err
		}

		await next()
	})

/**
 * Organization-level access control middleware
 */
export const requireOrganizationAccess = (allowSuperAdmin = false) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const session = c.get('session')
		const { error } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		// Allow super admin to access any organization
		if (allowSuperAdmin && session.user.role === 'admin') {
			await next()
			return
		}

		const activeOrganizationId = session.session.activeOrganizationId
		if (!activeOrganizationId) {
			const err = new HTTPException(403, {
				message: 'No active organization. Please select an organization.',
			})

			await error.handleError(
				err,
				{
					requestId,
					userId: session.session.userId,
					sessionId: session.session.id,
					metadata: {
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requireOrganizationAccess'
			)

			throw err
		}

		// Check if organization ID in path matches active organization
		const pathOrgId = c.req.param('organizationId')
		if (pathOrgId && pathOrgId !== activeOrganizationId) {
			const err = new HTTPException(403, {
				message: 'Access denied to this organization',
			})

			await error.handleError(
				err,
				{
					requestId,
					userId: session.session.userId,
					sessionId: session.session.id,
					metadata: {
						activeOrganizationId,
						requestedOrganizationId: pathOrgId,
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requireOrganizationAccess'
			)

			throw err
		}

		await next()
	})

/**
 * Organization role-based access control middleware
 */
export const requireOrganizationRole = (roles: string[]) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const session = c.get('session')
		const { error } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		const organizationRole = session.session.activeOrganizationRole
		if (!organizationRole || !roles.includes(organizationRole)) {
			const err = new HTTPException(403, {
				message: `Access denied. Required organization roles: ${roles.join(', ')}`,
			})

			await error.handleError(
				err,
				{
					requestId,
					userId: session.session.userId,
					sessionId: session.session.id,
					metadata: {
						organizationRole,
						requiredRoles: roles,
						organizationId: session.session.activeOrganizationId,
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requireOrganizationRole'
			)

			throw err
		}

		await next()
	})

/**
 * API key authentication middleware for third-party access
 */
export const requireApiKey = createMiddleware<HonoEnv>(async (c, next) => {
	const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')
	const { db, error } = c.get('services')
	const requestId = c.get('requestId')

	if (!apiKey) {
		throw new HTTPException(401, {
			message: 'API key required',
		})
	}

	try {
		// Query the API key from the auth database
		// Note: This assumes Better Auth's API key plugin stores keys in an 'apiKey' table
		const apiKeyRecord = await db.auth.query.apikey.findFirst({
			where: (apiKeys, { eq, and, gt }) =>
				and(eq(apiKeys.key, apiKey), gt(apiKeys.expiresAt, new Date())),
			with: {
				user: {
					with: {
						organizations: true,
					},
				},
			},
		})

		if (!apiKeyRecord) {
			const err = new HTTPException(401, {
				message: 'Invalid or expired API key',
			})

			await error.handleError(
				err,
				{
					requestId,
					metadata: {
						apiKeyPrefix: apiKey.substring(0, 8) + '...',
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requireApiKey'
			)

			throw err
		}

		// Create a pseudo-session for API key access
		const apiSession: Session = {
			session: {
				id: `api-${apiKeyRecord.id}`,
				token: apiKey,
				userId: apiKeyRecord.userId,
				expiresAt: apiKeyRecord.expiresAt,
				createdAt: apiKeyRecord.createdAt,
				updatedAt: apiKeyRecord.updatedAt,
				ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
				userAgent: c.req.header('user-agent'),
				activeOrganizationId: apiKeyRecord.user.organizations?.[0]?.organizationId || null,
				activeOrganizationRole: apiKeyRecord.user.organizations?.[0]?.role || null,
			},
			user: apiKeyRecord.user,
		}

		// Set the API session in context
		c.set('session', apiSession)
		c.set('isApiKeyAuth', true)

		await next()
	} catch (err) {
		// If it's already an HTTPException, re-throw it
		if (err instanceof HTTPException) {
			throw err
		}

		const error_handler = c.get('services').error

		await error_handler.handleError(
			err as Error,
			{
				requestId,
				metadata: {
					apiKeyPrefix: apiKey.substring(0, 8) + '...',
					path: c.req.path,
					method: c.req.method,
				},
			},
			'auth-middleware',
			'requireApiKey'
		)

		throw new HTTPException(500, {
			message: 'Internal server error during API key validation',
		})
	}
})

/**
 * Combined authentication middleware that supports both session and API key auth
 */
export const requireAuthOrApiKey = createMiddleware<HonoEnv>(async (c, next) => {
	const session = c.get('session')
	const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')

	// If session exists, use session auth
	if (session) {
		return requireAuth(c, next)
	}

	// If API key provided, use API key auth
	if (apiKey) {
		return requireApiKey(c, next)
	}

	// No authentication provided
	throw new HTTPException(401, {
		message: 'Authentication required. Provide either session token or API key.',
	})
})

/**
 * Permission-based access control middleware
 */
export const requirePermission = (resource: string, action: string) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const session = c.get('session')
		const { error } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		// Check if user has permission
		const hasPermission = await checkUserPermission(
			session,
			resource,
			action,
			c.get('services').db.auth
		)

		if (!hasPermission) {
			const err = new HTTPException(403, {
				message: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			await error.handleError(
				err,
				{
					requestId,
					userId: session.session.userId,
					sessionId: session.session.id,
					metadata: {
						resource,
						action,
						userRole: session.user.role,
						organizationRole: session.session.activeOrganizationRole,
						organizationId: session.session.activeOrganizationId,
						path: c.req.path,
						method: c.req.method,
					},
				},
				'auth-middleware',
				'requirePermission'
			)

			throw err
		}

		await next()
	})

/**
 * Helper function to check user permissions
 */
async function checkUserPermission(
	session: Session,
	resource: string,
	action: string,
	db: any
): Promise<boolean> {
	// Super admin has all permissions
	if (session.user.role === 'admin') {
		return true
	}

	// Define permission matrix based on roles and resources
	const permissions = {
		user: {
			'audit.events': ['read', 'create'],
			'audit.reports': ['read'],
			'audit.presets': ['read'],
			'audit.metrics': ['read'],
		},
		admin: {
			'audit.events': ['read', 'create', 'update', 'delete', 'verify'],
			'audit.reports': ['read', 'create', 'update', 'delete'],
			'audit.presets': ['read', 'create', 'update', 'delete'],
			'audit.metrics': ['read'],
			'audit.alerts': ['read', 'acknowledge', 'resolve'],
			'system.health': ['read'],
			'system.metrics': ['read'],
		},
	}

	// Organization-level permissions
	const orgPermissions = {
		owner: {
			'audit.events': ['read', 'create', 'update', 'delete', 'verify'],
			'audit.reports': ['read', 'create', 'update', 'delete'],
			'audit.presets': ['read', 'create', 'update', 'delete'],
			'audit.metrics': ['read'],
			'audit.alerts': ['read', 'acknowledge', 'resolve'],
			'organization.settings': ['read', 'update'],
			'organization.members': ['read', 'invite', 'remove'],
		},
		admin: {
			'audit.events': ['read', 'create', 'update', 'delete', 'verify'],
			'audit.reports': ['read', 'create', 'update', 'delete'],
			'audit.presets': ['read', 'create', 'update', 'delete'],
			'audit.metrics': ['read'],
			'audit.alerts': ['read', 'acknowledge', 'resolve'],
		},
		member: {
			'audit.events': ['read', 'create'],
			'audit.reports': ['read'],
			'audit.presets': ['read'],
			'audit.metrics': ['read'],
		},
	}

	// Check system-level permissions
	const userRole = session.user.role as keyof typeof permissions
	const userPermissions = permissions[userRole]
	if (userPermissions?.[resource]?.includes(action)) {
		return true
	}

	// Check organization-level permissions
	const orgRole = session.session.activeOrganizationRole as keyof typeof orgPermissions
	if (orgRole) {
		const orgUserPermissions = orgPermissions[orgRole]
		if (orgUserPermissions?.[resource]?.includes(action)) {
			return true
		}
	}

	return false
}

/**
 * TRPC-specific authentication middleware
 */
export const createTRPCAuthMiddleware = () => {
	return async ({ ctx, next }: { ctx: any; next: any }) => {
		if (!ctx.session) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
				cause: 'No session',
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					metadata: {
						message: err.message,
						name: err.name,
						code: err.code,
						cause: err.cause,
					},
				},
				'trpc-auth-middleware',
				'requireAuth'
			)

			throw err
		}

		// Validate session is not expired
		if (ctx.session.session.expiresAt < new Date()) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Session expired',
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						expiresAt: ctx.session.session.expiresAt,
					},
				},
				'trpc-auth-middleware',
				'requireAuth'
			)

			throw err
		}

		// Check if user is banned
		if (ctx.session.user.banned) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'FORBIDDEN',
				message: ctx.session.user.banReason || 'Account is banned',
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						banReason: ctx.session.user.banReason,
						banExpires: ctx.session.user.banExpires,
					},
				},
				'trpc-auth-middleware',
				'requireAuth'
			)

			throw err
		}

		return next({
			ctx: {
				...ctx,
				session: ctx.session,
			},
		})
	}
}

/**
 * TRPC role-based access control middleware
 */
export const createTRPCRoleMiddleware = (roles: string[]) => {
	return async ({ ctx, next }: { ctx: any; next: any }) => {
		if (!ctx.session) {
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const userRole = ctx.session.user.role
		if (!roles.includes(userRole)) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'FORBIDDEN',
				message: `Access denied. Required roles: ${roles.join(', ')}`,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						userRole,
						requiredRoles: roles,
					},
				},
				'trpc-role-middleware',
				'requireRole'
			)

			throw err
		}

		return next({ ctx })
	}
}

/**
 * TRPC permission-based access control middleware
 */
export const createTRPCPermissionMiddleware = (resource: string, action: string) => {
	return async ({ ctx, next }: { ctx: any; next: any }) => {
		if (!ctx.session) {
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await checkUserPermission(
			ctx.session,
			resource,
			action,
			ctx.services.db.auth
		)

		if (!hasPermission) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'FORBIDDEN',
				message: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						resource,
						action,
						userRole: ctx.session.user.role,
						organizationRole: ctx.session.session.activeOrganizationRole,
						organizationId: ctx.session.session.activeOrganizationId,
					},
				},
				'trpc-permission-middleware',
				'requirePermission'
			)

			throw err
		}

		return next({ ctx })
	}
}
