/**
 * @fileoverview Audit Events REST API
 *
 * Provides REST API endpoints for audit event operations:
 * - Create audit events
 * - Query audit events with filtering and pagination
 * - Get specific audit events
 * - Verify audit event integrity
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

// Zod schemas for request/response validation
const AuditEventSchema = z.object({
	id: z.string().uuid(),
	timestamp: z.string().datetime(),
	action: z.string(),
	targetResourceType: z.string(),
	targetResourceId: z.string().optional(),
	principalId: z.string(),
	organizationId: z.string(),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().optional(),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	sessionContext: z.record(z.string(), z.any()).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	hash: z.string().optional(),
	correlationId: z.string().optional(),
})

const CreateAuditEventSchema = z.object({
	action: z.string().min(1).max(100),
	targetResourceType: z.string().min(1).max(50),
	targetResourceId: z.string().optional(),
	principalId: z.string().min(1),
	organizationId: z.string().min(1),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().max(500).optional(),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	sessionContext: z.record(z.string(), z.any()).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

const QueryAuditEventsSchema = z.object({
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	principalIds: z
		.string()
		.optional()
		.transform((val) => val?.split(',')),
	organizationIds: z
		.string()
		.optional()
		.transform((val) => val?.split(',')),
	actions: z
		.string()
		.optional()
		.transform((val) => val?.split(',')),
	statuses: z
		.string()
		.optional()
		.transform((val) => val?.split(',') as ('attempt' | 'success' | 'failure')[] | undefined),
	dataClassifications: z
		.string()
		.optional()
		.transform(
			(val) => val?.split(',') as ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[] | undefined
		),
	resourceTypes: z
		.string()
		.optional()
		.transform((val) => val?.split(',')),
	verifiedOnly: z
		.string()
		.optional()
		.transform((val) => val === 'true'),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 0)),
	sortField: z.enum(['timestamp', 'status', 'action']).optional(),
	sortDirection: z.enum(['asc', 'desc']).optional(),
})

const PaginatedAuditEventsSchema = z.object({
	events: z.array(AuditEventSchema),
	pagination: z.object({
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
		hasNext: z.boolean(),
		hasPrevious: z.boolean(),
	}),
})

const IntegrityVerificationSchema = z.object({
	eventId: z.string().uuid(),
	verified: z.boolean(),
	timestamp: z.string().datetime(),
	details: z
		.object({
			originalHash: z.string().optional(),
			computedHash: z.string().optional(),
			algorithm: z.string().optional(),
		})
		.optional(),
})

const ErrorResponseSchema = z.object({
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.any()).optional(),
	timestamp: z.string().datetime(),
	requestId: z.string(),
	path: z.string().optional(),
})

// Route definitions
const createAuditEventRoute = createRoute({
	method: 'post',
	path: '/events',
	tags: ['Audit Events'],
	summary: 'Create a new audit event',
	description:
		'Creates a new audit event with the provided data and returns the created event with generated ID and timestamp.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: CreateAuditEventSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Audit event created successfully',
			content: {
				'application/json': {
					schema: AuditEventSchema,
				},
			},
		},
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const queryAuditEventsRoute = createRoute({
	method: 'get',
	path: '/events',
	tags: ['Audit Events'],
	summary: 'Query audit events',
	description: 'Retrieves audit events with optional filtering, pagination, and sorting.',
	request: {
		query: QueryAuditEventsSchema,
	},
	responses: {
		200: {
			description: 'Audit events retrieved successfully',
			content: {
				'application/json': {
					schema: PaginatedAuditEventsSchema,
				},
			},
		},
		400: {
			description: 'Invalid query parameters',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const getAuditEventRoute = createRoute({
	method: 'get',
	path: '/events/{id}',
	tags: ['Audit Events'],
	summary: 'Get audit event by ID',
	description: 'Retrieves a specific audit event by its ID.',
	request: {
		params: z.object({
			id: z.string().uuid(),
		}),
	},
	responses: {
		200: {
			description: 'Audit event retrieved successfully',
			content: {
				'application/json': {
					schema: AuditEventSchema,
				},
			},
		},
		404: {
			description: 'Audit event not found',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const verifyAuditEventRoute = createRoute({
	method: 'post',
	path: '/events/{id}/verify',
	tags: ['Audit Events'],
	summary: 'Verify audit event integrity',
	description: 'Verifies the cryptographic integrity of an audit event.',
	request: {
		params: z.object({
			id: z.string().uuid(),
		}),
	},
	responses: {
		200: {
			description: 'Integrity verification completed',
			content: {
				'application/json': {
					schema: IntegrityVerificationSchema,
				},
			},
		},
		404: {
			description: 'Audit event not found',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

/**
 * Create audit events API router
 */
