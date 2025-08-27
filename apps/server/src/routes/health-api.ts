/**
 * @fileoverview Enhanced Health Check API
 *
 * Provides comprehensive health monitoring endpoints:
 * - Basic health check
 * - Detailed health status with service checks
 * - Readiness probe for Kubernetes
 * - Liveness probe for container orchestration
 *
 * Requirements: 6.1, 6.4, 6.5
 */

import { EnhancedHealthService } from '@/lib/services/health'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

// Zod schemas for health responses
const BasicHealthSchema = z.object({
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	timestamp: z.string(),
	environment: z.string(),
	version: z.string().optional(),
	uptime: z.number(),
})

const HealthCheckSchema = z.object({
	name: z.string(),
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	responseTime: z.number().optional(),
	message: z.string().optional(),
	details: z.record(z.string(), z.any()).optional(),
	lastChecked: z.string(),
})

const SystemMetricsSchema = z.object({
	memory: z.object({
		used: z.number(),
		total: z.number(),
		percentage: z.number(),
	}),
	cpu: z.object({
		usage: z.number(),
		loadAverage: z.array(z.number()),
	}),
	disk: z
		.object({
			used: z.number(),
			total: z.number(),
			percentage: z.number(),
		})
		.optional(),
})

const PerformanceMetricsSchema = z.object({
	requestsPerSecond: z.number(),
	averageResponseTime: z.number(),
	errorRate: z.number(),
	activeConnections: z.number(),
})

const DetailedHealthSchema = z.object({
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	timestamp: z.string(),
	environment: z.string(),
	version: z.string().optional(),
	uptime: z.number(),
	checks: z.array(HealthCheckSchema),
	system: SystemMetricsSchema,
	services: z.object({
		database: HealthCheckSchema,
		redis: HealthCheckSchema,
		auth: HealthCheckSchema,
		audit: HealthCheckSchema,
	}),
	metrics: PerformanceMetricsSchema,
})

const ReadinessSchema = z.object({
	status: z.enum(['ready', 'not_ready']),
	timestamp: z.string(),
	reason: z.string().optional(),
	checks: z.object({
		database: z.boolean(),
		redis: z.boolean(),
		auth: z.boolean(),
		migrations: z.boolean(),
	}),
})

const DatabaseHealthSchema = z.object({
	overall: z.enum(['healthy', 'warning', 'critical']),
	components: z.object({
		connectionPool: z.object({
			status: z.string(),
			details: z.any(),
		}),
		queryCache: z.object({
			status: z.string(),
			details: z.any(),
		}),
		partitions: z.object({
			status: z.string(),
			details: z.any(),
		}),
		performance: z.object({
			status: z.string(),
			details: z.any(),
		}),
	}),
	recommendations: z.array(z.string()),
})

// Route definitions
const basicHealthRoute = createRoute({
	method: 'get',
	path: '/health',
	tags: ['Health'],
	summary: 'Basic health check',
	description: 'Returns basic server health status for load balancers and monitoring systems.',
	responses: {
		200: {
			description: 'Server is healthy',
			content: {
				'application/json': {
					schema: BasicHealthSchema,
				},
			},
		},
		503: {
			description: 'Server is unhealthy',
			content: {
				'application/json': {
					schema: BasicHealthSchema,
				},
			},
		},
	},
})

const detailedHealthRoute = createRoute({
	method: 'get',
	path: '/health/detailed',
	tags: ['Health'],
	summary: 'Detailed health check',
	description:
		'Returns comprehensive health status including service checks, system metrics, and performance data.',
	responses: {
		200: {
			description: 'Detailed health status retrieved successfully',
			content: {
				'application/json': {
					schema: DetailedHealthSchema,
				},
			},
		},
		503: {
			description: 'One or more services are unhealthy',
			content: {
				'application/json': {
					schema: DetailedHealthSchema,
				},
			},
		},
	},
})

const readinessRoute = createRoute({
	method: 'get',
	path: '/ready',
	tags: ['Health'],
	summary: 'Readiness probe',
	description: 'Kubernetes readiness probe to determine if the service is ready to accept traffic.',
	responses: {
		200: {
			description: 'Service is ready',
			content: {
				'application/json': {
					schema: ReadinessSchema,
				},
			},
		},
		503: {
			description: 'Service is not ready',
			content: {
				'application/json': {
					schema: ReadinessSchema,
				},
			},
		},
	},
})

const livenessRoute = createRoute({
	method: 'get',
	path: '/live',
	tags: ['Health'],
	summary: 'Liveness probe',
	description: 'Kubernetes liveness probe to determine if the service should be restarted.',
	responses: {
		200: {
			description: 'Service is alive',
			content: {
				'application/json': {
					schema: BasicHealthSchema,
				},
			},
		},
		503: {
			description: 'Service is not responding',
			content: {
				'application/json': {
					schema: BasicHealthSchema,
				},
			},
		},
	},
})

const databaseHealthRoute = createRoute({
	method: 'get',
	path: '/health/database',
	tags: ['Health'],
	summary: 'Database ',
	description: 'Returns detailed database ',
	responses: {
		200: {
			description: 'Detailed health status retrieved successfully',
			content: {
				'application/json': {
					schema: DatabaseHealthSchema,
				},
			},
		},
		503: {
			description: 'One or more services are unhealthy',
			content: {
				'application/json': {
					schema: DatabaseHealthSchema,
				},
			},
		},
	},
})

/**
 * Create health check API router
 */
