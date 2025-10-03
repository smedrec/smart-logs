/**
 * Alert API Service Layer
 *
 * Integrates with the Audit Client MetricsService to provide alert management functionality.
 * Includes error handling, retry logic, and data transformation utilities.
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import { AuditClient, AuditClientError } from '@smedrec/audit-client'

import type { AlertAction, AlertStatistics, AlertUI } from '@/components/alerts/types/alert-types'
import type {
	AlertActionRequest,
	AlertActionResponse,
	AlertApiError,
	AlertBulkActionRequest,
	AlertBulkActionResponse,
	AlertListRequest,
	AlertListResponse,
} from '@/components/alerts/types/api-types'
import type { AlertFilters } from '@/components/alerts/types/filter-types'
import type {
	AcknowledgeAlertRequest,
	Alert,
	AlertsParams,
	MetricsService,
	PaginatedAlerts,
	ResolveAlertRequest,
} from '@smedrec/audit-client'

/**
 * Configuration for the Alert API Service
 */
export interface AlertApiServiceConfig {
	retryAttempts?: number
	retryDelay?: number
	timeout?: number
	enableCache?: boolean
	cacheTtl?: number
}

/**
 * Default configuration for the Alert API Service
 */
const DEFAULT_CONFIG: Required<AlertApiServiceConfig> = {
	retryAttempts: 3,
	retryDelay: 1000,
	timeout: 30000,
	enableCache: false,
	cacheTtl: 60000, // 1 minute
}

/**
 * Alert API Service Error
 */
export class AlertApiServiceError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly originalError?: Error,
		public readonly requestId?: string
	) {
		super(message)
		this.name = 'AlertApiServiceError'
	}
}

/**
 * Alert API Service
 *
 * Provides a high-level interface for alert management operations using the Audit Client.
 */
export class AlertApiService {
	private metricsService: MetricsService
	private config: Required<AlertApiServiceConfig>
	private cache = new Map<string, { data: any; timestamp: number }>()

