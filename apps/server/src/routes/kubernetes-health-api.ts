/**
 * @fileoverview Kubernetes Health Check API
 *
 * Provides comprehensive health monitoring endpoints:
 * - Readiness probe for Kubernetes
 * - Liveness probe for container orchestration
 *
 * Requirements: 6.1, 6.4, 6.5
 */

import { EnhancedHealthService } from '@/lib/services/health'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { BasicHealthSchema } from './health-api'

import type { HonoEnv } from '@/lib/hono/context'

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

/**
 * Enhanced health service to check readiness of the service
 */

export function createKubernetesHealthAPI(): OpenAPIHono<HonoEnv> {
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
			logger.error('Readiness check failed', errorMessage, { requestId, error: errorMessage })

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
			logger.error('Liveness check failed', errorMessage, { requestId, error: errorMessage })

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
