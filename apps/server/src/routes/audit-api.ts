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
		const { db, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const query = c.req.valid('query')
			const organizationId = session.session.activeOrganizationId as string

			// Import Drizzle operators
			const { eq, and, gte, lte, inArray, isNotNull, count, desc, asc } = await import(
				'drizzle-orm'
			)
			const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

			// Build query conditions with organization isolation
			const conditions = [eq(auditLog.organizationId, organizationId)]

			if (query.startDate && query.endDate) {
				conditions.push(gte(auditLog.timestamp, query.startDate))
				conditions.push(lte(auditLog.timestamp, query.endDate))
			}

			if (query.principalIds?.length) {
				conditions.push(inArray(auditLog.principalId, query.principalIds))
			}

			if (query.actions?.length) {
				conditions.push(inArray(auditLog.action, query.actions))
			}

			if (query.statuses?.length) {
				conditions.push(inArray(auditLog.status, query.statuses))
			}

			if (query.dataClassifications?.length) {
				conditions.push(inArray(auditLog.dataClassification, query.dataClassifications))
			}

			if (query.resourceTypes?.length) {
				conditions.push(inArray(auditLog.targetResourceType, query.resourceTypes))
			}

			if (query.verifiedOnly) {
				conditions.push(isNotNull(auditLog.hash))
			}

			const whereClause = and(...conditions)

			// Execute query with proper error handling
			const events = await db.audit
				.select()
				.from(auditLog)
				.where(whereClause)
				.limit(query.limit || 50)
				.offset(query.offset || 0)
				.orderBy(
					query.sortDirection === 'asc'
						? asc(auditLog[query.sortField || 'timestamp'])
						: desc(auditLog[query.sortField || 'timestamp'])
				)

			// Get total count for pagination
			const totalResult = await db.audit
				.select({ count: count() })
				.from(auditLog)
				.where(whereClause)

			const total = totalResult[0]?.count || 0

			const result = {
				events: events.map((event) => ({
					id: event.id?.toString() || '',
					timestamp: event.timestamp,
					action: event.action,
					targetResourceType: event.targetResourceType || '',
					targetResourceId: event.targetResourceId || undefined,
					principalId: event.principalId || '',
					organizationId: event.organizationId || '',
					status: event.status,
					outcomeDescription: event.outcomeDescription || undefined,
					dataClassification: event.dataClassification || 'INTERNAL',
					sessionContext: event.sessionContext || undefined,
					metadata: event.details || undefined,
					hash: event.hash || undefined,
					correlationId: event.correlationId || undefined,
				})),
				pagination: {
					total,
					limit: query.limit || 50,
					offset: query.offset || 0,
					hasNext: (query.offset || 0) + (query.limit || 50) < total,
					hasPrevious: (query.offset || 0) > 0,
				},
			}

			logger.info(`Queried ${result.events.length} audit events`, {
				organizationId,
				total,
				filters: query,
			})

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
		const { db, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const organizationId = session.session.activeOrganizationId as string

			const { eq, and } = await import('drizzle-orm')
			const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

			const events = await db.audit
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.id, parseInt(id)), eq(auditLog.organizationId, organizationId)))
				.limit(1)

			if (!events.length) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			const dbEvent = events[0]
			const event = {
				id: dbEvent.id?.toString() || '',
				timestamp: dbEvent.timestamp,
				action: dbEvent.action,
				targetResourceType: dbEvent.targetResourceType || '',
				targetResourceId: dbEvent.targetResourceId || undefined,
				principalId: dbEvent.principalId || '',
				organizationId: dbEvent.organizationId || '',
				status: dbEvent.status,
				outcomeDescription: dbEvent.outcomeDescription || undefined,
				dataClassification: dbEvent.dataClassification || 'INTERNAL',
				sessionContext: dbEvent.details?.sessionContext || undefined,
				metadata: dbEvent.details || undefined,
				hash: dbEvent.hash || undefined,
				correlationId: dbEvent.correlationId || undefined,
			}

			logger.info(`Retrieved audit event: ${id}`, {
				organizationId,
				action: event.action,
			})

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
		const { audit, db, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const organizationId = session.session.activeOrganizationId as string

			const { eq, and } = await import('drizzle-orm')
			const { auditLog, auditIntegrityLog } = await import('@repo/audit-db/dist/db/schema.js')

			// Get event first to check access
			const events = await db.audit
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.id, parseInt(id)), eq(auditLog.organizationId, organizationId)))
				.limit(1)

			if (!events.length) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			const dbEvent = events[0]

			// Perform integrity verification using crypto service methods
			const auditEvent: any = {
				...dbEvent,
				ttl: dbEvent.ttl || undefined,
				principalId: dbEvent.principalId || undefined,
				organizationId: dbEvent.organizationId || undefined,
				targetResourceType: dbEvent.targetResourceType || undefined,
				targetResourceId: dbEvent.targetResourceId || undefined,
				outcomeDescription: dbEvent.outcomeDescription || undefined,
				hash: dbEvent.hash || undefined,
				correlationId: dbEvent.correlationId || undefined,
				dataClassification: dbEvent.dataClassification || 'INTERNAL',
				retentionPolicy: dbEvent.retentionPolicy || 'standard',
			}

			const isValid = dbEvent.hash ? audit.verifyEventHash(auditEvent, dbEvent.hash) : false
			const verificationResult = {
				verified: isValid,
				originalHash: dbEvent.hash,
				computedHash: dbEvent.hash ? audit.generateEventHash(auditEvent) : null,
				algorithm: dbEvent.hashAlgorithm || 'SHA-256',
			}

			// Log the verification attempt
			await db.audit.insert(auditIntegrityLog).values({
				auditLogId: parseInt(id),
				verificationTimestamp: new Date().toISOString(),
				verificationStatus: verificationResult.verified ? 'success' : 'failure',
				verificationDetails: verificationResult,
				verifiedBy: session.session.userId,
				hashVerified: dbEvent.hash,
				expectedHash: verificationResult.originalHash,
			})

			logger.info(`Verified audit event integrity: ${id}`, {
				organizationId,
				verified: verificationResult.verified,
				verifiedBy: session.session.userId,
			})

			return c.json({
				eventId: id,
				verified: verificationResult.verified,
				timestamp: new Date().toISOString(),
				details: {
					originalHash: verificationResult.originalHash,
					computedHash: verificationResult.computedHash,
					algorithm: verificationResult.algorithm,
				},
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

	// GDPR data export endpoint
	const gdprExportRoute = createRoute({
		method: 'post',
		path: '/gdpr/export',
		tags: ['Audit Events'],
		summary: 'Export user audit data for GDPR compliance',
		description: 'Exports all audit data for a specific user in the requested format.',
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							principalId: z.string().min(1),
							format: z.enum(['json', 'csv', 'xml']).default('json'),
							dateRange: z
								.object({
									startDate: z.string().datetime(),
									endDate: z.string().datetime(),
								})
								.optional(),
							includeMetadata: z.boolean().default(true),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				description: 'GDPR export completed successfully',
				content: {
					'application/json': {
						schema: z.object({
							requestId: z.string(),
							recordCount: z.number(),
							dataSize: z.number(),
							format: z.string(),
							exportTimestamp: z.string().datetime(),
							data: z.string(), // Base64 encoded data
							metadata: z.object({
								dateRange: z.object({
									start: z.string(),
									end: z.string(),
								}),
								categories: z.array(z.string()),
								retentionPolicies: z.array(z.string()),
								exportedBy: z.string(),
							}),
						}),
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

	app.openapi(gdprExportRoute, async (c) => {
		const { db, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const requestData = c.req.valid('json')
			const requestedBy = session.session.userId

			// Create GDPR export request
			const exportRequest = {
				principalId: requestData.principalId,
				requestType: 'access' as const,
				format: requestData.format,
				dateRange: requestData.dateRange
					? {
							start: requestData.dateRange.startDate,
							end: requestData.dateRange.endDate,
						}
					: undefined,
				includeMetadata: requestData.includeMetadata,
				requestedBy,
				requestTimestamp: new Date().toISOString(),
			}

			// Use the GDPR compliance service from the audit package
			const { GDPRComplianceService } = await import('@repo/audit')
			const { auditLog, auditRetentionPolicy } = await import('@repo/audit-db/dist/db/schema.js')

			const gdprService = new GDPRComplianceService(db.audit, auditLog, auditRetentionPolicy)

			const exportResult = await gdprService.exportUserData(exportRequest)

			logger.info('GDPR data export completed via REST API', {
				principalId: requestData.principalId,
				format: requestData.format,
				recordCount: exportResult.recordCount,
				requestedBy,
			})

			return c.json({
				requestId: exportResult.requestId,
				recordCount: exportResult.recordCount,
				dataSize: exportResult.dataSize,
				format: exportResult.format,
				exportTimestamp: exportResult.exportTimestamp,
				metadata: exportResult.metadata,
				// Convert buffer to base64 for JSON transport
				data: exportResult.data.toString('base64'),
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to export GDPR data via REST API: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// GDPR pseudonymization endpoint
	const gdprPseudonymizeRoute = createRoute({
		method: 'post',
		path: '/gdpr/pseudonymize',
		tags: ['Audit Events'],
		summary: 'Pseudonymize user audit data for GDPR compliance',
		description:
			'Pseudonymizes all audit data for a specific user while maintaining referential integrity.',
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							principalId: z.string().min(1),
							strategy: z.enum(['hash', 'token', 'encryption']).default('hash'),
						}),
					},
				},
			},
		},
		responses: {
			200: {
				description: 'GDPR pseudonymization completed successfully',
				content: {
					'application/json': {
						schema: z.object({
							pseudonymId: z.string(),
							recordsAffected: z.number(),
						}),
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

	app.openapi(gdprPseudonymizeRoute, async (c) => {
		const { db, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const requestData = c.req.valid('json')
			const requestedBy = session.session.userId

			// Use the GDPR compliance service from the audit package
			const { GDPRComplianceService } = await import('@repo/audit')
			const { auditLog, auditRetentionPolicy } = await import('@repo/audit-db/dist/db/schema.js')

			const gdprService = new GDPRComplianceService(db.audit, auditLog, auditRetentionPolicy)

			const result = await gdprService.pseudonymizeUserData(
				requestData.principalId,
				requestData.strategy,
				requestedBy
			)

			logger.info('GDPR data pseudonymization completed via REST API', {
				principalId: requestData.principalId,
				strategy: requestData.strategy,
				recordsAffected: result.recordsAffected,
				requestedBy,
			})

			return c.json(result)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to pseudonymize GDPR data via REST API: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Bulk create audit events endpoint
	const bulkCreateRoute = createRoute({
		method: 'post',
		path: '/events/bulk',
		tags: ['Audit Events'],
		summary: 'Create multiple audit events',
		description: 'Creates multiple audit events in a single request for batch processing.',
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							events: z.array(CreateAuditEventSchema).min(1).max(100),
							validateIntegrity: z.boolean().default(true),
						}),
					},
				},
			},
		},
		responses: {
			201: {
				description: 'Bulk audit events processed',
				content: {
					'application/json': {
						schema: z.object({
							successful: z.array(z.object({ success: z.boolean(), eventData: z.any() })),
							failed: z.array(z.object({ error: z.string(), eventData: z.any() })),
							summary: z.object({
								total: z.number(),
								successful: z.number(),
								failed: z.number(),
							}),
						}),
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

	app.openapi(bulkCreateRoute, async (c) => {
		const { audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const requestData = c.req.valid('json')
			const organizationId = session.session.activeOrganizationId as string

			const eventsData = requestData.events.map((event) => ({
				...event,
				principalId: session.session.userId,
				organizationId,
				timestamp: new Date().toISOString(),
				eventVersion: '1.0',
			}))

			// Process events in bulk
			const results = await Promise.all(
				eventsData.map(async (eventData) => {
					try {
						await audit.log(eventData)
						return { success: true, eventData }
					} catch (e) {
						logger.warn(`Failed to create individual audit event: ${e}`)
						return { error: e instanceof Error ? e.message : 'Unknown error', eventData }
					}
				})
			)

			const successful = results.filter((r: any) => !('error' in r))
			const failed = results.filter((r: any) => 'error' in r)

			logger.info('Bulk audit events processed via REST API', {
				organizationId,
				total: requestData.events.length,
				successful: successful.length,
				failed: failed.length,
			})

			return c.json(
				{
					successful,
					failed,
					summary: {
						total: requestData.events.length,
						successful: successful.length,
						failed: failed.length,
					},
				},
				201
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to process bulk audit events via REST API: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
