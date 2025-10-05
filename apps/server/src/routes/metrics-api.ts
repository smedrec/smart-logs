/**
 * @fileoverview Metrics and Monitoring REST API
 *
 * Provides REST API endpoints for system metrics and monitoring:
 * - System health and status
 * - Performance metrics
 * - Audit metrics and analytics
 * - Alert management
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

// Zod schemas for metrics
const SystemMetricsSchema = z.object({
	timestamp: z.string().datetime(),
	server: z.object({
		uptime: z.number(),
		memoryUsage: z.object({
			used: z.number(),
			total: z.number(),
			percentage: z.number(),
		}),
		cpuUsage: z.object({
			percentage: z.number(),
			loadAverage: z.array(z.number()),
		}),
	}),
	database: z.object({
		connectionCount: z.number(),
		activeQueries: z.number(),
		averageQueryTime: z.number(),
	}),
	redis: z.object({
		connectionCount: z.number(),
		memoryUsage: z.number(),
		keyCount: z.number(),
	}),
	api: z.object({
		requestsPerSecond: z.number(),
		averageResponseTime: z.number(),
		errorRate: z.number(),
	}),
})

const AuditMetricsSchema = z.object({
	eventsProcessed: z.number(),
	//processingLatency: z.number(),
	queueDepth: z.number(),
	errorsGenerated: z.number(),
	errorRate: z.number(),
	integrityViolations: z.number(),
	timestamp: z.string().datetime(),
	alertsGenerated: z.number(),
	suspiciousPatterns: z.number(),
	processingLatency: z.object({
		average: z.number(),
		p95: z.number(),
		p99: z.number(),
	}),
	integrityVerifications: z.object({
		total: z.number(),
		passed: z.number(),
		failed: z.number(),
	}),
	complianceReports: z.object({
		generated: z.number(),
		scheduled: z.number(),
		failed: z.number(),
	}),
})

const HealthStatusSchema = z.object({
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	timestamp: z.string().datetime(),
	environment: z.string(),
	version: z.string().optional(),
	services: z
		.object({
			database: z.enum(['healthy', 'degraded', 'unhealthy']),
			redis: z.enum(['healthy', 'degraded', 'unhealthy']),
			auth: z.enum(['healthy', 'degraded', 'unhealthy']),
		})
		.optional(),
	details: z.record(z.string(), z.any()).optional(),
})

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

const MetricsQuerySchema = z.object({
	timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
	groupBy: z.enum(['hour', 'day', 'week']).optional(),
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

const ErrorResponseSchema = z.object({
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.any()).optional(),
	timestamp: z.string().datetime(),
	requestId: z.string(),
	path: z.string().optional(),
})

const ResultSchema = z.object({
	success: z.boolean(),
})

// Route definitions
const getSystemMetricsRoute = createRoute({
	method: 'get',
	path: '/system',
	tags: ['Metrics'],
	summary: 'Get system metrics',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	responses: {
		200: {
			description: 'System metrics retrieved successfully',
			content: {
				'application/json': {
					schema: SystemMetricsSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getAuditMetricsRoute = createRoute({
	method: 'get',
	path: '/audit',
	tags: ['Metrics'],
	summary: 'Get audit metrics',
	description:
		'Retrieves audit-specific metrics including event processing, integrity verifications, and compliance reports.',
	request: {
		query: MetricsQuerySchema,
	},
	responses: {
		200: {
			description: 'Audit metrics retrieved successfully',
			content: {
				'application/json': {
					schema: AuditMetricsSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getHealthStatusRoute = createRoute({
	method: 'get',
	path: '/health/detailed',
	tags: ['Health'],
	summary: 'Get detailed health status',
	description: 'Retrieves detailed health status including individual service health checks.',
	responses: {
		200: {
			description: 'Health status retrieved successfully',
			content: {
				'application/json': {
					schema: HealthStatusSchema,
				},
			},
		},
		503: {
			description: 'Service unavailable',
			content: {
				'application/json': {
					schema: HealthStatusSchema,
				},
			},
		},
	},
})

const getAlertsRoute = createRoute({
	method: 'get',
	path: '/alerts',
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
	path: '/alerts/statistics',
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
	path: '/alerts/{id}/acknowledge',
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
	path: '/alerts/{id}/resolve',
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
	path: '/alerts/{id}/dismiss',
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
 * Create metrics API router
 */
export function createMetricsAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Get system metrics
	app.openapi(getSystemMetricsRoute, async (c) => {
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
			// Get comprehensive system metrics
			const metrics = await monitor.metrics.getSystemMetrics()

			logger.info('Retrieved system metrics', { requestId, userId: session.session.userId })

			return c.json(metrics, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get system metrics', message, {
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

	// Get audit metrics
	app.openapi(getAuditMetricsRoute, async (c) => {
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
			const query = c.req.valid('query')

			// Get audit-specific metrics
			const metrics = await monitor.metrics.getAuditMetrics()

			logger.info('Retrieved audit metrics', {
				requestId,
				timeRange: query.timeRange,
				userId: session.session.userId,
			})

			return c.json(metrics, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get audit metrics', message, {
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

	// Get detailed health status
	app.openapi(getHealthStatusRoute, async (c) => {
		const { monitor, logger } = c.get('services')

		try {
			// Get detailed health status
			// For now, return placeholder health status
			const health = {
				status: 'healthy' as const,
				timestamp: new Date().toISOString(),
				environment: 'development',
				version: '1.0.0',
				services: {
					database: 'healthy' as const,
					redis: 'healthy' as const,
					auth: 'healthy' as const,
				},
			}

			const statusCode = health.status === 'healthy' ? 200 : 503

			return c.json(health, statusCode)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get health status: ${message}`)

			return c.json(
				{
					status: 'unhealthy' as const,
					timestamp: new Date().toISOString(),
					environment: 'unknown',
					details: { error: message },
				},
				503
			)
		}
	})

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
			const alerts = await monitor.alert.getAlerts({
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
			const stats = await monitor.alert.getAlertStatistics(organizationId)

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
			const result = await monitor.alert.acknowledgeAlert(id, session.session.userId)

			if (!alert) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Alert not found',
				})
			}

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
			const result = await monitor.alert.resolveAlert(id, userId, {
				resolvedBy: userId,
				resolutionNotes: resolution,
			})

			if (!result) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Alert not found',
				})
			}

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
			const result = await monitor.alert.dismissAlert(id, session.session.userId)

			if (!alert) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Alert not found',
				})
			}

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
