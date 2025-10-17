/**
 * Unit tests for AlertAccessControl
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5: Organizational isolation and access control tests
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { AlertAccessControl } from '../alert-access-control.js'

import type { AlertUserContext } from '../alert-access-control.js'

describe('AlertAccessControl', () => {
	let accessControl: AlertAccessControl

	beforeEach(() => {
		accessControl = new AlertAccessControl()
	})

	describe('Permission Management', () => {
		it('should grant correct permissions for viewer role', () => {
			// Act
			const permissions = accessControl.getPermissionsForRole('viewer')

			// Assert
			expect(permissions).toEqual(['view_alerts'])
		})

		it('should grant correct permissions for operator role', () => {
			// Act
			const permissions = accessControl.getPermissionsForRole('operator')

			// Assert
			expect(permissions).toEqual(['view_alerts', 'acknowledge_alerts'])
		})

		it('should grant correct permissions for admin role', () => {
			// Act
			const permissions = accessControl.getPermissionsForRole('admin')

			// Assert
			expect(permissions).toContain('view_alerts')
			expect(permissions).toContain('acknowledge_alerts')
			expect(permissions).toContain('resolve_alerts')
			expect(permissions).toContain('configure_thresholds')
			expect(permissions).toContain('manage_maintenance_windows')
			expect(permissions).toContain('suppress_alerts')
		})

		it('should grant all permissions for owner role', () => {
			// Act
			const permissions = accessControl.getPermissionsForRole('owner')

			// Assert
			expect(permissions).toContain('view_alerts')
			expect(permissions).toContain('acknowledge_alerts')
			expect(permissions).toContain('resolve_alerts')
			expect(permissions).toContain('configure_thresholds')
			expect(permissions).toContain('manage_maintenance_windows')
			expect(permissions).toContain('suppress_alerts')
			expect(permissions).toContain('escalate_alerts')
		})

		it('should check user permissions correctly', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts', 'acknowledge_alerts', 'resolve_alerts'],
			}

			// Act & Assert
			expect(accessControl.hasPermission(userContext, 'view_alerts')).toBe(true)
			expect(accessControl.hasPermission(userContext, 'acknowledge_alerts')).toBe(true)
			expect(accessControl.hasPermission(userContext, 'resolve_alerts')).toBe(true)
			expect(accessControl.hasPermission(userContext, 'escalate_alerts')).toBe(false)
		})
	})

	describe('Organizational Isolation', () => {
		it('should allow access to same organization', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			// Act
			const result = accessControl.canAccessOrganization(userContext, 'org-1')

			// Assert
			expect(result).toBe(true)
		})

		it('should deny access to different organization', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			// Act
			const result = accessControl.canAccessOrganization(userContext, 'org-2')

			// Assert
			expect(result).toBe(false)
		})

		it('should allow access to alert from same organization', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-1',
				type: 'failure_rate',
			}

			// Act
			const result = accessControl.canAccessAlert(userContext, alert)

			// Assert
			expect(result).toBe(true)
		})

		it('should deny access to alert from different organization', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-2',
				type: 'failure_rate',
			}

			// Act
			const result = accessControl.canAccessAlert(userContext, alert)

			// Assert
			expect(result).toBe(false)
		})

		it('should enforce department-level isolation', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
				departmentId: 'dept-1',
			}

			const alertSameDept = {
				id: 'alert-1',
				organizationId: 'org-1',
				departmentId: 'dept-1',
			}

			const alertDifferentDept = {
				id: 'alert-2',
				organizationId: 'org-1',
				departmentId: 'dept-2',
			}

			// Act & Assert
			expect(accessControl.canAccessAlert(userContext, alertSameDept)).toBe(true)
			expect(accessControl.canAccessAlert(userContext, alertDifferentDept)).toBe(false)
		})

		it('should enforce team-level isolation', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
				teamId: 'team-1',
			}

			const alertSameTeam = {
				id: 'alert-1',
				organizationId: 'org-1',
				teamId: 'team-1',
			}

			const alertDifferentTeam = {
				id: 'alert-2',
				organizationId: 'org-1',
				teamId: 'team-2',
			}

			// Act & Assert
			expect(accessControl.canAccessAlert(userContext, alertSameTeam)).toBe(true)
			expect(accessControl.canAccessAlert(userContext, alertDifferentTeam)).toBe(false)
		})
	})

	describe('Alert Filtering', () => {
		it('should filter alerts based on user access', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			const alerts = [
				{ id: 'alert-1', organizationId: 'org-1', type: 'failure_rate' },
				{ id: 'alert-2', organizationId: 'org-2', type: 'consecutive_failures' },
				{ id: 'alert-3', organizationId: 'org-1', type: 'queue_backlog' },
			]

			// Act
			const filteredAlerts = accessControl.filterAlerts(userContext, alerts)

			// Assert
			expect(filteredAlerts).toHaveLength(2)
			expect(filteredAlerts.map((a) => a.id)).toEqual(['alert-1', 'alert-3'])
		})

		it('should filter destinations based on user access', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			const destinations = [
				{ id: 'dest-1', organizationId: 'org-1', type: 'webhook' },
				{ id: 'dest-2', organizationId: 'org-2', type: 'email' },
				{ id: 'dest-3', organizationId: 'org-1', type: 'storage' },
			]

			// Act
			const filteredDestinations = accessControl.filterDestinations(userContext, destinations)

			// Assert
			expect(filteredDestinations).toHaveLength(2)
			expect(filteredDestinations.map((d) => d.id)).toEqual(['dest-1', 'dest-3'])
		})
	})

	describe('Operation Validation', () => {
		it('should validate view operation with proper permissions', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer',
				permissions: ['view_alerts'],
			}

			// Act
			const result = accessControl.validateAlertOperation(userContext, 'view')

			// Assert
			expect(result.allowed).toBe(true)
		})

		it('should deny operation without proper permissions', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer',
				permissions: ['view_alerts'],
			}

			// Act
			const result = accessControl.validateAlertOperation(userContext, 'acknowledge')

			// Assert
			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Insufficient permissions')
		})

		it('should validate operation with alert access check', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['acknowledge_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-2', // Different organization
			}

			// Act
			const result = accessControl.validateAlertOperation(userContext, 'acknowledge', alert)

			// Assert
			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Access denied to alert')
		})
	})

	describe('User Context Creation', () => {
		it('should create user context with role-based permissions', () => {
			// Act
			const userContext = accessControl.createUserContext('user-1', 'org-1', 'admin')

			// Assert
			expect(userContext.userId).toBe('user-1')
			expect(userContext.organizationId).toBe('org-1')
			expect(userContext.role).toBe('admin')
			expect(userContext.permissions).toContain('view_alerts')
			expect(userContext.permissions).toContain('acknowledge_alerts')
			expect(userContext.permissions).toContain('resolve_alerts')
		})

		it('should create user context with additional context', () => {
			// Act
			const userContext = accessControl.createUserContext('user-1', 'org-1', 'admin', {
				departmentId: 'dept-1',
				teamId: 'team-1',
			})

			// Assert
			expect(userContext.departmentId).toBe('dept-1')
			expect(userContext.teamId).toBe('team-1')
		})

		it('should merge custom permissions with role permissions', () => {
			// Act
			const userContext = accessControl.createUserContext('user-1', 'org-1', 'viewer', {
				customPermissions: ['acknowledge_alerts'],
			})

			// Assert
			expect(userContext.permissions).toContain('view_alerts') // From role
			expect(userContext.permissions).toContain('acknowledge_alerts') // Custom
		})
	})

	describe('Configuration Access Control', () => {
		it('should allow alert config modification with proper permissions', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['configure_thresholds'],
			}

			// Act
			const result = accessControl.canModifyAlertConfig(userContext, 'org-1')

			// Assert
			expect(result).toBe(true)
		})

		it('should deny alert config modification without permissions', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer',
				permissions: ['view_alerts'],
			}

			// Act
			const result = accessControl.canModifyAlertConfig(userContext, 'org-1')

			// Assert
			expect(result).toBe(false)
		})

		it('should deny cross-organization config modification', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['configure_thresholds'],
			}

			// Act
			const result = accessControl.canModifyAlertConfig(userContext, 'org-2')

			// Assert
			expect(result).toBe(false)
		})

		it('should allow maintenance window management with proper permissions', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['manage_maintenance_windows'],
			}

			// Act
			const result = accessControl.canManageMaintenanceWindows(userContext, 'org-1')

			// Assert
			expect(result).toBe(true)
		})
	})

	describe('Cross-Organization Prevention', () => {
		it('should prevent cross-organization access', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			// Act & Assert
			expect(() => {
				accessControl.preventCrossOrganizationAccess(userContext, 'org-2')
			}).toThrow('cannot access resources from organization org-2')
		})

		it('should allow same organization access', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			// Act & Assert
			expect(() => {
				accessControl.preventCrossOrganizationAccess(userContext, 'org-1')
			}).not.toThrow()
		})
	})

	describe('Data Sanitization', () => {
		it('should sanitize alert data for non-admin users', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer',
				permissions: ['view_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-1',
				type: 'failure_rate',
				internalMetadata: { secret: 'data' },
				systemDetails: { internal: 'info' },
			}

			// Act
			const sanitized = accessControl.sanitizeAlertForUser(userContext, alert)

			// Assert
			expect(sanitized).toBeTruthy()
			expect(sanitized.id).toBe('alert-1')
			expect(sanitized.internalMetadata).toBeUndefined()
			expect(sanitized.systemDetails).toBeUndefined()
		})

		it('should preserve internal data for admin users', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['configure_thresholds'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-1',
				type: 'failure_rate',
				internalMetadata: { secret: 'data' },
				systemDetails: { internal: 'info' },
			}

			// Act
			const sanitized = accessControl.sanitizeAlertForUser(userContext, alert)

			// Assert
			expect(sanitized).toBeTruthy()
			expect(sanitized.internalMetadata).toEqual({ secret: 'data' })
			expect(sanitized.systemDetails).toEqual({ internal: 'info' })
		})

		it('should return null for cross-organization alerts', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['view_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-2', // Different organization
				type: 'failure_rate',
			}

			// Act
			const sanitized = accessControl.sanitizeAlertForUser(userContext, alert)

			// Assert
			expect(sanitized).toBeNull()
		})
	})

	describe('Audit Logging', () => {
		it('should create audit log entry with correct information', () => {
			// Arrange
			const userContext: AlertUserContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin',
				permissions: ['acknowledge_alerts'],
				departmentId: 'dept-1',
				teamId: 'team-1',
			}

			// Act
			const auditEntry = accessControl.createAuditLogEntry(
				userContext,
				'acknowledge',
				'alert',
				'alert-123',
				{ alertType: 'failure_rate' }
			)

			// Assert
			expect(auditEntry.userId).toBe('user-1')
			expect(auditEntry.organizationId).toBe('org-1')
			expect(auditEntry.operation).toBe('acknowledge')
			expect(auditEntry.resourceType).toBe('alert')
			expect(auditEntry.resourceId).toBe('alert-123')
			expect(auditEntry.userRole).toBe('admin')
			expect(auditEntry.departmentId).toBe('dept-1')
			expect(auditEntry.teamId).toBe('team-1')
			expect(auditEntry.details.alertType).toBe('failure_rate')
			expect(auditEntry.timestamp).toBeDefined()
		})
	})
})