	constructor(
		private auditClient: AuditClient,
		config: AlertApiServiceConfig = {}
	) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.metricsService = auditClient.metrics
	}

	/**
	 * Get alerts with filtering, sorting, and pagination
	 */
	async getAlerts(request: AlertListRequest): Promise<AlertListResponse> {
		try {
			// Transform UI filters to API parameters
			const apiParams = this.transformFiltersToApiParams(request.filters)

			// Add pagination parameters
			if (request.pagination) {
				apiParams.page = request.pagination.page
				apiParams.pageSize = request.pagination.pageSize
			}

			// Execute API call with retry logic
			const response = await this.executeWithRetry(
				() => this.metricsService.getAlerts(apiParams),
				'getAlerts'
			)

			// Transform API response to UI format
			return this.transformAlertsResponse(response, request)
		} catch (error) {
			throw this.handleApiError(error, 'Failed to fetch alerts')
		}
	}

	/**
	 * Get a specific alert by ID
	 */
	async getAlert(id: string): Promise<AlertUI | null> {
		try {
			const response = await this.executeWithRetry(
				() => this.metricsService.getAlert(id),
				'getAlert'
			)

			if (!response) {
				return null
			}

			return this.transformAlertToUI(response)
		} catch (error) {
			if (this.isNotFoundError(error)) {
				return null
			}
			throw this.handleApiError(error, `Failed to fetch alert ${id}`)
		}
	}

	/**
	 * Get alert statistics
	 */
	async getAlertStatistics(organizationId: string): Promise<AlertStatistics> {
		try {
			const cacheKey = `stats_${organizationId}`

			// Check cache first
			if (this.config.enableCache) {
				const cached = this.getCachedData(cacheKey)
				if (cached) {
					return cached
				}
			}

			const response = await this.executeWithRetry(
				() => this.metricsService.getAlertStatistics(),
				'getAlertStatistics'
			)

			const transformed = this.transformStatisticsResponse(response)

			// Cache the result
			if (this.config.enableCache) {
				this.setCachedData(cacheKey, transformed)
			}

			return transformed
		} catch (error) {
			throw this.handleApiError(error, 'Failed to fetch alert statistics')
		}
	}

	/**
	 * Acknowledge an alert
	 */
	async acknowledgeAlert(request: AlertActionRequest): Promise<AlertActionResponse> {
		try {
			const acknowledgeRequest: AcknowledgeAlertRequest = {
				acknowledgedBy: request.userId,
				notes: request.notes,
			}

			const response = await this.executeWithRetry(
				() => this.metricsService.acknowledgeAlert(request.alertId, acknowledgeRequest),
				'acknowledgeAlert'
			)

			return {
				success: true,
				alert: this.transformAlertToUI(response),
				message: 'Alert acknowledged successfully',
				timestamp: new Date(),
			}
		} catch (error) {
			throw this.handleApiError(error, `Failed to acknowledge alert ${request.alertId}`)
		}
	}

	/**
	 * Resolve an alert
	 */
	async resolveAlert(request: AlertActionRequest): Promise<AlertActionResponse> {
		try {
			const resolveRequest: ResolveAlertRequest = {
				resolution: request.notes || 'Alert resolved',
			}

			const response = await this.executeWithRetry(
				() => this.metricsService.resolveAlert(request.alertId, resolveRequest),
				'resolveAlert'
			)

			return {
				success: true,
				alert: this.transformAlertToUI(response),
				message: 'Alert resolved successfully',
				timestamp: new Date(),
			}
		} catch (error) {
			throw this.handleApiError(error, `Failed to resolve alert ${request.alertId}`)
		}
	}

	/**
	 * Dismiss an alert (suppress temporarily)
	 */
	async dismissAlert(request: AlertActionRequest): Promise<AlertActionResponse> {
		try {
			// Use suppress functionality with default duration
			const response = await this.executeWithRetry(
				() =>
					this.metricsService.suppressAlert(
						request.alertId,
						60, // 1 hour default suppression
						request.notes || 'Alert dismissed by user'
					),
				'dismissAlert'
			)

			return {
				success: true,
				alert: this.transformAlertToUI(response),
				message: 'Alert dismissed successfully',
				timestamp: new Date(),
			}
		} catch (error) {
			throw this.handleApiError(error, `Failed to dismiss alert ${request.alertId}`)
		}
	}

	/**
	 * Perform bulk actions on multiple alerts
	 */
	async performBulkAction(request: AlertBulkActionRequest): Promise<AlertBulkActionResponse> {
		try {
			const results = await Promise.allSettled(
				request.bulkAction.alertIds.map(async (alertId) => {
					const actionRequest: AlertActionRequest = {
						alertId,
						action: request.bulkAction.type,
						notes: request.bulkAction.notes,
						userId: request.bulkAction.userId || 'system',
					}

					switch (request.bulkAction.type) {
						case 'acknowledge':
							return await this.acknowledgeAlert(actionRequest)
						case 'resolve':
							return await this.resolveAlert(actionRequest)
						case 'dismiss':
							return await this.dismissAlert(actionRequest)
						default:
							throw new Error(`Unsupported bulk action: ${request.bulkAction.type}`)
					}
				})
			)

			const successful = results.filter((r) => r.status === 'fulfilled').length
			const failed = results.filter((r) => r.status === 'rejected').length
			const errors = results
				.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
				.map((r, index) => ({
					alertId: request.bulkAction.alertIds[index],
					error: r.reason?.message || 'Unknown error',
				}))

			return {
				success: failed === 0,
				processed: successful,
				failed,
				errors: errors.length > 0 ? errors : undefined,
				message: `Processed ${successful} alerts, ${failed} failed`,
			}
		} catch (error) {
			throw this.handleApiError(error, 'Failed to perform bulk action')
		}
	}

	/**
	 * Clear cache for alert data
	 */
	clearCache(pattern?: string): void {
		if (pattern) {
			for (const key of this.cache.keys()) {
				if (key.includes(pattern)) {
					this.cache.delete(key)
				}
			}
		} else {
			this.cache.clear()
		}
	}

	/**
	 * Transform UI filters to API parameters
	 */
	private transformFiltersToApiParams(filters?: AlertFilters): AlertsParams {
		if (!filters) {
			return {}
		}

		const params: AlertsParams = {}

		if (filters.severity?.length) {
			params.severity = filters.severity
		}

		if (filters.status?.length) {
			params.status = filters.status
		}

		if (filters.type?.length) {
			params.type = filters.type
		}

		if (filters.source?.length) {
			params.source = filters.source
		}

		if (filters.dateRange) {
			params.startDate = filters.dateRange.start.toISOString()
			params.endDate = filters.dateRange.end.toISOString()
		}

		if (filters.search) {
			params.search = filters.search
		}

		return params
	}

	/**
	 * Transform API alerts response to UI format
	 */
	private transformAlertsResponse(
		response: PaginatedAlerts,
		request: AlertListRequest
	): AlertListResponse {
		return {
			alerts: response.alerts.map((alert) => this.transformAlertToUI(alert)),
			pagination: {
				page: response.pagination.page,
				pageSize: response.pagination.pageSize,
				total: response.pagination.total,
				totalPages: response.pagination.totalPages,
			},
			filters: {
				applied: request.filters || {},
				available: {
					severities: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
					types: ['SYSTEM', 'SECURITY', 'PERFORMANCE', 'COMPLIANCE', 'CUSTOM'],
					sources: [], // Would be populated from API metadata
					tags: [], // Would be populated from API metadata
				},
			},
		}
	}

	/**
	 * Transform API Alert to UI AlertUI format
	 */
	private transformAlertToUI(alert: Alert): AlertUI {
		return {
			id: alert.id,
			title: alert.title,
			description: alert.description,
			severity: alert.severity as any, // Type assertion for enum compatibility
			type: alert.type as any, // Type assertion for enum compatibility
			status: alert.status as any, // Type assertion for enum compatibility
			source: alert.source,
			timestamp: new Date(alert.timestamp),
			acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined,
			acknowledgedBy: alert.acknowledgedBy,
			resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
			resolvedBy: alert.resolvedBy,
			resolutionNotes: alert.resolutionNotes,
			metadata: alert.metadata || {},
			tags: alert.tags || [],
			organizationId: alert.organizationId || 'default',
			correlationId: alert.correlationId,
		}
	}

	/**
	 * Transform statistics response
	 */
	private transformStatisticsResponse(response: any): AlertStatistics {
		return {
			total: response.total || 0,
			active: response.active || 0,
			acknowledged: response.acknowledged || 0,
			resolved: response.resolved || 0,
			dismissed: response.dismissed || 0,
			bySeverity: response.bySeverity || {},
			byType: response.byType || {},
			bySource: response.bySource || {},
			trends: response.trends || [],
		}
	}

	/**
	 * Execute API call with retry logic
	 */
	private async executeWithRetry<T>(
		operation: () => Promise<T>,
		operationName: string
	): Promise<T> {
		let lastError: Error | undefined

		for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
			try {
				return await operation()
			} catch (error) {
				lastError = error as Error

				// Don't retry on certain errors
				if (this.isNonRetryableError(error)) {
					break
				}

				// Don't retry on last attempt
				if (attempt === this.config.retryAttempts) {
					break
				}

				// Wait before retry with exponential backoff
				const delay = this.config.retryDelay * Math.pow(2, attempt - 1)
				await this.sleep(delay)
			}
		}

		throw lastError
	}

	/**
	 * Handle API errors and transform them to service errors
	 */
	private handleApiError(error: unknown, message: string): AlertApiServiceError {
		if (error instanceof AuditClientError) {
			return new AlertApiServiceError(
				message,
				error.code || 'AUDIT_CLIENT_ERROR',
				error,
				error.requestId
			)
		}

		if (error instanceof Error) {
			return new AlertApiServiceError(message, 'UNKNOWN_ERROR', error)
		}

		return new AlertApiServiceError(message, 'UNKNOWN_ERROR')
	}

	/**
	 * Check if error is a 404 Not Found error
	 */
	private isNotFoundError(error: unknown): boolean {
		if (error instanceof AuditClientError) {
			return error.code === 'NOT_FOUND' || error.message.includes('404')
		}
		return false
	}

	/**
	 * Check if error should not be retried
	 */
	private isNonRetryableError(error: unknown): boolean {
		if (error instanceof AuditClientError) {
			// Don't retry authentication, authorization, or validation errors
			const nonRetryableCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'NOT_FOUND']
			return nonRetryableCodes.includes(error.code || '')
		}
		return false
	}

	/**
	 * Get cached data if available and not expired
	 */
	private getCachedData<T>(key: string): T | null {
		const cached = this.cache.get(key)
		if (!cached) {
			return null
		}

		const isExpired = Date.now() - cached.timestamp > this.config.cacheTtl
		if (isExpired) {
			this.cache.delete(key)
			return null
		}

		return cached.data
	}

	/**
	 * Set data in cache with timestamp
	 */
	private setCachedData(key: string, data: any): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		})
	}

	/**
	 * Sleep utility for retry delays
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}
