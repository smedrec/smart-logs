/**
 * @fileoverview Monitoring and Observability Middleware
 *
 * Provides comprehensive monitoring capabilities:
 * - Request/response metrics collection
 * - Performance monitoring
 * - Correlation ID tracking
 * - Structured logging
 * - Error rate tracking
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { createMiddleware } from 'hono/factory'

import type { HonoEnv } from '@/lib/hono/context'
import type { Context } from 'hono'
import type { Alert, RequestMetrics } from '@repo/audit'
import type { HealthStatus } from '../graphql/types'

/**
 * Request metrics collection middleware
 */
export function requestMetrics() {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const startTime = Date.now()
		const requestId = c.get('requestId')
		const { logger, monitor } = c.get('services')

		// Add correlation ID to response headers
		c.header('X-Correlation-ID', requestId)
		c.header('X-Request-Start-Time', startTime.toString())

		// Log request start
		logger.info('Request started', {
			requestId,
			method: c.req.method,
			path: c.req.path,
			userAgent: c.req.header('user-agent'),
			ip: getClientIP(c),
			contentType: c.req.header('content-type'),
		})

		let statusCode = 200
		let errorCode: string | undefined

		try {
			await next()
			statusCode = c.res.status
		} catch (error) {
			statusCode = 500
			if (error && typeof error === 'object' && 'code' in error) {
				errorCode = String(error.code)
			}
			throw error
		} finally {
			const endTime = Date.now()
			const responseTime = endTime - startTime
			const session = c.get('session')

			// Collect request metrics
			const metrics: RequestMetrics = {
				requestId,
				method: c.req.method,
				path: c.req.path,
				statusCode,
				responseTime,
				timestamp: new Date(startTime).toISOString(),
				userAgent: c.req.header('user-agent'),
				ip: getClientIP(c),
				userId: session?.session.userId,
				organizationId: session?.session.activeOrganizationId || undefined,
				contentLength: getContentLength(c),
				errorCode,
			}

			// Log request completion
			const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
			logger[logLevel]('Request completed', {
				...metrics,
				duration: responseTime,
			})

			// Store metrics for aggregation
			try {
				await monitor.metrics.storeRequestMetrics(metrics)
			} catch (metricsError) {
				logger.error('Failed to store request metrics', {
					error: metricsError instanceof Error ? metricsError.message : 'Unknown error',
					requestId,
				})
			}

			// Add performance headers
			c.header('X-Response-Time', `${responseTime}ms`)
			c.header('Server-Timing', `total;dur=${responseTime}`)
		}
	})
}

/**
 * Performance monitoring middleware for specific endpoints
 */
export function performanceMonitoring(options: { threshold?: number; alertOnSlow?: boolean } = {}) {
	const { threshold = 1000, alertOnSlow = true } = options

	return createMiddleware<HonoEnv>(async (c, next) => {
		const startTime = performance.now()
		const requestId = c.get('requestId')
		const { logger, monitor } = c.get('services')

		// Track memory usage before request
		const memoryBefore = process.memoryUsage()

		await next()

		const endTime = performance.now()
		const duration = endTime - startTime
		const memoryAfter = process.memoryUsage()

		// Calculate memory delta
		const memoryDelta = {
			heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
			heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
			external: memoryAfter.external - memoryBefore.external,
		}

		// Log performance metrics
		logger.info('Performance metrics', {
			requestId,
			endpoint: c.req.path,
			method: c.req.method,
			duration,
			memoryDelta,
			statusCode: c.res.status,
		})

		// Alert on slow requests
		if (alertOnSlow && duration > threshold) {
			logger.warn('Slow request detected', {
				requestId,
				endpoint: c.req.path,
				method: c.req.method,
				duration,
				threshold,
			})

			// Create alert for slow request
			try {
				const alert: Alert = {
					id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
					severity: duration > threshold * 2 ? 'HIGH' : 'MEDIUM',
					type: 'PERFORMANCE',
					title: 'Slow API Request',
					description: `Request to ${c.req.method} ${c.req.path} took ${duration.toFixed(2)}ms`,
					timestamp: new Date().toISOString(),
					source: 'performance-monitor',
					metadata: {
						organizationId: c.get('session')?.session.activeOrganizationId || 'system',
						requestId,
						endpoint: c.req.path,
						method: c.req.method,
						duration,
						threshold,
						memoryDelta,
					},
					acknowledged: false,
					resolved: false,
				}
				await monitor.metrics.sendExternalAlert(alert)
			} catch (alertError) {
				logger.error('Failed to create slow request alert', {
					error: alertError instanceof Error ? alertError.message : 'Unknown error',
					requestId,
				})
			}
		}
	})
}

