/**
 * Delivery Service Public API - REST-style interface for delivery operations
 * Requirements 2.1, 2.4: Public API interface for delivery operations
 */

import { StructuredLogger } from '@repo/logs'

import type { DeliveryService } from './delivery-service.js'
import type {
	ConnectionTestResult,
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DeliveryListOptions,
	DeliveryListResponse,
	DeliveryMetrics,
	DeliveryRequest,
	DeliveryResponse,
	DeliveryStatusResponse,
	DestinationHealth,
	MetricsOptions,
	UpdateDeliveryDestinationInput,
	ValidationResult,
} from './types.js'

/**
 * API request validation error
 */
export class DeliveryAPIError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number = 400,
		public readonly code?: string
	) {
		super(message)
		this.name = 'DeliveryAPIError'
	}
}

/**
 * API response wrapper
 */
export interface APIResponse<T = any> {
	success: boolean
	data?: T
	error?: {
		code: string
		message: string
		details?: any
	}
	metadata?: {
		requestId?: string
		timestamp: string
		version: string
	}
}

/**
 * API request context
 */
export interface APIRequestContext {
	requestId: string
	organizationId: string
	userId?: string
	userAgent?: string
	ipAddress?: string
	timestamp: string
}

/**
 * Public API interface for delivery operations
 */
export class DeliveryAPI {
	private readonly logger: StructuredLogger
	private readonly version = '1.0.0'

