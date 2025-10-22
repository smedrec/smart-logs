/**
 * @fileoverview Delivery REST API
 *
 * Provides REST API endpoints for delivery operations:
 * - Delivery destination management
 * - Delivery request submission
 * - Delivery status tracking
 * - Delivery metrics and health monitoring
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

// Zod schemas for validation
const DeliveryDestinationConfigSchema = z.object({
	email: z
		.object({
			service: z.string(),
			smtpConfig: z
				.object({
					host: z.string(),
					port: z.number(),
					secure: z.boolean(),
					auth: z.object({
						user: z.string(),
						pass: z.string(),
					}),
				})
				.optional(),
			apiKey: z.string().optional(),
			from: z.string(),
			subject: z.string(),
			bodyTemplate: z.string().optional(),
			attachmentName: z.string().optional(),
			recipients: z.array(z.string()).optional(),
		})
		.optional(),
	webhook: z
		.object({
			url: z.string().url(),
			method: z.enum(['POST', 'PUT']),
			headers: z.record(z.string(), z.string()),
			timeout: z.number(),
			retryConfig: z.object({
				maxRetries: z.number(),
				backoffMultiplier: z.number(),
				maxBackoffDelay: z.number(),
			}),
		})
		.optional(),
	storage: z
		.object({
			provider: z.enum(['local', 's3', 'azure', 'gcp']),
			config: z.record(z.string(), z.any()),
			path: z.string(),
			retention: z.object({
				days: z.number(),
				autoCleanup: z.boolean(),
			}),
		})
		.optional(),
	sftp: z
		.object({
			host: z.string(),
			port: z.number(),
			username: z.string().optional(),
			password: z.string().optional(),
			privateKey: z.string().optional(),
			path: z.string(),
			filename: z.string().optional(),
		})
		.optional(),
	download: z
		.object({
			baseUrl: z.string().optional(),
			expiryHours: z.number(),
			maxAccess: z.number().optional(),
			allowedIpRanges: z.array(z.string()).optional(),
		})
		.optional(),
})

const DeliveryDestinationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	label: z.string(),
	type: z.enum(['email', 'webhook', 'storage', 'sftp', 'download']),
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	disabled: z.boolean(),
	disabledAt: z.string().optional(),
	disabledBy: z.string().optional(),
	countUsage: z.number(),
	lastUsedAt: z.string().optional(),
	config: DeliveryDestinationConfigSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
})

const CreateDeliveryDestinationSchema = z.object({
	organizationId: z.string(),
	label: z.string().min(1),
	type: z.enum(['email', 'webhook', 'storage', 'sftp', 'download']),
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	config: DeliveryDestinationConfigSchema,
})

const UpdateDeliveryDestinationSchema = z.object({
	label: z.string().min(1).optional(),
	description: z.string().optional(),
	icon: z.string().optional(),
	instructions: z.string().optional(),
	config: DeliveryDestinationConfigSchema.optional(),
	disabled: z.boolean().optional(),
})

const DeliveryDestinationQuerySchema = z.object({
	type: z.enum(['email', 'webhook', 'storage', 'sftp', 'download']).optional(),
	disabled: z.boolean().optional(),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 0)),
	sortBy: z.enum(['createdAt', 'updatedAt', 'label', 'type']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})

const DeliveryRequestSchema = z.object({
	organizationId: z.string(),
	destinations: z.union([z.array(z.string()), z.literal('default')]),
	payload: z.object({
		type: z.enum(['report', 'export', 'data', 'custom']),
		data: z.any(),
		metadata: z.record(z.string(), z.any()),
	}),
	options: z
		.object({
			priority: z.number().min(0).max(10).optional(),
			idempotencyKey: z.string().optional(),
			correlationId: z.string().optional(),
			tags: z.array(z.string()).optional(),
		})
		.optional(),
})

const DeliveryResponseSchema = z.object({
	deliveryId: z.string(),
	status: z.enum(['queued', 'processing', 'completed', 'failed']),
	destinations: z.array(
		z.object({
			destinationId: z.string(),
			status: z.enum(['pending', 'delivered', 'failed', 'retrying']),
			deliveryLogId: z.string().optional(),
		})
	),
	queuedAt: z.string(),
	estimatedDeliveryTime: z.string().optional(),
})

const DeliveryStatusResponseSchema = z.object({
	deliveryId: z.string(),
	status: z.enum(['queued', 'processing', 'completed', 'failed']),
	destinations: z.array(
		z.object({
			destinationId: z.string(),
			status: z.enum(['pending', 'delivered', 'failed', 'retrying']),
			attempts: z.number(),
			lastAttemptAt: z.string().optional(),
			deliveredAt: z.string().optional(),
			failureReason: z.string().optional(),
			crossSystemReference: z.string().optional(),
		})
	),
	createdAt: z.string(),
	updatedAt: z.string(),
	metadata: z.record(z.string(), z.any()),
})

const ValidationResultSchema = z.object({
	isValid: z.boolean(),
	errors: z.array(z.string()),
	warnings: z.array(z.string()),
})

const ConnectionTestResultSchema = z.object({
	success: z.boolean(),
	responseTime: z.number().optional(),
	statusCode: z.number().optional(),
	error: z.string().optional(),
	details: z.record(z.string(), z.any()).optional(),
})

const DestinationHealthSchema = z.object({
	destinationId: z.string(),
	status: z.enum(['healthy', 'degraded', 'unhealthy', 'disabled']),
	lastCheckAt: z.string(),
	consecutiveFailures: z.number(),
	totalFailures: z.number(),
	totalDeliveries: z.number(),
	successRate: z.string(),
	averageResponseTime: z.number().optional(),
	lastFailureAt: z.string().optional(),
	lastSuccessAt: z.string().optional(),
	disabledAt: z.string().optional(),
	disabledReason: z.string().optional(),
	circuitBreakerState: z.enum(['closed', 'open', 'half-open']),
	circuitBreakerOpenedAt: z.string().optional(),
	metadata: z.record(z.string(), z.any()),
})

const DeliveryMetricsSchema = z.object({
	totalDeliveries: z.number(),
	successfulDeliveries: z.number(),
	failedDeliveries: z.number(),
	successRate: z.string(),
	averageDeliveryTime: z.number(),
	byDestinationType: z.record(
		z.string(),
		z.object({
			total: z.number(),
			successful: z.number(),
			failed: z.number(),
			successRate: z.string(),
			averageTime: z.number(),
		})
	),
	byOrganization: z.record(
		z.string(),
		z.object({
			total: z.number(),
			successful: z.number(),
			failed: z.number(),
			successRate: z.string(),
		})
	),
	timeRange: z.object({
		start: z.string(),
		end: z.string(),
	}),
})

const DeliveryListQuerySchema = z.object({
	destinationId: z.string().optional(),
	status: z.enum(['pending', 'delivered', 'failed', 'retrying']).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 0)),
	sortBy: z.enum(['createdAt', 'updatedAt', 'status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})

const MetricsQuerySchema = z.object({
	destinationType: z.enum(['email', 'webhook', 'storage', 'sftp', 'download']).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
})

const ResultSchema = z.object({
	success: z.boolean(),
})

// Route definitions
const createDestinationRoute = createRoute({
	method: 'post',
	path: '/destinations',
	tags: ['Delivery'],
	summary: 'Create delivery destination',
	description: 'Creates a new delivery destination for the organization.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: CreateDeliveryDestinationSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Destination created successfully',
			content: {
				'application/json': {
					schema: DeliveryDestinationSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const updateDestinationRoute = createRoute({
	method: 'put',
	path: '/destinations/{id}',
	tags: ['Delivery'],
	summary: 'Update delivery destination',
	description: 'Updates an existing delivery destination.',
	request: {
		params: z.object({
			id: z.string(),
		}),
		body: {
			content: {
				'application/json': {
					schema: UpdateDeliveryDestinationSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Destination updated successfully',
			content: {
				'application/json': {
					schema: DeliveryDestinationSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const deleteDestinationRoute = createRoute({
	method: 'delete',
	path: '/destinations/{id}',
	tags: ['Delivery'],
	summary: 'Delete delivery destination',
	description: 'Deletes a delivery destination.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Destination deleted successfully',
			content: {
				'application/json': {
					schema: ResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getDestinationRoute = createRoute({
	method: 'get',
	path: '/destinations/{id}',
	tags: ['Delivery'],
	summary: 'Get delivery destination',
	description: 'Retrieves a delivery destination by ID.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Destination retrieved successfully',
			content: {
				'application/json': {
					schema: DeliveryDestinationSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const listDestinationsRoute = createRoute({
	method: 'get',
	path: '/destinations',
	tags: ['Delivery'],
	summary: 'List delivery destinations',
	description: 'Retrieves delivery destinations with optional filtering and pagination.',
	request: {
		query: DeliveryDestinationQuerySchema,
	},
	responses: {
		200: {
			description: 'Destinations retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						data: z.array(DeliveryDestinationSchema),
						pagination: z.object({
							total: z.number().int().min(0).optional(),
							limit: z.number().int().min(1).optional(),
							offset: z.number().int().min(0).optional(),
							hasNext: z.boolean(),
							hasPrevious: z.boolean(),
							nextCursor: z.string().optional(),
							previousCursor: z.string().optional(),
						}),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const validateDestinationRoute = createRoute({
	method: 'post',
	path: '/destinations/{id}/validate',
	tags: ['Delivery'],
	summary: 'Validate destination configuration',
	description: 'Validates a destination configuration.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Validation completed',
			content: {
				'application/json': {
					schema: ValidationResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const testConnectionRoute = createRoute({
	method: 'post',
	path: '/destinations/{id}/test',
	tags: ['Delivery'],
	summary: 'Test destination connection',
	description: 'Tests connection to a delivery destination.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Connection test completed',
			content: {
				'application/json': {
					schema: ConnectionTestResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const deliverRoute = createRoute({
	method: 'post',
	path: '/deliveries',
	tags: ['Delivery'],
	summary: 'Submit delivery request',
	description: 'Submits a delivery request to one or more destinations.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: DeliveryRequestSchema,
				},
			},
		},
	},
	responses: {
		202: {
			description: 'Delivery request accepted',
			content: {
				'application/json': {
					schema: DeliveryResponseSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const retryDeliveryRoute = createRoute({
	method: 'post',
	path: '/deliveries/{id}/retry',
	tags: ['Delivery'],
	summary: 'Retry failed delivery',
	description: 'Retries a failed delivery.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		202: {
			description: 'Delivery retry accepted',
			content: {
				'application/json': {
					schema: DeliveryResponseSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getDeliveryStatusRoute = createRoute({
	method: 'get',
	path: '/deliveries/{id}',
	tags: ['Delivery'],
	summary: 'Get delivery status',
	description: 'Retrieves the status of a delivery.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Delivery status retrieved successfully',
			content: {
				'application/json': {
					schema: DeliveryStatusResponseSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const listDeliveriesRoute = createRoute({
	method: 'get',
	path: '/deliveries',
	tags: ['Delivery'],
	summary: 'List deliveries',
	description: 'Retrieves deliveries with optional filtering and pagination.',
	request: {
		query: DeliveryListQuerySchema,
	},
	responses: {
		200: {
			description: 'Deliveries retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						data: z.array(DeliveryStatusResponseSchema),
						pagination: z.object({
							total: z.number().int().min(0).optional(),
							limit: z.number().int().min(1).optional(),
							offset: z.number().int().min(0).optional(),
							hasNext: z.boolean(),
							hasPrevious: z.boolean(),
							nextCursor: z.string().optional(),
							previousCursor: z.string().optional(),
						}),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getDestinationHealthRoute = createRoute({
	method: 'get',
	path: '/destinations/{id}/health',
	tags: ['Delivery'],
	summary: 'Get destination health',
	description: 'Retrieves health status of a delivery destination.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Destination health retrieved successfully',
			content: {
				'application/json': {
					schema: DestinationHealthSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getDeliveryMetricsRoute = createRoute({
	method: 'get',
	path: '/metrics',
	tags: ['Delivery'],
	summary: 'Get delivery metrics',
	description: 'Retrieves delivery metrics and analytics.',
	request: {
		query: MetricsQuerySchema,
	},
	responses: {
		200: {
			description: 'Delivery metrics retrieved successfully',
			content: {
				'application/json': {
					schema: DeliveryMetricsSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getHealthStatusRoute = createRoute({
	method: 'get',
	path: '/health',
	tags: ['Delivery'],
	summary: 'Get API health status',
	description: 'Retrieves the health status of the delivery API.',
	responses: {
		200: {
			description: 'Health status retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						status: z.string(),
						version: z.string(),
						timestamp: z.string(),
						details: z.record(z.string(), z.any()).optional(),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

/**
 * Create delivery API router
 */
