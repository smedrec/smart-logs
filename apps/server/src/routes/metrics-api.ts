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
import { MetricsCollectionService } from '@/lib/services/metrics'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { QueryBuilder } from 'drizzle-orm/singlestore-core'

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
	processingLatency: z.number(),
	queueDepth: z.number(),
	errorsGenerated: z.number(),
	errorRate: z.number(),
	integrityViolations: z.number(),
	timestamp: z.string().datetime(),
	alertsGenerated: z.number(),
	suspiciousPatterns: z.number(),
	/*
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
	*/
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
	severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
	type: z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM', 'METRICS']),
	title: z.string(),
	description: z.string(),
	timestamp: z.string().datetime(),
	source: z.string(),
	acknowledged: z.boolean(),
	resolved: z.boolean(),
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
						alerts: z.array(AlertSchema),
						pagination: z.object({
							total: z.number(),
							limit: z.number(),
							offset: z.number(),
							hasNext: z.boolean(),
							hasPrevious: z.boolean(),
						}),
					}),
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
					schema: AlertSchema,
				},
			},
		},
		404: {
			description: 'Alert not found',
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

const resolveAlertRoute = createRoute({
	method: 'post',
	path: '/alerts/{id}/resolve',
	tags: ['Alerts'],
	summary: 'Resolve an alert',
	description: 'Resolves an alert with a resolution note.',
	request: {
		params: z.object({
			id: z.string().uuid(),
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
					schema: AlertSchema,
				},
			},
		},
		404: {
			description: 'Alert not found',
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
 * Create metrics API router
 */
export function createMetricsAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Initialize metrics service
	let metricsService: MetricsCollectionService | null = null

	// Middleware to initialize metrics service
	app.use('*', async (c, next) => {
		if (!metricsService) {
			const { redis, logger } = c.get('services')
			metricsService = new MetricsCollectionService(redis, logger)
		}
		await next()
	})

	// Get system metrics
	app.openapi(getSystemMetricsRoute, async (c) => {
		const { logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			if (!metricsService) {
				throw new Error('Metrics service not initialized')
			}

			// Get comprehensive system metrics
			const metrics = await metricsService.getSystemMetrics()

			logger.info('Retrieved system metrics', { requestId, userId: session.session.userId })

			return c.json(metrics)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get system metrics', {
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

			if (!metricsService) {
				throw new Error('Metrics service not initialized')
			}

			// Get audit-specific metrics
			const metrics = await monitor.metrics.getMetrics()

			logger.info('Retrieved audit metrics', {
				requestId,
				timeRange: query.timeRange,
				userId: session.session.userId,
			})

			return c.json(metrics)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get audit metrics', {
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
			const query = c.req.valid('query')

			// Get alerts
			const alerts = await monitor.alert.getAlerts({
				organizationId,
				...query,
			})

			const total = alerts.length

			const result = {
				alerts,
				pagination: {
					total,
					limit: query.limit || 50,
					offset: query.offset || 0,
					hasNext: query.offset + query.limit < total,
					hasPrevious: query.offset > 0,
				},
			}

			logger.info('Retrieved alerts', {
				requestId,
				count: alerts.length,
				total,
				userId: session.session.userId,
			})

			return c.json(result)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get alerts', {
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
			const alert = await monitor.alert.acknowledgeAlert(id, session.session.userId)

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

			return c.json(alert)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to acknowledge alert', {
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
			const alert = await monitor.alert.resolveAlert(id, userId, {
				resolvedBy: userId,
				resolutionNotes: resolution,
			})

			if (!alert) {
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

			return c.json(alert)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to resolve alert', {
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
