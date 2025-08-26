import { TRPCError } from '@trpc/server'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { audit } from '../hono/init.js'

import type { Context } from 'hono'
import type { AuthorizationService, Session } from '@repo/auth'
import type { HonoEnv } from '../hono/context.js'
import type { Context as TRPCContext } from '../trpc/context.js'

/**
 * Authentication middleware that validates session tokens
 */
export const requireAuth = createMiddleware<HonoEnv>(async (c, next) => {
	const session = c.get('session')
	const { audit } = c.get('services')
	const requestId = c.get('requestId')

	if (!session) {
		const err = new HTTPException(401, {
			message: 'Authentication required',
		})

		audit.logAuth({
			action: 'session',
			status: 'failure',
			sessionContext: {
				sessionId: 'anonymous',
				ipAddress: c.get('location'),
				userAgent: c.get('userAgent'),
				requestId,
				path: c.req.path,
				method: c.req.method,
				component: 'auth-middleware',
				operation: 'requireAuth',
			},
			reason: 'Authentication required',
		})

		throw err
	}

	// Validate session is not expired
	if (session.session.expiresAt < new Date()) {
		const err = new HTTPException(401, {
			message: 'Session expired',
		})

		audit.logAuth({
			principalId: session.user.id,
			organizationId: session.session.activeOrganizationId || undefined,
			action: `session`,
			status: 'failure',
			sessionContext: {
				sessionId: session.session.id,
				ipAddress: session.session.ipAddress,
				userAgent: session.session.userAgent,
				banReason: session.user.banReason,
				banExpires: session.user.banExpires,
				requestId,
				path: c.req.path,
				method: c.req.method,
				component: 'auth-middleware',
				operation: 'requireAuth',
			},
			reason: 'Session expired',
		})

		throw err
	}

	// Check if user is banned
	if (session.user.banned) {
		const err = new HTTPException(403, {
			message: session.user.banReason || 'Account is banned',
		})

		audit.logAuth({
			principalId: session.user.id,
			organizationId: session.session.activeOrganizationId || undefined,
			action: 'account',
			status: 'failure',
			sessionContext: {
				sessionId: session.session.id,
				ipAddress: session.session.ipAddress,
				userAgent: session.session.userAgent,
				banReason: session.user.banReason,
				banExpires: session.user.banExpires,
				requestId,
				path: c.req.path,
				method: c.req.method,
				component: 'auth-middleware',
				operation: 'requireAuth',
			},
			reason: session.user.banReason || 'Account is banned',
		})

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
		const { audit } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: c.get('location'),
					userAgent: c.get('userAgent'),
					requestId,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireAuth',
				},
				reason: 'Authentication required',
			})
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		const userRole = session.user.role
		if (!roles.includes(userRole)) {
			const err = new HTTPException(403, {
				message: `Access denied. Required roles: ${roles.join(', ')}`,
			})

			audit.logAuth({
				principalId: session.user.id,
				organizationId: session.session.activeOrganizationId || undefined,
				action: `permission`,
				status: 'failure',
				sessionContext: {
					sessionId: session.session.id,
					ipAddress: session.session.ipAddress,
					userAgent: session.session.userAgent,
					userRole,
					requiredRoles: roles,
					requestId,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireRole',
				},
				reason: `Access denied. Required roles: ${roles.join(', ')}`,
			})

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
		const { audit } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: c.get('location'),
					userAgent: c.get('userAgent'),
					requestId,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireOrganizationAccess',
				},
				reason: 'Authentication required',
			})
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

			audit.logAuth({
				principalId: session.user.id,
				action: `permission`,
				status: 'failure',
				sessionContext: {
					sessionId: session.session.id,
					ipAddress: session.session.ipAddress,
					userAgent: session.session.userAgent,
					requestId,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireOrganizationAccess',
				},
				reason: 'No active organization. Please select an organization.',
			})

			throw err
		}

		// Check if organization ID in path matches active organization
		const pathOrgId = c.req.param('organizationId')
		if (pathOrgId && pathOrgId !== activeOrganizationId) {
			const err = new HTTPException(403, {
				message: 'Access denied to this organization',
			})

			audit.logAuth({
				principalId: session.user.id,
				organizationId: session.session.activeOrganizationId || undefined,
				action: `permission`,
				status: 'failure',
				sessionContext: {
					sessionId: session.session.id,
					ipAddress: session.session.ipAddress,
					userAgent: session.session.userAgent,
					requestId,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireOrganizationAccess',
				},
				reason: 'Access denied to this organization',
			})

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
		const { audit } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: c.get('location'),
					userAgent: c.get('userAgent'),
					requestId,
					requiredRoles: roles,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireOrganizationRole',
				},
				reason: 'Authentication required',
			})
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		const organizationRole = session.session.activeOrganizationRole
		if (!organizationRole || !roles.includes(organizationRole)) {
			const err = new HTTPException(403, {
				message: `Access denied. Required organization roles: ${roles.join(', ')}`,
			})

			audit.logAuth({
				principalId: session.user.id,
				organizationId: session.session.activeOrganizationId || undefined,
				action: 'permission',
				status: 'failure',
				sessionContext: {
					sessionId: session.session.id,
					ipAddress: session.session.ipAddress,
					userAgent: session.session.userAgent,
					requestId,
					organizationRole,
					requiredRoles: roles,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requireOrganizationRole',
				},
				reason: `Access denied. Required organization roles: ${roles.join(', ')}`,
			})

			throw err
		}

		await next()
	})

