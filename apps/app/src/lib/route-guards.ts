/**
 * Route Guards for Authentication and Authorization
 *
 * This file provides utilities for protecting routes with authentication
 * and authorization checks.
 */

import { redirect } from '@tanstack/react-router'

import type { RouterAppContext } from '@/routes/__root'

/**
 * User permissions interface
 */
export interface UserPermissions {
	canViewCompliance: boolean
	canCreateReports: boolean
	canEditReports: boolean
	canDeleteReports: boolean
	canExecuteReports: boolean
	canViewExecutions: boolean
	canManageTemplates: boolean
}

/**
 * Route context with user information
 */
export interface RouteContext extends RouterAppContext {
	user?: {
		id: string
		email: string
		role: string
		permissions: string[]
		organizationId: string
	}
}

/**
 * Authentication guard - ensures user is logged in
 */
export function requireAuth(context: RouteContext) {
	if (!context.user) {
		throw redirect({
			to: '/sign-in',
			search: {
				redirect: window.location.pathname + window.location.search,
			},
		})
	}
	return context
}

/**
 * Permission guard - ensures user has required permissions
 */
export function requirePermissions(permissions: string[]) {
	return (context: RouteContext) => {
		requireAuth(context)

		if (!context.user) {
			throw redirect({ to: '/sign-in' })
		}

		const hasPermissions = permissions.every((permission) =>
			context.user!.permissions.includes(permission)
		)

		if (!hasPermissions) {
			throw redirect({
				to: '/unauthorized',
				search: {
					message: 'You do not have permission to access this page',
				},
			})
		}

		return context
	}
}

/**
 * Compliance access guard - ensures user can access compliance features
 */
export function requireComplianceAccess(context: RouteContext) {
	return requirePermissions(['compliance:read'])(context)
}

/**
 * Report management guard - ensures user can manage reports
 */
export function requireReportManagement(context: RouteContext) {
	return requirePermissions(['compliance:read', 'reports:read'])(context)
}

/**
 * Report creation guard - ensures user can create reports
 */
export function requireReportCreation(context: RouteContext) {
	return requirePermissions(['compliance:write', 'reports:create'])(context)
}

/**
 * Report editing guard - ensures user can edit reports
 */
export function requireReportEditing(context: RouteContext) {
	return requirePermissions(['compliance:write', 'reports:update'])(context)
}

/**
 * Report execution guard - ensures user can execute reports
 */
export function requireReportExecution(context: RouteContext) {
	return requirePermissions(['compliance:execute', 'reports:execute'])(context)
}

/**
 * Template management guard - ensures user can manage templates
 */
export function requireTemplateManagement(context: RouteContext) {
	return requirePermissions(['compliance:read', 'templates:read'])(context)
}

/**
 * Execution history guard - ensures user can view execution history
 */
export function requireExecutionHistory(context: RouteContext) {
	return requirePermissions(['compliance:read', 'executions:read'])(context)
}

/**
 * Organization-specific resource guard - ensures user can access organization resources
 */
export function requireOrganizationAccess(resourceOrgId: string) {
	return (context: RouteContext) => {
		requireAuth(context)

		if (!context.user) {
			throw redirect({ to: '/sign-in' })
		}

		if (context.user.organizationId !== resourceOrgId) {
			throw redirect({
				to: '/unauthorized',
				search: {
					message: "You do not have access to this organization's resources",
				},
			})
		}

		return context
	}
}

/**
 * Validate route parameters
 */
export function validateRouteParams<T extends Record<string, unknown>>(
	params: T,
	validators: Record<keyof T, (value: unknown) => boolean>
): T {
	for (const [key, validator] of Object.entries(validators)) {
		const value = params[key as keyof T]
		if (!validator(value)) {
			throw new Error(`Invalid parameter: ${String(key)}`)
		}
	}
	return params
}

/**
 * Common parameter validators
 */
export const paramValidators = {
	reportId: (value: unknown): value is string => {
		return typeof value === 'string' && value.trim().length > 0 && /^[a-zA-Z0-9-_]+$/.test(value)
	},
	organizationId: (value: unknown): value is string => {
		return typeof value === 'string' && value.trim().length > 0 && /^[a-zA-Z0-9-_]+$/.test(value)
	},
	uuid: (value: unknown): value is string => {
		return (
			typeof value === 'string' &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
		)
	},
}

/**
 * Error handling for route guards
 */
export class RouteGuardError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly redirectTo?: string
	) {
		super(message)
		this.name = 'RouteGuardError'
	}
}

/**
 * Helper to create route guard with error handling
 */
export function createRouteGuard<T extends RouteContext>(guard: (context: T) => T | Promise<T>) {
	return async (context: T): Promise<T> => {
		try {
			return await guard(context)
		} catch (error) {
			if (error instanceof RouteGuardError) {
				if (error.redirectTo) {
					throw redirect({ to: error.redirectTo })
				}
				throw redirect({
					to: '/error',
					search: {
						message: error.message,
						code: error.code,
					},
				})
			}
			throw error
		}
	}
}
