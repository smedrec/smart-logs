import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Session } from '@repo/auth'
import type * as authSchema from '@repo/auth/dist/db/schema/index.js'

/**
 * Permission definition interface
 */
export interface Permission {
	resource: string
	action: string
	conditions?: Record<string, any>
}

/**
 * Role definition interface
 */
export interface Role {
	name: string
	permissions: Permission[]
	inherits?: string[]
}

/**
 * Authorization service for managing permissions and access control
 */
export class AuthorizationService {
	private db: PostgresJsDatabase<typeof authSchema>
	private roleCache = new Map<string, Role>()
	private permissionCache = new Map<string, boolean>()

	constructor(db: PostgresJsDatabase<typeof authSchema>) {
		this.db = db
		this.initializeRoles()
	}

	/**
	 * Initialize default roles and permissions
	 */
	private initializeRoles(): void {
		// System-level roles
		const systemRoles: Role[] = [
			{
				name: 'user',
				permissions: [
					{ resource: 'audit.events', action: 'read' },
					{ resource: 'audit.events', action: 'create' },
					{ resource: 'audit.reports', action: 'read' },
					{ resource: 'audit.presets', action: 'read' },
					{ resource: 'audit.metrics', action: 'read' },
					{ resource: 'profile', action: 'read' },
					{ resource: 'profile', action: 'update' },
				],
			},
			{
				name: 'admin',
				permissions: [
					{ resource: '*', action: '*' }, // Super admin has all permissions
				],
			},
		]

		// Organization-level roles
		const organizationRoles: Role[] = [
			{
				name: 'org:member',
				permissions: [
					{ resource: 'audit.events', action: 'read' },
					{ resource: 'audit.events', action: 'create' },
					{ resource: 'audit.reports', action: 'read' },
					{ resource: 'audit.presets', action: 'read' },
					{ resource: 'audit.metrics', action: 'read' },
				],
			},
			{
				name: 'org:admin',
				permissions: [
					{ resource: 'audit.events', action: 'read' },
					{ resource: 'audit.events', action: 'create' },
					{ resource: 'audit.events', action: 'update' },
					{ resource: 'audit.events', action: 'delete' },
					{ resource: 'audit.events', action: 'verify' },
					{ resource: 'audit.reports', action: 'read' },
					{ resource: 'audit.reports', action: 'create' },
					{ resource: 'audit.reports', action: 'update' },
					{ resource: 'audit.reports', action: 'delete' },
					{ resource: 'audit.presets', action: 'read' },
					{ resource: 'audit.presets', action: 'create' },
					{ resource: 'audit.presets', action: 'update' },
					{ resource: 'audit.presets', action: 'delete' },
					{ resource: 'audit.metrics', action: 'read' },
					{ resource: 'audit.alerts', action: 'read' },
					{ resource: 'audit.alerts', action: 'acknowledge' },
					{ resource: 'audit.alerts', action: 'resolve' },
				],
			},
			{
				name: 'org:owner',
				inherits: ['org:admin'],
				permissions: [
					{ resource: 'organization.settings', action: 'read' },
					{ resource: 'organization.settings', action: 'update' },
					{ resource: 'organization.members', action: 'read' },
					{ resource: 'organization.members', action: 'invite' },
					{ resource: 'organization.members', action: 'remove' },
					{ resource: 'organization.members', action: 'update' },
					{ resource: 'organization.billing', action: 'read' },
					{ resource: 'organization.billing', action: 'update' },
				],
			},
		]

		// Cache all roles
		const allRoles = systemRoles.concat(organizationRoles)
		allRoles.forEach((role) => {
			this.roleCache.set(role.name, role)
		})
	}

