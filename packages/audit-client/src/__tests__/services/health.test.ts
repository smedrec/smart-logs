import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HealthService } from '../../services/health'

import type {
	ApiStatus,
	ComponentHealth,
	DetailedHealthStatus,
	HealthCheckConfig,
	HealthStatus,
	LivenessStatus,
	ReadinessStatus,
	ServiceDependency,
	VersionInfo,
} from '../../services/health'

// Mock the BaseResource
vi.mock('../core/base-resource', () => ({
	BaseResource: class MockBaseResource {
		protected config: any
		protected logger: any

		constructor(config: any, logger?: any) {
			this.config = config
			this.logger = logger
		}

		protected async request<T>(endpoint: string, options: any = {}): Promise<T> {
			// Mock implementation that returns different responses based on endpoint
			return this.getMockResponse(endpoint, options) as T
		}

		private getMockResponse(endpoint: string, options: any) {
			switch (endpoint) {
				case '/health':
					return {
						status: 'healthy',
						timestamp: '2024-01-01T00:00:00Z',
						uptime: 3600,
						version: '1.0.0',
					}

				case '/health/detailed':
					return {
						status: 'healthy',
						timestamp: '2024-01-01T00:00:00Z',
						uptime: 3600,
						version: '1.0.0',
						components: {
							database: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 50,
							},
							cache: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 10,
							},
							storage: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 25,
							},
							authentication: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 15,
							},
							audit: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 30,
							},
							compliance: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 40,
							},
						},
						dependencies: [
							{
								name: 'postgres',
								type: 'database',
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 50,
							},
						],
						metrics: {
							responseTime: 25,
							memoryUsage: 512,
							cpuUsage: 15,
							activeConnections: 10,
						},
					}

				case '/health/ready':
					return {
						ready: true,
						timestamp: '2024-01-01T00:00:00Z',
						checks: {
							database: true,
							cache: true,
							storage: true,
							authentication: true,
							migrations: true,
						},
					}

				case '/health/alive':
					return {
						alive: true,
						timestamp: '2024-01-01T00:00:00Z',
						uptime: 3600,
						lastActivity: '2024-01-01T00:00:00Z',
					}

				case '/health/version':
					return {
						version: '1.0.0',
						buildDate: '2024-01-01T00:00:00Z',
						gitCommit: 'abc123',
						gitBranch: 'main',
						environment: 'production',
						apiVersion: 'v1',
						features: ['audit', 'compliance', 'health'],
						dependencies: {
							node: '18.0.0',
							postgres: '14.0',
							redis: '6.0',
						},
					}

				case '/health/status':
					return {
						status: 'operational',
						timestamp: '2024-01-01T00:00:00Z',
						endpoints: {
							'/api/v1/audit/events': {
								status: 'operational',
								responseTime: 100,
								errorRate: 0.01,
								lastChecked: '2024-01-01T00:00:00Z',
							},
							'/api/v1/compliance/reports': {
								status: 'operational',
								responseTime: 200,
								errorRate: 0.02,
								lastChecked: '2024-01-01T00:00:00Z',
							},
						},
						rateLimit: {
							current: 100,
							limit: 1000,
							resetTime: '2024-01-01T01:00:00Z',
						},
					}

				case '/health/components/database':
					return {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 50,
						details: {
							connectionCount: 10,
							activeQueries: 2,
						},
					}

				case '/health/dependencies':
					return [
						{
							name: 'postgres',
							type: 'database',
							status: 'healthy',
							url: 'postgres://localhost:5432',
							lastChecked: '2024-01-01T00:00:00Z',
							responseTime: 50,
							version: '14.0',
						},
						{
							name: 'redis',
							type: 'cache',
							status: 'healthy',
							url: 'redis://localhost:6379',
							lastChecked: '2024-01-01T00:00:00Z',
							responseTime: 10,
							version: '6.0',
						},
					]

				case '/health/dependencies/postgres':
					return {
						name: 'postgres',
						type: 'database',
						status: 'healthy',
						url: 'postgres://localhost:5432',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 50,
						version: '14.0',
					}

				case '/health/history':
					return [
						{
							timestamp: '2024-01-01T00:00:00Z',
							status: 'healthy',
							responseTime: 25,
						},
						{
							timestamp: '2024-01-01T00:01:00Z',
							status: 'healthy',
							responseTime: 30,
						},
					]

				case '/health/metrics':
					return {
						uptime: {
							current: 3600,
							average: 3500,
							availability: 99.9,
						},
						responseTime: {
							average: 25,
							p50: 20,
							p95: 50,
							p99: 100,
						},
						errorRates: {
							total: 0.01,
							byComponent: {
								database: 0.005,
								cache: 0.001,
							},
							byDependency: {
								postgres: 0.005,
								redis: 0.001,
							},
						},
						statusDistribution: {
							healthy: 95,
							degraded: 4,
							unhealthy: 1,
						},
						trends: {
							uptimeTrend: 0.1,
							responseTimeTrend: -0.05,
							errorRateTrend: -0.02,
						},
					}

				case '/health/check':
					return {
						status: 'healthy',
						timestamp: '2024-01-01T00:00:00Z',
						uptime: 3600,
						version: '1.0.0',
						components: {
							database: {
								status: 'healthy',
								lastChecked: '2024-01-01T00:00:00Z',
								responseTime: 50,
							},
						},
						dependencies: [],
						metrics: {
							responseTime: 25,
							memoryUsage: 512,
							cpuUsage: 15,
							activeConnections: 10,
						},
					}

				case '/health/cache/reset':
					return undefined

				case '/health/config':
					if (options.method === 'GET') {
						return {
							checkInterval: 30,
							timeout: 5000,
							retryAttempts: 3,
							alertThresholds: {
								responseTime: 1000,
								errorRate: 0.05,
							},
							enabledChecks: ['database', 'cache', 'storage'],
							dependencyChecks: {
								postgres: { timeout: 5000 },
								redis: { timeout: 2000 },
							},
						}
					} else {
						return options.body
					}

				case '/health/system':
					return {
						hostname: 'test-server',
						platform: 'linux',
						architecture: 'x64',
						nodeVersion: '18.0.0',
						processId: 1234,
						parentProcessId: 1,
						workingDirectory: '/app',
						execPath: '/usr/bin/node',
						memoryUsage: {
							rss: 100000000,
							heapTotal: 50000000,
							heapUsed: 30000000,
							external: 5000000,
							arrayBuffers: 1000000,
						},
						cpuUsage: {
							user: 1000000,
							system: 500000,
						},
						loadAverage: [0.5, 0.3, 0.2],
						networkInterfaces: {},
						environment: 'test',
					}

				case '/health/connectivity':
					return {
						timestamp: '2024-01-01T00:00:00Z',
						results: [
							{
								service: 'postgres',
								status: 'connected',
								responseTime: 50,
							},
							{
								service: 'redis',
								status: 'connected',
								responseTime: 10,
							},
						],
						summary: {
							total: 2,
							connected: 2,
							failed: 0,
							averageResponseTime: 30,
						},
					}

				default:
					throw new Error(`Unmocked endpoint: ${endpoint}`)
			}
		}
	},
}))

