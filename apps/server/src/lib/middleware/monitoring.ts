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
import type { Alert } from '@repo/audit'

export interface RequestMetrics {
	requestId: string
	method: string
	path: string
	statusCode: number
	responseTime: number
	timestamp: string
	userAgent?: string
	ip?: string
	userId?: string
	organizationId?: string
	contentLength?: number
	errorCode?: string
}

export interface PerformanceMetrics {
	endpoint: string
	method: string
	count: number
	averageResponseTime: number
	p95ResponseTime: number
	p99ResponseTime: number
	errorRate: number
	lastUpdated: string
}

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
				organizationId: session?.session.activeOrganizationId,
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
				await storeRequestMetrics(metrics, monitor)
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
						organizationId: c.get('session')?.session.activeOrganizationId || 'unknown',
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
			const healthStatus = await health.checkHealth()

			// Log health status
			logger.info('Health check performed', {
				requestId,
				status: healthStatus.status,
				checks: healthStatus.checks?.map((check) => ({
					name: check.name,
					status: check.status,
					responseTime: check.responseTime,
				})),
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
				await trackRequestOutcome(c.req.path, c.req.method, 'success', monitor)
			} else {
				await trackRequestOutcome(c.req.path, c.req.method, 'error', monitor)
			}
		} catch (error) {
			// Track failed requests
			await trackRequestOutcome(c.req.path, c.req.method, 'error', monitor)

			// Check error rate and create alert if threshold exceeded
			try {
				const errorRate = await calculateErrorRate(c.req.path, c.req.method, windowSize, monitor)
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
 * Store request metrics for aggregation
 */
async function storeRequestMetrics(metrics: RequestMetrics, monitor: any): Promise<void> {
	try {
		// Store in Redis for real-time metrics using enhanced metrics service
		const key = `requests:${Date.now()}`
		await monitor.metricsCollection.storeMetric(key, metrics, 3600) // 1 hour TTL

		// Update endpoint performance metrics
		await updateEndpointMetrics(metrics, monitor)
	} catch (error) {
		console.error('Failed to store request metrics:', error)
	}
}

/**
 * Update endpoint performance metrics
 */
async function updateEndpointMetrics(metrics: RequestMetrics, monitor: any): Promise<void> {
	const endpointKey = `${metrics.method}:${metrics.path}`
	const metricsKey = `metrics:endpoints:${endpointKey}`

	try {
		// Get existing metrics using enhanced metrics service
		const existing = await monitor.metricsCollection.getMetric(metricsKey)
		const now = new Date().toISOString()

		if (existing) {
			// Update existing metrics
			const updated: PerformanceMetrics = {
				endpoint: metrics.path,
				method: metrics.method,
				count: existing.count + 1,
				averageResponseTime:
					(existing.averageResponseTime * existing.count + metrics.responseTime) /
					(existing.count + 1),
				p95ResponseTime: existing.p95ResponseTime, // Will be calculated separately
				p99ResponseTime: existing.p99ResponseTime, // Will be calculated separately
				errorRate:
					metrics.statusCode >= 400
						? (existing.errorRate * existing.count + 1) / (existing.count + 1)
						: (existing.errorRate * existing.count) / (existing.count + 1),
				lastUpdated: now,
			}

			await monitor.metricsCollection.storeMetric(metricsKey, updated, 86400) // 24 hours TTL
		} else {
			// Create new metrics
			const newMetrics: PerformanceMetrics = {
				endpoint: metrics.path,
				method: metrics.method,
				count: 1,
				averageResponseTime: metrics.responseTime,
				p95ResponseTime: metrics.responseTime,
				p99ResponseTime: metrics.responseTime,
				errorRate: metrics.statusCode >= 400 ? 1 : 0,
				lastUpdated: now,
			}

			await monitor.metricsCollection.storeMetric(metricsKey, newMetrics, 86400) // 24 hours TTL
		}
	} catch (error) {
		console.error('Failed to update endpoint metrics:', error)
	}
}

/**
 * Track request outcome for error rate calculation
 */
async function trackRequestOutcome(
	path: string,
	method: string,
	outcome: 'success' | 'error',
	monitor: any
): Promise<void> {
	const key = `outcomes:${method}:${path}:${Date.now()}`
	await monitor.metricsCollection.storeMetric(key, { outcome, timestamp: Date.now() }, 3600) // 1 hour TTL
}

/**
 * Calculate error rate for an endpoint
 */
async function calculateErrorRate(
	path: string,
	method: string,
	windowSize: number,
	monitor: any
): Promise<number> {
	const now = Date.now()
	const windowStart = now - windowSize

	try {
		// Get all outcomes in the time window
		const pattern = `outcomes:${method}:${path}:*`
		const outcomes = await monitor.metricsCollection.getMetricsByPattern(pattern)

		if (!outcomes || outcomes.length === 0) {
			return 0
		}

		// Filter outcomes within the time window
		const recentOutcomes = outcomes.filter((outcome: any) => {
			const timestamp = outcome.timestamp || 0
			return timestamp >= windowStart
		})

		if (recentOutcomes.length === 0) {
			return 0
		}

		// Calculate error rate
		const errorCount = recentOutcomes.filter((outcome: any) => outcome.outcome === 'error').length
		return errorCount / recentOutcomes.length
	} catch (error) {
		console.error('Failed to calculate error rate:', error)
		return 0
	}
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

	return 'unknown'
}

/**
 * Get content length from response
 */
function getContentLength(c: Context): number | undefined {
	const contentLength = c.res.headers.get('content-length')
	return contentLength ? parseInt(contentLength, 10) : undefined
}
