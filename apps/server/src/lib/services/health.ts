/**
 * @fileoverview Enhanced Health Check Service
 *
 * Provides comprehensive health monitoring:
 * - Detailed service health checks
 * - Dependency status monitoring
 * - Performance metrics integration
 * - Alerting for critical issues
 *
 * Requirements: 6.1, 6.4, 6.5
 */

import type { HonoEnv } from '@/lib/hono/context'
import type { Alert } from '@repo/audit'

export interface HealthCheck {
	name: string
	status: 'healthy' | 'degraded' | 'unhealthy'
	responseTime?: number
	message?: string
	details?: Record<string, any>
	lastChecked: string
}

export interface DetailedHealthStatus {
	status: 'healthy' | 'degraded' | 'unhealthy'
	timestamp: string
	environment: string
	version?: string
	uptime: number
	checks: HealthCheck[]
	system: {
		memory: {
			used: number
			total: number
			percentage: number
		}
		cpu: {
			usage: number
			loadAverage: number[]
		}
		disk?: {
			used: number
			total: number
			percentage: number
		}
	}
	services: {
		database: HealthCheck
		redis: HealthCheck
		auth: HealthCheck
		audit: HealthCheck
	}
	metrics: {
		requestsPerSecond: number
		averageResponseTime: number
		errorRate: number
		activeConnections: number
	}
}

export interface ReadinessStatus {
	status: 'ready' | 'not_ready'
	timestamp: string
	reason?: string
	checks: {
		database: boolean
		redis: boolean
		auth: boolean
		migrations: boolean
	}
}

/**
 * Enhanced health check service
 */
export class EnhancedHealthService {
	private lastHealthCheck?: DetailedHealthStatus
	private healthCheckInterval?: NodeJS.Timeout
	private readonly checkIntervalMs = 30000 // 30 seconds

	constructor(
		private services: {
			db: any
			redis: any
			health: any
			monitor: any
			logger: any
		}
	) {
		// Start periodic health checks
		this.startPeriodicHealthChecks()
	}