/**
 * Health check monitoring middleware
 */
export function healthCheckMonitoring() {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const { health, logger } = c.get('services')
		const requestId = c.get('requestId')

		// Only apply to health check endpoints
		if (!c.req.path.includes('/health') && !c.req.path.includes('/ready')) {
			await next()
			return
		}

		try {
			// Run health checks
			const healthResults = await health.checkAllComponents()

			const healthStatus: HealthStatus = {
				status:
					healthResults.status === 'OK'
						? 'healthy'
						: healthResults.status === 'CRITICAL'
							? 'unhealthy'
							: 'degraded',
				timestamp: new Date().toISOString(),
				checks: Object.entries(healthResults.components).map(([name, component]) => ({
					name,
					status: component.status === 'OK' ? 'healthy' : 'unhealthy',
					message: component.message,
					responseTime: component.responseTime,
				})),
			}

			// Log health status
			logger.info('Health check performed', {
				requestId,
				healthStatus,
			})

			// Store health status in context for endpoint handler
			c.set('healthStatus', healthStatus)

			await next()
		} catch (error) {
			logger.error('Health check failed', {
				requestId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Set unhealthy status
			c.set('healthStatus', {
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				checks: [],
			})

			await next()
		}
	})
}

/**
 * Error rate monitoring middleware
 */
export function errorRateMonitoring(options: { windowSize?: number; threshold?: number } = {}) {
	const { windowSize = 300000, threshold = 0.1 } = options // 5 minutes window, 10% threshold

	return createMiddleware<HonoEnv>(async (c, next) => {
		const { monitor, logger } = c.get('services')
		const requestId = c.get('requestId')

		try {
			await next()

			// Track successful requests
			if (c.res.status < 400) {
				await monitor.metrics.trackRequestOutcome(c.req.path, c.req.method, 'success')
			} else {
				await monitor.metrics.trackRequestOutcome(c.req.path, c.req.method, 'error')
			}
		} catch (error) {
			// Track failed requests
			await monitor.metrics.trackRequestOutcome(c.req.path, c.req.method, 'error')

			// Check error rate and create alert if threshold exceeded
			try {
				const errorRate = await monitor.metrics.calculateErrorRate(
					c.req.path,
					c.req.method,
					windowSize
				)
				if (errorRate > threshold) {
					const alert: Alert = {
						id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						severity: errorRate > threshold * 2 ? 'CRITICAL' : 'HIGH',
						type: 'METRICS',
						title: 'High Error Rate Detected',
						description: `Error rate for ${c.req.method} ${c.req.path} is ${(errorRate * 100).toFixed(2)}%`,
						timestamp: new Date().toISOString(),
						source: 'error-rate-monitor',
						metadata: {
							organizationId: c.get('session')?.session.activeOrganizationId || 'unknown',
							endpoint: c.req.path,
							method: c.req.method,
							errorRate,
							threshold,
							windowSize,
						},
						acknowledged: false,
						resolved: false,
					}
					await monitor.metrics.sendExternalAlert(alert)
				}
			} catch (alertError) {
				logger.error('Failed to create error rate alert', {
					error: alertError instanceof Error ? alertError.message : 'Unknown error',
					requestId,
				})
			}

			throw error
		}
	})
}

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
	const forwarded = c.req.header('x-forwarded-for')
	if (forwarded) {
		return forwarded.split(',')[0].trim()
	}

	const realIP = c.req.header('x-real-ip')
	if (realIP) {
		return realIP
	}

	return '127.0.0.1'
}

/**
 * Get content length from response
 */
function getContentLength(c: Context): number | undefined {
	const contentLength = c.res.headers.get('content-length')
	return contentLength ? parseInt(contentLength, 10) : undefined
}