	/**
	 * Check if a user has a specific permission
	 */
	async hasPermission(
		session: Session,
		resource: string,
		action: string,
		context?: Record<string, any>
	): Promise<boolean> {
		const cacheKey = `${session.session.userId}:${resource}:${action}:${JSON.stringify(context || {})}`

		// Check cache first
		if (this.permissionCache.has(cacheKey)) {
			return this.permissionCache.get(cacheKey)!
		}

		let hasPermission = false

		try {
			// Super admin has all permissions
			if (session.user.role === 'admin') {
				hasPermission = true
			} else {
				// Check system-level permissions
				const systemRole = this.roleCache.get(session.user.role)
				if (systemRole && this.checkRolePermissions(systemRole, resource, action, context)) {
					hasPermission = true
				}

				// Check organization-level permissions if not already granted
				if (!hasPermission && session.session.activeOrganizationRole) {
					const orgRole = this.roleCache.get(`org:${session.session.activeOrganizationRole}`)
					if (orgRole && this.checkRolePermissions(orgRole, resource, action, context)) {
						hasPermission = true
					}
				}

				// Check resource-specific permissions (e.g., ownership)
				if (!hasPermission && context) {
					hasPermission = await this.checkResourceSpecificPermissions(
						session,
						resource,
						action,
						context
					)
				}
			}

			// Cache the result for 5 minutes
			this.permissionCache.set(cacheKey, hasPermission)
			setTimeout(() => this.permissionCache.delete(cacheKey), 5 * 60 * 1000)

			return hasPermission
		} catch (error) {
			console.error('Error checking permissions:', error)
			return false
		}
	}

	/**
	 * Check if a role has specific permissions
	 */
	private checkRolePermissions(
		role: Role,
		resource: string,
		action: string,
		context?: Record<string, any>
	): boolean {
		// Check inherited roles first
		if (role.inherits) {
			for (const inheritedRoleName of role.inherits) {
				const inheritedRole = this.roleCache.get(inheritedRoleName)
				if (inheritedRole && this.checkRolePermissions(inheritedRole, resource, action, context)) {
					return true
				}
			}
		}

		// Check direct permissions
		for (const permission of role.permissions) {
			if (this.matchesPermission(permission, resource, action, context)) {
				return true
			}
		}

		return false
	}

	/**
	 * Check if a permission matches the requested resource and action
	 */
	private matchesPermission(
		permission: Permission,
		resource: string,
		action: string,
		context?: Record<string, any>
	): boolean {
		// Wildcard permissions
		if (permission.resource === '*' && permission.action === '*') {
			return true
		}

		if (permission.resource === '*' && permission.action === action) {
			return true
		}

		if (permission.resource === resource && permission.action === '*') {
			return true
		}

		// Exact match
		if (permission.resource === resource && permission.action === action) {
			// Check conditions if present
			if (permission.conditions && context) {
				return this.checkConditions(permission.conditions, context)
			}
			return true
		}

		// Pattern matching for resources (e.g., "audit.*" matches "audit.events")
		if (permission.resource.endsWith('*')) {
			const resourcePrefix = permission.resource.slice(0, -1)
			if (resource.startsWith(resourcePrefix) && permission.action === action) {
				return true
			}
		}

		return false
	}

	/**
	 * Check permission conditions
	 */
	private checkConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
		for (const [key, value] of Object.entries(conditions)) {
			if (context[key] !== value) {
				return false
			}
		}
		return true
	}

	/**
	 * Check resource-specific permissions (e.g., ownership)
	 */
	private async checkResourceSpecificPermissions(
		session: Session,
		resource: string,
		action: string,
		context: Record<string, any>
	): Promise<boolean> {
		// Check if user owns the resource
		if (context.ownerId === session.session.userId) {
			// Owners can perform most actions on their resources
			const ownerActions = ['read', 'update', 'delete']
			if (ownerActions.includes(action)) {
				return true
			}
		}

		// Check organization-specific permissions
		if (context.organizationId === session.session.activeOrganizationId) {
			// Users can read resources in their organization
			if (action === 'read') {
				return true
			}
		}

		return false
	}

	/**
	 * Get all permissions for a user
	 */
	async getUserPermissions(session: Session): Promise<Permission[]> {
		const permissions: Permission[] = []

		// Get system role permissions
		const systemRole = this.roleCache.get(session.user.role)
		if (systemRole) {
			permissions.push(...this.getRolePermissions(systemRole))
		}

		// Get organization role permissions
		if (session.session.activeOrganizationRole) {
			const orgRole = this.roleCache.get(`org:${session.session.activeOrganizationRole}`)
			if (orgRole) {
				permissions.push(...this.getRolePermissions(orgRole))
			}
		}

		return permissions
	}

	/**
	 * Get all permissions for a role (including inherited)
	 */
	private getRolePermissions(role: Role): Permission[] {
		const permissions: Permission[] = [...role.permissions]

		// Add inherited permissions
		if (role.inherits) {
			for (const inheritedRoleName of role.inherits) {
				const inheritedRole = this.roleCache.get(inheritedRoleName)
				if (inheritedRole) {
					permissions.push(...this.getRolePermissions(inheritedRole))
				}
			}
		}

		return permissions
	}

	/**
	 * Check if user can access organization
	 */
	async canAccessOrganization(session: Session, organizationId: string): Promise<boolean> {
		// Super admin can access any organization
		if (session.user.role === 'admin') {
			return true
		}

		// Check if user is member of the organization
		try {
			const membership = await this.db.query.member.findFirst({
				where: (members, { eq, and }) =>
					and(
						eq(members.userId, session.session.userId),
						eq(members.organizationId, organizationId)
					),
			})

			return !!membership
		} catch (error) {
			console.error('Error checking organization access:', error)
			return false
		}
	}

	/**
	 * Get user's role in organization
	 */
	async getOrganizationRole(session: Session, organizationId: string): Promise<string | null> {
		try {
			const membership = await this.db.query.member.findFirst({
				where: (members, { eq, and }) =>
					and(
						eq(members.userId, session.session.userId),
						eq(members.organizationId, organizationId)
					),
			})

			return membership?.role || null
		} catch (error) {
			console.error('Error getting organization role:', error)
			return null
		}
	}

	/**
	 * Clear permission cache for a user
	 */
	clearUserCache(userId: string): void {
		for (const key of this.permissionCache.keys()) {
			if (key.startsWith(`${userId}:`)) {
				this.permissionCache.delete(key)
			}
		}
	}

	/**
	 * Clear all permission cache
	 */
	clearCache(): void {
		this.permissionCache.clear()
	}

	/**
	 * Add custom role
	 */
	addRole(role: Role): void {
		this.roleCache.set(role.name, role)
	}

	/**
	 * Remove role
	 */
	removeRole(roleName: string): void {
		this.roleCache.delete(roleName)
	}

	/**
	 * Get role definition
	 */
	getRole(roleName: string): Role | undefined {
		return this.roleCache.get(roleName)
	}

	/**
	 * List all roles
	 */
	getAllRoles(): Role[] {
		return Array.from(this.roleCache.values())
	}
}

