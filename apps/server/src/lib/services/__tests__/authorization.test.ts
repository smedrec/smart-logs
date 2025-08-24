/**
 * Authorization Service Tests
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthorizationService, PERMISSIONS } from '../authorization'

import type { Session } from '@repo/auth'

// Mock database
const mockDb = {
	query: {
		member: {
			findFirst: vi.fn(),
		},
	},
} as any

// Mock session
const mockUserSession: Session = {
	session: {
		id: 'session-123',
		token: 'token-123',
		userId: 'user-123',
		expiresAt: new Date(Date.now() + 3600000),
		createdAt: new Date(),
		updatedAt: new Date(),
		ipAddress: '127.0.0.1',
		userAgent: 'test-agent',
		activeOrganizationId: 'org-123',
		activeOrganizationRole: 'member',
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

const mockAdminSession: Session = {
	...mockUserSession,
	user: {
		...mockUserSession.user,
		role: 'admin',
	},
}

const mockOrgAdminSession: Session = {
	...mockUserSession,
	session: {
		...mockUserSession.session,
		activeOrganizationRole: 'admin',
	},
}

describe('AuthorizationService', () => {
	let authService: AuthorizationService

	beforeEach(() => {
		authService = new AuthorizationService(mockDb)
		vi.clearAllMocks()
	})

	describe('hasPermission', () => {
		it('should grant all permissions to super admin', async () => {
			const hasPermission = await authService.hasPermission(
				mockAdminSession,
				'audit.events',
				'delete'
			)

			expect(hasPermission).toBe(true)
		})

		it('should grant read permissions to regular users', async () => {
			const hasPermission = await authService.hasPermission(mockUserSession, 'audit.events', 'read')

			expect(hasPermission).toBe(true)
		})

		it('should deny delete permissions to regular users', async () => {
			const hasPermission = await authService.hasPermission(
				mockUserSession,
				'audit.events',
				'delete'
			)

			expect(hasPermission).toBe(false)
		})

		it('should grant admin permissions to organization admins', async () => {
			const hasPermission = await authService.hasPermission(
				mockOrgAdminSession,
				'audit.events',
				'delete'
			)

			expect(hasPermission).toBe(true)
		})

		it('should grant organization settings access to org owners', async () => {
			const orgOwnerSession = {
				...mockUserSession,
				session: {
					...mockUserSession.session,
					activeOrganizationRole: 'owner',
				},
			}

			const hasPermission = await authService.hasPermission(
				orgOwnerSession,
				'organization.settings',
				'update'
			)

			expect(hasPermission).toBe(true)
		})

		it('should deny organization settings access to regular members', async () => {
			const hasPermission = await authService.hasPermission(
				mockUserSession,
				'organization.settings',
				'update'
			)

			expect(hasPermission).toBe(false)
		})

		it('should handle resource-specific permissions with ownership', async () => {
			const hasPermission = await authService.hasPermission(
				mockUserSession,
				'audit.events',
				'update',
				{ ownerId: 'user-123' }
			)

			expect(hasPermission).toBe(true)
		})

		it('should deny access to resources owned by others', async () => {
			const hasPermission = await authService.hasPermission(
				mockUserSession,
				'audit.events',
				'update',
				{ ownerId: 'other-user' }
			)

			expect(hasPermission).toBe(false)
		})

		it('should grant access to organization resources', async () => {
			const hasPermission = await authService.hasPermission(
				mockUserSession,
				'audit.events',
				'read',
				{ organizationId: 'org-123' }
			)

			expect(hasPermission).toBe(true)
		})
	})

	describe('canAccessOrganization', () => {
		it('should allow super admin to access any organization', async () => {
			const canAccess = await authService.canAccessOrganization(mockAdminSession, 'any-org')

			expect(canAccess).toBe(true)
		})

		it('should allow access to user organization', async () => {
			mockDb.query.member.findFirst.mockResolvedValue({
				userId: 'user-123',
				organizationId: 'org-123',
				role: 'member',
			})

			const canAccess = await authService.canAccessOrganization(mockUserSession, 'org-123')

			expect(canAccess).toBe(true)
			expect(mockDb.query.member.findFirst).toHaveBeenCalled()
		})

		it('should deny access to organizations user is not member of', async () => {
			mockDb.query.member.findFirst.mockResolvedValue(null)

			const canAccess = await authService.canAccessOrganization(mockUserSession, 'other-org')

			expect(canAccess).toBe(false)
		})
	})

	describe('getOrganizationRole', () => {
		it('should return user role in organization', async () => {
			mockDb.query.member.findFirst.mockResolvedValue({
				userId: 'user-123',
				organizationId: 'org-123',
				role: 'admin',
			})

			const role = await authService.getOrganizationRole(mockUserSession, 'org-123')

			expect(role).toBe('admin')
		})

		it('should return null if user is not member', async () => {
			mockDb.query.member.findFirst.mockResolvedValue(null)

			const role = await authService.getOrganizationRole(mockUserSession, 'other-org')

			expect(role).toBe(null)
		})
	})

	describe('getUserPermissions', () => {
		it('should return all permissions for super admin', async () => {
			const permissions = await authService.getUserPermissions(mockAdminSession)

			expect(permissions).toContainEqual({ resource: '*', action: '*' })
		})

		it('should return user permissions for regular user', async () => {
			const permissions = await authService.getUserPermissions(mockUserSession)

			expect(permissions).toContainEqual({ resource: 'audit.events', action: 'read' })
			expect(permissions).toContainEqual({ resource: 'audit.events', action: 'create' })
		})

		it('should include organization permissions', async () => {
			const permissions = await authService.getUserPermissions(mockOrgAdminSession)

			expect(permissions).toContainEqual({ resource: 'audit.events', action: 'delete' })
		})
	})

	describe('role management', () => {
		it('should add custom role', () => {
			const customRole = {
				name: 'custom-role',
				permissions: [{ resource: 'custom.resource', action: 'custom-action' }],
			}

			authService.addRole(customRole)
			const retrievedRole = authService.getRole('custom-role')

			expect(retrievedRole).toEqual(customRole)
		})

		it('should remove role', () => {
			const customRole = {
				name: 'temp-role',
				permissions: [{ resource: 'temp.resource', action: 'temp-action' }],
			}

			authService.addRole(customRole)
			authService.removeRole('temp-role')
			const retrievedRole = authService.getRole('temp-role')

			expect(retrievedRole).toBeUndefined()
		})

		it('should list all roles', () => {
			const roles = authService.getAllRoles()

			expect(roles.length).toBeGreaterThan(0)
			expect(roles.some((role) => role.name === 'user')).toBe(true)
			expect(roles.some((role) => role.name === 'admin')).toBe(true)
		})
	})

	describe('cache management', () => {
		it('should clear user cache', () => {
			// This is mainly to ensure the method exists and doesn't throw
			expect(() => authService.clearUserCache('user-123')).not.toThrow()
		})

		it('should clear all cache', () => {
			// This is mainly to ensure the method exists and doesn't throw
			expect(() => authService.clearCache()).not.toThrow()
		})
	})

	describe('permission constants', () => {
		it('should have audit permissions defined', () => {
			expect(PERMISSIONS.AUDIT.EVENTS.READ).toEqual({
				resource: 'audit.events',
				action: 'read',
			})
			expect(PERMISSIONS.AUDIT.EVENTS.CREATE).toEqual({
				resource: 'audit.events',
				action: 'create',
			})
		})

		it('should have organization permissions defined', () => {
			expect(PERMISSIONS.ORGANIZATION.SETTINGS.READ).toEqual({
				resource: 'organization.settings',
				action: 'read',
			})
		})

		it('should have system permissions defined', () => {
			expect(PERMISSIONS.SYSTEM.HEALTH.READ).toEqual({
				resource: 'system.health',
				action: 'read',
			})
		})
	})
})