export function createAuditAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Create audit event
	app.openapi(createAuditEventRoute, async (c) => {
		const { audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const eventData = c.req.valid('json')

			// Create audit event using the log method
			const auditEvent = {
				...eventData,
				principalId: session.session.userId,
				organizationId: session.session.activeOrganizationId as string,
			}

			// Log the event (this will queue it for processing)
			await audit.log(auditEvent)

			// For the REST API response, we need to return the event with an ID
			// In a real implementation, this would come from the database after processing
			const event = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				...auditEvent,
			}

			logger.info(`Created audit event: ${event.id}`)

			return c.json(event, 201)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to create audit event: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Query audit events
	app.openapi(queryAuditEventsRoute, async (c) => {
		const { audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const query = c.req.valid('query')

			// Build filter criteria
			const filter = {
				dateRange:
					query.startDate && query.endDate
						? {
								startDate: query.startDate,
								endDate: query.endDate,
							}
						: undefined,
				principalIds: query.principalIds,
				organizationIds: query.organizationIds || [session.session.activeOrganizationId as string],
				actions: query.actions,
				statuses: query.statuses,
				dataClassifications: query.dataClassifications,
				resourceTypes: query.resourceTypes,
				verifiedOnly: query.verifiedOnly,
			}

			const pagination = {
				limit: query.limit || 50,
				offset: query.offset || 0,
			}

			const sort = query.sortField
				? {
						field: query.sortField,
						direction: query.sortDirection || 'desc',
					}
				: undefined

			// Query events from database
			// For now, return a placeholder response
			// In a real implementation, this would query the audit database
			const result = {
				events: [],
				pagination: {
					total: 0,
					limit: pagination.limit,
					offset: pagination.offset,
					hasNext: false,
					hasPrevious: false,
				},
			}

			logger.info(`Queried ${result.events.length} audit events`)

			return c.json(result)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to query audit events: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get audit event by ID
	app.openapi(getAuditEventRoute, async (c) => {
		const { audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')

			// Get event from database
			// For now, return null (not found)
			// In a real implementation, this would query the audit database
			const event = null

			if (!event) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			// Check organization access
			if (event.organizationId !== session.session.activeOrganizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied to this audit event',
				})
			}

			logger.info(`Retrieved audit event: ${id}`)

			return c.json(event)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get audit event: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Verify audit event integrity
	app.openapi(verifyAuditEventRoute, async (c) => {
		const { audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')

			// Get event first to check access
			// For now, return null (not found)
			// In a real implementation, this would query the audit database
			const event = null

			if (!event) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			// Check organization access
			if (event.organizationId !== session.session.activeOrganizationId) {
				throw new ApiError({
					code: 'FORBIDDEN',
					message: 'Access denied to this audit event',
				})
			}

			// Verify integrity
			// For now, return a placeholder verification result
			// In a real implementation, this would verify the cryptographic hash
			const verification = {
				verified: true,
				details: {
					algorithm: 'SHA-256',
				},
			}

			logger.info(`Verified audit event integrity: ${id}`)

			return c.json({
				eventId: id,
				verified: verification.verified,
				timestamp: new Date().toISOString(),
				details: verification.details,
			})
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to verify audit event: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