describe('HealthService', () => {
	let healthService: HealthService
	let mockConfig: any

	beforeEach(() => {
		mockConfig = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			cache: { enabled: false },
			retry: { enabled: false },
			batching: { enabled: false },
			performance: { enableCompression: false },
			logging: { enabled: false },
			errorHandling: { throwOnError: true },
			customHeaders: {},
			interceptors: { request: [], response: [] },
		}

		healthService = new HealthService(mockConfig)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('check', () => {
		it('should perform a simple health check', async () => {
			const result = await healthService.check()

			expect(result).toEqual({
				status: 'healthy',
				timestamp: '2024-01-01T00:00:00Z',
				uptime: 3600,
				version: '1.0.0',
			})
		})

		it('should perform a health check with configuration', async () => {
			const config: HealthCheckConfig = {
				timeout: 5000,
				includeDetails: true,
				checkDependencies: true,
				componentChecks: ['database', 'cache'],
			}

			const result = await healthService.check(config)

			expect(result).toEqual({
				status: 'healthy',
				timestamp: '2024-01-01T00:00:00Z',
				uptime: 3600,
				version: '1.0.0',
			})
		})
	})

	describe('detailed', () => {
		it('should perform a detailed health check', async () => {
			const result = await healthService.detailed()

			expect(result).toEqual({
				status: 'healthy',
				timestamp: '2024-01-01T00:00:00Z',
				uptime: 3600,
				version: '1.0.0',
				components: {
					database: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 50,
					},
					cache: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 10,
					},
					storage: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 25,
					},
					authentication: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 15,
					},
					audit: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 30,
					},
					compliance: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 40,
					},
				},
				dependencies: [
					{
						name: 'postgres',
						type: 'database',
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 50,
					},
				],
				metrics: {
					responseTime: 25,
					memoryUsage: 512,
					cpuUsage: 15,
					activeConnections: 10,
				},
			})
		})
	})

	describe('ready', () => {
		it('should check readiness status', async () => {
			const result = await healthService.ready()

			expect(result).toEqual({
				ready: true,
				timestamp: '2024-01-01T00:00:00Z',
				checks: {
					database: true,
					cache: true,
					storage: true,
					authentication: true,
					migrations: true,
				},
			})
		})
	})

	describe('alive', () => {
		it('should check liveness status', async () => {
			const result = await healthService.alive()

			expect(result).toEqual({
				alive: true,
				timestamp: '2024-01-01T00:00:00Z',
				uptime: 3600,
				lastActivity: '2024-01-01T00:00:00Z',
			})
		})
	})

	describe('version', () => {
		it('should get version information', async () => {
			const result = await healthService.version()

			expect(result).toEqual({
				version: '1.0.0',
				buildDate: '2024-01-01T00:00:00Z',
				gitCommit: 'abc123',
				gitBranch: 'main',
				environment: 'production',
				apiVersion: 'v1',
				features: ['audit', 'compliance', 'health'],
				dependencies: {
					node: '18.0.0',
					postgres: '14.0',
					redis: '6.0',
				},
			})
		})
	})

	describe('status', () => {
		it('should get API status', async () => {
			const result = await healthService.status()

			expect(result).toEqual({
				status: 'operational',
				timestamp: '2024-01-01T00:00:00Z',
				endpoints: {
					'/api/v1/audit/events': {
						status: 'operational',
						responseTime: 100,
						errorRate: 0.01,
						lastChecked: '2024-01-01T00:00:00Z',
					},
					'/api/v1/compliance/reports': {
						status: 'operational',
						responseTime: 200,
						errorRate: 0.02,
						lastChecked: '2024-01-01T00:00:00Z',
					},
				},
				rateLimit: {
					current: 100,
					limit: 1000,
					resetTime: '2024-01-01T01:00:00Z',
				},
			})
		})
	})

	describe('checkComponent', () => {
		it('should check health of a specific component', async () => {
			const result = await healthService.checkComponent('database')

			expect(result).toEqual({
				status: 'healthy',
				lastChecked: '2024-01-01T00:00:00Z',
				responseTime: 50,
				details: {
					connectionCount: 10,
					activeQueries: 2,
				},
			})
		})
	})

	describe('getDependencies', () => {
		it('should get health status of all dependencies', async () => {
			const result = await healthService.getDependencies()

			expect(result).toEqual([
				{
					name: 'postgres',
					type: 'database',
					status: 'healthy',
					url: 'postgres://localhost:5432',
					lastChecked: '2024-01-01T00:00:00Z',
					responseTime: 50,
					version: '14.0',
				},
				{
					name: 'redis',
					type: 'cache',
					status: 'healthy',
					url: 'redis://localhost:6379',
					lastChecked: '2024-01-01T00:00:00Z',
					responseTime: 10,
					version: '6.0',
				},
			])
		})
	})

	describe('checkDependency', () => {
		it('should check health of a specific dependency', async () => {
			const result = await healthService.checkDependency('postgres')

			expect(result).toEqual({
				name: 'postgres',
				type: 'database',
				status: 'healthy',
				url: 'postgres://localhost:5432',
				lastChecked: '2024-01-01T00:00:00Z',
				responseTime: 50,
				version: '14.0',
			})
		})
	})

	describe('getHealthHistory', () => {
		it('should get health check history', async () => {
			const timeRange = {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-01T01:00:00Z',
			}

			const result = await healthService.getHealthHistory(timeRange)

			expect(result).toEqual([
				{
					timestamp: '2024-01-01T00:00:00Z',
					status: 'healthy',
					responseTime: 25,
				},
				{
					timestamp: '2024-01-01T00:01:00Z',
					status: 'healthy',
					responseTime: 30,
				},
			])
		})

		it('should get health check history for specific component', async () => {
			const timeRange = {
				startDate: '2024-01-01T00:00:00Z',
				endDate: '2024-01-01T01:00:00Z',
			}

			const result = await healthService.getHealthHistory(timeRange, 'database')

			expect(result).toEqual([
				{
					timestamp: '2024-01-01T00:00:00Z',
					status: 'healthy',
					responseTime: 25,
				},
				{
					timestamp: '2024-01-01T00:01:00Z',
					status: 'healthy',
					responseTime: 30,
				},
			])
		})
	})

	describe('getHealthMetrics', () => {
		it('should get health metrics and statistics', async () => {
			const result = await healthService.getHealthMetrics()

			expect(result).toEqual({
				uptime: {
					current: 3600,
					average: 3500,
					availability: 99.9,
				},
				responseTime: {
					average: 25,
					p50: 20,
					p95: 50,
					p99: 100,
				},
				errorRates: {
					total: 0.01,
					byComponent: {
						database: 0.005,
						cache: 0.001,
					},
					byDependency: {
						postgres: 0.005,
						redis: 0.001,
					},
				},
				statusDistribution: {
					healthy: 95,
					degraded: 4,
					unhealthy: 1,
				},
				trends: {
					uptimeTrend: 0.1,
					responseTimeTrend: -0.05,
					errorRateTrend: -0.02,
				},
			})
		})
	})

	describe('triggerHealthCheck', () => {
		it('should trigger a manual health check', async () => {
			const result = await healthService.triggerHealthCheck()

			expect(result).toEqual({
				status: 'healthy',
				timestamp: '2024-01-01T00:00:00Z',
				uptime: 3600,
				version: '1.0.0',
				components: {
					database: {
						status: 'healthy',
						lastChecked: '2024-01-01T00:00:00Z',
						responseTime: 50,
					},
				},
				dependencies: [],
				metrics: {
					responseTime: 25,
					memoryUsage: 512,
					cpuUsage: 15,
					activeConnections: 10,
				},
			})
		})
	})

	describe('resetHealthCache', () => {
		it('should reset health check cache', async () => {
			await expect(healthService.resetHealthCache()).resolves.toBeUndefined()
		})
	})

	describe('getHealthConfig', () => {
		it('should get health check configuration', async () => {
			const result = await healthService.getHealthConfig()

			expect(result).toEqual({
				checkInterval: 30,
				timeout: 5000,
				retryAttempts: 3,
				alertThresholds: {
					responseTime: 1000,
					errorRate: 0.05,
				},
				enabledChecks: ['database', 'cache', 'storage'],
				dependencyChecks: {
					postgres: { timeout: 5000 },
					redis: { timeout: 2000 },
				},
			})
		})
	})

	describe('updateHealthConfig', () => {
		it('should update health check configuration', async () => {
			const config = {
				checkInterval: 60,
				timeout: 10000,
				retryAttempts: 5,
			}

			const result = await healthService.updateHealthConfig(config)

			expect(result).toEqual(config)
		})
	})

	describe('getSystemInfo', () => {
		it('should get system information', async () => {
			const result = await healthService.getSystemInfo()

			expect(result).toEqual({
				hostname: 'test-server',
				platform: 'linux',
				architecture: 'x64',
				nodeVersion: '18.0.0',
				processId: 1234,
				parentProcessId: 1,
				workingDirectory: '/app',
				execPath: '/usr/bin/node',
				memoryUsage: {
					rss: 100000000,
					heapTotal: 50000000,
					heapUsed: 30000000,
					external: 5000000,
					arrayBuffers: 1000000,
				},
				cpuUsage: {
					user: 1000000,
					system: 500000,
				},
				loadAverage: [0.5, 0.3, 0.2],
				networkInterfaces: {},
				environment: 'test',
			})
		})
	})

	describe('testConnectivity', () => {
		it('should test connectivity to external services', async () => {
			const result = await healthService.testConnectivity(['postgres', 'redis'])

			expect(result).toEqual({
				timestamp: '2024-01-01T00:00:00Z',
				results: [
					{
						service: 'postgres',
						status: 'connected',
						responseTime: 50,
					},
					{
						service: 'redis',
						status: 'connected',
						responseTime: 10,
					},
				],
				summary: {
					total: 2,
					connected: 2,
					failed: 0,
					averageResponseTime: 30,
				},
			})
		})

		it('should test connectivity without specifying services', async () => {
			const result = await healthService.testConnectivity()

			expect(result).toEqual({
				timestamp: '2024-01-01T00:00:00Z',
				results: [
					{
						service: 'postgres',
						status: 'connected',
						responseTime: 50,
					},
					{
						service: 'redis',
						status: 'connected',
						responseTime: 10,
					},
				],
				summary: {
					total: 2,
					connected: 2,
					failed: 0,
					averageResponseTime: 30,
				},
			})
		})
	})

	describe('subscribeToHealth', () => {
		it('should create a health subscription', () => {
			const params = {
				interval: 30,
				includeMetrics: true,
				alertOnStatusChange: true,
				components: ['database', 'cache'],
			}

			const subscription = healthService.subscribeToHealth(params)

			expect(subscription).toBeDefined()
			expect(subscription.id).toMatch(/^health-sub-/)
			expect(subscription.isActive).toBe(false)
		})

		it('should create a health subscription with default parameters', () => {
			const subscription = healthService.subscribeToHealth()

			expect(subscription).toBeDefined()
			expect(subscription.id).toMatch(/^health-sub-/)
			expect(subscription.isActive).toBe(false)
		})
	})
})