/**
 * Factory function to create authorization service
 */
export function createAuthorizationService(
	db: PostgresJsDatabase<typeof authSchema>
): AuthorizationService {
	return new AuthorizationService(db)
}

/**
 * Permission constants for common resources and actions
 */
export const PERMISSIONS = {
	AUDIT: {
		EVENTS: {
			READ: { resource: 'audit.events', action: 'read' },
			CREATE: { resource: 'audit.events', action: 'create' },
			UPDATE: { resource: 'audit.events', action: 'update' },
			DELETE: { resource: 'audit.events', action: 'delete' },
			VERIFY: { resource: 'audit.events', action: 'verify' },
		},
		REPORTS: {
			READ: { resource: 'audit.reports', action: 'read' },
			CREATE: { resource: 'audit.reports', action: 'create' },
			UPDATE: { resource: 'audit.reports', action: 'update' },
			DELETE: { resource: 'audit.reports', action: 'delete' },
		},
		PRESETS: {
			READ: { resource: 'audit.presets', action: 'read' },
			CREATE: { resource: 'audit.presets', action: 'create' },
			UPDATE: { resource: 'audit.presets', action: 'update' },
			DELETE: { resource: 'audit.presets', action: 'delete' },
		},
		METRICS: {
			READ: { resource: 'audit.metrics', action: 'read' },
		},
		ALERTS: {
			READ: { resource: 'audit.alerts', action: 'read' },
			ACKNOWLEDGE: { resource: 'audit.alerts', action: 'acknowledge' },
			RESOLVE: { resource: 'audit.alerts', action: 'resolve' },
		},
	},
	ORGANIZATION: {
		SETTINGS: {
			READ: { resource: 'organization.settings', action: 'read' },
			UPDATE: { resource: 'organization.settings', action: 'update' },
		},
		MEMBERS: {
			READ: { resource: 'organization.members', action: 'read' },
			INVITE: { resource: 'organization.members', action: 'invite' },
			REMOVE: { resource: 'organization.members', action: 'remove' },
			UPDATE: { resource: 'organization.members', action: 'update' },
		},
		BILLING: {
			READ: { resource: 'organization.billing', action: 'read' },
			UPDATE: { resource: 'organization.billing', action: 'update' },
		},
	},
	SYSTEM: {
		HEALTH: {
			READ: { resource: 'system.health', action: 'read' },
		},
		METRICS: {
			READ: { resource: 'system.metrics', action: 'read' },
		},
	},
} as const
