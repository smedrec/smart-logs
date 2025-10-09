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
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'

import { auditIntegrityLog, auditLog } from '@repo/audit-db'

import type { HonoEnv } from '@/lib/hono/context'
import type { AuditLogEvent } from '@repo/audit'

// Zod schemas for request/response validation
const AuditEventSchema = z.object({
	id: z.string(),
	timestamp: z.string().datetime(),
	action: z.string(),
	targetResourceType: z.string(),
	targetResourceId: z.string().optional(),
	principalId: z.string(),
	organizationId: z.string(),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().optional(),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	details: z.record(z.string(), z.any()).optional(),
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
	details: z.record(z.string(), z.any()).optional(),
})

const CreateAuditEventOptionsSchema = z.object({
	priority: z.number().optional(),
	delay: z.number().optional(),
	durabilityGuarantees: z.boolean().optional(),
	generateHash: z.boolean().optional(),
	generateSignature: z.boolean().optional(),
	correlationId: z.string().optional(),
	eventVersion: z.string().optional(),
	skipValidation: z.boolean().optional(),
	validationConfig: z
		.object({
			maxStringLength: z.number().default(10000),
			allowedDataClassifications: z
				.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
				.default(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
			requiredFields: z.array(z.string()).default(['timestamp', 'action', 'status']),
			maxCustomFieldDepth: z.number().default(3),
			allowedEventVersions: z.array(z.string()).default(['1.0', '1.1', '2.0']),
		})
		.optional(),
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
					schema: z.object({
						eventData: CreateAuditEventSchema,
						options: CreateAuditEventOptionsSchema,
					}),
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
		...openApiErrorResponses,
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
		...openApiErrorResponses,
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
			id: z.string(),
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
		...openApiErrorResponses,
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
			id: z.string(),
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
		...openApiErrorResponses,
	},
})

/**
 * Create audit events API router
 */
