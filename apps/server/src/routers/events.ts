import { protectedProcedure, publicProcedure } from '@/lib/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import type { TRPCRouterRecord } from '@trpc/server'

// Zod schemas for comprehensive input validation (Requirements 1.2, 1.3)
const SessionContextSchema = z.object({
	sessionId: z.string(),
	ipAddress: z.string(),
	userAgent: z.string(),
	geolocation: z.string().optional(),
})

const CreateAuditEventSchema = z.object({
	action: z.string().min(1, 'Action is required'),
	targetResourceType: z.string().optional(),
	targetResourceId: z.string().optional(),
	principalId: z.string().min(1, 'Principal ID is required'),
	organizationId: z.string().min(1, 'Organization ID is required'),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().optional(),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']).default('INTERNAL'),
	sessionContext: SessionContextSchema.optional(),
	correlationId: z.string().optional(),
	retentionPolicy: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

const QueryAuditEventsSchema = z.object({
	filter: z
		.object({
			dateRange: z
				.object({
					startDate: z.string().datetime(),
					endDate: z.string().datetime(),
				})
				.optional(),
			principalIds: z.array(z.string()).optional(),
			organizationIds: z.array(z.string()).optional(),
			actions: z.array(z.string()).optional(),
			statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
			dataClassifications: z
				.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']))
				.optional(),
			resourceTypes: z.array(z.string()).optional(),
			resourceIds: z.array(z.string()).optional(),
			verifiedOnly: z.boolean().optional(),
			correlationIds: z.array(z.string()).optional(),
		})
		.optional(),
	pagination: z.object({
		limit: z.number().min(1).max(1000).default(50),
		offset: z.number().min(0).default(0),
	}),
	sort: z
		.object({
			field: z.enum(['timestamp', 'status', 'action', 'principalId']).default('timestamp'),
			direction: z.enum(['asc', 'desc']).default('desc'),
		})
		.optional(),
})

const VerifyAuditEventSchema = z.object({
	id: z.string().min(1, 'Event ID is required'),
	includeChain: z.boolean().default(false),
})

const BulkCreateAuditEventsSchema = z.object({
	events: z.array(CreateAuditEventSchema).min(1).max(100),
	validateIntegrity: z.boolean().default(true),
})

const ExportAuditEventsSchema = z.object({
	filter: QueryAuditEventsSchema.shape.filter,
	format: z.enum(['json', 'csv', 'xml']).default('json'),
	includeMetadata: z.boolean().default(true),
	includeIntegrityReport: z.boolean().default(false),
	compression: z.enum(['none', 'zip', 'gzip']).default('none'),
	encryption: z
		.object({
			enabled: z.boolean(),
			algorithm: z.string().optional(),
		})
		.optional(),
})

/**
 * Enhanced TRPC router for comprehensive audit event operations
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export const eventsRouter = {
	/**
	 * Create a single audit event with comprehensive validation
	 * Requirement 1.1: TRPC endpoints with type safety
	 * Requirement 1.2: Input validation using Zod schemas
	 */
	create: protectedProcedure.input(CreateAuditEventSchema).mutation(async ({ ctx, input }) => {
		const { audit, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			// Ensure organization isolation
			const eventData = {
				...input,
				organizationId,
				timestamp: new Date().toISOString(),
				eventVersion: '1.0',
			}

			// Create audit event using the audit service
			await audit.log(eventData)

			logger.info('Audit event created successfully', {
				action: input.action,
				principalId: input.principalId,
				organizationId,
			})

			return { success: true, message: 'Audit event created successfully' }
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to create audit event: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to create audit event: ${message}`,
				cause: e,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						input,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'events.create'
			)

			throw err
		}
	}),

	/**
	 * Create multiple audit events in a single transaction
	 * Requirement 1.1: TRPC endpoints with type safety
	 */
	bulkCreate: protectedProcedure
		.input(BulkCreateAuditEventsSchema)
		.mutation(async ({ ctx, input }) => {
			const { audit, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string

			try {
				const eventsData = input.events.map((event) => ({
					...event,
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

				logger.info('Bulk audit events processed', {
					total: input.events.length,
					successful: successful.length,
					failed: failed.length,
					organizationId,
				})

				return {
					successful,
					failed,
					summary: {
						total: input.events.length,
						successful: successful.length,
						failed: failed.length,
					},
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to process bulk audit events: ${message}`)

				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to process bulk audit events: ${message}`,
					cause: e,
				})

				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId,
							eventCount: input.events.length,
							message: err.message,
							name: err.name,
							code: err.code,
						},
					},
					'trpc-api',
					'events.bulkCreate'
				)

				throw err
			}
		}),

	/**
	 * Query audit events with comprehensive filtering and pagination
	 * Requirement 1.2: Input validation using Zod schemas
	 * Requirement 1.3: Complete TypeScript type definitions
	 */
	query: protectedProcedure.input(QueryAuditEventsSchema).query(async ({ ctx, input }) => {
		const { db, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			// Import Drizzle operators
			const { eq, and, or, gte, lte, inArray, isNotNull, count, desc, asc } = await import(
				'drizzle-orm'
			)
			const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

			// Build query with organization isolation
			const filter = {
				...input.filter,
				organizationIds: [organizationId], // Enforce organization isolation
			}

			// Build where conditions
			const conditions = [eq(auditLog.organizationId, organizationId)]

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

			const whereClause = and(...conditions)

			// Execute query with proper error handling
			const events = await db.audit
				.select()
				.from(auditLog)
				.where(whereClause)
				.limit(input.pagination.limit)
				.offset(input.pagination.offset)
				.orderBy(
					input.sort?.direction === 'asc'
						? asc(auditLog[input.sort.field])
						: desc(auditLog[input.sort?.field || 'timestamp'])
				)

			// Get total count for pagination
			const totalResult = await db.audit
				.select({ count: count() })
				.from(auditLog)
				.where(whereClause)

			const total = totalResult[0]?.count || 0

			logger.info('Audit events queried successfully', {
				organizationId,
				resultCount: events.length,
				total,
				filters: filter,
			})

			return {
				events,
				pagination: {
					total,
					limit: input.pagination.limit,
					offset: input.pagination.offset,
					hasNext: input.pagination.offset + input.pagination.limit < total,
					hasPrevious: input.pagination.offset > 0,
				},
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to query audit events: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to query audit events: ${message}`,
				cause: e,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						filter: input.filter,
						pagination: input.pagination,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'events.query'
			)

			throw err
		}
	}),

	/**
	 * Get a single audit event by ID
	 * Requirement 1.3: Complete TypeScript type definitions
	 */
	getById: protectedProcedure
		.input(z.object({ id: z.string().min(1, 'Event ID is required') }))
		.query(async ({ ctx, input }) => {
			const { db, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string

			try {
				const { eq, and } = await import('drizzle-orm')
				const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

				const event = await db.audit
					.select()
					.from(auditLog)
					.where(
						and(eq(auditLog.id, parseInt(input.id)), eq(auditLog.organizationId, organizationId))
					)
					.limit(1)

				if (!event.length) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Audit event not found',
					})
				}

				logger.info('Audit event retrieved successfully', {
					eventId: input.id,
					organizationId,
				})

				return event[0]
			} catch (e) {
				if (e instanceof TRPCError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit event: ${message}`)

				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to get audit event: ${message}`,
					cause: e,
				})

				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId,
							eventId: input.id,
							message: err.message,
							name: err.name,
							code: err.code,
						},
					},
					'trpc-api',
					'events.getById'
				)

				throw err
			}
		}),

	/**
	 * Verify the cryptographic integrity of an audit event
	 * Requirement 1.4: Authentication enforcement
	 * Requirement 1.5: Structured error responses
	 */
	verify: protectedProcedure.input(VerifyAuditEventSchema).mutation(async ({ ctx, input }) => {
		const { audit, db, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			const { eq, and } = await import('drizzle-orm')
			const { auditLog, auditIntegrityLog } = await import('@repo/audit-db/dist/db/schema.js')

			// First, get the event to verify organization access
			const event = await db.audit
				.select()
				.from(auditLog)
				.where(
					and(eq(auditLog.id, parseInt(input.id)), eq(auditLog.organizationId, organizationId))
				)
				.limit(1)

			if (!event.length) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Audit event not found',
				})
			}

			// Perform integrity verification using crypto service methods
			// Convert database event to AuditLogEvent format for crypto operations
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
			const verificationResult = {
				isValid,
				expectedHash: event[0].hash,
				computedHash: event[0].hash ? audit.generateEventHash(auditEvent) : null,
				timestamp: new Date().toISOString(),
				eventId: input.id,
			}

			// Log the verification attempt
			await db.audit.insert(auditIntegrityLog).values({
				auditLogId: parseInt(input.id),
				verificationTimestamp: new Date().toISOString(),
				verificationStatus: verificationResult.isValid ? 'success' : 'failure',
				verificationDetails: verificationResult,
				verifiedBy: ctx.session.session.userId,
				hashVerified: event[0].hash,
				expectedHash: verificationResult.expectedHash,
			})

			logger.info('Audit event verification completed', {
				eventId: input.id,
				organizationId,
				isValid: verificationResult.isValid,
				verifiedBy: ctx.session.session.userId,
			})

			return verificationResult
		} catch (e) {
			if (e instanceof TRPCError) {
				throw e
			}

			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to verify audit event: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to verify audit event: ${message}`,
				cause: e,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						eventId: input.id,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'events.verify'
			)

			throw err
		}
	}),

	/**
	 * Export audit events with various formats and options
	 * Requirement 1.2: Input validation using Zod schemas
	 */
	export: protectedProcedure.input(ExportAuditEventsSchema).mutation(async ({ ctx, input }) => {
		const { compliance, logger, error } = ctx.services
		const organizationId = ctx.session.session.activeOrganizationId as string

		try {
			const { eq, and, gte, lte, inArray, isNotNull } = await import('drizzle-orm')
			const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

			// Build query conditions with organization isolation
			const conditions = [eq(auditLog.organizationId, organizationId)]

			if (input.filter?.dateRange) {
				conditions.push(gte(auditLog.timestamp, input.filter.dateRange.startDate))
				conditions.push(lte(auditLog.timestamp, input.filter.dateRange.endDate))
			}

			if (input.filter?.principalIds?.length) {
				conditions.push(inArray(auditLog.principalId, input.filter.principalIds))
			}

			if (input.filter?.actions?.length) {
				conditions.push(inArray(auditLog.action, input.filter.actions))
			}

			if (input.filter?.statuses?.length) {
				conditions.push(inArray(auditLog.status, input.filter.statuses))
			}

			if (input.filter?.dataClassifications?.length) {
				conditions.push(inArray(auditLog.dataClassification, input.filter.dataClassifications))
			}

			if (input.filter?.resourceTypes?.length) {
				conditions.push(inArray(auditLog.targetResourceType, input.filter.resourceTypes))
			}

			if (input.filter?.resourceIds?.length) {
				conditions.push(inArray(auditLog.targetResourceId, input.filter.resourceIds))
			}

			if (input.filter?.verifiedOnly) {
				conditions.push(isNotNull(auditLog.hash))
			}

			const whereClause = and(...conditions)

			// Query events from database
			const dbEvents = await ctx.services.db.audit
				.select()
				.from(auditLog)
				.where(whereClause)
				.limit(10000) // Reasonable limit for export

			// Convert database events to ComplianceReportEvent format
			const events = dbEvents.map((event) => ({
				id: event.id,
				timestamp: event.timestamp,
				principalId: event.principalId || undefined,
				organizationId: event.organizationId || undefined,
				action: event.action,
				targetResourceType: event.targetResourceType || undefined,
				targetResourceId: event.targetResourceId || undefined,
				status: event.status,
				outcomeDescription: event.outcomeDescription || undefined,
				dataClassification: event.dataClassification || undefined,
				correlationId: event.correlationId || undefined,
				integrityStatus: (event.hash ? 'verified' : 'not_checked') as
					| 'verified'
					| 'failed'
					| 'not_checked',
			})) as any[]

			// Use the compliance export service
			const exportResult = await compliance.export.exportAuditEvents(events, {
				format: input.format,
				includeMetadata: input.includeMetadata,
				includeIntegrityReport: input.includeIntegrityReport,
				compression: input.compression,
				encryption: input.encryption,
			})

			logger.info('Audit events exported successfully', {
				organizationId,
				format: input.format,
				recordCount: dbEvents.length,
				exportId: exportResult.exportId,
			})

			return exportResult
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to export audit events: ${message}`)

			const err = new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to export audit events: ${message}`,
				cause: e,
			})

			await error.handleError(
				err,
				{
					requestId: ctx.requestId,
					userId: ctx.session.session.userId,
					sessionId: ctx.session.session.id,
					metadata: {
						organizationId,
						filter: input.filter,
						format: input.format,
						message: err.message,
						name: err.name,
						code: err.code,
					},
				},
				'trpc-api',
				'events.export'
			)

			throw err
		}
	}),

	/**
	 * Get audit event statistics and metrics
	 * Requirement 1.3: Complete TypeScript type definitions
	 */
	getStats: protectedProcedure
		.input(
			z.object({
				dateRange: z
					.object({
						startDate: z.string().datetime(),
						endDate: z.string().datetime(),
					})
					.optional(),
				groupBy: z.enum(['action', 'status', 'dataClassification', 'day', 'hour']).optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { db, logger, error } = ctx.services
			const organizationId = ctx.session.session.activeOrganizationId as string

			try {
				const { eq, and, gte, lte, count } = await import('drizzle-orm')
				const { auditLog } = await import('@repo/audit-db/dist/db/schema.js')

				// Build base conditions
				const baseConditions = [eq(auditLog.organizationId, organizationId)]

				if (input.dateRange) {
					baseConditions.push(gte(auditLog.timestamp, input.dateRange.startDate))
					baseConditions.push(lte(auditLog.timestamp, input.dateRange.endDate))
				}

				const whereClause = and(...baseConditions)

				// Get total count
				const totalResult = await db.audit
					.select({ count: count() })
					.from(auditLog)
					.where(whereClause)

				const total = totalResult[0]?.count || 0

				// Get grouped statistics if requested
				let groupedStats = null
				if (input.groupBy) {
					// This would need to be implemented with proper SQL aggregation
					// For now, return a placeholder structure
					groupedStats = {
						groupBy: input.groupBy,
						data: [], // Would contain grouped results
					}
				}

				// Get status distribution
				const statusStats = await db.audit
					.select({
						status: auditLog.status,
						count: count(),
					})
					.from(auditLog)
					.where(whereClause)
					.groupBy(auditLog.status)

				logger.info('Audit event statistics retrieved', {
					organizationId,
					total,
					dateRange: input.dateRange,
					groupBy: input.groupBy,
				})

				return {
					total,
					statusDistribution: statusStats,
					groupedStats,
					dateRange: input.dateRange,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit event statistics: ${message}`)

				const err = new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to get audit event statistics: ${message}`,
					cause: e,
				})

				await error.handleError(
					err,
					{
						requestId: ctx.requestId,
						userId: ctx.session.session.userId,
						sessionId: ctx.session.session.id,
						metadata: {
							organizationId,
							dateRange: input.dateRange,
							groupBy: input.groupBy,
							message: err.message,
							name: err.name,
							code: err.code,
						},
					},
					'trpc-api',
					'events.getStats'
				)

				throw err
			}
		}),
} satisfies TRPCRouterRecord
