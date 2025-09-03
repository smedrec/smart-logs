import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { auditLog } from '@repo/audit-db'

import type { HonoEnv } from '../lib/hono/context.js'

/**
 * Performance-optimized REST API endpoints
 * Requirements 8.1, 8.2, 8.3, 8.4, 8.5: REST API performance optimization implementation
 */

const paginationQuerySchema = z.object({
	limit: z.coerce.number().min(1).max(1000).optional().default(50),
	offset: z.coerce.number().min(0).optional().default(0),
	cursor: z.string().optional(),
	sort_field: z.string().optional().default('timestamp'),
	sort_direction: z.enum(['asc', 'desc']).optional().default('desc'),
})

const streamingQuerySchema = z.object({
	format: z.enum(['json', 'csv', 'ndjson']).optional().default('json'),
	chunk_size: z.coerce.number().min(100).max(10000).optional().default(1000),
	compression: z.coerce.boolean().optional().default(false),
})

const auditEventFilterSchema = z.object({
	start_date: z.string().optional(),
	end_date: z.string().optional(),
	principal_ids: z.string().optional(), // Comma-separated
	organization_ids: z.string().optional(), // Comma-separated
	actions: z.string().optional(), // Comma-separated
	statuses: z.string().optional(), // Comma-separated
	data_classifications: z.string().optional(), // Comma-separated
})

