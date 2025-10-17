/**
 * Unit tests for AlertDebouncer
 * Requirements 7.4, 7.5: Alert debouncing and rate limiting tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertDebouncer } from '../alert-debouncer.js'

import type { AlertType } from '../alert-manager.js'

describe('AlertDebouncer', () => {
	let debouncer: AlertDebouncer

	beforeEach(() => {
		debouncer = new AlertDebouncer()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('Alert Debouncing', () => {
		it('should allow first alert for new combination', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Act
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should debounce alerts within cooldown period', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Act - try to send another alert immediately
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(false)
		})

		it('should allow alert after cooldown period expires', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Act - advance time past cooldown period (30 minutes for consecutive_failures)
			vi.advanceTimersByTime(31 * 60 * 1000)
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should enforce rate limiting within time window', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Use custom config with shorter cooldown for testing
			const customConfig = {
				windowMinutes: 10,
				cooldownMinutes: 2, // Short cooldown for testing
				maxAlertsPerWindow: 2,
				escalationDelayMinutes: 30,
			}

			// Send first alert
			expect(
				debouncer.shouldSendAlert(alertType, destinationId, organizationId, customConfig)
			).toBe(true)

			// Advance time past cooldown but within window
			vi.advanceTimersByTime(3 * 60 * 1000) // 3 minutes > 2 minute cooldown

			// Send second alert (should be allowed)
			expect(
				debouncer.shouldSendAlert(alertType, destinationId, organizationId, customConfig)
			).toBe(true)

			// Advance time past cooldown again but still within window
			vi.advanceTimersByTime(3 * 60 * 1000) // Total 6 minutes < 10 minute window

			// Try to send third alert (should be blocked by rate limit - max 2 per window)
			const result = debouncer.shouldSendAlert(
				alertType,
				destinationId,
				organizationId,
				customConfig
			)

			// Assert
			expect(result).toBe(false)
		})

		it('should reset window after window period expires', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Use custom config with shorter cooldown for testing
			const customConfig = {
				windowMinutes: 10,
				cooldownMinutes: 2,
				maxAlertsPerWindow: 2,
				escalationDelayMinutes: 30,
			}

			// Fill up the rate limit
			debouncer.shouldSendAlert(alertType, destinationId, organizationId, customConfig)
			vi.advanceTimersByTime(3 * 60 * 1000)
			debouncer.shouldSendAlert(alertType, destinationId, organizationId, customConfig)

			// Act - advance time past window period (10 minutes for consecutive_failures)
			vi.advanceTimersByTime(11 * 60 * 1000) // Total 14 minutes > 10 minute window
			const result = debouncer.shouldSendAlert(
				alertType,
				destinationId,
				organizationId,
				customConfig
			)

			// Assert
			expect(result).toBe(true)
		})

		it('should handle different alert types independently', () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send consecutive_failures alert
			expect(debouncer.shouldSendAlert('consecutive_failures', destinationId, organizationId)).toBe(
				true
			)

			// Act - send failure_rate alert (different type)
			const result = debouncer.shouldSendAlert('failure_rate', destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should handle different destinations independently', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const organizationId = 'org-1'

			// Send alert for destination 1
			expect(debouncer.shouldSendAlert(alertType, '123', organizationId)).toBe(true)

			// Act - send alert for destination 2
			const result = debouncer.shouldSendAlert(alertType, '456', organizationId)

			// Assert
			expect(result).toBe(true)
		})
	})

	describe('Alert Escalation', () => {
		it('should not escalate immediately after first alert', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Act
			const result = debouncer.shouldEscalateAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result.shouldEscalate).toBe(false)
		})

		it('should escalate after escalation delay', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert to create state
			expect(debouncer.shouldSendAlert(alertType, destinationId, organizationId)).toBe(true)

			// Act - advance time past escalation delay (60 minutes for first escalation)
			vi.advanceTimersByTime(61 * 60 * 1000)
			const result = debouncer.shouldEscalateAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result.shouldEscalate).toBe(true)
			expect(result.newSeverity).toBe('medium')
			expect(result.channels).toContain('email')
		})

		it('should escalate through multiple levels', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert to create state
			expect(debouncer.shouldSendAlert(alertType, destinationId, organizationId)).toBe(true)

			// First escalation
			vi.advanceTimersByTime(61 * 60 * 1000)
			const firstEscalation = debouncer.shouldEscalateAlert(
				alertType,
				destinationId,
				organizationId
			)
			expect(firstEscalation.shouldEscalate).toBe(true)
			expect(firstEscalation.newSeverity).toBe('medium')

			// Act - second escalation (240 - 60 = 180 minutes later)
			vi.advanceTimersByTime(180 * 60 * 1000)
			const secondEscalation = debouncer.shouldEscalateAlert(
				alertType,
				destinationId,
				organizationId
			)

			// Assert
			expect(secondEscalation.shouldEscalate).toBe(true)
			expect(secondEscalation.newSeverity).toBe('high')
			expect(secondEscalation.channels).toContain('pagerduty')
		})
	})

	describe('Maintenance Windows', () => {
		it('should suppress alerts during maintenance window', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			const now = new Date()
			const maintenanceWindow = {
				id: 'mw-1',
				organizationId,
				destinationId,
				startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // Started 30 min ago
				endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // Ends in 30 min
				timezone: 'UTC',
				reason: 'Scheduled maintenance',
				suppressAlertTypes: [alertType],
				createdBy: 'admin',
			}

			debouncer.addMaintenanceWindow(maintenanceWindow)

			// Act
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(false)
		})

		it('should allow alerts outside maintenance window', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			const now = new Date()
			const maintenanceWindow = {
				id: 'mw-1',
				organizationId,
				destinationId,
				startTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), // Starts in 1 hour
				endTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(), // Ends in 2 hours
				timezone: 'UTC',
				reason: 'Scheduled maintenance',
				suppressAlertTypes: [alertType],
				createdBy: 'admin',
			}

			debouncer.addMaintenanceWindow(maintenanceWindow)

			// Act
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should allow alerts for different alert types during maintenance', () => {
			// Arrange
			const destinationId = '123'
			const organizationId = 'org-1'

			const now = new Date()
			const maintenanceWindow = {
				id: 'mw-1',
				organizationId,
				destinationId,
				startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
				endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
				timezone: 'UTC',
				reason: 'Scheduled maintenance',
				suppressAlertTypes: ['consecutive_failures' as AlertType], // Only suppress consecutive_failures
				createdBy: 'admin',
			}

			debouncer.addMaintenanceWindow(maintenanceWindow)

			// Act
			const result = debouncer.shouldSendAlert('failure_rate', destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should get active maintenance windows for organization', () => {
			// Arrange
			const organizationId = 'org-1'
			const now = new Date()

			const activeWindow = {
				id: 'mw-1',
				organizationId,
				startTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
				endTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
				timezone: 'UTC',
				reason: 'Active maintenance',
				suppressAlertTypes: ['consecutive_failures' as AlertType],
				createdBy: 'admin',
			}

			const expiredWindow = {
				id: 'mw-2',
				organizationId,
				startTime: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
				endTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
				timezone: 'UTC',
				reason: 'Expired maintenance',
				suppressAlertTypes: ['failure_rate' as AlertType],
				createdBy: 'admin',
			}

			debouncer.addMaintenanceWindow(activeWindow)
			debouncer.addMaintenanceWindow(expiredWindow)

			// Act
			const activeWindows = debouncer.getActiveMaintenanceWindows(organizationId)

			// Assert
			expect(activeWindows).toHaveLength(1)
			expect(activeWindows[0].id).toBe('mw-1')
		})
	})

	describe('Alert Suppression', () => {
		it('should suppress alerts for specified period', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert to create state
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Suppress alerts for 60 minutes
			debouncer.suppressAlerts(alertType, destinationId, organizationId, 60)

			// Act - advance time past cooldown but within suppression
			vi.advanceTimersByTime(31 * 60 * 1000)
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(false)
		})

		it('should allow alerts after suppression period expires', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send first alert and suppress
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)
			debouncer.suppressAlerts(alertType, destinationId, organizationId, 60)

			// Act - advance time past suppression period
			vi.advanceTimersByTime(61 * 60 * 1000)
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})
	})

	describe('State Management', () => {
		it('should reset debounce state', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Send alert to create state
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Reset state
			debouncer.resetDebounceState(alertType, destinationId, organizationId)

			// Act - should allow immediate alert after reset
			const result = debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			// Assert
			expect(result).toBe(true)
		})

		it('should provide debounce statistics', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Create some state
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)
			debouncer.suppressAlerts(alertType, destinationId, organizationId, 60)

			// Act
			const stats = debouncer.getDebounceStats()

			// Assert
			expect(stats.activeStates).toBeGreaterThan(0)
			expect(stats.suppressedAlerts).toBeGreaterThan(0)
		})

		it('should cleanup expired states and windows', () => {
			// Arrange
			const alertType: AlertType = 'consecutive_failures'
			const destinationId = '123'
			const organizationId = 'org-1'

			// Create state and expired maintenance window
			debouncer.shouldSendAlert(alertType, destinationId, organizationId)

			const now = new Date()
			const expiredWindow = {
				id: 'mw-1',
				organizationId,
				startTime: new Date(now.getTime() - 120 * 60 * 1000).toISOString(),
				endTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
				timezone: 'UTC',
				reason: 'Expired maintenance',
				suppressAlertTypes: [alertType],
				createdBy: 'admin',
			}

			debouncer.addMaintenanceWindow(expiredWindow)

			// Act
			debouncer.cleanup()

			// Assert
			const activeWindows = debouncer.getActiveMaintenanceWindows(organizationId)
			expect(activeWindows).toHaveLength(0)
		})
	})
})
