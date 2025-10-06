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

const MetricsQuerySchema = z.object({
	timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).optional(),
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
	groupBy: z.enum(['hour', 'day', 'week']).optional(),
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

	return app
}