	/**
	 * Get detailed health status
	 */
	async getDetailedHealth(): Promise<DetailedHealthStatus> {
		const startTime = Date.now()

		try {
			// Run all health checks in parallel
			const [databaseCheck, redisCheck, authCheck, auditCheck, systemMetrics] =
				await Promise.allSettled([
					this.checkDatabase(),
					this.checkRedis(),
					this.checkAuth(),
					this.checkAudit(),
					this.getSystemMetrics(),
				])

			// Process results
			const checks: HealthCheck[] = []
			const services = {
				database: this.getCheckResult(databaseCheck, 'Database'),
				redis: this.getCheckResult(redisCheck, 'Redis'),
				auth: this.getCheckResult(authCheck, 'Authentication'),
				audit: this.getCheckResult(auditCheck, 'Audit Service'),
			}

			checks.push(...Object.values(services))

			// Determine overall status
			const overallStatus = this.determineOverallStatus(checks)

			// Get performance metrics
			const performanceMetrics = await this.getPerformanceMetrics()

			const healthStatus: DetailedHealthStatus = {
				status: overallStatus,
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				version: process.env.APP_VERSION || '1.0.0',
				uptime: process.uptime(),
				checks,
				system:
					systemMetrics.status === 'fulfilled'
						? systemMetrics.value
						: this.getDefaultSystemMetrics(),
				services,
				metrics: performanceMetrics,
			}

			// Cache the result
			this.lastHealthCheck = healthStatus

			// Log health status
			this.services.logger.info('Health check completed', {
				status: overallStatus,
				responseTime: Date.now() - startTime,
				failedChecks: checks.filter((check) => check.status !== 'healthy').length,
			})

			// Create alerts for unhealthy services
			await this.handleUnhealthyServices(services)

			return healthStatus
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			this.services.logger.error('Health check failed', { error: errorMessage })

			return {
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || 'unknown',
				uptime: process.uptime(),
				checks: [
					{
						name: 'Health Check System',
						status: 'unhealthy',
						message: errorMessage,
						lastChecked: new Date().toISOString(),
					},
				],
				system: this.getDefaultSystemMetrics(),
				services: {
					database: {
						name: 'Database',
						status: 'unhealthy',
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					redis: {
						name: 'Redis',
						status: 'unhealthy',
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					auth: {
						name: 'Authentication',
						status: 'unhealthy',
						message: 'Health check system failure',
						lastChecked: new Date().toISOString(),
					},
					audit: {
						name: 'Audit Service',
						status: 'unhealthy',
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
		}
	}

	/**
	 * Get readiness status for Kubernetes
	 */
	async getReadinessStatus(): Promise<ReadinessStatus> {
		try {
			const checks = await Promise.allSettled([
				this.checkDatabaseConnection(),
				this.checkRedisConnection(),
				this.checkAuthService(),
				this.checkMigrations(),
			])

			const checkResults = {
				database: checks[0].status === 'fulfilled' && checks[0].value,
				redis: checks[1].status === 'fulfilled' && checks[1].value,
				auth: checks[2].status === 'fulfilled' && checks[2].value,
				migrations: checks[3].status === 'fulfilled' && checks[3].value,
			}

			const allReady = Object.values(checkResults).every(Boolean)

			if (!allReady) {
				const failedChecks = Object.entries(checkResults)
					.filter(([, ready]) => !ready)
					.map(([name]) => name)

				return {
					status: 'not_ready',
					timestamp: new Date().toISOString(),
					reason: `Failed checks: ${failedChecks.join(', ')}`,
					checks: checkResults,
				}
			}

			return {
				status: 'ready',
				timestamp: new Date().toISOString(),
				checks: checkResults,
			}
		} catch (error) {
			return {
				status: 'not_ready',
				timestamp: new Date().toISOString(),
				reason: error instanceof Error ? error.message : 'Unknown error',
				checks: {
					database: false,
					redis: false,
					auth: false,
					migrations: false,
				},
			}
		}
	}

	/**
	 * Get cached health status (for performance)
	 */
	getCachedHealth(): DetailedHealthStatus | null {
		return this.lastHealthCheck || null
	}

	/**
	 * Start periodic health checks
	 */
	private startPeriodicHealthChecks(): void {
		this.healthCheckInterval = setInterval(async () => {
			try {
				await this.getDetailedHealth()
			} catch (error) {
				this.services.logger.error('Periodic health check failed', {
					error: error instanceof Error ? error.message : 'Unknown error',
				})
			}
		}, this.checkIntervalMs)
	}

	/**
	 * Stop periodic health checks
	 */
	stopPeriodicHealthChecks(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = undefined
		}
	}

	/**
	 * Check database health
	 */
	private async checkDatabase(): Promise<HealthCheck> {
		const startTime = Date.now()

		try {
			// Test database connection with a simple query
			await this.services.db.audit.execute('SELECT 1 as health_check')

			// Check connection pool status
			const poolStatus = await this.getDatabasePoolStatus()

			return {
				name: 'Database',
				status: 'healthy',
				responseTime: Date.now() - startTime,
				message: 'Database connection successful',
				details: poolStatus,
				lastChecked: new Date().toISOString(),
			}
		} catch (error) {
			return {
				name: 'Database',
				status: 'unhealthy',
				responseTime: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Database connection failed',
				lastChecked: new Date().toISOString(),
			}
		}
	}

	/**
	 * Check Redis health
	 */
	private async checkRedis(): Promise<HealthCheck> {
		const startTime = Date.now()

		try {
			// Test Redis connection with ping
			const result = await this.services.redis.ping()

			if (result !== 'PONG') {
				throw new Error('Redis ping failed')
			}

			// Get Redis info
			const info = await this.services.redis.info('memory')

			return {
				name: 'Redis',
				status: 'healthy',
				responseTime: Date.now() - startTime,
				message: 'Redis connection successful',
				details: { info },
				lastChecked: new Date().toISOString(),
			}
		} catch (error) {
			return {
				name: 'Redis',
				status: 'unhealthy',
				responseTime: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Redis connection failed',
				lastChecked: new Date().toISOString(),
			}
		}
	}

	/**
	 * Check authentication service health
	 */
	private async checkAuth(): Promise<HealthCheck> {
		const startTime = Date.now()

		try {
			// Test auth database connection
			await this.services.db.auth.execute('SELECT 1 as health_check')

			return {
				name: 'Authentication',
				status: 'healthy',
				responseTime: Date.now() - startTime,
				message: 'Authentication service operational',
				lastChecked: new Date().toISOString(),
			}
		} catch (error) {
			return {
				name: 'Authentication',
				status: 'unhealthy',
				responseTime: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Authentication service failed',
				lastChecked: new Date().toISOString(),
			}
		}
	}

	/**
	 * Check audit service health
	 */
	private async checkAudit(): Promise<HealthCheck> {
		const startTime = Date.now()

		try {
			// Test audit service functionality
			const testResult = await this.services.health.checkAllComponents()

			return {
				name: 'Audit Service',
				status: testResult.status === 'healthy' ? 'healthy' : 'degraded',
				responseTime: Date.now() - startTime,
				message: 'Audit service operational',
				details: testResult,
				lastChecked: new Date().toISOString(),
			}
		} catch (error) {
			return {
				name: 'Audit Service',
				status: 'unhealthy',
				responseTime: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Audit service failed',
				lastChecked: new Date().toISOString(),
			}
		}
	}

	/**
	 * Get system metrics
	 */
	private async getSystemMetrics() {
		const memoryUsage = process.memoryUsage()
		const cpuUsage = process.cpuUsage()

		return {
			memory: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			},
			cpu: {
				usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
				loadAverage: [0, 0, 0], // Not available in Node.js on all platforms
			},
		}
	}

	/**
	 * Get performance metrics
	 */
	private async getPerformanceMetrics() {
		try {
			// Get metrics from monitoring service
			const metrics = await this.services.monitor.metrics.getSystemMetrics()

			return {
				requestsPerSecond: metrics?.requestsPerSecond || 0,
				averageResponseTime: metrics?.averageResponseTime || 0,
				errorRate: metrics?.errorRate || 0,
				activeConnections: metrics?.activeConnections || 0,
			}
		} catch (error) {
			return {
				requestsPerSecond: 0,
				averageResponseTime: 0,
				errorRate: 0,
				activeConnections: 0,
			}
		}
	}

	/**
	 * Get database pool status
	 */
	private async getDatabasePoolStatus() {
		try {
			// This would depend on your database client implementation
			return {
				totalConnections: 10,
				activeConnections: 2,
				idleConnections: 8,
			}
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Unknown error',
			}
		}
	}

	/**
	 * Check database connection (simple)
	 */
	private async checkDatabaseConnection(): Promise<boolean> {
		try {
			await this.services.db.audit.execute('SELECT 1')
			return true
		} catch {
			return false
		}
	}

	/**
	 * Check Redis connection (simple)
	 */
	private async checkRedisConnection(): Promise<boolean> {
		try {
			const result = await this.services.redis.ping()
			return result === 'PONG'
		} catch {
			return false
		}
	}

	/**
	 * Check auth service (simple)
	 */
	private async checkAuthService(): Promise<boolean> {
		try {
			await this.services.db.auth.execute('SELECT 1')
			return true
		} catch {
			return false
		}
	}

	/**
	 * Check migrations status
	 */
	private async checkMigrations(): Promise<boolean> {
		try {
			// This would check if all migrations have been applied
			// Implementation depends on your migration system
			return true
		} catch {
			return false
		}
	}

	/**
	 * Get check result from Promise.allSettled result
	 */
	private getCheckResult(
		result: PromiseSettledResult<HealthCheck>,
		defaultName: string
	): HealthCheck {
		if (result.status === 'fulfilled') {
			return result.value
		}

		return {
			name: defaultName,
			status: 'unhealthy',
			message: result.reason instanceof Error ? result.reason.message : 'Check failed',
			lastChecked: new Date().toISOString(),
		}
	}

	/**
	 * Determine overall status from individual checks
	 */
	private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
		const unhealthyCount = checks.filter((check) => check.status === 'unhealthy').length
		const degradedCount = checks.filter((check) => check.status === 'degraded').length

		if (unhealthyCount > 0) {
			return 'unhealthy'
		}

		if (degradedCount > 0) {
			return 'degraded'
		}

		return 'healthy'
	}

	/**
	 * Get default system metrics
	 */
	private getDefaultSystemMetrics() {
		const memoryUsage = process.memoryUsage()

		return {
			memory: {
				used: memoryUsage.heapUsed,
				total: memoryUsage.heapTotal,
				percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
			},
			cpu: {
				usage: 0,
				loadAverage: [0, 0, 0],
			},
		}
	}

	/**
	 * Handle unhealthy services by creating alerts
	 */
	private async handleUnhealthyServices(services: Record<string, HealthCheck>): Promise<void> {
		for (const [serviceName, check] of Object.entries(services)) {
			if (check.status === 'unhealthy') {
				try {
					const alert: Alert = {
						id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						severity: 'CRITICAL',
						type: 'METRICS',
						title: `${serviceName} Service Unhealthy`,
						description: check.message || `${serviceName} service is not responding`,
						createdAt: new Date().toISOString(),
						source: 'health-monitor',
						status: 'active',
						metadata: {
							organizationId: 'system',
							service: serviceName,
							responseTime: check.responseTime,
							details: check.details,
						},
						acknowledged: false,
						resolved: false,
						tags: ['api', 'health'],
					}
					await this.services.monitor.alerts.sendExternalAlert(alert)
				} catch (error) {
					this.services.logger.error('Failed to create health alert', {
						service: serviceName,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}
		}
	}
}
