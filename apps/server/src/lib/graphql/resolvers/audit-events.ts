/**
 * Audit Events GraphQL Resolvers
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { GraphQLError } from 'graphql'

import { auditLog } from '@repo/audit-db'

import type { AuditEventStatus, DataClassification } from '@repo/audit'
import type {
	AuditEvent,
	AuditEventFilter,
	CreateAuditEventInput,
	GraphQLContext,
	IntegrityVerificationResult,
	PaginationInput,
	SortInput,
} from '../types'

/**
 * Helper function to convert database event to GraphQL AuditEvent
 */
function convertDbEventToGraphQL(dbEvent: any): AuditEvent {
	return {
		id: dbEvent.id.toString(),
		timestamp: dbEvent.timestamp,
		action: dbEvent.action,
		targetResourceType: dbEvent.targetResourceType || undefined,
		targetResourceId: dbEvent.targetResourceId || undefined,
		principalId: dbEvent.principalId || undefined,
		organizationId: dbEvent.organizationId || undefined,
		status: dbEvent.status as AuditEventStatus,
		outcomeDescription: dbEvent.outcomeDescription || undefined,
		dataClassification: dbEvent.dataClassification as DataClassification | undefined,
		correlationId: dbEvent.correlationId || undefined,
		retentionPolicy: dbEvent.retentionPolicy || undefined,
		metadata: dbEvent.metadata || undefined,
		hash: dbEvent.hash || undefined,
		integrityStatus: dbEvent.hash ? 'verified' : 'not_checked',
		ttl: dbEvent.ttl || undefined,
		eventVersion: dbEvent.eventVersion || undefined,
		hashAlgorithm: dbEvent.hashAlgorithm as 'SHA-256' | undefined,
		signature: dbEvent.signature || undefined,
		processingLatency: dbEvent.processingLatency || undefined,
		queueDepth: dbEvent.queueDepth || undefined,
		sessionContext: dbEvent.details?.sessionContext
			? {
					sessionId: dbEvent.details.sessionContext.sessionId,
					ipAddress: dbEvent.details.sessionContext.ipAddress,
					userAgent: dbEvent.details.sessionContext.userAgent,
					geolocation: dbEvent.details.sessionContext.geolocation,
				}
			: undefined,
	}
}

/**
 * Helper function to build database query conditions from GraphQL filter
 */
async function buildQueryConditions(filter: AuditEventFilter | undefined, organizationId: string) {
	// Always enforce organization isolation
	const conditions = [eq(auditLog.organizationId, organizationId)]

	if (!filter) {
		return and(...conditions)
	}

	if (filter.dateRange) {
		conditions.push(gte(auditLog.timestamp, filter.dateRange.startDate))
		conditions.push(lte(auditLog.timestamp, filter.dateRange.endDate))
	}

	if (filter.principalIds?.length) {
		conditions.push(inArray(auditLog.principalId, filter.principalIds))
	}

	if (filter.actions?.length) {
		conditions.push(inArray(auditLog.action, filter.actions))
	}

	if (filter.statuses?.length) {
		conditions.push(inArray(auditLog.status, filter.statuses))
	}

	if (filter.dataClassifications?.length) {
		conditions.push(inArray(auditLog.dataClassification, filter.dataClassifications))
	}

	if (filter.resourceTypes?.length) {
		conditions.push(inArray(auditLog.targetResourceType, filter.resourceTypes))
	}

	if (filter.resourceIds?.length) {
		conditions.push(inArray(auditLog.targetResourceId, filter.resourceIds))
	}

	if (filter.correlationIds?.length) {
		conditions.push(inArray(auditLog.correlationId, filter.correlationIds))
	}

	if (filter.verifiedOnly) {
		conditions.push(isNotNull(auditLog.hash))
	}

	return and(...conditions)
}

/**
 * Helper function to convert cursor to offset
 */
function cursorToOffset(cursor: string | undefined): number {
	if (!cursor) return 0
	try {
		return parseInt(Buffer.from(cursor, 'base64').toString('utf-8'))
	} catch {
		return 0
	}
}

/**
 * Helper function to convert offset to cursor
 */
function offsetToCursor(offset: number): string {
	return Buffer.from(offset.toString()).toString('base64')
}

