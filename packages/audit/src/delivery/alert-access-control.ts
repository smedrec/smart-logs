/**
 * Alert access control and organizational isolation
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5: Organizational isolation and access control
 */

/**
 * User role for alert access control
 */
export type AlertRole = 'viewer' | 'operator' | 'admin' | 'owner'

/**
 * Alert permission for specific operations
 */
export type AlertPermission =
	| 'view_alerts'
	| 'acknowledge_alerts'
	| 'resolve_alerts'
	| 'configure_thresholds'
	| 'manage_maintenance_windows'
	| 'suppress_alerts'
	| 'escalate_alerts'

/**
 * User context for alert operations
 */
export interface AlertUserContext {
	userId: string
	organizationId: string
	role: AlertRole
	permissions: AlertPermission[]
	departmentId?: string
	teamId?: string
}

/**
 * Alert scope for organizational isolation
 */
export interface AlertScope {
	organizationId: string
	destinationIds?: string[] // Optional - restrict to specific destinations
	alertTypes?: string[] // Optional - restrict to specific alert types
	departmentId?: string // Optional - department-level isolation
	teamId?: string // Optional - team-level isolation
}

/**
 * Alert configuration with organizational isolation
 */
export interface OrganizationalAlertConfig {
	organizationId: string
	departmentId?: string
	teamId?: string
	thresholds: {
		failureRateThreshold: number
		consecutiveFailureThreshold: number
		queueBacklogThreshold: number
		responseTimeThreshold: number
	}
	debouncing: {
		debounceWindow: number
		cooldownPeriod: number
		maxAlertsPerWindow: number
	}
	escalation: {
		enabled: boolean
		levels: Array<{
			delayMinutes: number
			severity: string
			notificationChannels: string[]
			assignees: string[]
		}>
	}
	notifications: {
		channels: Array<{
			type: 'email' | 'slack' | 'webhook' | 'pagerduty'
			config: Record<string, any>
			enabled: boolean
		}>
		defaultAssignees: string[]
		escalationAssignees: string[]
	}
	suppressionRules: Array<{
		id: string
		name: string
		conditions: Record<string, any>
		suppressAlertTypes: string[]
		enabled: boolean
	}>
}

/**
 * Alert access control manager for organizational isolation
 */
export class AlertAccessControl {
	private readonly rolePermissions: Record<AlertRole, AlertPermission[]> = {
		viewer: ['view_alerts'],
		operator: ['view_alerts', 'acknowledge_alerts'],
		admin: [
			'view_alerts',
			'acknowledge_alerts',
			'resolve_alerts',
			'configure_thresholds',
			'manage_maintenance_windows',
			'suppress_alerts',
		],
		owner: [
			'view_alerts',
			'acknowledge_alerts',
			'resolve_alerts',
			'configure_thresholds',
			'manage_maintenance_windows',
			'suppress_alerts',
			'escalate_alerts',
		],
	}

	/**
	 * Verify user has permission for alert operation
	 * Requirements 6.1, 6.2, 6.3: Access control and permission validation
	 */
	hasPermission(userContext: AlertUserContext, permission: AlertPermission): boolean {
		return userContext.permissions.includes(permission)
	}

	/**
	 * Verify user can access alerts for organization
	 * Requirements 6.1, 6.2, 6.3: Organizational isolation
	 */
	canAccessOrganization(userContext: AlertUserContext, organizationId: string): boolean {
		return userContext.organizationId === organizationId
	}

	/**
	 * Verify user can access specific alert
	 * Requirements 6.1, 6.2, 6.3, 6.4: Alert access control
	 */
	canAccessAlert(userContext: AlertUserContext, alert: any): boolean {
		// Check organization access
		if (!this.canAccessOrganization(userContext, alert.organizationId)) {
			return false
		}

		// Check department-level isolation if applicable
		if (
			userContext.departmentId &&
			alert.departmentId &&
			userContext.departmentId !== alert.departmentId
		) {
			return false
		}

		// Check team-level isolation if applicable
		if (userContext.teamId && alert.teamId && userContext.teamId !== alert.teamId) {
			return false
		}

		return true
	}

	/**
	 * Verify user can access destination
	 * Requirements 6.1, 6.2, 6.3: Destination access control
	 */
	canAccessDestination(userContext: AlertUserContext, destination: any): boolean {
		// Check organization access
		if (!this.canAccessOrganization(userContext, destination.organizationId)) {
			return false
		}

		// Additional destination-specific access control can be added here
		// For example, department or team-based destination access

		return true
	}

	/**
	 * Filter alerts based on user access
	 * Requirements 6.1, 6.2, 6.3: Alert filtering and isolation
	 */
	filterAlerts(userContext: AlertUserContext, alerts: any[]): any[] {
		return alerts.filter((alert) => this.canAccessAlert(userContext, alert))
	}

	/**
	 * Filter destinations based on user access
	 * Requirements 6.1, 6.2, 6.3: Destination filtering and isolation
	 */
	filterDestinations(userContext: AlertUserContext, destinations: any[]): any[] {
		return destinations.filter((destination) => this.canAccessDestination(userContext, destination))
	}

