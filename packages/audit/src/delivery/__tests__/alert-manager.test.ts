/**
 * Unit tests for AlertManager
 * Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5: Alerting system tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertAccessControl } from '../alert-access-control.js'
import { AlertDebouncer } from '../alert-debouncer.js'
import { AlertManager } from '../alert-manager.js'

import type { DeliveryDatabaseClient } from '../database-client.js'
import type { AlertThresholdConfig, DeliveryAlert } from '../interfaces.js'

// Mock database client
const mockDbClient = {
	getDestination: vi.fn(),
	getDestinationHealth: vi.fn(),
	getDeliveriesInWindow: vi.fn(),
	getQueueStatus: vi.fn(),
	createAlert: vi.fn(),
	getAlert: vi.fn(),
	updateAlertStatus: vi.fn(),
	getActiveAlerts: vi.fn(),
	saveAlertConfig: vi.fn(),
	getAlertConfig: vi.fn(),
	verifyUserOrganizationAccess: vi.fn(),
} as unknown as DeliveryDatabaseClient

describe('AlertManager', () => {
	let alertManager: AlertManager
	let mockDebouncer: AlertDebouncer
	let mockAccessControl: AlertAccessControl

	beforeEach(() => {
		vi.clearAllMocks()
		mockDebouncer = new AlertDebouncer()
		mockAccessControl = new AlertAccessControl()
		alertManager = new AlertManager(mockDbClient, mockDebouncer, mockAccessControl)
	})

	describe('Alert Generation', () => {
		it('should generate consecutive failure alert when threshold exceeded', async () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			vi.mocked(mockDbClient.getDestination).mockResolvedValue({
				id: destinationId,
				organizationId,
				type: 'webhook',
				label: 'Test Webhook',
			})

			vi.mocked(mockDbClient.getDestinationHealth).mockResolvedValue({
				destinationId,
				consecutiveFailures: 6,
				lastFailureAt: new Date().toISOString(),
			})

			vi.mocked(mockDbClient.getDeliveriesInWindow).mockResolvedValue([])
			vi.mocked(mockDbClient.getQueueStatus).mockResolvedValue({
				pendingCount: 0,
				oldestPendingAge: 0,
			})

			vi.mocked(mockDbClient.getAlertConfig).mockResolvedValue({
				organizationId,
				consecutiveFailureThreshold: 5,
				suppressionWindows: [],
			})

			const shouldSendSpy = vi.spyOn(mockDebouncer, 'shouldSendAlert').mockReturnValue(true)
			const createAlertSpy = vi.mocked(mockDbClient.createAlert)

			// Act
			await alertManager.checkFailureThresholds(destinationId)

			// Assert
			expect(shouldSendSpy).toHaveBeenCalledWith(
				'consecutive_failures',
				destinationId,
				organizationId
			)
			expect(createAlertSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'consecutive_failures',
					organizationId,
					destinationId,
					severity: expect.any(String),
					title: 'Consecutive Failures Detected',
				})
			)
		})

		it('should generate failure rate alert when sliding window threshold exceeded', async () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			vi.mocked(mockDbClient.getDestination).mockResolvedValue({
				id: destinationId,
				organizationId,
				type: 'webhook',
				label: 'Test Webhook',
			})

			vi.mocked(mockDbClient.getDeliveriesInWindow).mockResolvedValue([
				{ id: '1', status: 'failed' },
				{ id: '2', status: 'failed' },
				{ id: '3', status: 'completed' },
				{ id: '4', status: 'failed' },
				{ id: '5', status: 'completed' },
				{ id: '6', status: 'failed' },
				{ id: '7', status: 'completed' },
				{ id: '8', status: 'failed' },
				{ id: '9', status: 'completed' },
				{ id: '10', status: 'failed' },
				{ id: '11', status: 'completed' },
				{ id: '12', status: 'failed' },
			])

			vi.mocked(mockDbClient.getAlertConfig).mockResolvedValue({
				organizationId,
				failureRateThreshold: 50, // 50%
				suppressionWindows: [],
			})

			vi.mocked(mockDbClient.getDestinationHealth).mockResolvedValue(null)
			vi.mocked(mockDbClient.getQueueStatus).mockResolvedValue({
				pendingCount: 0,
				oldestPendingAge: 0,
			})

			const shouldSendSpy = vi.spyOn(mockDebouncer, 'shouldSendAlert').mockReturnValue(true)
			const createAlertSpy = vi.mocked(mockDbClient.createAlert)

			// Act
			await alertManager.checkFailureThresholds(destinationId)

			// Assert
			expect(shouldSendSpy).toHaveBeenCalledWith('failure_rate', destinationId, organizationId)
			expect(createAlertSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'failure_rate',
					organizationId,
					destinationId,
					title: 'High Failure Rate Detected',
				})
			)
		})

		it('should generate queue backlog alert when threshold exceeded', async () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			vi.mocked(mockDbClient.getDestination).mockResolvedValue({
				id: destinationId,
				organizationId,
				type: 'webhook',
				label: 'Test Webhook',
			})

			vi.mocked(mockDbClient.getQueueStatus).mockResolvedValue({
				pendingCount: 1500,
				oldestPendingAge: 300000, // 5 minutes
			})

			vi.mocked(mockDbClient.getAlertConfig).mockResolvedValue({
				organizationId,
				queueBacklogThreshold: 1000,
				suppressionWindows: [],
			})

			const shouldSendSpy = vi.spyOn(mockDebouncer, 'shouldSendAlert').mockReturnValue(true)
			const createAlertSpy = vi.mocked(mockDbClient.createAlert)

			// Act
			await alertManager.checkFailureThresholds(destinationId)

			// Assert
			expect(shouldSendSpy).toHaveBeenCalledWith('queue_backlog', '', organizationId)
			expect(createAlertSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'queue_backlog',
					organizationId,
					destinationId: '',
					title: 'Queue Backlog Alert',
				})
			)
		})

		it('should not generate alert when debounced', async () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			vi.mocked(mockDbClient.getDestination).mockResolvedValue({
				id: destinationId,
				organizationId,
			})

			vi.mocked(mockDbClient.getDestinationHealth).mockResolvedValue({
				destinationId,
				consecutiveFailures: 6,
			})

			vi.mocked(mockDbClient.getAlertConfig).mockResolvedValue({
				organizationId,
				consecutiveFailureThreshold: 5,
				suppressionWindows: [],
			})

			const shouldSendSpy = vi.spyOn(mockDebouncer, 'shouldSendAlert').mockReturnValue(false)
			const createAlertSpy = vi.mocked(mockDbClient.createAlert)

			// Act
			await alertManager.checkFailureThresholds(destinationId)

			// Assert
			expect(shouldSendSpy).toHaveBeenCalled()
			expect(createAlertSpy).not.toHaveBeenCalled()
		})
	})

	describe('Alert Operations', () => {
		it('should acknowledge alert successfully', async () => {
			// Arrange
			const alertId = 'alert-123'
			const userId = 'user-1'
			const alert = {
				id: alertId,
				organizationId: 'org-1',
				type: 'consecutive_failures',
			}

			vi.mocked(mockDbClient.getAlert).mockResolvedValue(alert)
			vi.mocked(mockDbClient.verifyUserOrganizationAccess).mockResolvedValue(true)
			const updateAlertSpy = vi.mocked(mockDbClient.updateAlertStatus)

			// Act
			await alertManager.acknowledgeAlert(alertId, userId)

			// Assert
			expect(updateAlertSpy).toHaveBeenCalledWith(alertId, 'acknowledged', {
				acknowledgedBy: userId,
				acknowledgedAt: expect.any(String),
			})
		})

		it('should resolve alert and reset debounce state', async () => {
			// Arrange
			const alertId = 'alert-123'
			const userId = 'user-1'
			const notes = 'Issue resolved'
			const alert = {
				id: alertId,
				organizationId: 'org-1',
				type: 'consecutive_failures',
				destinationId: '123',
			}

			vi.mocked(mockDbClient.getAlert).mockResolvedValue(alert)
			vi.mocked(mockDbClient.verifyUserOrganizationAccess).mockResolvedValue(true)
			const updateAlertSpy = vi.mocked(mockDbClient.updateAlertStatus)
			const resetDebounceSpy = vi.spyOn(mockDebouncer, 'resetDebounceState')

			// Act
			await alertManager.resolveAlert(alertId, userId, notes)

			// Assert
			expect(updateAlertSpy).toHaveBeenCalledWith(alertId, 'resolved', {
				resolvedBy: userId,
				resolvedAt: expect.any(String),
				notes,
			})
			expect(resetDebounceSpy).toHaveBeenCalledWith(
				alert.type,
				alert.destinationId,
				alert.organizationId
			)
		})

		it('should configure alert thresholds', async () => {
			// Arrange
			const organizationId = 'org-1'
			const config: AlertThresholdConfig = {
				failureRateThreshold: 15,
				consecutiveFailureThreshold: 8,
				queueBacklogThreshold: 2000,
				responseTimeThreshold: 45000,
				debounceWindow: 20,
				escalationDelay: 90,
			}

			const saveConfigSpy = vi.mocked(mockDbClient.saveAlertConfig)

			// Act
			await alertManager.configureAlertThresholds(organizationId, config)

			// Assert
			expect(saveConfigSpy).toHaveBeenCalledWith(organizationId, expect.objectContaining(config))
		})
	})

	describe('Organizational Isolation', () => {
		it('should allow user to access alerts from their organization', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin' as const,
				permissions: ['view_alerts', 'acknowledge_alerts', 'resolve_alerts'],
			}

			const alerts = [
				{ id: 'alert-1', organizationId: 'org-1', type: 'failure_rate' },
				{ id: 'alert-2', organizationId: 'org-1', type: 'consecutive_failures' },
			]

			vi.mocked(mockDbClient.getActiveAlerts).mockResolvedValue(alerts)
			const filterAlertsSpy = vi.spyOn(mockAccessControl, 'filterAlerts').mockReturnValue(alerts)

			// Act
			const result = await alertManager.getAlertsForUser(userContext)

			// Assert
			expect(result).toEqual(alerts)
			expect(filterAlertsSpy).toHaveBeenCalledWith(userContext, alerts)
		})

		it('should prevent cross-organization alert access', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin' as const,
				permissions: ['acknowledge_alerts'],
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-2', // Different organization
				type: 'failure_rate',
			}

			vi.mocked(mockDbClient.getAlert).mockResolvedValue(alert)

			// Act & Assert
			await expect(alertManager.acknowledgeAlertWithAuth('alert-1', userContext)).rejects.toThrow(
				'Access denied'
			)
		})

		it('should deny access when user lacks permissions', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer' as const,
				permissions: ['view_alerts'], // No acknowledge permission
			}

			const alert = {
				id: 'alert-1',
				organizationId: 'org-1',
				type: 'failure_rate',
			}

			vi.mocked(mockDbClient.getAlert).mockResolvedValue(alert)

			// Act & Assert
			await expect(alertManager.acknowledgeAlertWithAuth('alert-1', userContext)).rejects.toThrow(
				'Access denied: Insufficient permissions'
			)
		})
	})

	describe('Maintenance Windows', () => {
		it('should add maintenance window with access control', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin' as const,
				permissions: ['manage_maintenance_windows'],
			}

			const window = {
				id: 'mw-1',
				destinationId: '123',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
				timezone: 'UTC',
				reason: 'Scheduled maintenance',
				suppressAlertTypes: ['consecutive_failures' as const],
			}

			const addWindowSpy = vi.spyOn(mockDebouncer, 'addMaintenanceWindow')

			// Act
			await alertManager.addMaintenanceWindowWithAuth(userContext, window)

			// Assert
			expect(addWindowSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					...window,
					organizationId: userContext.organizationId,
					createdBy: userContext.userId,
				})
			)
		})

		it('should deny maintenance window creation without permissions', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'viewer' as const,
				permissions: ['view_alerts'], // No maintenance window permission
			}

			const window = {
				id: 'mw-1',
				startTime: new Date().toISOString(),
				endTime: new Date(Date.now() + 3600000).toISOString(),
				timezone: 'UTC',
				reason: 'Scheduled maintenance',
				suppressAlertTypes: ['consecutive_failures' as const],
			}

			// Act & Assert
			await expect(alertManager.addMaintenanceWindowWithAuth(userContext, window)).rejects.toThrow(
				'Access denied: Insufficient permissions to manage maintenance windows'
			)
		})
	})

	describe('Alert Suppression', () => {
		it('should suppress alerts with proper access control', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin' as const,
				permissions: ['suppress_alerts'],
			}

			const destinationId = '123'
			const destination = {
				id: destinationId,
				organizationId: 'org-1',
			}

			vi.mocked(mockDbClient.getDestination).mockResolvedValue(destination)
			const suppressSpy = vi.spyOn(mockDebouncer, 'suppressAlerts')

			// Act
			await alertManager.suppressAlertsWithAuth(
				userContext,
				'consecutive_failures',
				destinationId,
				60
			)

			// Assert
			expect(suppressSpy).toHaveBeenCalledWith(
				'consecutive_failures',
				destinationId,
				userContext.organizationId,
				60
			)
		})

		it('should prevent suppression of alerts for other organizations', async () => {
			// Arrange
			const userContext = {
				userId: 'user-1',
				organizationId: 'org-1',
				role: 'admin' as const,
				permissions: ['suppress_alerts'],
			}

			const destinationId = '123'
			const destination = {
				id: destinationId,
				organizationId: 'org-2', // Different organization
			}

			vi.mocked(mockDbClient.getDestination).mockResolvedValue(destination)

			// Act & Assert
			await expect(
				alertManager.suppressAlertsWithAuth(userContext, 'consecutive_failures', destinationId, 60)
			).rejects.toThrow('Access denied')
		})
	})

	describe('Alert Escalation', () => {
		it('should escalate alert when conditions are met', async () => {
			// Arrange
			const alert: DeliveryAlert = {
				id: 'alert-1',
				organizationId: 'org-1',
				destinationId: '123',
				type: 'consecutive_failures',
				severity: 'medium',
				title: 'Consecutive Failures',
				description: 'Multiple failures detected',
				metadata: {},
				createdAt: new Date().toISOString(),
			}

			vi.spyOn(mockDebouncer, 'shouldSendAlert').mockReturnValue(true)
			vi.spyOn(mockDebouncer, 'shouldEscalateAlert').mockReturnValue({
				shouldEscalate: true,
				newSeverity: 'high',
				channels: ['email', 'slack'],
			})

			const createAlertSpy = vi.mocked(mockDbClient.createAlert)

			// Act
			await alertManager.sendAlert(alert)

			// Assert
			expect(createAlertSpy).toHaveBeenCalledTimes(2) // Original + escalated
			expect(createAlertSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					severity: 'high',
					title: '[ESCALATED] Consecutive Failures',
					metadata: expect.objectContaining({
						escalated: true,
						originalAlertId: alert.id,
					}),
				})
			)
		})
	})
})
