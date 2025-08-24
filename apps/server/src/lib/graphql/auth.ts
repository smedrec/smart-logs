/**
 * GraphQL Authentication and Authorization Utilities
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { GraphQLError } from 'graphql'

import type { GraphQLContext } from './types'

/**
 * Ensure user is authenticated
 */
export function requireAuth(context: GraphQLContext): asserts context is GraphQLContext & {
	session: NonNullable<GraphQLContext['session']>
} {
	if (!context.isAuthenticated || !context.session) {
		throw new GraphQLError('Authentication required', {
			extensions: {
				code: 'UNAUTHENTICATED',
				http: { status: 401 },
			},
		})
	}

	// Check if session is expired
	if (context.session.session.expiresAt < new Date()) {
		throw new GraphQLError('Session expired', {
			extensions: {
				code: 'UNAUTHENTICATED',
				http: { status: 401 },
			},
		})
	}

	// Check if user is banned
	if (context.session.user.banned) {
		throw new GraphQLError(context.session.user.banReason || 'Account is banned', {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
			},
		})
	}
}

/**
 * Require specific user roles
 */
export function requireRole(context: GraphQLContext, roles: string[]): void {
	requireAuth(context)

	const userRole = context.session.user.role
	if (!roles.includes(userRole)) {
		throw new GraphQLError(`Access denied. Required roles: ${roles.join(', ')}`, {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
				requiredRoles: roles,
				userRole,
			},
		})
	}
}

/**
 * Require organization access
 */
export function requireOrganizationAccess(context: GraphQLContext, allowSuperAdmin = false): void {
	requireAuth(context)

	// Allow super admin to access any organization
	if (allowSuperAdmin && context.session.user.role === 'admin') {
		return
	}

	const activeOrganizationId = context.session.session.activeOrganizationId
	if (!activeOrganizationId) {
		throw new GraphQLError('No active organization. Please select an organization.', {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
			},
		})
	}
}

/**
 * Require organization role
 */
export function requireOrganizationRole(context: GraphQLContext, roles: string[]): void {
	requireAuth(context)
	requireOrganizationAccess(context)

	const organizationRole = context.session.session.activeOrganizationRole
	if (!organizationRole || !roles.includes(organizationRole)) {
		throw new GraphQLError(`Access denied. Required organization roles: ${roles.join(', ')}`, {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
				requiredRoles: roles,
				organizationRole,
			},
		})
	}
}

/**
 * Check if user has specific permission
 */
export async function requirePermission(
	context: GraphQLContext,
	resource: string,
	action: string,
	resourceContext?: Record<string, any>
): Promise<void> {
	requireAuth(context)

	const hasPermission = await context.services.authorization.hasPermission(
		context.session,
		resource,
		action,
		resourceContext
	)

	if (!hasPermission) {
		throw new GraphQLError(`Access denied. Missing permission: ${action} on ${resource}`, {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
				resource,
				action,
				userRole: context.session.user.role,
				organizationRole: context.session.session.activeOrganizationRole,
			},
		})
	}
}

/**
 * Check organization access for a specific organization ID
 */
export async function requireOrganizationAccessById(
	context: GraphQLContext,
	organizationId: string
): Promise<void> {
	requireAuth(context)

	// Super admin can access any organization
	if (context.session.user.role === 'admin') {
		return
	}

	const canAccess = await context.services.authorization.canAccessOrganization(
		context.session,
		organizationId
	)

	if (!canAccess) {
		throw new GraphQLError('Access denied to this organization', {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
				organizationId,
			},
		})
	}
}

/**
 * Validate organization ID matches active organization
 */
export function validateOrganizationId(context: GraphQLContext, organizationId: string): void {
	requireAuth(context)

	// Super admin can access any organization
	if (context.session.user.role === 'admin') {
		return
	}

	const activeOrganizationId = context.session.session.activeOrganizationId
	if (organizationId !== activeOrganizationId) {
		throw new GraphQLError('Access denied to this organization', {
			extensions: {
				code: 'FORBIDDEN',
				http: { status: 403 },
				requestedOrganizationId: organizationId,
				activeOrganizationId,
			},
		})
	}
}

