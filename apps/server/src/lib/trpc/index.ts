import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import {
	createTRPCAuthMiddleware,
	createTRPCPermissionMiddleware,
	createTRPCRoleMiddleware,
} from '../middleware/auth.js'
import { createTRPCErrorHandler } from '../middleware/error-handling.js'

import type { Context } from './context'

export const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter: ({ error, ctx }) => {
		const handler = createTRPCErrorHandler()
		try {
			handler({ error, ctx })
		} catch (formattedError: any) {
			return {
				message: formattedError.message,
				code: formattedError.code,
				data: {
					code: formattedError.code,
					httpStatus: formattedError.code === 'INTERNAL_SERVER_ERROR' ? 500 : 400,
					stack: process.env.NODE_ENV === 'development' ? formattedError.stack : undefined,
				},
			}
		}

		// Fallback formatting
		return {
			message: error.message,
			code: error.code,
			data: {
				code: error.code,
				httpStatus: error.code === 'INTERNAL_SERVER_ERROR' ? 500 : 400,
				stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
			},
		}
	},
})

export const router = t.router

export const publicProcedure = t.procedure

// Enhanced protected procedure with comprehensive authentication
export const protectedProcedure = t.procedure.use(createTRPCAuthMiddleware())

// Role-based procedures
export const adminProcedure = protectedProcedure.use(createTRPCRoleMiddleware(['admin']))

export const userProcedure = protectedProcedure.use(createTRPCRoleMiddleware(['user', 'admin']))

// Organization role-based procedures
export const orgOwnerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.session?.session.activeOrganizationRole) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'No active organization',
		})
	}

	if (ctx.session.session.activeOrganizationRole !== 'owner' && ctx.session.user.role !== 'admin') {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Organization owner access required',
		})
	}

	return next({ ctx })
})

export const orgAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.session?.session.activeOrganizationRole) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'No active organization',
		})
	}

	const allowedRoles = ['owner', 'admin']
	if (
		!allowedRoles.includes(ctx.session.session.activeOrganizationRole) &&
		ctx.session.user.role !== 'admin'
	) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'Organization admin access required',
		})
	}

	return next({ ctx })
})

// Permission-based procedure factory
export const createPermissionProcedure = (resource: string, action: string) =>
	protectedProcedure.use(createTRPCPermissionMiddleware(resource, action))

// Common permission procedures
export const auditReadProcedure = createPermissionProcedure('audit.events', 'read')
export const auditWriteProcedure = createPermissionProcedure('audit.events', 'create')
export const auditUpdateProcedure = createPermissionProcedure('audit.events', 'update')
export const auditDeleteProcedure = createPermissionProcedure('audit.events', 'delete')
export const auditVerifyProcedure = createPermissionProcedure('audit.events', 'verify')

export const reportReadProcedure = createPermissionProcedure('audit.reports', 'read')
export const reportWriteProcedure = createPermissionProcedure('audit.reports', 'create')
export const reportUpdateProcedure = createPermissionProcedure('audit.reports', 'update')
export const reportDeleteProcedure = createPermissionProcedure('audit.reports', 'delete')

export const presetReadProcedure = createPermissionProcedure('audit.presets', 'read')
export const presetWriteProcedure = createPermissionProcedure('audit.presets', 'create')
export const presetUpdateProcedure = createPermissionProcedure('audit.presets', 'update')
export const presetDeleteProcedure = createPermissionProcedure('audit.presets', 'delete')

export const metricsReadProcedure = createPermissionProcedure('audit.metrics', 'read')

export const alertReadProcedure = createPermissionProcedure('audit.alerts', 'read')
export const alertAcknowledgeProcedure = createPermissionProcedure('audit.alerts', 'acknowledge')
export const alertResolveProcedure = createPermissionProcedure('audit.alerts', 'resolve')