	constructor(private readonly deliveryService: DeliveryService) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - DeliveryAPI',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})
	}

	/**
	 * Create a new delivery destination
	 * POST /destinations
	 */
	async createDestination(
		input: CreateDeliveryDestinationInput,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryDestination>> {
		try {
			this.validateCreateDestinationInput(input)
			this.validateOrganizationAccess(input.organizationId, context.organizationId)

			const destination = await this.deliveryService.createDestination(input)

			this.logger.info('Destination created via API', {
				requestId: context.requestId,
				destinationId: destination.id,
				organizationId: destination.organizationId,
				type: destination.type,
			})

			return this.successResponse(destination, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Update an existing delivery destination
	 * PUT /destinations/:id
	 */
	async updateDestination(
		id: string,
		input: UpdateDeliveryDestinationInput,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryDestination>> {
		try {
			this.validateDestinationId(id)
			await this.validateDestinationAccess(id, context.organizationId)

			const destination = await this.deliveryService.updateDestination(id, input)

			this.logger.info('Destination updated via API', {
				requestId: context.requestId,
				destinationId: id,
				organizationId: destination.organizationId,
			})

			return this.successResponse(destination, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Delete a delivery destination
	 * DELETE /destinations/:id
	 */
	async deleteDestination(id: string, context: APIRequestContext): Promise<APIResponse<void>> {
		try {
			this.validateDestinationId(id)
			await this.validateDestinationAccess(id, context.organizationId)

			await this.deliveryService.deleteDestination(id)

			this.logger.info('Destination deleted via API', {
				requestId: context.requestId,
				destinationId: id,
				organizationId: context.organizationId,
			})

			return this.successResponse(undefined, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Get a delivery destination by ID
	 * GET /destinations/:id
	 */
	async getDestination(
		id: string,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryDestination>> {
		try {
			this.validateDestinationId(id)

			const destination = await this.deliveryService.getDestination(id)
			if (!destination) {
				throw new DeliveryAPIError(`Destination not found: ${id}`, 404, 'DESTINATION_NOT_FOUND')
			}

			this.validateOrganizationAccess(destination.organizationId, context.organizationId)

			return this.successResponse(destination, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * List delivery destinations with filtering and pagination
	 * GET /destinations
	 */
	async listDestinations(
		options: DeliveryDestinationListOptions,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryDestinationListResponse>> {
		try {
			// Ensure organization isolation
			const filteredOptions = {
				...options,
				filters: {
					...options.filters,
					organizationId: context.organizationId,
				},
			}

			const destinations = await this.deliveryService.listDestinations(filteredOptions)

			this.logger.debug('Destinations listed via API', {
				requestId: context.requestId,
				organizationId: context.organizationId,
				count: destinations.deliveryDestinations.length,
				totalCount: destinations.totalCount,
			})

			return this.successResponse(destinations, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Validate a destination configuration
	 * POST /destinations/:id/validate
	 */
	async validateDestination(
		id: string,
		context: APIRequestContext
	): Promise<APIResponse<ValidationResult>> {
		try {
			this.validateDestinationId(id)

			const destination = await this.deliveryService.getDestination(id)
			if (!destination) {
				throw new DeliveryAPIError(`Destination not found: ${id}`, 404, 'DESTINATION_NOT_FOUND')
			}

			this.validateOrganizationAccess(destination.organizationId, context.organizationId)

			const result = await this.deliveryService.validateDestination(destination)

			return this.successResponse(result, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Test connection to a destination
	 * POST /destinations/:id/test
	 */
	async testConnection(
		id: string,
		context: APIRequestContext
	): Promise<APIResponse<ConnectionTestResult>> {
		try {
			this.validateDestinationId(id)

			const destination = await this.deliveryService.getDestination(id)
			if (!destination) {
				throw new DeliveryAPIError(`Destination not found: ${id}`, 404, 'DESTINATION_NOT_FOUND')
			}

			this.validateOrganizationAccess(destination.organizationId, context.organizationId)

			const result = await this.deliveryService.testConnection(destination)

			this.logger.info('Connection test performed via API', {
				requestId: context.requestId,
				destinationId: id,
				success: result.success,
				responseTime: result.responseTime,
			})

			return this.successResponse(result, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Submit a delivery request
	 * POST /deliveries
	 */
	async deliver(
		request: DeliveryRequest,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryResponse>> {
		try {
			this.validateDeliveryRequest(request)
			this.validateOrganizationAccess(request.organizationId, context.organizationId)

			const response = await this.deliveryService.deliver(request)

			this.logger.info('Delivery submitted via API', {
				requestId: context.requestId,
				deliveryId: response.deliveryId,
				organizationId: request.organizationId,
				destinationCount: response.destinations.length,
				status: response.status,
			})

			return this.successResponse(response, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Retry a failed delivery
	 * POST /deliveries/:id/retry
	 */
	async retryDelivery(
		deliveryId: string,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryResponse>> {
		try {
			this.validateDeliveryId(deliveryId)

			// Get delivery status to validate organization access
			const status = await this.deliveryService.getDeliveryStatus(deliveryId)
			// Note: Organization validation would need to be added to delivery status
			// For now, we'll trust the organization context

			const response = await this.deliveryService.retryDelivery(deliveryId)

			this.logger.info('Delivery retry submitted via API', {
				requestId: context.requestId,
				deliveryId,
				organizationId: context.organizationId,
				status: response.status,
			})

			return this.successResponse(response, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Get delivery status
	 * GET /deliveries/:id
	 */
	async getDeliveryStatus(
		deliveryId: string,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryStatusResponse>> {
		try {
			this.validateDeliveryId(deliveryId)

			const status = await this.deliveryService.getDeliveryStatus(deliveryId)
			// Note: Organization validation would need to be added to delivery status

			return this.successResponse(status, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * List deliveries with filtering and pagination
	 * GET /deliveries
	 */
	async listDeliveries(
		options: DeliveryListOptions,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryListResponse>> {
		try {
			// Ensure organization isolation
			const filteredOptions = {
				...options,
				organizationId: context.organizationId,
			}

			const deliveries = await this.deliveryService.listDeliveries(filteredOptions)

			this.logger.debug('Deliveries listed via API', {
				requestId: context.requestId,
				organizationId: context.organizationId,
				count: deliveries.deliveries.length,
				totalCount: deliveries.totalCount,
			})

			return this.successResponse(deliveries, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Get destination health status
	 * GET /destinations/:id/health
	 */
	async getDestinationHealth(
		id: string,
		context: APIRequestContext
	): Promise<APIResponse<DestinationHealth>> {
		try {
			this.validateDestinationId(id)
			await this.validateDestinationAccess(id, context.organizationId)

			const health = await this.deliveryService.getDestinationHealth(id)
			if (!health) {
				throw new DeliveryAPIError(
					`Health data not found for destination: ${id}`,
					404,
					'HEALTH_NOT_FOUND'
				)
			}

			return this.successResponse(health, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Get delivery metrics
	 * GET /metrics
	 */
	async getDeliveryMetrics(
		options: MetricsOptions,
		context: APIRequestContext
	): Promise<APIResponse<DeliveryMetrics>> {
		try {
			// Ensure organization isolation
			const filteredOptions = {
				...options,
				organizationId: context.organizationId,
			}

			const metrics = await this.deliveryService.getDeliveryMetrics(filteredOptions)

			this.logger.debug('Metrics retrieved via API', {
				requestId: context.requestId,
				organizationId: context.organizationId,
				timeRange: metrics.timeRange,
			})

			return this.successResponse(metrics, context)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	/**
	 * Get API health status
	 * GET /health
	 */
	async getHealthStatus(context: APIRequestContext): Promise<APIResponse<any>> {
		try {
			const health = await this.deliveryService.healthCheck()

			return this.successResponse(
				{
					...health.details,
					api: {
						version: this.version,
						timestamp: new Date().toISOString(),
					},
				},
				context
			)
		} catch (error) {
			return this.errorResponse(error, context)
		}
	}

	// Private validation and helper methods

	private validateCreateDestinationInput(input: CreateDeliveryDestinationInput): void {
		if (!input.organizationId) {
			throw new DeliveryAPIError('Organization ID is required', 400, 'MISSING_ORGANIZATION_ID')
		}

		if (!input.type) {
			throw new DeliveryAPIError('Destination type is required', 400, 'MISSING_DESTINATION_TYPE')
		}

		if (!input.label) {
			throw new DeliveryAPIError('Destination label is required', 400, 'MISSING_DESTINATION_LABEL')
		}

		if (!input.config) {
			throw new DeliveryAPIError(
				'Destination configuration is required',
				400,
				'MISSING_DESTINATION_CONFIG'
			)
		}
	}

	private validateDeliveryRequest(request: DeliveryRequest): void {
		if (!request.organizationId) {
			throw new DeliveryAPIError('Organization ID is required', 400, 'MISSING_ORGANIZATION_ID')
		}

		if (
			!request.destinations ||
			(Array.isArray(request.destinations) && request.destinations.length === 0)
		) {
			throw new DeliveryAPIError(
				'At least one destination is required',
				400,
				'MISSING_DESTINATIONS'
			)
		}

		if (!request.payload || !request.payload.type || !request.payload.data) {
			throw new DeliveryAPIError('Payload with type and data is required', 400, 'INVALID_PAYLOAD')
		}

		// Validate payload size (10MB limit)
		const payloadSize = JSON.stringify(request.payload.data).length
		if (payloadSize > 10 * 1024 * 1024) {
			throw new DeliveryAPIError(
				'Payload size exceeds maximum limit of 10MB',
				413,
				'PAYLOAD_TOO_LARGE'
			)
		}

		// Validate priority if specified
		if (request.options?.priority !== undefined) {
			if (request.options.priority < 0 || request.options.priority > 10) {
				throw new DeliveryAPIError('Priority must be between 0 and 10', 400, 'INVALID_PRIORITY')
			}
		}
	}

	private validateDestinationId(id: string): void {
		if (!id || typeof id !== 'string') {
			throw new DeliveryAPIError('Valid destination ID is required', 400, 'INVALID_DESTINATION_ID')
		}
	}

	private validateDeliveryId(id: string): void {
		if (!id || typeof id !== 'string') {
			throw new DeliveryAPIError('Valid delivery ID is required', 400, 'INVALID_DELIVERY_ID')
		}
	}

	private validateOrganizationAccess(resourceOrgId: string, contextOrgId: string): void {
		if (resourceOrgId !== contextOrgId) {
			throw new DeliveryAPIError(
				'Access denied: resource belongs to different organization',
				403,
				'ORGANIZATION_ACCESS_DENIED'
			)
		}
	}

	private async validateDestinationAccess(
		destinationId: string,
		organizationId: string
	): Promise<void> {
		const destination = await this.deliveryService.getDestination(destinationId)
		if (!destination) {
			throw new DeliveryAPIError(
				`Destination not found: ${destinationId}`,
				404,
				'DESTINATION_NOT_FOUND'
			)
		}

		this.validateOrganizationAccess(destination.organizationId, organizationId)
	}

	private successResponse<T>(data: T, context: APIRequestContext): APIResponse<T> {
		return {
			success: true,
			data,
			metadata: {
				requestId: context.requestId,
				timestamp: context.timestamp,
				version: this.version,
			},
		}
	}

	private errorResponse(error: unknown, context: APIRequestContext): APIResponse {
		let statusCode = 500
		let code = 'INTERNAL_ERROR'
		let message = 'An internal error occurred'

		if (error instanceof DeliveryAPIError) {
			statusCode = error.statusCode
			code = error.code || 'API_ERROR'
			message = error.message
		} else if (error instanceof Error) {
			message = error.message
			// Map common error patterns to appropriate status codes
			if (message.includes('not found')) {
				statusCode = 404
				code = 'NOT_FOUND'
			} else if (message.includes('validation') || message.includes('invalid')) {
				statusCode = 400
				code = 'VALIDATION_ERROR'
			} else if (message.includes('unauthorized') || message.includes('access denied')) {
				statusCode = 403
				code = 'ACCESS_DENIED'
			}
		}

		this.logger.error('API error', {
			requestId: context.requestId,
			organizationId: context.organizationId,
			statusCode,
			code,
			message,
			error: error instanceof Error ? error.stack : String(error),
		})

		return {
			success: false,
			error: {
				code,
				message,
			},
			metadata: {
				requestId: context.requestId,
				timestamp: context.timestamp,
				version: this.version,
			},
		}
	}
}

/**
 * Factory function for creating delivery API
 */
export function createDeliveryAPI(deliveryService: DeliveryService): DeliveryAPI {
	return new DeliveryAPI(deliveryService)
}

/**
 * Generate API request context
 */
export function createAPIRequestContext(
	organizationId: string,
	options: {
		requestId?: string
		userId?: string
		userAgent?: string
		ipAddress?: string
	} = {}
): APIRequestContext {
	return {
		requestId: options.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2)}`,
		organizationId,
		userId: options.userId,
		userAgent: options.userAgent,
		ipAddress: options.ipAddress,
		timestamp: new Date().toISOString(),
	}
}
