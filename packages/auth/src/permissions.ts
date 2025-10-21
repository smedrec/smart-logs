import { and, eq } from 'drizzle-orm'

import { organizationRole } from './db/schema/index.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisInstanceType } from 'ioredis'
import type { Session } from './auth.js'
import type * as authSchema from './db/schema/index.js'

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
	description?: string
	permissions: Permission[]
	inherits?: string[]
}

/**
 * Authorization service for managing permissions and access control
 */
export class AuthorizationService {
	private readonly roleCachePrefix = 'authz:roles:'
	private readonly permissionCachePrefix = 'authz:permissions:'
	private readonly retentionPeriod = 5 * 60 // 5 minutes

	constructor(
		private db: PostgresJsDatabase<typeof authSchema>,
		private redis: RedisInstanceType
	) {
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

		// Default Organization-level roles
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
					{ resource: 'audit.events', action: 'export' },
					{ resource: 'audit.events', action: 'verify' },
					{ resource: 'audit.events', action: 'pseudonymize' },
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
					{ resource: 'audit.alerts', action: 'dismiss' },
					{ resource: 'audit.alerts', action: 'supress' },
					{ resource: 'audit.alerts', action: 'escalate' },
					{ resource: 'audit.alerts', action: 'configure_thresholds' },
					{ resource: 'audit.alerts', action: 'manage_maintenance_windows' },
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
			const key = `${this.roleCachePrefix}${role.name}`
			this.redis.set(key, JSON.stringify(role))
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
		const cacheKey = `${this.permissionCachePrefix}${session.session.userId}:${resource}:${action}:${JSON.stringify(context || {})}`

		// Check cache first
		const exists = await this.redis.exists(cacheKey)
		if (exists) {
			const data = await this.redis.get(cacheKey)
			if (data) {
				return data === 'true'
			}
		}

		let hasPermission = false

		try {
			// Super admin has all permissions
			if (session.user.role === 'admin') {
				hasPermission = true
			} else {
				// Check system-level permissions
				const systemRole = await this.getRole(session.user.role)
				if (
					systemRole &&
					(await this.checkRolePermissions(systemRole, resource, action, context))
				) {
					hasPermission = true
				}

				// Check organization-level permissions if not already granted
				if (!hasPermission && session.session.activeOrganizationRole) {
					let orgRole
					orgRole = await this.getRole(
						`${session.session.activeOrganizationId}:${session.session.activeOrganizationRole}`
					)
					if (!orgRole)
						orgRole = await this.getRole(`org:${session.session.activeOrganizationRole}`)
					if (orgRole && (await this.checkRolePermissions(orgRole, resource, action, context))) {
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
			try {
				const serialized = hasPermission ? 'true' : 'false'

				await this.redis.setex(cacheKey, this.retentionPeriod, serialized)
			} catch (error) {
				console.error('Failed to store permission cache', {
					cacheKey,
					error: error instanceof Error ? error.message : 'Unknown error',
				})
			}

			return hasPermission
		} catch (error) {
			console.error('Error checking permissions:', error)
			return false
		}
	}

	/**
	 * Check if a role has specific permissions
	 */
	private async checkRolePermissions(
		role: Role,
		resource: string,
		action: string,
		context?: Record<string, any>
	): Promise<boolean> {
		// Check inherited roles first
		if (role.inherits) {
			for (const inheritedRoleName of role.inherits) {
				const inheritedRole = await this.getRole(inheritedRoleName)
				const rolePermission = await this.checkRolePermissions(
					inheritedRole!,
					resource,
					action,
					context
				)
				if (inheritedRole && rolePermission) {
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
		const systemRole = await this.getRole(session.user.role)
		if (systemRole) {
			const rolePermission = await this.getRolePermissions(systemRole)
			permissions.push(...rolePermission)
		}

		// Get organization role permissions
		if (session.session.activeOrganizationRole) {
			let orgRole: Role | undefined
			orgRole = await this.getRole(
				`${session.session.activeOrganizationId}:${session.session.activeOrganizationRole}`
			)
			if (!orgRole) orgRole = await this.getRole(`org:${session.session.activeOrganizationRole}`)
			if (orgRole) {
				const rolePermission = await this.getRolePermissions(orgRole)
				permissions.push(...rolePermission)
			}
		}

		return permissions
	}

	/**
	 * Get all permissions for a role (including inherited)
	 */
	private async getRolePermissions(role: Role): Promise<Permission[]> {
		const permissions: Permission[] = [...role.permissions]

		// Add inherited permissions
		if (role.inherits) {
			for (const inheritedRoleName of role.inherits) {
				const inheritedRole = await this.getRole(inheritedRoleName)
				if (inheritedRole) {
					const rolePermission = await this.getRolePermissions(inheritedRole)
					permissions.push(...rolePermission)
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
	async clearUserCache(userId: string): Promise<void> {
		try {
			const pattern = `${this.permissionCachePrefix}${userId}`
			const keys = await this.redis.keys(pattern)

			for (const key of keys) {
				try {
					await this.redis.del(key)
				} catch (error) {
					console.warn('Failed to delete user permission', { key, error: error })
				}
			}
		} catch (error) {
			console.error('Failed to delete user permissions', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Clear all permission cache
	 */
	async clearCache(): Promise<void> {
		await this.redis.del(this.permissionCachePrefix)
	}

	/**
	 * Add custom role
	 */
	async addRole(role: Role): Promise<void> {
		const roleName = role.name
		try {
			const fullKey = roleName.startsWith(this.roleCachePrefix)
				? roleName
				: `${this.roleCachePrefix}${roleName}`
			await this.redis.set(fullKey, JSON.stringify(role))
			await this.addRoleToDatabase(role)
		} catch (error) {
			console.error('Failed to add role', {
				roleName,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Remove role
	 */
	async removeRole(roleName: string): Promise<void> {
		try {
			const fullKey = roleName.startsWith(this.roleCachePrefix)
				? roleName
				: `${this.roleCachePrefix}${roleName}`
			await this.redis.del(fullKey)
			await this.removeRoleFromDatabase(roleName)
		} catch (error) {
			console.error('Failed to delete role', {
				roleName,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get role definition
	 */
	async getRole(roleName: string): Promise<Role | undefined> {
		let data
		try {
			const fullKey = roleName.startsWith(this.roleCachePrefix)
				? roleName
				: `${this.roleCachePrefix}${roleName}`
			data = await this.redis.get(fullKey)
			if (data === null) {
				data = await this.getRoleFromDatabase(fullKey)
				return data || undefined
			}

			return data ? JSON.parse(data) : undefined
		} catch (error) {
			console.error('Failed to get role', {
				roleName,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return undefined
		}
	}

	/**
	 * Get a role from the database.
	 * @param fullKey The full key of the role.
	 * @returns The role.
	 */
	private async getRoleFromDatabase(fullKey: string): Promise<Role | null> {
		fullKey = fullKey.replace(this.roleCachePrefix, '')
		const organizationId = fullKey.substring(0, fullKey.indexOf(':'))
		const name = fullKey.substring(fullKey.indexOf(':') + 1)

		const result = await this.db.query.organizationRole.findFirst({
			where: and(
				eq(organizationRole.organizationId, organizationId),
				eq(organizationRole.name, name)
			),
			columns: { name: true, permissions: true, inherits: true },
		})
		if (!result) return null

		const role = {
			name: result.name,
			permissions:
				typeof result.permissions === 'string'
					? JSON.parse(result.permissions)
					: result.permissions,
			inherits:
				(typeof result.inherits === 'string' ? JSON.parse(result.inherits) : result.inherits) ||
				undefined,
		}

		await this.redis.set(fullKey, JSON.stringify(role))
		return role
	}

	/**
	 * Remove role from database
	 */
	private async removeRoleFromDatabase(roleName: string): Promise<void> {
		roleName = roleName.replace(this.roleCachePrefix, '')
		const organizationId = roleName.substring(0, roleName.indexOf(':'))
		const name = roleName.substring(roleName.indexOf(':') + 1)

		await this.db
			.delete(organizationRole)
			.where(
				and(
					eq(organizationRole.organizationId, organizationId),
					eq(organizationRole.name, roleName)
				)
			)
	}

	/**
	 * Add role to database
	 */
	private async addRoleToDatabase(role: Role): Promise<void> {
		const organizationId = role.name.split(':')[0]
		const name = role.name.split(':')[1]

		await this.db
			.insert(organizationRole)
			.values({
				organizationId,
				name,
				description: role.description,
				permissions: role.permissions,
				inherits: role.inherits,
			})
			.onConflictDoUpdate({
				target: [organizationRole.organizationId, organizationRole.name],
				set: {
					description: role.description,
					permissions: role.permissions,
					inherits: role.inherits,
				},
			})
	}

	/**
	 * List all roles
	 */
	async getAllRoles(): Promise<Role[]> {
		try {
			const pattern = `${this.roleCachePrefix.replace(/:$/, '')}`
			const keys = await this.redis.keys(pattern)

			const roles: Role[] = []

			for (const key of keys) {
				try {
					const data = await this.redis.get(key)
					if (data) {
						roles.push(JSON.parse(data))
					}
				} catch (parseError) {
					console.warn('Failed to parse role', { key, error: parseError })
				}
			}

			return roles
		} catch (error) {
			console.error('Failed to get roles', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return []
		}
	}
}

/**
 * Factory function to create authorization service
 */
export function createAuthorizationService(
	db: PostgresJsDatabase<typeof authSchema>,
	redis: RedisInstanceType
): AuthorizationService {
	return new AuthorizationService(db, redis)
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
			PSEUDONYMIZE: { resource: 'audit.events', action: 'psuedonymize' },
			VERIFY: { resource: 'audit.events', action: 'verify' },
			EXPORT: { resource: 'audit.events', action: 'export' },
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
			DISMISS: { resource: 'audit.alerts', action: 'dismiss' },
			SUPRESS: { resource: 'audit.alerts', action: 'supress' },
			ESCALATE: { resource: 'audit.alerts', action: 'escalate' },
			CONFIGURE_THRESHOLDS: { resource: 'audit.alerts', action: 'configure_thresholds' },
			MANAGE_MAINTENANCE_WINDOWS: {
				resource: 'audit.alerts',
				action: 'manage_maintenance_windows',
			},
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