export function createAuditAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Create audit event
	app.openapi(createAuditEventRoute, async (c) => {
		const { audit, logger, authorization } = c.get('services')
		const session = c.get('session')!

		// Check permission to create audit events
		const hasPermission = await authorization.hasPermission(session, 'audit.events', 'create')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'Insufficient permissions to create audit events',
			})
		}

		try {
			const { eventData, options } = c.req.valid('json')

			// Create audit event using the log method
			const auditEvent = {
				...eventData,
				principalId: eventData.principalId || session.session.userId,
				organizationId:
					eventData.organizationId || (session.session.activeOrganizationId as string),
			}

			// Log the event (this will queue it for processing)
			await audit.log(auditEvent, options)

			// TODO: For the REST API response, we need to return the event with an ID
			// In a real implementation, this would come from the database after processing
			const event = {
				id: crypto.randomUUID(),
				timestamp: new Date().toISOString(),
				...auditEvent,
			}

			logger.info(`Created audit event: ${event.id}`, {
				userId: session.session.userId,
				organizationId: session.session.activeOrganizationId,
				eventId: event.id,
			})

			return c.json(event, 201)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to create audit event: ${message}`, {
				userId: session.session.userId,
				organizationId: session.session.activeOrganizationId,
				error: message,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Query audit events
	app.openapi(queryAuditEventsRoute, async (c) => {
		const { client, logger, authorization } = c.get('services')
		const session = c.get('session')!

		// Check permission to read audit events
		const hasPermission = await authorization.hasPermission(session, 'audit.events', 'read')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'Insufficient permissions to read audit events',
			})
		}

		try {
			const query = c.req.valid('query')
			const organizationId = session.session.activeOrganizationId as string

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
			const cacheKey = client.generateCacheKey('audit_events_query', { organizationId, ...query })

			const events = await client.executeMonitoredQuery(
				(audit) =>
					audit
						.select()
						.from(auditLog)
						.where(whereClause)
						.limit(query.limit || 50)
						.offset(query.offset || 0)
						.orderBy(
							query.sortDirection === 'asc'
								? asc(auditLog[query.sortField || 'timestamp'])
								: desc(auditLog[query.sortField || 'timestamp'])
						),
				'audit_events_query',
				{ cacheKey }
			)

			const cacheKeyCount = client.generateCacheKey('audit_events_count', {
				organizationId,
				...query,
			})
			// Get total count for pagination
			const totalResult = await client.executeMonitoredQuery(
				(audit) => audit.select({ count: count() }).from(auditLog).where(whereClause),
				'audit_events_query_count',
				{ cacheKey: cacheKeyCount }
			)

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
					details: event.details || undefined,
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
				filters: JSON.stringify(query),
			})

			return c.json(result, 200)
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
		const { authorization, client, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await authorization.hasPermission(session, 'audit.events', 'read')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'Insufficient permissions to read audit events',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const organizationId = session.session.activeOrganizationId as string

			const events = await client.executeOptimizedQuery(
				(audit) =>
					audit
						.select()
						.from(auditLog)
						.where(and(eq(auditLog.id, parseInt(id)), eq(auditLog.organizationId, organizationId)))
						.limit(1),
				{ cacheKey: `audit_event_${id}` }
			)

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
				details: dbEvent.details || undefined,
				hash: dbEvent.hash || undefined,
				correlationId: dbEvent.correlationId || undefined,
			}

			return c.json(event, 200)
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
		const { client, audit, db, logger } = c.get('services')
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

			// Get event first to check access
			const events = await client.executeOptimizedQuery(
				(audit) =>
					audit
						.select()
						.from(auditLog)
						.where(and(eq(auditLog.id, parseInt(id)), eq(auditLog.organizationId, organizationId)))
						.limit(1),
				{ cacheKey: `audit_event_${id}` }
			)

			if (!events.length) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			const dbEvent = events[0]

			if (!dbEvent.hash) {
				throw new ApiError({
					code: 'PRECONDITION_FAILED',
					message: 'Audit event do not have a hash',
				})
			}

			// Perform integrity verification using crypto service methods
			// Only include fields that are used in hash calculation (critical fields)
			const auditEvent: any = {
				timestamp: dbEvent.timestamp,
				action: dbEvent.action,
				status: dbEvent.status,
				principalId: dbEvent.principalId || null,
				organizationId: dbEvent.organizationId || null,
				targetResourceType: dbEvent.targetResourceType || null,
				targetResourceId: dbEvent.targetResourceId || null,
				outcomeDescription: dbEvent.outcomeDescription || null,
			}

			const isValid = audit.verifyEventHash(auditEvent, dbEvent.hash)
			const computedHash = audit.generateEventHash(auditEvent)

			// Add debug logging for hash verification issues
			logger.info(`Hash verification debug for event ${id}`, {
				originalHash: dbEvent.hash,
				computedHash,
				isValid,
				auditEventFields: auditEvent,
				dbEventKeys: JSON.stringify(dbEvent),
			})

			const verificationResult = {
				verified: isValid,
				originalHash: dbEvent.hash,
				computedHash,
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

			return c.json(
				{
					eventId: id,
					verified: verificationResult.verified,
					timestamp: new Date().toISOString(),
					details: {
						originalHash: verificationResult.originalHash,
						computedHash: verificationResult.computedHash,
						algorithm: verificationResult.algorithm,
					},
				},
				200
			)
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
			...openApiErrorResponses,
		},
	})

	app.openapi(gdprExportRoute, async (c) => {
		const { compliance, audit, authorization, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await authorization.hasPermission(session, 'audit.events', 'export')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'Insufficient permissions to export audit events',
			})
		}

		try {
			const requestData = c.req.valid('json')
			const requestedBy = session.session.userId

			// Create GDPR export request
			const exportRequest = {
				principalId: requestData.principalId,
				organizationId: session.session.activeOrganizationId as string,
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

			const exportResult = await compliance.gdpr.exportUserData(exportRequest)

			return c.json(
				{
					requestId: exportResult.requestId,
					recordCount: exportResult.recordCount,
					dataSize: exportResult.dataSize,
					format: exportResult.format,
					exportTimestamp: exportResult.exportTimestamp,
					metadata: exportResult.metadata,
					// Convert buffer to base64 for JSON transport
					data: exportResult.data.toString('base64'),
				},
				200
			)
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
							resourceType: z.string().min(1),
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
			...openApiErrorResponses,
		},
	})

	app.openapi(gdprPseudonymizeRoute, async (c) => {
		const { compliance, audit, authorization, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await authorization.hasPermission(session, 'audit.events', 'pseudonymize')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'Insufficient permissions to pseudonymize audit events',
			})
		}

		try {
			const requestData = c.req.valid('json')
			const requestedBy = session.session.userId

			const result = await compliance.gdpr.pseudonymizeUserData(
				requestData.principalId,
				requestData.strategy,
				requestedBy
			)

			// FIXME: the log data is already done on gdpr service but needs improvements
			audit.logData({
				principalId: requestedBy,
				organizationId: session.session.activeOrganizationId as string,
				action: 'pseudonymize',
				resourceType: requestData.resourceType,
				resourceId: requestData.principalId,
				status: 'success',
				dataClassification: 'PHI',
				outcomeDescription: `${requestData.resourceType} data pseudonymized per GDPR right to pseudonymize request completed via REST API`,
				metadata: {
					strategy: requestData.strategy,
					pseudonymId: result.pseudonymId,
					recordsAffected: result.recordsAffected,
				},
			})

			return c.json(result, 200)
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
			...openApiErrorResponses,
		},
	})

	app.openapi(bulkCreateRoute, async (c) => {
		const { authorization, audit, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const hasPermission = await authorization.hasPermission(session, 'audit:events', 'create')
		if (!hasPermission) {
			throw new ApiError({
				code: 'FORBIDDEN',
				message: 'You do not have permission to create audit events',
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
						return {
							success: false,
							eventData,
							error: e instanceof Error ? e.message : 'Unknown error',
						}
					}
				})
			)

			const successful = results.filter((r: any) => r.success)
			const failed = results.filter((r: any) => !r.success)

			logger.info('Bulk audit events processed via REST API', {
				organizationId,
				total: requestData.events.length,
				successful: successful.length,
				failed: failed.length,
			})

			return c.json(
				{
					successful: successful.map(({ success, eventData }) => ({ success, eventData })),
					failed: failed.map(({ error, eventData }) => ({
						error: error ?? 'Unknown error',
						eventData,
					})),
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