/**
 * Check if user owns a resource
 */
export function requireResourceOwnership(
	context: GraphQLContext,
	resourceOwnerId: string,
	allowOrgAdmin = false
): void {
	requireAuth(context)

	const userId = context.session.session.userId

	// Check if user owns the resource
	if (resourceOwnerId === userId) {
		return
	}

	// Check if organization admin is allowed and user is org admin
	if (allowOrgAdmin) {
		const orgRole = context.session.session.activeOrganizationRole
		if (orgRole && ['owner', 'admin'].includes(orgRole)) {
			return
		}
	}

	// Super admin can access any resource
	if (context.session.user.role === 'admin') {
		return
	}

	throw new GraphQLError('Access denied. You can only access your own resources.', {
		extensions: {
			code: 'FORBIDDEN',
			http: { status: 403 },
			resourceOwnerId,
			userId,
		},
	})
}

/**
 * Create authentication context for resolvers
 */
export function createAuthContext(context: GraphQLContext) {
	return {
		requireAuth: () => requireAuth(context),
		requireRole: (roles: string[]) => requireRole(context, roles),
		requireOrganizationAccess: (allowSuperAdmin = false) =>
			requireOrganizationAccess(context, allowSuperAdmin),
		requireOrganizationRole: (roles: string[]) => requireOrganizationRole(context, roles),
		requirePermission: (resource: string, action: string, resourceContext?: Record<string, any>) =>
			requirePermission(context, resource, action, resourceContext),
		requireOrganizationAccessById: (organizationId: string) =>
			requireOrganizationAccessById(context, organizationId),
		validateOrganizationId: (organizationId: string) =>
			validateOrganizationId(context, organizationId),
		requireResourceOwnership: (resourceOwnerId: string, allowOrgAdmin = false) =>
			requireResourceOwnership(context, resourceOwnerId, allowOrgAdmin),
		isAuthenticated: context.isAuthenticated,
		isApiKeyAuth: context.isApiKeyAuth,
		session: context.session,
		userId: context.session?.session.userId,
		organizationId: context.session?.session.activeOrganizationId,
		userRole: context.session?.user.role,
		organizationRole: context.session?.session.activeOrganizationRole,
	}
}

/**
 * Decorator for GraphQL resolvers that require authentication
 */
export function withAuth<TArgs extends any[], TReturn>(
	resolver: (context: GraphQLContext, ...args: TArgs) => TReturn
) {
	return (context: GraphQLContext, ...args: TArgs): TReturn => {
		requireAuth(context)
		return resolver(context, ...args)
	}
}

/**
 * Decorator for GraphQL resolvers that require specific roles
 */
export function withRole<TArgs extends any[], TReturn>(
	roles: string[],
	resolver: (context: GraphQLContext, ...args: TArgs) => TReturn
) {
	return (context: GraphQLContext, ...args: TArgs): TReturn => {
		requireRole(context, roles)
		return resolver(context, ...args)
	}
}

/**
 * Decorator for GraphQL resolvers that require specific permissions
 */
export function withPermission<TArgs extends any[], TReturn>(
	resource: string,
	action: string,
	resolver: (context: GraphQLContext, ...args: TArgs) => TReturn
) {
	return async (context: GraphQLContext, ...args: TArgs): Promise<TReturn> => {
		await requirePermission(context, resource, action)
		return resolver(context, ...args)
	}
}

/**
 * Decorator for GraphQL resolvers that require organization access
 */
export function withOrganizationAccess<TArgs extends any[], TReturn>(
	allowSuperAdmin = false,
	resolver: (context: GraphQLContext, ...args: TArgs) => TReturn
) {
	return (context: GraphQLContext, ...args: TArgs): TReturn => {
		requireOrganizationAccess(context, allowSuperAdmin)
		return resolver(context, ...args)
	}
}

/**
 * Error handler for GraphQL authentication errors
 */
export function handleAuthError(error: Error): GraphQLError {
	if (error instanceof GraphQLError) {
		return error
	}

	// Convert other errors to GraphQL errors
	return new GraphQLError(error.message, {
		extensions: {
			code: 'INTERNAL_ERROR',
			http: { status: 500 },
		},
	})
}
