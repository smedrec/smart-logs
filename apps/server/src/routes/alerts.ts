/**
 * @fileoverview Alerts REST API
 *
 * Provides REST API endpoints for system alerts:
 * - Alert management
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

const AlertSchema = z.object({
	id: z.string(),
	severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
	type: z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM', 'METRICS', 'CUSTOM']),
	title: z.string(),
	description: z.string(),
	createdAt: z.string().datetime(),
	source: z.string(),
	status: z.enum(['active', 'acknowledged', 'resolved', 'dismissed']),
	acknowledged: z.boolean(),
	resolved: z.boolean(),
	tags: z.array(z.string()),
	metadata: z.record(z.string(), z.any()).optional(),
})

const AlertQuerySchema = z.object({
	acknowledged: z.boolean().optional(),
	resolved: z.boolean().optional(),
	severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
	type: z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM', 'METRICS']).optional(),
	source: z.string().optional(),
	status: z.enum(['active', 'acknowledged', 'resolved', 'dismissed']).optional(),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 0)),
	orderBy: z.enum(['createdAt', 'updatedAt', 'severity']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})

const ResultSchema = z.object({
	success: z.boolean(),
})

const getAlertsRoute = createRoute({
	method: 'get',
	path: '/',
	tags: ['Alerts'],
	summary: 'Get system alerts',
	description: 'Retrieves system alerts with optional filtering.',
	request: {
		query: AlertQuerySchema,
	},
	responses: {
		200: {
			description: 'Alerts retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						data: z.array(AlertSchema),
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

const getAlertStatisticsRoute = createRoute({
	method: 'get',
	path: '/statistics',
	tags: ['Alerts'],
	summary: 'Get alert statistics',
	description: 'Retrieves statistics about alerts such as counts by severity and type.',
	responses: {
		200: {
			description: 'Alert statistics retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						total: z.number(),
						active: z.number(),
						acknowledged: z.number(),
						resolved: z.number(),
						bySeverity: z.record(z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), z.number()),
						byType: z.record(
							z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM', 'METRICS', 'CUSTOM']),
							z.number()
						),
						recentAlerts: z.array(AlertSchema).optional(),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const acknowledgeAlertRoute = createRoute({
	method: 'post',
	path: '/{id}/acknowledge',
	tags: ['Alerts'],
	summary: 'Acknowledge an alert',
	description: 'Acknowledges an active alert.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Alert acknowledged successfully',
			content: {
				'application/json': {
					schema: ResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const resolveAlertRoute = createRoute({
	method: 'post',
	path: '/{id}/resolve',
	tags: ['Alerts'],
	summary: 'Resolve an alert',
	description: 'Resolves an alert with a resolution note.',
	request: {
		params: z.object({
			id: z.string(),
		}),
		body: {
			content: {
				'application/json': {
					schema: z.object({
						resolution: z.string().min(1).max(500),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Alert resolved successfully',
			content: {
				'application/json': {
					schema: ResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const dismissAlertRoute = createRoute({
	method: 'post',
	path: '/{id}/dismiss',
	tags: ['Alerts'],
	summary: 'Dismiss an alert',
	description: 'Dismisses an alert.',
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: 'Alert dismissed successfully',
			content: {
				'application/json': {
					schema: ResultSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

/**
 * Create alerts API router
 */
export function createAlertsAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Get alerts
	app.openapi(getAlertsRoute, async (c) => {
		const { monitor, performance, logger } = c.get('services')
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

			// Get alerts
			const alerts = await monitor.alerts.getAlerts({
				organizationId,
				...query,
			})

			const response = performance.createPaginatedResponse(alerts, {
				limit: query.limit || 50,
				offset: query.offset || 0,
			})

			logger.info('Retrieved alerts', {
				requestId,
				count: alerts.length,
				total: response.pagination.total,
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
			logger.error('Failed to get alerts', message, {
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

	app.openapi(getAlertStatisticsRoute, async (c) => {
		const { monitor, logger } = c.get('services')
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
			// Get alert statistics
			const stats = await monitor.alerts.getAlertStatistics(organizationId)

			logger.info('Retrieved alert statistics', { requestId, userId: session.session.userId })

			return c.json(stats, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get alert statistics', message, {
				requestId,
				error: message,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Acknowledge alert
	app.openapi(acknowledgeAlertRoute, async (c) => {
		const { monitor, logger } = c.get('services')
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

			// Acknowledge alert using enhanced alerting service
			const result = await monitor.alerts.acknowledgeAlert(id, session.session.userId)

			/**if (!alert) {
        throw new ApiError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        })
      }*/

			logger.info('Alert acknowledged', {
				requestId,
				alertId: id,
				userId: session.session.userId,
			})

			return c.json(result, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to acknowledge alert', message, {
				requestId,
				alertId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Resolve alert
	app.openapi(resolveAlertRoute, async (c) => {
		const { monitor, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const userId = session?.session.userId

		try {
			const { id } = c.req.valid('param')
			const { resolution } = c.req.valid('json')

			// Resolve alert
			const result = await monitor.alerts.resolveAlert(id, userId, {
				resolvedBy: userId,
				resolutionNotes: resolution,
			})

			/**if (!result) {
        throw new ApiError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        })
      }*/

			logger.info('Alert resolved', {
				requestId,
				alertId: id,
				resolution,
				userId: session.session.userId,
			})

			return c.json(result, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to resolve alert', message, {
				requestId,
				alertId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Dismiss alert
	app.openapi(dismissAlertRoute, async (c) => {
		const { monitor, logger } = c.get('services')
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

			// Acknowledge alert using enhanced alerting service
			const result = await monitor.alerts.dismissAlert(id, session.session.userId)

			/**if (!alert) {
        throw new ApiError({
          code: 'NOT_FOUND',
          message: 'Alert not found',
        })
      }*/

			logger.info('Alert dismissed', {
				requestId,
				alertId: id,
				userId: session.session.userId,
			})

			return c.json(result, 200)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to dismiss alert', message, {
				requestId,
				alertId: c.req.param('id'),
				error: message,
				userId: session?.session.userId,
			})

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