/**
 * API key authentication middleware for third-party access
 */
export const requireApiKey = createMiddleware<HonoEnv>(async (c, next) => {
	const session = c.get('session')
	const { audit } = c.get('services')
	const requestId = c.get('requestId')

	if (!session) {
		audit.logAuth({
			action: 'session',
			status: 'failure',
			sessionContext: {
				sessionId: 'anonymous',
				ipAddress: c.get('location'),
				userAgent: c.get('userAgent'),
				requestId,
				path: c.req.path,
				method: c.req.method,
				component: 'auth-middleware',
				operation: 'requireApiKey',
			},
			reason: 'Authentication required',
		})
		throw new HTTPException(401, { message: 'Authentication required' })
	}

	// Check if user is banned
	if (session.user.banned) {
		const err = new HTTPException(403, {
			message: session.user.banReason || 'Account is banned',
		})

		audit.logAuth({
			principalId: session.user.id,
			organizationId: session.session.activeOrganizationId || undefined,
			action: 'account',
			status: 'failure',
			sessionContext: {
				sessionId: session.session.id,
				ipAddress: session.session.ipAddress,
				userAgent: session.session.userAgent,
				banReason: session.user.banReason,
				banExpires: session.user.banExpires,
				requestId,
				path: c.req.path,
				method: c.req.method,
				component: 'auth-middleware',
				operation: 'requireApiKey',
			},
			reason: session.user.banReason || 'Account is banned',
		})

		throw err
	}
})

/**
 * Combined authentication middleware that supports both session and API key auth
 */
export const requireAuthOrApiKey = createMiddleware<HonoEnv>(async (c, next) => {
	const session = c.get('session')
	const { audit } = c.get('services')
	const isApiKeyAuth = c.get('isApiKeyAuth')

	// If session exists, use session auth
	if (session && !isApiKeyAuth) {
		return requireAuth(c, next)
	}

	// If API key provided, use API key auth
	if (session && isApiKeyAuth) {
		return requireApiKey(c, next)
	}

	audit.logAuth({
		action: 'session',
		status: 'failure',
		sessionContext: {
			sessionId: 'anonymous',
			ipAddress: c.get('location'),
			userAgent: c.get('userAgent'),
			requestId: c.get('requestId'),
			path: c.req.path,
			method: c.req.method,
			component: 'auth-middleware',
			operation: 'requireAuthOrApiKey',
		},
		reason: isApiKeyAuth
			? 'Authentication required. Provide a valid API key.'
			: 'Authentication required.',
	})
	// No authentication provided
	throw new HTTPException(401, {
		message: isApiKeyAuth
			? 'Authentication required. Provide a valid API key.'
			: 'Authentication required.',
	})
})

/**
 * Permission-based access control middleware
 */