	/**
	 * Create alert scope for user context
	 * Requirements 6.1, 6.2, 6.3: Scope-based access control
	 */
	createAlertScope(
		userContext: AlertUserContext,
		additionalFilters?: {
			destinationIds?: string[]
			alertTypes?: string[]
		}
	): AlertScope {
		return {
			organizationId: userContext.organizationId,
			destinationIds: additionalFilters?.destinationIds,
			alertTypes: additionalFilters?.alertTypes,
			departmentId: userContext.departmentId,
			teamId: userContext.teamId,
		}
	}

	/**
	 * Validate alert operation against user permissions
	 * Requirements 6.1, 6.2, 6.3, 6.4: Operation validation
	 */
	validateAlertOperation(
		userContext: AlertUserContext,
		operation: 'view' | 'acknowledge' | 'resolve' | 'configure' | 'suppress',
		alert?: any
	): { allowed: boolean; reason?: string } {
		// Map operations to permissions
		const operationPermissions: Record<string, AlertPermission> = {
			view: 'view_alerts',
			acknowledge: 'acknowledge_alerts',
			resolve: 'resolve_alerts',
			configure: 'configure_thresholds',
			suppress: 'suppress_alerts',
		}

		const requiredPermission = operationPermissions[operation]
		if (!requiredPermission) {
			return { allowed: false, reason: 'Invalid operation' }
		}

		// Check permission
		if (!this.hasPermission(userContext, requiredPermission)) {
			return { allowed: false, reason: 'Insufficient permissions' }
		}

		// Check alert access if alert is provided
		if (alert && !this.canAccessAlert(userContext, alert)) {
			return { allowed: false, reason: 'Access denied to alert' }
		}

		return { allowed: true }
	}

	/**
	 * Get user permissions based on role
	 * Requirements 6.4, 6.5: Role-based access control
	 */
	getPermissionsForRole(role: AlertRole): AlertPermission[] {
		return [...this.rolePermissions[role]]
	}

	/**
	 * Create user context with role-based permissions
	 * Requirements 6.4, 6.5: User context creation
	 */
	createUserContext(
		userId: string,
		organizationId: string,
		role: AlertRole,
		additionalContext?: {
			departmentId?: string
			teamId?: string
			customPermissions?: AlertPermission[]
		}
	): AlertUserContext {
		const basePermissions = this.getPermissionsForRole(role)
		const customPermissions = additionalContext?.customPermissions || []

		// Merge permissions (custom permissions can extend but not reduce base permissions)
		const allPermissions = [...new Set([...basePermissions, ...customPermissions])]

		return {
			userId,
			organizationId,
			role,
			permissions: allPermissions,
			departmentId: additionalContext?.departmentId,
			teamId: additionalContext?.teamId,
		}
	}

	/**
	 * Validate organizational alert configuration access
	 * Requirements 6.4, 6.5: Configuration access control
	 */
	canModifyAlertConfig(userContext: AlertUserContext, organizationId: string): boolean {
		return (
			this.canAccessOrganization(userContext, organizationId) &&
			this.hasPermission(userContext, 'configure_thresholds')
		)
	}

	/**
	 * Validate maintenance window management access
	 * Requirements 6.4, 6.5: Maintenance window access control
	 */
	canManageMaintenanceWindows(userContext: AlertUserContext, organizationId: string): boolean {
		return (
			this.canAccessOrganization(userContext, organizationId) &&
			this.hasPermission(userContext, 'manage_maintenance_windows')
		)
	}

	/**
	 * Create audit log entry for alert operations
	 * Requirements 6.1, 6.2, 6.3: Audit trail for security
	 */
	createAuditLogEntry(
		userContext: AlertUserContext,
		operation: string,
		resourceType: 'alert' | 'destination' | 'config' | 'maintenance_window',
		resourceId: string,
		details?: Record<string, any>
	): any {
		return {
			timestamp: new Date().toISOString(),
			userId: userContext.userId,
			organizationId: userContext.organizationId,
			operation,
			resourceType,
			resourceId,
			userRole: userContext.role,
			departmentId: userContext.departmentId,
			teamId: userContext.teamId,
			details: details || {},
		}
	}

	/**
	 * Prevent cross-organization alert access
	 * Requirements 6.1, 6.2, 6.3: Cross-organization prevention
	 */
	preventCrossOrganizationAccess(
		userContext: AlertUserContext,
		targetOrganizationId: string
	): void {
		if (userContext.organizationId !== targetOrganizationId) {
			throw new Error(
				`Access denied: User ${userContext.userId} from organization ${userContext.organizationId} ` +
					`cannot access resources from organization ${targetOrganizationId}`
			)
		}
	}

	/**
	 * Sanitize alert data for user context
	 * Requirements 6.1, 6.2, 6.3: Data sanitization
	 */
	sanitizeAlertForUser(userContext: AlertUserContext, alert: any): any {
		// Remove sensitive information based on user permissions
		const sanitized = { ...alert }

		// Remove internal system details for non-admin users
		if (!this.hasPermission(userContext, 'configure_thresholds')) {
			delete sanitized.internalMetadata
			delete sanitized.systemDetails
		}

		// Remove cross-organization references
		if (sanitized.organizationId !== userContext.organizationId) {
			return null
		}

		return sanitized
	}
}

/**
 * Factory function for creating alert access control
 */
export function createAlertAccessControl(): AlertAccessControl {
	return new AlertAccessControl()
}
