import { publicProcedure, router } from '@/lib/trpc'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { auditLog } from '@repo/audit-db'

/**
 * Performance router with optimized procedures
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: TRPC performance optimization implementation
 */

const paginationSchema = z.object({
	limit: z.number().min(1).max(1000).optional().default(50),
	offset: z.number().min(0).optional().default(0),
	cursor: z.string().optional(),
	sort: z
		.object({
			field: z.string(),
			direction: z.enum(['asc', 'desc']).default('desc'),
		})
		.optional(),
})

const streamingOptionsSchema = z.object({
	format: z.enum(['json', 'csv', 'ndjson']).default('json'),
	chunkSize: z.number().min(100).max(10000).optional().default(1000),
	compression: z.boolean().optional().default(false),
})

export const performanceRouter = router({
	/**
	 * Get performance metrics
	 */
	getMetrics: publicProcedure.query(async ({ ctx }) => {
		const { services } = ctx

		if (!services.performance) {
			throw new Error('Performance service not available')
		}

		return services.performance.getMetrics()
	}),

	/**
	 * Get performance health status
	 */
	getHealthStatus: publicProcedure.query(async ({ ctx }) => {
		const { services } = ctx

		if (!services.performance) {
			throw new Error('Performance service not available')
		}

		return services.performance.healthCheck()
	}),

	/**
	 * Optimized audit events query with caching and pagination
	 */
	getOptimizedAuditEvents: publicProcedure
		.input(
			z.object({
				filter: z
					.object({
						dateRange: z
							.object({
								startDate: z.string(),
								endDate: z.string(),
							})
							.optional(),
						principalIds: z.array(z.string()).optional(),
						organizationIds: z.array(z.string()).optional(),
						actions: z.array(z.string()).optional(),
						statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
					})
					.optional(),
				pagination: paginationSchema,
				useCache: z.boolean().optional().default(true),
				cacheTTL: z.number().min(60).max(3600).optional().default(300), // 5 minutes
			})
		)
		.query(async ({ input, ctx }) => {
			const { services } = ctx
			const { filter, pagination, useCache, cacheTTL } = input

			if (!services.performance) {
				// Fallback to direct database query
				const events = await services.client.executeOptimizedQuery(async (db) => {
					let query = db.select().from(auditLog)

					// Apply filters
					if (filter?.dateRange) {
						// Add date range filter
					}
					if (filter?.principalIds?.length) {
						// Add principal filter
					}
					if (filter?.organizationIds?.length) {
						// Add organization filter
					}

					return query.limit(pagination.limit).offset(pagination.offset)
				})

				return {
					data: events,
					pagination: {
						limit: pagination.limit,
						offset: pagination.offset,
						hasNext: false,
						hasPrevious: false,
					},
				}
			}

			// Generate cache key
			const cacheKey = services.performance.generateCacheKey('audit_events', {
				filter,
				pagination,
			})

			// Execute optimized query with caching
			const result = await services.performance.executeOptimized(
				async () => {
					const events = await services.client.executeOptimizedQuery(
						async (db) => {
							let query = db.select().from(auditLog)

							// Apply filters
							if (filter?.dateRange) {
								// Add date range filter
							}
							if (filter?.principalIds?.length) {
								// Add principal filter
							}
							if (filter?.organizationIds?.length) {
								// Add organization filter
							}

							return query.limit(pagination.limit).offset(pagination.offset)
						},
						{
							cacheKey: useCache ? `db_${cacheKey}` : undefined,
							cacheTTL,
						}
					)

					return services.performance.createPaginatedResponse(events, pagination)
				},
				{
					cacheKey: useCache ? cacheKey : undefined,
					cacheTTL,
					skipCache: !useCache,
				}
			)

			return result
		}),

	/**
	 * Streaming audit events export
	 */
	streamAuditEvents: publicProcedure
		.input(
			z.object({
				filter: z
					.object({
						dateRange: z
							.object({
								startDate: z.string(),
								endDate: z.string(),
							})
							.optional(),
						organizationIds: z.array(z.string()).optional(),
					})
					.optional(),
				streaming: streamingOptionsSchema,
			})
		)
		.query(async ({ input, ctx }) => {
			const { services } = ctx
			const { filter, streaming } = input

			if (!services.performance) {
				throw new Error('Performance service not available')
			}

			// Create async generator for streaming data
			async function* generateAuditEvents() {
				let offset = 0
				const chunkSize = streaming.chunkSize

				while (true) {
					const events = await services.client.executeOptimizedQuery(async (db) => {
						let query = db.select().from(auditLog)

						// Apply filters
						if (filter?.dateRange) {
							// Add date range filter
						}
						if (filter?.organizationIds?.length) {
							// Add organization filter
						}

						return query.limit(chunkSize).offset(offset)
					})

					if (events.length === 0) break

					yield events
					offset += chunkSize

					// Prevent infinite loops
					if (offset > 1000000) break
				}
			}

			// Note: This would need to be handled differently in TRPC
			// as it doesn't support streaming responses directly
			// This is more of a conceptual implementation
			return {
				message: 'Streaming not supported in TRPC. Use REST API for streaming.',
				totalEstimate: 'Use /api/v1/audit/events/stream endpoint',
			}
		}),

	/**
	 * Bulk operations with concurrency control
	 */
	bulkCreateAuditEvents: publicProcedure
		.input(
			z.object({
				events: z
					.array(
						z.object({
							action: z.string(),
							targetResourceType: z.string(),
							targetResourceId: z.string().optional(),
							principalId: z.string(),
							organizationId: z.string(),
							status: z.enum(['attempt', 'success', 'failure']),
							outcomeDescription: z.string().optional(),
							dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
							metadata: z.record(z.string(), z.any()).optional(),
						})
					)
					.min(1)
					.max(100), // Limit bulk size
				batchSize: z.number().min(1).max(50).optional().default(10),
			})
		)
		.mutation(async ({ input, ctx }) => {
			const { services } = ctx
			const { events, batchSize } = input

			if (!services.performance) {
				// Fallback to sequential processing
				const results = []
				for (const event of events) {
					const result = await services.audit.log({
						...event,
						timestamp: new Date(),
						sessionContext: {},
					})
					results.push(result)
				}
				return { created: results.length, results }
			}

			// Process in batches with concurrency control
			const results = []
			const batches = []

			// Split into batches
			for (let i = 0; i < events.length; i += batchSize) {
				batches.push(events.slice(i, i + batchSize))
			}

			// Process batches with performance optimization
			for (const batch of batches) {
				const batchResults = await services.performance.executeOptimized(
					async () => {
						const promises = batch.map((event) =>
							services.audit.log({
								...event,
								timestamp: new Date(),
								sessionContext: {},
							})
						)
						return Promise.all(promises)
					},
					{
						skipCache: true, // Don't cache bulk operations
						skipQueue: false, // Use concurrency control
					}
				)

				results.push(...batchResults)
			}

			// Invalidate related caches
			await services.performance.invalidateCache('audit_events*')

			return {
				created: results.length,
				batches: batches.length,
				results: results.slice(0, 10), // Return first 10 for verification
			}
		}),

	/**
	 * Cache management operations
	 */
	cacheOperations: router({
		/**
		 * Get cache statistics
		 */
		getStats: publicProcedure.query(async ({ ctx }) => {
			const { services } = ctx

			if (!services.performance) {
				throw new Error('Performance service not available')
			}

			const metrics = services.performance.getMetrics()
			return metrics.cacheStats
		}),

		/**
		 * Invalidate cache by pattern
		 */
		invalidate: publicProcedure
			.input(
				z.object({
					pattern: z.string().min(1),
				})
			)
			.mutation(async ({ input, ctx }) => {
				const { services } = ctx
				const { pattern } = input

				if (!services.performance) {
					throw new Error('Performance service not available')
				}

				const invalidated = await services.performance.invalidateCache(pattern)

				return {
					pattern,
					invalidated,
					timestamp: new Date(),
				}
			}),

		/**
		 * Warm up cache with common queries
		 */
		warmUp: publicProcedure
			.input(
				z.object({
					organizationIds: z.array(z.string()).optional(),
					preloadDays: z.number().min(1).max(30).optional().default(7),
				})
			)
			.mutation(async ({ input, ctx }) => {
				const { services } = ctx
				const { organizationIds, preloadDays } = input

				if (!services.performance) {
					throw new Error('Performance service not available')
				}

				const endDate = new Date()
				const startDate = new Date(endDate.getTime() - preloadDays * 24 * 60 * 60 * 1000)

				const warmUpQueries = [
					// Recent events
					{
						key: 'recent_events',
						query: () =>
							services.client.executeOptimizedQuery(
								async (db) => db.select().from(auditLog).limit(100).orderBy(auditLog.timestamp),
								{ cacheKey: 'recent_events', cacheTTL: 300 }
							),
					},
					// Organization-specific queries
					...(organizationIds || []).map((orgId) => ({
						key: `org_events_${orgId}`,
						query: () =>
							services.client.executeOptimizedQuery(
								async (db) =>
									db.select().from(auditLog).where(eq(auditLog.organizationId, orgId)).limit(50),
								{ cacheKey: `org_events_${orgId}`, cacheTTL: 600 }
							),
					})),
				]

				const results = await Promise.allSettled(
					warmUpQueries.map(({ key, query }) =>
						services.performance!.executeOptimized(query, {
							cacheKey: key,
							cacheTTL: 600,
						})
					)
				)

				const successful = results.filter((r) => r.status === 'fulfilled').length
				const failed = results.filter((r) => r.status === 'rejected').length

				return {
					warmedUp: successful,
					failed,
					total: warmUpQueries.length,
					timestamp: new Date(),
				}
			}),
	}),

	/**
	 * Database optimization operations
	 */
	databaseOptimization: router({
		/**
		 * Get database performance report
		 */
		getReport: publicProcedure.query(async ({ ctx }) => {
			const { services } = ctx

			return services.client.generatePerformanceReport()
		}),

		/**
		 * Run database optimization
		 */
		optimize: publicProcedure.mutation(async ({ ctx }) => {
			const { services } = ctx

			const result = await services.client.optimizeDatabase()

			return {
				...result,
				timestamp: new Date(),
			}
		}),

		/**
		 * Get database health status
		 */
		getHealthStatus: publicProcedure.query(async ({ ctx }) => {
			const { services } = ctx

			return services.client.getHealthStatus()
		}),
	}),
})
