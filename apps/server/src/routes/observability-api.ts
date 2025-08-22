/**
 * @fileoverview Observability REST API
 *
 * Provides REST API endpoints for system Observability:
 * - System health and status
 * - Performance metrics
 * - Audit metrics and analytics
 * - Alert management
 *
 */

import { ApiError } from '@/lib/errors'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'
import type { DashboardData } from '@repo/audit'

const DashboardDataSchema = z.object({
	overview: z.object({
		totalEvents: z.number(),
		eventsPerSecond: z.number(),
		averageProcessingTime: z.number(),
		errorRate: z.number(),
		uptime: z.number(),
		systemStatus: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']),
	}),
	performance: z.object({
		throughput: z.object({
			current: z.number(),
			peak: z.number(),
			average: z.number(),
		}),
		latency: z.object({
			p50: z.number(),
			p95: z.number(),
			p99: z.number(),
			max: z.number(),
		}),
		bottlenecks: z.array(
			z.object({
				component: z.string(),
				operation: z.string(),
				averageTime: z.number(),
				maxTime: z.number(),
				minTime: z.number(),
				percentile95: z.number(),
				percentile99: z.number(),
				sampleCount: z.number(),
				isBottleneck: z.boolean(),
				severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
				recommendations: z.array(z.string()),
				timestamp: z.string(),
			})
		),
		resourceUsage: z.object({
			cpu: z.number(),
			memory: z.number(),
			disk: z.number(),
			network: z.number(),
		}),
	}),
	health: z.object({
		components: z.array(
			z.object({
				name: z.string(),
				status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']),
				uptime: z.number(),
				responseTime: z.number(),
				errorRate: z.number(),
				throughput: z.number(),
				lastCheck: z.string(),
			})
		),
		overallStatus: z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']),
		criticalComponents: z.array(z.string()),
		degradedComponents: z.array(z.string()),
	}),
	alerts: z.object({
		total: z.number(),
		critical: z.number(),
		high: z.number(),
		medium: z.number(),
		low: z.number(),
		recent: z.array(
			z.object({
				id: z.string(),
				severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
				title: z.string(),
				timestamp: z.string(),
				component: z.string(),
			})
		),
	}),
	trends: z.object({
		timeSeries: z.array(
			z.object({
				timestamp: z.string(),
				eventsProcessed: z.number(),
				processingLatency: z.number(),
				errorRate: z.number(),
				queueDepth: z.number(),
				cpuUsage: z.number(),
				memoryUsage: z.number(),
			})
		),
		trends: z.object({
			eventsProcessed: z.object({
				current: z.number(),
				previous: z.number(),
				change: z.number(),
				changePercent: z.number(),
				direction: z.enum(['up', 'down', 'stable']),
			}),
			processingLatency: z.object({
				current: z.number(),
				previous: z.number(),
				change: z.number(),
				changePercent: z.number(),
				direction: z.enum(['up', 'down', 'stable']),
			}),
			errorRate: z.object({
				current: z.number(),
				previous: z.number(),
				change: z.number(),
				changePercent: z.number(),
				direction: z.enum(['up', 'down', 'stable']),
			}),
			systemLoad: z.object({
				current: z.number(),
				previous: z.number(),
				change: z.number(),
				changePercent: z.number(),
				direction: z.enum(['up', 'down', 'stable']),
			}),
		}),
	}),
	timestamp: z.string(),
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
const getDashboardDataRoute = createRoute({
	method: 'get',
	path: '/dashboard',
	tags: ['Observability'],
	summary: 'Get dashboard data',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	responses: {
		200: {
			description: 'Dashboard data retrieved successfully',
			content: {
				'application/json': {
					schema: DashboardDataSchema,
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

const getEnhancedMetricsRoute = createRoute({
	method: 'get',
	path: '/metrics/enhanced',
	tags: ['Observability'],
	summary: 'Get Enhanced metrics',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	request: {
		query: z.object({
			format: z.enum(['json', 'prometheus']).optional(),
		}),
	},
	responses: {
		200: {
			description: 'Enhanced metrics retrieved successfully',
			content: {
				'application/json': {
					schema: z.any(),
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

const getBottleneckAnalysisRoute = createRoute({
	method: 'get',
	path: '/bottlenecks',
	tags: ['Observability'],
	summary: 'Get bottleneck analysis',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	responses: {
		200: {
			description: 'Bottleneck analysis metrics retrieved successfully',
			content: {
				'application/json': {
					schema: z.any(),
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

const getTracesRoute = createRoute({
	method: 'get',
	path: '/traces',
	tags: ['Observability'],
	summary: 'Get trace data',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	request: {
		query: z.object({
			traceId: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: 'Bottleneck analysis metrics retrieved successfully',
			content: {
				'application/json': {
					schema: z.any(),
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

const getProfilingRoute = createRoute({
	method: 'get',
	path: '/profiling',
	tags: ['Observability'],
	summary: 'Get profiling results',
	description:
		'Retrieves current system performance metrics including server, database, and API statistics.',
	responses: {
		200: {
			description: 'Profiling results retrieved successfully',
			content: {
				'application/json': {
					schema: z.any(),
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
 * Create observability API router
 */
export function createObservabilityAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	app.openapi(getDashboardDataRoute, async (c) => {
		const { observability, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		try {
			const dashboardData: DashboardData = await observability.dashboard.getDashboardData()
			return c.json(dashboardData)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get dashboard data', {
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

	app.openapi(getEnhancedMetricsRoute, async (c) => {
		const { observability, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		try {
			const format = c.req.query('format') || 'json'
			const metrics = await observability.metrics.exportMetrics(format as 'json' | 'prometheus')

			if (format === 'prometheus') {
				c.header('Content-Type', 'text/plain')
				return c.text(metrics)
			}

			return c.json(JSON.parse(metrics))
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to export enhanced metrics', {
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

	app.openapi(getBottleneckAnalysisRoute, async (c) => {
		const { observability, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		try {
			const bottlenecks = await observability.dashboard.getBottleneckAnalysis()
			return c.json(bottlenecks)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get bottleneck analysis', {
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

	app.openapi(getTracesRoute, async (c) => {
		const { observability, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		try {
			const traceId = c.req.query('traceId')
			if (traceId) {
				const spans = observability.tracer.getTraceSpans(traceId)
				return c.json(spans)
			}

			const activeSpans = observability.tracer.getActiveSpans()
			return c.json(activeSpans)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get trace data', {
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

	app.openapi(getProfilingRoute, async (c) => {
		const { observability, logger } = c.get('services')
		const session = c.get('session')
		const requestId = c.get('requestId')

		try {
			const profilingResults = observability.bottleneck.getProfilingResults()
			return c.json(profilingResults)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Failed to get profiling results', {
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

	return app
}