export const requirePermission = (resource: string, action: string) =>
	createMiddleware<HonoEnv>(async (c, next) => {
		const session = c.get('session')
		const { authorization, audit } = c.get('services')
		const requestId = c.get('requestId')

		if (!session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: c.get('location'),
					userAgent: c.get('userAgent'),
					requestId,
					resource,
					action,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requirePermission',
				},
				reason: 'Authentication required',
			})
			throw new HTTPException(401, { message: 'Authentication required' })
		}

		// Check if user has permission
		const hasPermission = await authorization.hasPermission(session, resource, action)

		if (!hasPermission) {
			const err = new HTTPException(403, {
				message: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			audit.logAuth({
				principalId: session.user.id,
				organizationId: session.session.activeOrganizationId || undefined,
				action: `permission`,
				status: 'failure',
				sessionContext: {
					sessionId: session.session.id,
					ipAddress: session.session.ipAddress,
					userAgent: session.session.userAgent,
					requestId,
					resource,
					action,
					path: c.req.path,
					method: c.req.method,
					component: 'auth-middleware',
					operation: 'requirePermission',
				},
				reason: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			throw err
		}

		await next()
	})

/**
 * TRPC-specific authentication middleware
 */
export const createTRPCAuthMiddleware = () => {
	return async ({ ctx, next }: { ctx: TRPCContext; next: any }) => {
		if (!ctx.session) {
			const { audit } = ctx.services
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: ctx.location,
					userAgent: ctx.userAgent,
					requestId: ctx.requestId,
					component: 'trpc-auth-middleware',
					operation: 'requireAuth',
				},
				reason: 'Authentication required',
			})
			const err = new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
				cause: 'No session',
			})

			throw err
		}

		// Validate session is not expired
		if (ctx.session.session.expiresAt < new Date()) {
			const { audit } = ctx.services
			const err = new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Session expired',
			})

			audit.logAuth({
				principalId: ctx.session.user.id,
				organizationId: ctx.session.session.activeOrganizationId || undefined,
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: ctx.session.session.id,
					ipAddress: ctx.session.session.ipAddress,
					userAgent: ctx.session.session.userAgent,
					requestId: ctx.requestId,
					component: 'auth-middleware',
					operation: 'requireAuth',
				},
				reason: 'Session expired',
			})

			throw err
		}

		// Check if user is banned
		if (ctx.session.user.banned) {
			const { audit } = ctx.services
			const err = new TRPCError({
				code: 'FORBIDDEN',
				message: ctx.session.user.banReason || 'Account is banned',
			})

			audit.logAuth({
				principalId: ctx.session.user.id,
				organizationId: ctx.session.session.activeOrganizationId || undefined,
				action: 'account',
				status: 'failure',
				sessionContext: {
					sessionId: ctx.session.session.id,
					ipAddress: ctx.session.session.ipAddress,
					userAgent: ctx.session.session.userAgent,
					banReason: ctx.session.user.banReason,
					banExpires: ctx.session.user.banExpires,
					requestId: ctx.requestId,
					component: 'auth-middleware',
					operation: 'requireAuth',
				},
				reason: ctx.session.user.banReason || 'Account is banned',
			})

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
	return async ({ ctx, next }: { ctx: TRPCContext; next: any }) => {
		const { audit } = ctx.services
		if (!ctx.session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: ctx.location,
					userAgent: ctx.userAgent,
					requestId: ctx.requestId,
					requiredRoles: roles,
					component: 'trpc-role-middleware',
					operation: 'requireRole',
				},
				reason: 'Authentication required',
			})
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

			audit.logAuth({
				principalId: ctx.session.user.id,
				organizationId: ctx.session.session.activeOrganizationId || undefined,
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: ctx.session.session.id,
					ipAddress: ctx.session.session.ipAddress,
					userAgent: ctx.session.session.userAgent,
					requestId: ctx.requestId,
					userRole,
					requiredRoles: roles,
					component: 'trpc-role-middleware',
					operation: 'requireRole',
				},
				reason: `Access denied. Required roles: ${roles.join(', ')}`,
			})

			throw err
		}

		return next({ ctx })
	}
}

/**
 * TRPC permission-based access control middleware
 */
export const createTRPCPermissionMiddleware = (resource: string, action: string) => {
	return async ({ ctx, next }: { ctx: TRPCContext; next: any }) => {
		const { audit, authorization } = ctx.services
		if (!ctx.session) {
			audit.logAuth({
				action: 'session',
				status: 'failure',
				sessionContext: {
					sessionId: 'anonymous',
					ipAddress: ctx.location,
					userAgent: ctx.userAgent,
					requestId: ctx.requestId,
					resource,
					action,
					component: 'trpc-permission-middleware',
					operation: 'requirePermission',
				},
				reason: 'Authentication required',
			})
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await authorization.hasPermission(ctx.session, resource, action)

		if (!hasPermission) {
			const { error } = ctx.services
			const err = new TRPCError({
				code: 'FORBIDDEN',
				message: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			audit.logAuth({
				principalId: ctx.session.user.id,
				organizationId: ctx.session.session.activeOrganizationId || undefined,
				action: `permission`,
				status: 'failure',
				sessionContext: {
					sessionId: ctx.session.session.id,
					ipAddress: ctx.session.session.ipAddress,
					userAgent: ctx.session.session.userAgent,
					requestId: ctx.requestId,
					resource,
					action,
					component: 'trpc-permission-middleware',
					operation: 'requirePermission',
				},
				reason: `Access denied. Missing permission: ${action} on ${resource}`,
			})

			throw err
		}

		return next({ ctx })
	}
}