export function createDeliveryAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Create delivery destination
	app.openapi(createDestinationRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const input = c.req.valid('json')

			// Ensure organization isolation
			if (input.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const destination = await delivery.createDestination(input)

			logger.info('Destination created via API', {
				requestId,
				destinationId: destination.id,
				organizationId: destination.organizationId,
				type: destination.type,
				userId: session.session.userId,
			})

			return c.json(destination, 201)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to create destination', {
				requestId,
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Update delivery destination
	app.openapi(updateDestinationRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const input = c.req.valid('json')

			// Validate destination access
			const existingDestination = await delivery.getDestination(id)
			if (!existingDestination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (existingDestination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const destination = await delivery.updateDestination(id, input)

			logger.info('Destination updated via API', {
				requestId,
				destinationId: id,
				organizationId: destination.organizationId,
				userId: session.session.userId,
			})

			return c.json(destination, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to update destination', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Delete delivery destination
	app.openapi(deleteDestinationRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			// Validate destination access
			const existingDestination = await delivery.getDestination(id)
			if (!existingDestination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (existingDestination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			await delivery.deleteDestination(id)

			logger.info('Destination deleted via API', {
				requestId,
				destinationId: id,
				organizationId,
				userId: session.session.userId,
			})

			return c.json({ success: true }, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to delete destination', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get delivery destination
	app.openapi(getDestinationRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			const destination = await delivery.getDestination(id)
			if (!destination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (destination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			return c.json(destination, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get destination', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// List delivery destinations
	app.openapi(listDestinationsRoute, async (c) => {
		const { delivery, performance, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const query = c.req.valid('query')

			// Ensure organization isolation
			const options = {
				...query,
				filters: {
					...query,
					organizationId,
				},
			}

			const destinations = await delivery.listDestinations(options)

			const response = performance.createPaginatedResponse(
				destinations.deliveryDestinations,
				{
					limit: query.limit || 50,
					offset: query.offset || 0,
				},
				destinations.totalCount
			)

			logger.debug('Destinations listed via API', {
				requestId,
				organizationId,
				count: destinations.deliveryDestinations.length,
				totalCount: destinations.totalCount,
				userId: session.session.userId,
			})

			return c.json(
				{
					data: response.data,
					pagination: response.pagination,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to list destinations', {
				requestId,
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Validate destination configuration
	app.openapi(validateDestinationRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			const destination = await delivery.getDestination(id)
			if (!destination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (destination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const result = await delivery.validateDestination(destination)

			return c.json(result, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to validate destination', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Test destination connection
	app.openapi(testConnectionRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			const destination = await delivery.getDestination(id)
			if (!destination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (destination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const result = await delivery.testConnection(destination)

			logger.info('Connection test performed via API', {
				requestId,
				destinationId: id,
				success: result.success,
				responseTime: result.responseTime,
				userId: session.session.userId,
			})

			return c.json(result, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to test connection', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Submit delivery request
	app.openapi(deliverRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const request = c.req.valid('json')

			// Ensure organization isolation
			if (request.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const response = await delivery.deliver(request)

			logger.info('Delivery submitted via API', {
				requestId,
				deliveryId: response.deliveryId,
				organizationId: request.organizationId,
				destinationCount: response.destinations.length,
				status: response.status,
				userId: session.session.userId,
			})

			return c.json(response, 202)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to submit delivery', {
				requestId,
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Retry failed delivery
	app.openapi(retryDeliveryRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			const response = await delivery.retryDelivery(id)

			logger.info('Delivery retry submitted via API', {
				requestId,
				deliveryId: id,
				organizationId,
				status: response.status,
				userId: session.session.userId,
			})

			return c.json(response, 202)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to retry delivery', {
				requestId,
				deliveryId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get delivery status
	app.openapi(getDeliveryStatusRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')

			const status = await delivery.getDeliveryStatus(id)
			if (!status) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Delivery not found',
				})
			}

			return c.json(status, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get delivery status', {
				requestId,
				deliveryId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// List deliveries
	app.openapi(listDeliveriesRoute, async (c) => {
		const { delivery, performance, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const query = c.req.valid('query')

			// Ensure organization isolation
			const options = {
				...query,
				organizationId,
			}

			const deliveries = await delivery.listDeliveries(options)

			const response = performance.createPaginatedResponse(
				deliveries.deliveries,
				{
					limit: query.limit || 50,
					offset: query.offset || 0,
				},
				deliveries.totalCount
			)

			logger.debug('Deliveries listed via API', {
				requestId,
				organizationId,
				count: deliveries.deliveries.length,
				totalCount: deliveries.totalCount,
				userId: session.session.userId,
			})

			return c.json(
				{
					data: response.data,
					pagination: response.pagination,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to list deliveries', {
				requestId,
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get destination health
	app.openapi(getDestinationHealthRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const { id } = c.req.valid('param')

			// Validate destination access
			const destination = await delivery.getDestination(id)
			if (!destination) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Destination not found',
				})
			}

			if (destination.organizationId !== organizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied: resource belongs to different organization',
				})
			}

			const health = await delivery.getDestinationHealth(id)
			if (!health) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Health data not found for destination',
				})
			}

			return c.json(health, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get destination health', {
				requestId,
				destinationId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get delivery metrics
	app.openapi(getDeliveryMetricsRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const organizationId = session.session.activeOrganizationId
		if (!organizationId) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'No active organization',
			})
		}

		try {
			const query = c.req.valid('query')

			// Ensure organization isolation
			const options = {
				...query,
				organizationId,
			}

			const metrics = await delivery.getDeliveryMetrics(options)

			logger.debug('Metrics retrieved via API', {
				requestId,
				organizationId,
				timeRange: metrics.timeRange,
				userId: session.session.userId,
			})

			return c.json(metrics, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get delivery metrics', {
				requestId,
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get API health status
	app.openapi(getHealthStatusRoute, async (c) => {
		const { delivery, logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			const health = await delivery.healthCheck()

			return c.json(
				{
					status: health.details.status,
					version: '1.0.0',
					timestamp: new Date().toISOString(),
					details: health.details,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get health status', {
				requestId,
				error: message,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
