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
	timestamp: z.string().datetime(),
	eventsProcessed: z.number(),
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
	id: z.string().uuid(),
	severity: z.enum(['low', 'medium', 'high', 'critical']),
	title: z.string(),
	description: z.string(),
	timestamp: z.string().datetime(),
	status: z.enum(['active', 'acknowledged', 'resolved']),
	source: z.string(),
	metadata: z.record(z.string(), z.any()).optional(),
})

const MetricsQuerySchema = z.object({
	timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
	groupBy: z.enum(['hour', 'day', 'week']).optional(),
})

const AlertQuerySchema = z.object({
	severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
	status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
	source: z.string().optional(),
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 50)),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val) : 0)),
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
			id: z.string().uuid(),
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

	// Get system metrics
	app.openapi(getSystemMetricsRoute, async (c) => {
		const { monitor, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			// Get system metrics
			// For now, return placeholder metrics
			const metrics = {
				timestamp: new Date().toISOString(),
				server: {
					uptime: process.uptime(),
					memoryUsage: {
						used: process.memoryUsage().heapUsed,
						total: process.memoryUsage().heapTotal,
						percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
					},
					cpuUsage: {
						percentage: 0,
						loadAverage: [0, 0, 0],
					},
				},
				database: {
					connectionCount: 1,
					activeQueries: 0,
					averageQueryTime: 10,
				},
				redis: {
					connectionCount: 1,
					memoryUsage: 1024 * 1024,
					keyCount: 100,
				},
				api: {
					requestsPerSecond: 10,
					averageResponseTime: 50,
					errorRate: 0.01,
				},
			}

			logger.info('Retrieved system metrics')

			return c.json(metrics)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get system metrics: ${message}`)

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

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const query = c.req.valid('query')

			// Get audit metrics
			// For now, return placeholder metrics
			const metrics = {
				timestamp: new Date().toISOString(),
				eventsProcessed: 1000,
				processingLatency: {
					average: 25,
					p95: 50,
					p99: 100,
				},
				integrityVerifications: {
					total: 100,
					passed: 98,
					failed: 2,
				},
				complianceReports: {
					generated: 10,
					scheduled: 5,
					failed: 0,
				},
			}

			logger.info('Retrieved audit metrics')

			return c.json(metrics)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get audit metrics: ${message}`)

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

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const query = c.req.valid('query')

			// Get alerts
			// For now, return placeholder alerts
			const result = {
				alerts: [],
				pagination: {
					total: 0,
					limit: query.limit || 50,
					offset: query.offset || 0,
					hasNext: false,
					hasPrevious: false,
				},
			}

			logger.info(`Retrieved ${result.alerts.length} alerts`)

			return c.json(result)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get alerts: ${message}`)

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

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')

			// Acknowledge alert
			// For now, return placeholder alert
			const alert = {
				id,
				severity: 'medium' as const,
				title: 'Sample Alert',
				description: 'This is a sample alert',
				timestamp: new Date().toISOString(),
				status: 'acknowledged' as const,
				source: 'system',
			}

			if (!alert) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Alert not found',
				})
			}

			logger.info(`Acknowledged alert: ${id}`)

			return c.json(alert)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to acknowledge alert: ${message}`)

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

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const { resolution } = c.req.valid('json')

			// Resolve alert
			// For now, return placeholder alert
			const alert = {
				id,
				severity: 'medium' as const,
				title: 'Sample Alert',
				description: 'This is a sample alert',
				timestamp: new Date().toISOString(),
				status: 'resolved' as const,
				source: 'system',
			}

			if (!alert) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Alert not found',
				})
			}

			logger.info(`Resolved alert: ${id}`)

			return c.json(alert)
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to resolve alert: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
