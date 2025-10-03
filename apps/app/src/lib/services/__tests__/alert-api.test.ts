/**
 * Alert API Service Tests
 *
 * Basic tests to verify the alert API service integration
 */

import { AuditClient } from '@smedrec/audit-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AlertApiService, AlertApiServiceError } from '../alert-api'

// Mock the audit client
vi.mock('@smedrec/audit-client')

describe('AlertApiService', () => {
	let mockAuditClient: any
	let mockMetricsService: any
	let alertApiService: AlertApiService

	beforeEach(() => {
		mockMetricsService = {
			getAlerts: vi.fn(),
			getAlert: vi.fn(),
			getAlertStatistics: vi.fn(),
			acknowledgeAlert: vi.fn(),
			resolveAlert: vi.fn(),
			suppressAlert: vi.fn(),
		}

		mockAuditClient = {
			metrics: mockMetricsService,
		}

		alertApiService = new AlertApiService(mockAuditClient as AuditClient)
	})

	describe('getAlerts', () => {
		it('should transform UI filters to API parameters', async () => {
			const mockResponse = {
				alerts: [],
				pagination: {
					page: 1,
					pageSize: 10,
					total: 0,
					totalPages: 0,
				},
			}

			mockMetricsService.getAlerts.mockResolvedValue(mockResponse)

			const request = {
				organizationId: 'test-org',
				filters: {
					severity: ['CRITICAL', 'HIGH'],
					status: ['active'],
					dateRange: {
						start: new Date('2024-01-01'),
						end: new Date('2024-01-31'),
					},
				},
			}

			await alertApiService.getAlerts(request)

			expect(mockMetricsService.getAlerts).toHaveBeenCalledWith({
				severity: ['CRITICAL', 'HIGH'],
				status: ['active'],
				startDate: '2024-01-01T00:00:00.000Z',
				endDate: '2024-01-31T00:00:00.000Z',
			})
		})

		it('should handle API errors gracefully', async () => {
			const apiError = new Error('API Error')
			mockMetricsService.getAlerts.mockRejectedValue(apiError)

			const request = {
				organizationId: 'test-org',
			}

			await expect(alertApiService.getAlerts(request)).rejects.toThrow(AlertApiServiceError)
		})
	})

	describe('acknowledgeAlert', () => {
		it('should call metrics service with correct parameters', async () => {
			const mockAlert = {
				id: 'alert-1',
				title: 'Test Alert',
				status: 'acknowledged',
			}

			mockMetricsService.acknowledgeAlert.mockResolvedValue(mockAlert)

			const request = {
				alertId: 'alert-1',
				action: 'acknowledge' as const,
				userId: 'user-1',
				notes: 'Test acknowledgment',
			}

			const result = await alertApiService.acknowledgeAlert(request)

			expect(mockMetricsService.acknowledgeAlert).toHaveBeenCalledWith('alert-1', {
				acknowledgedBy: 'user-1',
				notes: 'Test acknowledgment',
			})

			expect(result.success).toBe(true)
			expect(result.message).toBe('Alert acknowledged successfully')
		})
	})

	describe('performBulkAction', () => {
		it('should handle bulk acknowledge operations', async () => {
			const mockAlert = {
				id: 'alert-1',
				title: 'Test Alert',
				status: 'acknowledged',
			}

			mockMetricsService.acknowledgeAlert.mockResolvedValue(mockAlert)

			const request = {
				organizationId: 'test-org',
				bulkAction: {
					type: 'acknowledge' as const,
					alertIds: ['alert-1', 'alert-2'],
					userId: 'user-1',
					notes: 'Bulk acknowledgment',
				},
			}

			const result = await alertApiService.performBulkAction(request)

			expect(result.processed).toBe(2)
			expect(result.failed).toBe(0)
			expect(result.success).toBe(true)
		})

		it('should handle partial failures in bulk operations', async () => {
			mockMetricsService.acknowledgeAlert
				.mockResolvedValueOnce({ id: 'alert-1' })
				.mockRejectedValueOnce(new Error('Failed'))

			const request = {
				organizationId: 'test-org',
				bulkAction: {
					type: 'acknowledge' as const,
					alertIds: ['alert-1', 'alert-2'],
					userId: 'user-1',
				},
			}

			const result = await alertApiService.performBulkAction(request)

			expect(result.processed).toBe(1)
			expect(result.failed).toBe(1)
			expect(result.success).toBe(false)
			expect(result.errors).toHaveLength(1)
		})
	})

	describe('retry logic', () => {
		it('should retry on retryable errors', async () => {
			const retryableError = new Error('Network error')
			mockMetricsService.getAlerts
				.mockRejectedValueOnce(retryableError)
				.mockRejectedValueOnce(retryableError)
				.mockResolvedValueOnce({ alerts: [], pagination: {} })

			const request = { organizationId: 'test-org' }

			await alertApiService.getAlerts(request)

			expect(mockMetricsService.getAlerts).toHaveBeenCalledTimes(3)
		})
	})
})