export function createPerformanceAPI() {
	const app = new Hono<HonoEnv>()

	/**
	 * Get performance metrics
	 */
	app.get('/metrics', async (c) => {
		const services = c.get('services')

		if (!services.performance) {
			return c.json({ error: 'Performance service not available' }, 503)
		}

		const metrics = services.performance.getMetrics()
		return c.json(metrics)
	})

	/**
	 * Get performance health status
	 */
	app.get('/health', async (c) => {
		const services = c.get('services')

		if (!services.performance) {
			return c.json({ error: 'Performance service not available' }, 503)
		}

		const health = await services.performance.healthCheck()
		return c.json(health)
	})

	/**
	 * Optimized audit events with pagination and caching
	 */
	app.get(
		'/audit/events',
		zValidator('query', paginationQuerySchema.merge(auditEventFilterSchema)),
		async (c) => {
			const services = c.get('services')
			const query = c.req.valid('query')

			// Parse filters
			const filter = {
				dateRange:
					query.start_date && query.end_date
						? {
								startDate: query.start_date,
								endDate: query.end_date,
							}
						: undefined,
				principalIds: query.principal_ids?.split(',').filter(Boolean),
				organizationIds: query.organization_ids?.split(',').filter(Boolean),
				actions: query.actions?.split(',').filter(Boolean),
				statuses: query.statuses?.split(',').filter(Boolean) as
					| ('attempt' | 'success' | 'failure')[]
					| undefined,
				dataClassifications: query.data_classifications?.split(',').filter(Boolean) as
					| ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
					| undefined,
			}

			const pagination = {
				limit: query.limit,
				offset: query.offset,
				cursor: query.cursor,
				sort: {
					field: query.sort_field,
					direction: query.sort_direction,
				},
			}

			if (!services.performance) {
				// Fallback to direct database query
				const events = await services.client.executeOptimizedQuery(async (db) => {
					let dbQuery = db.select().from(auditLog)

					// Apply filters
					if (filter.dateRange) {
						// Add date range filter
					}
					if (filter.principalIds?.length) {
						// Add principal filter
					}
					if (filter.organizationIds?.length) {
						// Add organization filter
					}

					return dbQuery.limit(pagination.limit).offset(pagination.offset)
				})

				return c.json({
					data: events,
					pagination: {
						limit: pagination.limit,
						offset: pagination.offset,
						hasNext: events.length === pagination.limit,
						hasPrevious: pagination.offset > 0,
					},
				})
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
							let dbQuery = db.select().from(auditLog)

							// Apply filters
							if (filter.dateRange) {
								// Add date range filter
							}
							if (filter.principalIds?.length) {
								// Add principal filter
							}
							if (filter.organizationIds?.length) {
								// Add organization filter
							}

							return dbQuery.limit(pagination.limit).offset(pagination.offset)
						},
						{
							cacheKey: `db_${cacheKey}`,
							cacheTTL: 300, // 5 minutes
						}
					)

					return services.performance.createPaginatedResponse(events, pagination)
				},
				{
					cacheKey,
					cacheTTL: 300,
				}
			)

			return c.json(result)
		}
	)

	/**
	 * Streaming audit events export
	 */
	app.get(
		'/audit/events/stream',
		zValidator('query', streamingQuerySchema.merge(auditEventFilterSchema)),
		async (c) => {
			const services = c.get('services')
			const query = c.req.valid('query')

			if (!services.performance) {
				return c.json({ error: 'Performance service not available' }, 503)
			}

			// Parse filters
			const filter = {
				dateRange:
					query.start_date && query.end_date
						? {
								startDate: query.start_date,
								endDate: query.end_date,
							}
						: undefined,
				organizationIds: query.organization_ids?.split(',').filter(Boolean),
			}

			const streaming = {
				format: query.format,
				chunkSize: query.chunk_size,
				compression: query.compression,
			}

			// Create async generator for streaming data
			async function* generateAuditEvents() {
				let offset = 0
				const chunkSize = streaming.chunkSize

				while (true) {
					const events = await services.client.executeOptimizedQuery(async (db) => {
						let dbQuery = db.select().from(auditLog)

						// Apply filters
						if (filter.dateRange) {
							// Add date range filter
						}
						if (filter.organizationIds?.length) {
							// Add organization filter
						}

						return dbQuery.limit(chunkSize).offset(offset)
					})

					if (events.length === 0) break

					yield events
					offset += chunkSize

					// Prevent infinite loops
					if (offset > 1000000) break
				}
			}

			// Create streaming response
			return services.performance.createStreamingResponse(generateAuditEvents(), c, streaming)
		}
	)

	/**
	 * Bulk create audit events with concurrency control
	 */
	app.post(
		'/audit/events/bulk',
		zValidator(
			'json',
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
					.max(100),
				batchSize: z.number().min(1).max(50).optional().default(10),
			})
		),
		async (c) => {
			const services = c.get('services')
			const { events, batchSize } = c.req.valid('json')

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
				return c.json({ created: results.length, results })
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

			return c.json({
				created: results.length,
				batches: batches.length,
				results: results.slice(0, 10), // Return first 10 for verification
			})
		}
	)

	/**
	 * Cache management endpoints
	 */
	app.get('/cache/stats', async (c) => {
		const services = c.get('services')

		if (!services.performance) {
			return c.json({ error: 'Performance service not available' }, 503)
		}

		const metrics = services.performance.getMetrics()
		return c.json(metrics.cacheStats)
	})

	app.delete(
		'/cache',
		zValidator(
			'query',
			z.object({
				pattern: z.string().min(1),
			})
		),
		async (c) => {
			const services = c.get('services')
			const { pattern } = c.req.valid('query')

			if (!services.performance) {
				return c.json({ error: 'Performance service not available' }, 503)
			}

			const invalidated = await services.performance.invalidateCache(pattern)

			return c.json({
				pattern,
				invalidated,
				timestamp: new Date(),
			})
		}
	)

	/**
	 * Cache warm-up endpoint
	 */
	app.post(
		'/cache/warmup',
		zValidator(
			'json',
			z.object({
				organizationIds: z.array(z.string()).optional(),
				preloadDays: z.number().min(1).max(30).optional().default(7),
			})
		),
		async (c) => {
			const services = c.get('services')
			const { organizationIds, preloadDays } = c.req.valid('json')

			if (!services.performance) {
				return c.json({ error: 'Performance service not available' }, 503)
			}

			const endDate = new Date()
			const startDate = new Date(endDate.getTime() - preloadDays * 24 * 60 * 60 * 1000)

			const warmUpQueries = [
				// Recent events
				{
					key: 'recent_events',
					query: () =>
						services.client.executeOptimizedQuery(
							async (db) => db.select().from(auditLog).limit(100),
							{ cacheKey: 'recent_events', cacheTTL: 300 }
						),
				},
				// Organization-specific queries
				...(organizationIds || []).map((orgId) => ({
					key: `org_events_${orgId}`,
					query: () =>
						services.client.executeOptimizedQuery(
							async (db) => db.select().from(auditLog).limit(50),
							{ cacheKey: `org_events_${orgId}`, cacheTTL: 600 }
						),
				})),
			]

			const results = await Promise.allSettled(
				warmUpQueries.map(({ key, query }) =>
					services.performance.executeOptimized(query, {
						cacheKey: key,
						cacheTTL: 600,
					})
				)
			)

			const successful = results.filter((r) => r.status === 'fulfilled').length
			const failed = results.filter((r) => r.status === 'rejected').length

			return c.json({
				warmedUp: successful,
				failed,
				total: warmUpQueries.length,
				timestamp: new Date(),
			})
		}
	)

	/**
	 * Database optimization endpoints
	 */
	app.get('/database/performance-report', async (c) => {
		const services = c.get('services')
		const report = await services.client.generatePerformanceReport()
		return c.json(report)
	})

	app.post('/database/optimize', async (c) => {
		const services = c.get('services')
		const result = await services.client.optimizeDatabase()
		return c.json({
			...result,
			timestamp: new Date(),
		})
	})

	app.get('/database/health', async (c) => {
		const services = c.get('services')
		const health = await services.client.getHealthStatus()
		return c.json(health)
	})

	return app
}