export function createHealthAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()

	// Initialize enhanced health service
	let healthService: EnhancedHealthService | null = null

	// Middleware to initialize health service
	app.use('*', async (c, next) => {
		if (!healthService) {
			const services = c.get('services')
			healthService = new EnhancedHealthService(services)
		}
		await next()
	})

	// Basic health check
	app.openapi(basicHealthRoute, async (c) => {
		const { logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			// Check if we're shutting down
			const isShuttingDown = c.get('isShuttingDown') || false
			if (isShuttingDown) {
				const response = {
					status: 'unhealthy' as const,
					timestamp: new Date().toISOString(),
					environment: process.env.NODE_ENV || 'unknown',
					version: process.env.APP_VERSION || '1.0.0',
					uptime: process.uptime(),
				}

				logger.warn('Health check during shutdown', { requestId, status: 'shutting_down' })
				return c.json(response, 503)
			}

			// Get cached health status for performance
			const cachedHealth = healthService?.getCachedHealth()
			if (cachedHealth) {
				const basicHealth = {
					status: cachedHealth.status,
					timestamp: cachedHealth.timestamp,
					environment: cachedHealth.environment,
					version: cachedHealth.version,
					uptime: cachedHealth.uptime,
				}

				const statusCode = cachedHealth.status === 'healthy' ? 200 : 503
				logger.info('Basic health check (cached)', { requestId, status: cachedHealth.status })
				return c.json(basicHealth, statusCode)
			}

			// Fallback to simple health check
			const basicHealth = {
				status: 'healthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				version: process.env.APP_VERSION || '1.0.0',
				uptime: process.uptime(),
			}

			logger.info('Basic health check (fallback)', { requestId, status: 'healthy' })
			return c.json(basicHealth, 200)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Basic health check failed', { requestId, error: errorMessage })

			const errorResponse = {
				status: 'unhealthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				uptime: process.uptime(),
			}

			return c.json(errorResponse, 503)
		}
	})

	// Detailed health check
	app.openapi(detailedHealthRoute, async (c) => {
		const { logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			logger.info('Detailed health check started', { requestId })

			if (!healthService) {
				throw new Error('Health service not initialized')
			}

			const healthStatus = await healthService.getDetailedHealth()
			const statusCode = healthStatus.status === 'healthy' ? 200 : 503

			logger.info('Detailed health check completed', {
				requestId,
				status: healthStatus.status,
				failedChecks: healthStatus.checks.filter((check) => check.status !== 'healthy').length,
			})

			return c.json(healthStatus, statusCode)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Detailed health check failed', { requestId, error: errorMessage })

			const errorResponse = {
				status: 'unhealthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				uptime: process.uptime(),
				checks: [
					{
						name: 'Health Check System',
						status: 'unhealthy' as const,
						message: errorMessage,
						lastChecked: new Date().toISOString(),
					},
				],
				system: {
					memory: { used: 0, total: 0, percentage: 0 },
					cpu: { usage: 0, loadAverage: [0, 0, 0] },
				},
				services: {
					database: {
						name: 'Database',
						status: 'unhealthy' as const,
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					redis: {
						name: 'Redis',
						status: 'unhealthy' as const,
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					auth: {
						name: 'Authentication',
						status: 'unhealthy' as const,
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					audit: {
						name: 'Audit Service',
						status: 'unhealthy' as const,
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
				},
				metrics: {
					requestsPerSecond: 0,
					averageResponseTime: 0,
					errorRate: 1,
					activeConnections: 0,
				},
			}

			return c.json(errorResponse, 503)
		}
	})

	// Readiness probe
	app.openapi(readinessRoute, async (c) => {
		const { logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			logger.debug('Readiness check started', { requestId })

			if (!healthService) {
				throw new Error('Health service not initialized')
			}

			const readinessStatus = await healthService.getReadinessStatus()
			const statusCode = readinessStatus.status === 'ready' ? 200 : 503

			logger.debug('Readiness check completed', {
				requestId,
				status: readinessStatus.status,
				reason: readinessStatus.reason,
			})

			return c.json(readinessStatus, statusCode)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Readiness check failed', { requestId, error: errorMessage })

			const errorResponse = {
				status: 'not_ready' as const,
				timestamp: new Date().toISOString(),
				reason: errorMessage,
				checks: {
					database: false,
					redis: false,
					auth: false,
					migrations: false,
				},
			}

			return c.json(errorResponse, 503)
		}
	})

	// Liveness probe
	app.openapi(livenessRoute, async (c) => {
		const { logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			// Liveness probe should be simple and fast
			// It only checks if the process is responsive
			const livenessStatus = {
				status: 'healthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				version: process.env.APP_VERSION || '1.0.0',
				uptime: process.uptime(),
			}

			logger.debug('Liveness check completed', { requestId, status: 'healthy' })
			return c.json(livenessStatus, 200)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Liveness check failed', { requestId, error: errorMessage })

			const errorResponse = {
				status: 'unhealthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				uptime: process.uptime(),
			}

			return c.json(errorResponse, 503)
		}
	})

	app.openapi(databaseHealthRoute, async (c) => {
		const { client, logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			logger.debug('Database health check started', { requestId })

			if (!healthService) {
				throw new Error('Health service not initialized')
			}

			const databaseHealth = await client.getHealthStatus()
			const statusCode = databaseHealth.overall === 'healthy' ? 200 : 503

			logger.debug('Database health check completed', {
				requestId,
				status: databaseHealth.overall,
				reason: databaseHealth.recommendations.join(', '),
			})

			return c.json(databaseHealth, statusCode)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			logger.error('Database health check failed', { requestId, error: errorMessage })

			const errorResponse = {
				status: 'unhealthy' as const,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				uptime: process.uptime(),
			}

			return c.json(errorResponse, 503)
		}
	})

	return app
}
