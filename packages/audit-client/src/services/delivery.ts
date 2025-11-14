import { BaseResource } from '../core/base-resource'
import { assertDefined, assertType, isObject } from '../utils/type-guards'
import {
	validateCreateDeliveryDestination,
	validateDeliveryDestinationQuery,
	validateDeliveryListQuery,
	validateDeliveryRequest,
	validateMetricsQuery,
	validateUpdateDeliveryDestination,
	ValidationError,
} from '../utils/validation'

import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'
import type {
	ConnectionTestResult,
	CreateDeliveryDestination,
	DeliveryDestination,
	DeliveryDestinationQuery,
	DeliveryListQuery,
	DeliveryMetrics,
	DeliveryRequest,
	DeliveryResponse,
	DeliveryStatusResponse,
	DestinationHealth,
	MetricsQuery,
	PaginatedDeliveries,
	PaginatedDeliveryDestinations,
	UpdateDeliveryDestination,
} from '../types/delivery'
import type { ValidationResult } from '../types/shared-schemas'

/**
 * DeliveryService - Comprehensive delivery destination and request management
 *
 * This service provides:
 * - Delivery destination CRUD operations
 * - Destination configuration validation
 * - Connection testing
 * - Delivery request submission
 * - Delivery status tracking
 * - Delivery retry management
 * - Health monitoring
 * - Metrics and analytics
 */
export class DeliveryService extends BaseResource {
	constructor(config: AuditClientConfig, logger?: Logger, performanceMonitor?: any) {
		super(config, logger, performanceMonitor)
	}

	// ============================================================================
	// Destination Management
	// ============================================================================