export const auditEventResolvers = {
	Query: {
		/**
		 * Query audit events with flexible filtering and pagination
		 * Requirements: 3.1, 3.2
		 */
		auditEvents: async (
			_: any,
			args: {
				filter?: AuditEventFilter
				pagination?: PaginationInput
				sort?: SortInput
			},
			context: GraphQLContext
		) => {
			const { services } = context
			const { client, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Build query conditions
				const whereClause = await buildQueryConditions(args.filter, organizationId)

				// Handle pagination
				const limit = args.pagination?.first || 50
				const offset = args.pagination?.after ? cursorToOffset(args.pagination.after) : 0

				// Handle sorting
				const sortField = args.sort?.field?.toLowerCase() || 'timestamp'
				const sortDirection = args.sort?.direction || 'DESC'

				// Map sort fields to actual columns
				const sortColumnMap = {
					timestamp: auditLog.timestamp,
					action: auditLog.action,
					status: auditLog.status,
					principalid: auditLog.principalId,
					organizationid: auditLog.organizationId,
					targetresourcetype: auditLog.targetResourceType,
					targetresourceid: auditLog.targetResourceId,
					dataclassification: auditLog.dataClassification,
					correlationid: auditLog.correlationId,
				} as const

				const column = sortColumnMap[sortField as keyof typeof sortColumnMap] || auditLog.timestamp
				const orderBy = sortDirection === 'ASC' ? asc(column) : desc(column)

				const cacheKey = client.generateCacheKey('audit_events', args)
				// Execute query
				const events = await client.executeMonitoredQuery(
					(audit) =>
						audit
							.select()
							.from(auditLog)
							.where(whereClause)
							.limit(limit)
							.offset(offset)
							.orderBy(orderBy),
					'audit_events',
					{ cacheKey }
				)

				const cacheKeyCount = client.generateCacheKey('audit_events_count', args)
				// Get total count for pagination
				const totalResult = await client.executeMonitoredQuery(
					(audit) => audit.select({ count: count() }).from(auditLog).where(whereClause),
					'audit_events_count',
					{ cacheKey: cacheKeyCount }
				)

				const totalCount = totalResult[0]?.count || 0

				// Convert to GraphQL format
				const edges = events.map((event, index) => ({
					node: convertDbEventToGraphQL(event),
					cursor: offsetToCursor(offset + index),
				}))

				const pageInfo = {
					hasNextPage: offset + limit < totalCount,
					hasPreviousPage: offset > 0,
					startCursor: edges.length > 0 ? edges[0].cursor : undefined,
					endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
				}

				logger.info('GraphQL audit events queried successfully', {
					organizationId,
					resultCount: events.length,
					totalCount,
					filters: args.filter,
				})

				return {
					edges,
					pageInfo,
					totalCount,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to query audit events via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							filter: args.filter,
							pagination: args.pagination,
							sort: args.sort,
						},
					},
					'graphql-api',
					'auditEvents'
				)

				throw new GraphQLError(`Failed to query audit events: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Get a single audit event by ID
		 * Requirements: 3.1, 3.2
		 */
		auditEvent: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<AuditEvent | null> => {
			const { services } = context
			const { client, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const { eq, and } = await import('drizzle-orm')
				const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

				const event = await client.executeOptimizedQuery(
					(audit) =>
						audit
							.select()
							.from(auditLog)
							.where(
								and(eq(auditLog.id, parseInt(args.id)), eq(auditLog.organizationId, organizationId))
							)
							.limit(1),
					{ cacheKey: `audit_event_${args.id}` }
				)

				if (!event.length) {
					return null
				}

				logger.info('GraphQL audit event retrieved successfully', {
					eventId: args.id,
					organizationId,
				})

				return convertDbEventToGraphQL(event[0])
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit event via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							eventId: args.id,
						},
					},
					'graphql-api',
					'auditEvent'
				)

				throw new GraphQLError(`Failed to get audit event: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	Mutation: {
		/**
		 * Create a new audit event
		 * Requirements: 3.1, 3.2
		 */
		createAuditEvent: async (
			_: any,
			args: { input: CreateAuditEventInput },
			context: GraphQLContext
		): Promise<AuditEvent> => {
			const { services } = context
			const { audit, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Create audit event data compatible with AuditLogEvent interface
				const eventData: Partial<import('@repo/audit').AuditLogEvent> = {
					...args.input,
					organizationId,
					timestamp: new Date().toISOString(),
					eventVersion: '1.0',
					hashAlgorithm: 'SHA-256',
				}

				// Create audit event using the audit service
				await audit.log(eventData)

				logger.info('GraphQL audit event created successfully', {
					action: args.input.action,
					principalId: args.input.principalId,
					organizationId,
				})

				// Return the created event
				return {
					id: crypto.randomUUID(),
					timestamp: eventData.timestamp!,
					action: eventData.action!,
					targetResourceType: eventData.targetResourceType,
					targetResourceId: eventData.targetResourceId,
					principalId: eventData.principalId!,
					organizationId: eventData.organizationId!,
					status: eventData.status!,
					outcomeDescription: eventData.outcomeDescription,
					dataClassification: eventData.dataClassification,
					sessionContext: eventData.sessionContext,
					correlationId: eventData.correlationId,
					retentionPolicy: eventData.retentionPolicy,
					metadata: eventData.metadata,
					integrityStatus: 'not_checked',
					eventVersion: eventData.eventVersion,
					hashAlgorithm: eventData.hashAlgorithm,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create audit event via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							input: args.input,
						},
					},
					'graphql-api',
					'createAuditEvent'
				)

				throw new GraphQLError(`Failed to create audit event: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Verify the cryptographic integrity of an audit event
		 * Requirements: 3.1, 3.2
		 */
		verifyAuditEvent: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<IntegrityVerificationResult> => {
			const { services } = context
			const { audit, db, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const { eq, and } = await import('drizzle-orm')
				const { auditLog, auditIntegrityLog } = await import('@repo/audit-db/dist/db/schema.js')

				// First, get the event to verify organization access
				const event = await db.audit
					.select()
					.from(auditLog)
					.where(
						and(eq(auditLog.id, parseInt(args.id)), eq(auditLog.organizationId, organizationId))
					)
					.limit(1)

				if (!event.length) {
					throw new GraphQLError('Audit event not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				// Perform integrity verification
				const auditEvent: any = {
					...event[0],
					ttl: event[0].ttl || undefined,
					principalId: event[0].principalId || undefined,
					organizationId: event[0].organizationId || undefined,
					targetResourceType: event[0].targetResourceType || undefined,
					targetResourceId: event[0].targetResourceId || undefined,
					outcomeDescription: event[0].outcomeDescription || undefined,
					hash: event[0].hash || undefined,
					correlationId: event[0].correlationId || undefined,
					dataClassification: event[0].dataClassification || 'INTERNAL',
					retentionPolicy: event[0].retentionPolicy || 'standard',
				}

				const isValid = event[0].hash ? audit.verifyEventHash(auditEvent, event[0].hash) : false
				const verificationResult: IntegrityVerificationResult = {
					isValid,
					expectedHash: event[0].hash || undefined,
					computedHash: event[0].hash ? audit.generateEventHash(auditEvent) : undefined,
					timestamp: new Date().toISOString(),
					eventId: args.id,
				}

				// Log the verification attempt
				await db.audit.insert(auditIntegrityLog).values({
					auditLogId: parseInt(args.id),
					verificationTimestamp: new Date().toISOString(),
					verificationStatus: verificationResult.isValid ? 'success' : 'failure',
					verificationDetails: verificationResult,
					verifiedBy: context.session.session.userId,
					hashVerified: event[0].hash,
					expectedHash: verificationResult.expectedHash,
				})

				logger.info('GraphQL audit event verification completed', {
					eventId: args.id,
					organizationId,
					isValid: verificationResult.isValid,
					verifiedBy: context.session.session.userId,
				})

				return verificationResult
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to verify audit event via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							eventId: args.id,
						},
					},
					'graphql-api',
					'verifyAuditEvent'
				)

				throw new GraphQLError(`Failed to verify audit event: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	// Type resolvers for AuditEvent
	AuditEvent: {
		// Add any field-level resolvers if needed
	},
}