	/**
	 * Create a new delivery destination
	 */
	async createDestination(destination: CreateDeliveryDestination): Promise<DeliveryDestination> {
		// Validate input
		const validationResult = validateCreateDeliveryDestination(destination)
		if (!validationResult.success) {
			throw new ValidationError('Invalid delivery destination data', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<DeliveryDestination>('/delivery/destinations', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isObject, 'Invalid delivery destination response from server')
		assertDefined(response.id, 'Delivery destination response missing ID')

		return response
	}

	/**
	 * Update an existing delivery destination
	 */
	async updateDestination(
		id: string,
		updates: UpdateDeliveryDestination
	): Promise<DeliveryDestination> {
		assertDefined(id, 'Destination ID is required')

		// Validate input
		const validationResult = validateUpdateDeliveryDestination(updates)
		if (!validationResult.success) {
			throw new ValidationError('Invalid delivery destination update data', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<DeliveryDestination>(`/delivery/destinations/${id}`, {
			method: 'PUT',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isObject, 'Invalid delivery destination response from server')
		assertDefined(response.id, 'Delivery destination response missing ID')

		return response
	}

	/**
	 * Delete a delivery destination
	 */
	async deleteDestination(id: string): Promise<void> {
		assertDefined(id, 'Destination ID is required')

		await this.request<void>(`/delivery/destinations/${id}`, {
			method: 'DELETE',
		})
	}

	/**
	 * Get a specific delivery destination by ID
	 */
	async getDestination(id: string): Promise<DeliveryDestination | null> {
		assertDefined(id, 'Destination ID is required')

		try {
			return await this.request<DeliveryDestination>(`/delivery/destinations/${id}`)
		} catch (error: any) {
			if (error?.status === 404 || error?.code === 'NOT_FOUND') {
				return null
			}
			throw error
		}
	}

	/**
	 * List delivery destinations with filtering and pagination
	 */
	async listDestinations(
		params: DeliveryDestinationQuery = {}
	): Promise<PaginatedDeliveryDestinations> {
		// Validate input
		const validationResult = validateDeliveryDestinationQuery(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid destination query parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {}

		if (validatedParams.type) {
			queryParams.type = validatedParams.type
		}
		if (validatedParams.disabled !== undefined) {
			queryParams.disabled = validatedParams.disabled.toString()
		}
		if (validatedParams.limit !== undefined) {
			queryParams.limit = validatedParams.limit.toString()
		}
		if (validatedParams.offset !== undefined) {
			queryParams.offset = validatedParams.offset.toString()
		}
		if (validatedParams.sortBy) {
			queryParams.sortBy = validatedParams.sortBy
		}
		if (validatedParams.sortOrder) {
			queryParams.sortOrder = validatedParams.sortOrder
		}

		const response = await this.request<PaginatedDeliveryDestinations>('/delivery/destinations', {
			method: 'GET',
			query: queryParams,
		})

		// Validate response
		assertType(response, isObject, 'Invalid paginated destinations response from server')
		assertDefined(response.data, 'Paginated destinations response missing data')
		assertDefined(response.pagination, 'Paginated destinations response missing pagination')

		return response
	}

	// ============================================================================
	// Validation and Testing
	// ============================================================================

	/**
	 * Validate a destination configuration
	 */
	async validateDestination(id: string): Promise<ValidationResult> {
		assertDefined(id, 'Destination ID is required')

		const response = await this.request<ValidationResult>(`/delivery/destinations/${id}/validate`, {
			method: 'POST',
		})

		// Validate response
		assertType(response, isObject, 'Invalid validation result from server')
		assertDefined(response.isValid, 'Validation result missing isValid')

		return response
	}

	/**
	 * Test connection to a delivery destination
	 */
	async testConnection(id: string): Promise<ConnectionTestResult> {
		assertDefined(id, 'Destination ID is required')

		const response = await this.request<ConnectionTestResult>(`/delivery/destinations/${id}/test`, {
			method: 'POST',
		})

		// Validate response
		assertType(response, isObject, 'Invalid connection test result from server')
		assertDefined(response.success, 'Connection test result missing success')

		return response
	}

	// ============================================================================
	// Delivery Operations
	// ============================================================================

	/**
	 * Submit a delivery request
	 */
	async deliver(request: DeliveryRequest): Promise<DeliveryResponse> {
		// Validate input
		const validationResult = validateDeliveryRequest(request)
		if (!validationResult.success) {
			throw new ValidationError('Invalid delivery request data', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const response = await this.request<DeliveryResponse>('/delivery/deliveries', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isObject, 'Invalid delivery response from server')
		assertDefined(response.deliveryId, 'Delivery response missing deliveryId')

		return response
	}

	/**
	 * Retry a failed delivery
	 */
	async retryDelivery(id: string): Promise<DeliveryResponse> {
		assertDefined(id, 'Delivery ID is required')

		const response = await this.request<DeliveryResponse>(`/delivery/deliveries/${id}/retry`, {
			method: 'POST',
		})

		// Validate response
		assertType(response, isObject, 'Invalid delivery response from server')
		assertDefined(response.deliveryId, 'Delivery response missing deliveryId')

		return response
	}

	/**
	 * Get delivery status
	 */
	async getDeliveryStatus(id: string): Promise<DeliveryStatusResponse | null> {
		assertDefined(id, 'Delivery ID is required')

		try {
			return await this.request<DeliveryStatusResponse>(`/delivery/deliveries/${id}`)
		} catch (error: any) {
			if (error?.status === 404 || error?.code === 'NOT_FOUND') {
				return null
			}
			throw error
		}
	}

	/**
	 * List deliveries with filtering and pagination
	 */
	async listDeliveries(params: DeliveryListQuery = {}): Promise<PaginatedDeliveries> {
		// Validate input
		const validationResult = validateDeliveryListQuery(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid delivery list query parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {}

		if (validatedParams.destinationId) {
			queryParams.destinationId = validatedParams.destinationId
		}
		if (validatedParams.status) {
			queryParams.status = validatedParams.status
		}
		if (validatedParams.startDate) {
			queryParams.startDate = validatedParams.startDate
		}
		if (validatedParams.endDate) {
			queryParams.endDate = validatedParams.endDate
		}
		if (validatedParams.limit !== undefined) {
			queryParams.limit = validatedParams.limit.toString()
		}
		if (validatedParams.offset !== undefined) {
			queryParams.offset = validatedParams.offset.toString()
		}
		if (validatedParams.sortBy) {
			queryParams.sortBy = validatedParams.sortBy
		}
		if (validatedParams.sortOrder) {
			queryParams.sortOrder = validatedParams.sortOrder
		}

		const response = await this.request<PaginatedDeliveries>('/delivery/deliveries', {
			method: 'GET',
			query: queryParams,
		})

		// Validate response
		assertType(response, isObject, 'Invalid paginated deliveries response from server')
		assertDefined(response.data, 'Paginated deliveries response missing data')
		assertDefined(response.pagination, 'Paginated deliveries response missing pagination')

		return response
	}

	// ============================================================================
	// Health and Metrics
	// ============================================================================

	/**
	 * Get destination health status
	 */
	async getDestinationHealth(id: string): Promise<DestinationHealth | null> {
		assertDefined(id, 'Destination ID is required')

		try {
			return await this.request<DestinationHealth>(`/delivery/destinations/${id}/health`)
		} catch (error: any) {
			if (error?.status === 404 || error?.code === 'NOT_FOUND') {
				return null
			}
			throw error
		}
	}

	/**
	 * Get delivery metrics
	 */
	async getDeliveryMetrics(params: MetricsQuery = {}): Promise<DeliveryMetrics> {
		// Validate input
		const validationResult = validateMetricsQuery(params)
		if (!validationResult.success) {
			throw new ValidationError('Invalid metrics query parameters', {
				...(validationResult.zodError && { originalError: validationResult.zodError }),
			})
		}

		const validatedParams = validationResult.data!
		const queryParams: Record<string, any> = {}

		if (validatedParams.destinationType) {
			queryParams.destinationType = validatedParams.destinationType
		}
		if (validatedParams.startDate) {
			queryParams.startDate = validatedParams.startDate
		}
		if (validatedParams.endDate) {
			queryParams.endDate = validatedParams.endDate
		}
		if (validatedParams.granularity) {
			queryParams.granularity = validatedParams.granularity
		}

		const response = await this.request<DeliveryMetrics>('/delivery/metrics', {
			method: 'GET',
			query: queryParams,
		})

		// Validate response
		assertType(response, isObject, 'Invalid delivery metrics response from server')
		assertDefined(response.totalDeliveries, 'Delivery metrics response missing totalDeliveries')

		return response
	}

	/**
	 * Get API health status
	 */
	async healthCheck(): Promise<{
		status: string
		version: string
		timestamp: string
		details?: Record<string, any>
	}> {
		const response = await this.request<{
			status: string
			version: string
			timestamp: string
			details?: Record<string, any>
		}>('/delivery/health')

		// Validate response
		assertType(response, isObject, 'Invalid health check response from server')
		assertDefined(response.status, 'Health check response missing status')

		return response
	}
}
