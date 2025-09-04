import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetricsService } from '../../services/metrics'

import type { AuditClientConfig } from '../../core/config'
import type {
	AcknowledgeAlertRequest,
	Alert,
	AlertsParams,
	AuditMetrics,
	AuditMetricsParams,
	MetricsSubscriptionParams,
	PaginatedAlerts,
	PerformanceMetrics,
	ResolveAlertRequest,
	SystemMetrics,
	UsageMetrics,
	UsageMetricsParams,
} from '../../services/metrics'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper function to create mock response
const createMockResponse = (data: any, status = 200, ok = true) => ({
	ok,
	status,
	statusText: ok ? 'OK' : 'Error',
	headers: new Headers([['content-type', 'application/json']]),
	json: async () => data,
	text: async () => JSON.stringify(data),
	blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' }),
})

// Mock WebSocket and EventSource for real-time subscriptions
global.WebSocket = vi.fn().mockImplementation(() => ({
	readyState: 1,
	send: vi.fn(),
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}))

global.EventSource = vi.fn().mockImplementation(() => ({
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
}))

describe('MetricsService', () => {
	let metricsService: MetricsService

	const mockConfig: AuditClientConfig = {
		baseUrl: 'https://api.example.com',
		authentication: {
			type: 'apiKey',
			apiKey: 'test-key',
		},
		retry: {
			enabled: false,
			maxAttempts: 1,
			initialDelayMs: 100,
			maxDelayMs: 1000,
			backoffMultiplier: 2,
			retryableStatusCodes: [500, 502, 503],
			retryableErrors: [],
		},
		cache: {
			enabled: false,
			defaultTtlMs: 300000,
			maxSize: 100,
			storage: 'memory',
			keyPrefix: 'audit-client',
			compressionEnabled: false,
		},
		batching: {
			enabled: false,
			maxBatchSize: 10,
			batchTimeoutMs: 100,
			batchableEndpoints: [],
		},
		performance: {
			enableCompression: false,
			enableStreaming: false,
			maxConcurrentRequests: 10,
			requestDeduplication: false,
			responseTransformation: false,
		},
		logging: {
			enabled: false,
			level: 'info',
			includeRequestBody: false,
			includeResponseBody: false,
			maskSensitiveData: true,
		},
		errorHandling: {
			throwOnError: true,
			includeStackTrace: false,
			errorTransformation: false,
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
		metricsService = new MetricsService(mockConfig)
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('System Metrics', () => {
		it('should get system metrics', async () => {
			const mockSystemMetrics: SystemMetrics = {
				timestamp: '2024-01-01T00:00:00Z',
				server: {
					uptime: 86400,
					memoryUsage: {
						used: 1024,
						free: 2048,
						total: 3072,
						percentage: 33.3,
					},
					cpuUsage: {
						percentage: 45.2,
						loadAverage: [1.2, 1.5, 1.8],
						cores: 4,
					},
				},
				database: {
					connectionCount: 10,
					activeQueries: 5,
					averageQueryTime: 25.5,
					slowQueries: 2,
					totalQueries: 1000,
					errorRate: 0.1,
				},
				cache: {
					hitRate: 85.5,
					missRate: 14.5,
					evictionRate: 2.1,
					memoryUsage: 512,
					totalRequests: 5000,
					totalHits: 4275,
					totalMisses: 725,
				},
				api: {
					requestsPerSecond: 150.5,
					averageResponseTime: 125.8,
					errorRate: 1.2,
					activeConnections: 25,
					totalRequests: 10000,
					totalErrors: 120,
					endpointStats: {
						'/api/events': {
							requestCount: 5000,
							averageResponseTime: 100.5,
							errorCount: 50,
							errorRate: 1.0,
							lastAccessed: '2024-01-01T00:00:00Z',
						},
					},
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockSystemMetrics))

			const result = await metricsService.getSystemMetrics()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/system',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockSystemMetrics)
		})
	})

	describe('Audit Metrics', () => {
		it('should get audit metrics with default parameters', async () => {
			const mockAuditMetrics: AuditMetrics = {
				timestamp: '2024-01-01T00:00:00Z',
				timeRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-01T23:59:59Z',
				},
				eventsProcessed: 1000,
				processingLatency: {
					average: 25.5,
					p50: 20.0,
					p95: 45.0,
					p99: 75.0,
					min: 5.0,
					max: 150.0,
				},
				integrityVerifications: {
					total: 500,
					passed: 495,
					failed: 5,
					averageTime: 15.2,
					successRate: 99.0,
				},
				complianceReports: {
					generated: 25,
					scheduled: 20,
					failed: 1,
					averageGenerationTime: 5000,
				},
				errorRates: {
					total: 12,
					byType: {
						ValidationError: 5,
						NetworkError: 4,
						TimeoutError: 3,
					},
					byEndpoint: {
						'/api/events': 8,
						'/api/reports': 4,
					},
					byStatus: {
						'400': 5,
						'500': 4,
						'503': 3,
					},
				},
				dataClassificationStats: {
					PUBLIC: 200,
					INTERNAL: 300,
					CONFIDENTIAL: 400,
					PHI: 100,
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockAuditMetrics))

			const result = await metricsService.getAuditMetrics()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/audit',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockAuditMetrics)
		})

		it('should get audit metrics with custom parameters', async () => {
			const params: AuditMetricsParams = {
				timeRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-02T00:00:00Z',
				},
				granularity: 'day',
				includeBreakdown: true,
				organizationIds: ['org1', 'org2'],
				dataClassifications: ['PHI', 'CONFIDENTIAL'],
			}

			const mockAuditMetrics: AuditMetrics = {
				timestamp: '2024-01-01T00:00:00Z',
				timeRange: params.timeRange!,
				eventsProcessed: 2000,
				processingLatency: {
					average: 30.0,
					p50: 25.0,
					p95: 50.0,
					p99: 80.0,
					min: 8.0,
					max: 200.0,
				},
				integrityVerifications: {
					total: 1000,
					passed: 990,
					failed: 10,
					averageTime: 18.5,
					successRate: 99.0,
				},
				complianceReports: {
					generated: 50,
					scheduled: 40,
					failed: 2,
					averageGenerationTime: 6000,
				},
				errorRates: {
					total: 24,
					byType: {},
					byEndpoint: {},
					byStatus: {},
				},
				dataClassificationStats: {
					PUBLIC: 0,
					INTERNAL: 0,
					CONFIDENTIAL: 800,
					PHI: 200,
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockAuditMetrics))

			const result = await metricsService.getAuditMetrics(params)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v1/metrics/audit'),
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockAuditMetrics)
		})
	})

	describe('Performance Metrics', () => {
		it('should get performance metrics', async () => {
			const mockPerformanceMetrics: PerformanceMetrics = {
				timestamp: '2024-01-01T00:00:00Z',
				responseTime: {
					average: 125.8,
					p50: 100.0,
					p95: 250.0,
					p99: 500.0,
					min: 10.0,
					max: 2000.0,
				},
				throughput: {
					requestsPerSecond: 150.5,
					eventsPerSecond: 75.2,
					reportsPerHour: 12.5,
				},
				resourceUtilization: {
					cpu: 45.2,
					memory: 67.8,
					disk: 23.4,
					network: {
						bytesIn: 1024000,
						bytesOut: 2048000,
						packetsIn: 5000,
						packetsOut: 7500,
					},
				},
				concurrency: {
					activeConnections: 25,
					queuedRequests: 5,
					processingThreads: 8,
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockPerformanceMetrics))

			const result = await metricsService.getPerformanceMetrics()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/performance',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockPerformanceMetrics)
		})
	})

	describe('Usage Metrics', () => {
		it('should get usage metrics with default parameters', async () => {
			const mockUsageMetrics: UsageMetrics = {
				timestamp: '2024-01-01T00:00:00Z',
				timeRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-01T23:59:59Z',
				},
				apiUsage: {
					totalRequests: 10000,
					uniqueUsers: 150,
					topEndpoints: [
						{
							endpoint: '/api/events',
							requestCount: 5000,
							percentage: 50.0,
						},
						{
							endpoint: '/api/reports',
							requestCount: 3000,
							percentage: 30.0,
						},
					],
					rateLimitHits: 25,
					quotaUsage: {
						current: 8500,
						limit: 10000,
						percentage: 85.0,
					},
				},
				auditEvents: {
					totalEvents: 5000,
					eventsByType: {
						'user.login': 1500,
						'user.logout': 1200,
						'data.access': 2300,
					},
					eventsByOrganization: {
						org1: 2500,
						org2: 1500,
						org3: 1000,
					},
					eventsByDataClassification: {
						PUBLIC: 1000,
						INTERNAL: 1500,
						CONFIDENTIAL: 2000,
						PHI: 500,
					},
				},
				reports: {
					totalGenerated: 100,
					reportsByType: {
						hipaa: 40,
						gdpr: 35,
						custom: 25,
					},
					scheduledReports: 75,
					onDemandReports: 25,
				},
				storage: {
					totalSize: 1024000000,
					growthRate: 5.2,
					retentionCompliance: 98.5,
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockUsageMetrics))

			const result = await metricsService.getUsageMetrics()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/usage',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockUsageMetrics)
		})

		it('should get usage metrics with custom parameters', async () => {
			const params: UsageMetricsParams = {
				timeRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-07T23:59:59Z',
				},
				granularity: 'week',
				includeBreakdown: true,
			}

			mockFetch.mockResolvedValueOnce(createMockResponse({}))

			await metricsService.getUsageMetrics(params)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v1/metrics/usage'),
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
		})
	})

	describe('Alert Management', () => {
		it('should get alerts with default parameters', async () => {
			const mockPaginatedAlerts: PaginatedAlerts = {
				alerts: [
					{
						id: 'alert-1',
						title: 'High CPU Usage',
						description: 'CPU usage exceeded 90% threshold',
						severity: 'high',
						status: 'active',
						source: 'system-monitor',
						category: 'performance',
						createdAt: '2024-01-01T00:00:00Z',
						updatedAt: '2024-01-01T00:00:00Z',
						metadata: {
							threshold: 90,
							currentValue: 95.2,
						},
						affectedResources: ['server-1'],
					},
				],
				pagination: {
					total: 1,
					limit: 50,
					offset: 0,
					hasNext: false,
					hasPrevious: false,
				},
				summary: {
					totalActive: 1,
					totalAcknowledged: 0,
					totalResolved: 0,
					bySeverity: {
						low: 0,
						medium: 0,
						high: 1,
						critical: 0,
					},
					byCategory: {
						performance: 1,
					},
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockPaginatedAlerts))

			const result = await metricsService.getAlerts()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/alerts',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockPaginatedAlerts)
		})

		it('should get a specific alert by ID', async () => {
			const mockAlert: Alert = {
				id: 'alert-1',
				title: 'High CPU Usage',
				description: 'CPU usage exceeded 90% threshold',
				severity: 'high',
				status: 'active',
				source: 'system-monitor',
				category: 'performance',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				metadata: {},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockAlert))

			const result = await metricsService.getAlert('alert-1')

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/alerts/alert-1',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockAlert)
		})

		it('should return null when alert is not found', async () => {
			mockFetch.mockResolvedValueOnce(createMockResponse({}, 404, false))

			const result = await metricsService.getAlert('nonexistent')

			expect(result).toBeNull()
		})

		it('should acknowledge an alert', async () => {
			const request: AcknowledgeAlertRequest = {
				acknowledgedBy: 'admin@example.com',
				notes: 'Investigating the issue',
			}

			const mockAlert: Alert = {
				id: 'alert-1',
				title: 'High CPU Usage',
				description: 'CPU usage exceeded 90% threshold',
				severity: 'high',
				status: 'acknowledged',
				source: 'system-monitor',
				category: 'performance',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T01:00:00Z',
				acknowledgedAt: '2024-01-01T01:00:00Z',
				acknowledgedBy: 'admin@example.com',
				metadata: {},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockAlert))

			const result = await metricsService.acknowledgeAlert('alert-1', request)

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/alerts/alert-1/acknowledge',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
						'Content-Type': 'application/json',
					}),
					body: JSON.stringify(request),
				})
			)
			expect(result).toEqual(mockAlert)
		})

		it('should resolve an alert', async () => {
			const request: ResolveAlertRequest = {
				resolvedBy: 'admin@example.com',
				resolution: 'Scaled up server resources',
				notes: 'Added additional CPU cores',
			}

			const mockAlert: Alert = {
				id: 'alert-1',
				title: 'High CPU Usage',
				description: 'CPU usage exceeded 90% threshold',
				severity: 'high',
				status: 'resolved',
				source: 'system-monitor',
				category: 'performance',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T02:00:00Z',
				resolvedAt: '2024-01-01T02:00:00Z',
				resolvedBy: 'admin@example.com',
				resolution: 'Scaled up server resources',
				metadata: {},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockAlert))

			const result = await metricsService.resolveAlert('alert-1', request)

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/alerts/alert-1/resolve',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
						'Content-Type': 'application/json',
					}),
					body: JSON.stringify(request),
				})
			)
			expect(result).toEqual(mockAlert)
		})
	})

	describe('Historical and Export Features', () => {
		it('should get historical metrics', async () => {
			const mockHistoricalData = [
				{ timestamp: '2024-01-01T00:00:00Z', value: 100 },
				{ timestamp: '2024-01-01T01:00:00Z', value: 110 },
			]

			mockFetch.mockResolvedValueOnce(createMockResponse(mockHistoricalData))

			const result = await metricsService.getHistoricalMetrics(
				'system',
				{
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-01T23:59:59Z',
				},
				'hour'
			)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v1/metrics/system/historical'),
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockHistoricalData)
		})

		it('should export metrics data', async () => {
			const mockBlob = new Blob(['csv,data'], { type: 'text/csv' })
			mockFetch.mockResolvedValueOnce({
				...createMockResponse(null),
				blob: async () => mockBlob,
			})

			const result = await metricsService.exportMetrics(
				'audit',
				{
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-01T23:59:59Z',
				},
				'csv'
			)

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/audit/export',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
						'Content-Type': 'application/json',
					}),
					body: JSON.stringify({
						timeRange: {
							startDate: '2024-01-01T00:00:00Z',
							endDate: '2024-01-01T23:59:59Z',
						},
						format: 'csv',
					}),
				})
			)
			expect(result).toEqual(mockBlob)
		})
	})

	describe('Dashboard and Configuration', () => {
		it('should get dashboard summary', async () => {
			const mockDashboard = {
				system: { timestamp: '2024-01-01T00:00:00Z' },
				audit: { eventsProcessed: 1000 },
				performance: { responseTime: { average: 125 } },
				alerts: {
					total: 5,
					critical: 1,
					high: 2,
					recent: [],
				},
				trends: {
					eventsGrowth: 5.2,
					performanceTrend: -2.1,
					errorRateTrend: 0.5,
				},
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockDashboard))

			const result = await metricsService.getDashboardSummary()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/dashboard',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockDashboard)
		})

		it('should execute custom query', async () => {
			const query = {
				metrics: ['cpu_usage', 'memory_usage'],
				filters: { server: 'prod-1' },
				timeRange: {
					startDate: '2024-01-01T00:00:00Z',
					endDate: '2024-01-01T23:59:59Z',
				},
				groupBy: ['server'],
				aggregation: 'avg' as const,
			}

			const mockResult = { data: [] }
			mockFetch.mockResolvedValueOnce(createMockResponse(mockResult))

			const result = await metricsService.customQuery(query)

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/query',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
						'Content-Type': 'application/json',
					}),
					body: JSON.stringify(query),
				})
			)
			expect(result).toEqual(mockResult)
		})

		it('should get metrics configuration', async () => {
			const mockConfig = {
				alertThresholds: { cpu: 90, memory: 85 },
				retentionPolicies: { metrics: '30d', alerts: '90d' },
				samplingRates: { system: 1.0, audit: 0.8 },
				enabledMetrics: ['system', 'audit', 'performance'],
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockConfig))

			const result = await metricsService.getMetricsConfig()

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/config',
				expect.objectContaining({
					method: 'GET',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
					}),
				})
			)
			expect(result).toEqual(mockConfig)
		})

		it('should update metrics configuration', async () => {
			const config = {
				alertThresholds: { cpu: 95 },
				enabledMetrics: ['system', 'audit'],
			}

			const mockUpdatedConfig = {
				alertThresholds: { cpu: 95, memory: 85 },
				retentionPolicies: { metrics: '30d', alerts: '90d' },
				samplingRates: { system: 1.0, audit: 0.8 },
				enabledMetrics: ['system', 'audit'],
			}

			mockFetch.mockResolvedValueOnce(createMockResponse(mockUpdatedConfig))

			const result = await metricsService.updateMetricsConfig(config)

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/v1/metrics/config',
				expect.objectContaining({
					method: 'PUT',
					headers: expect.objectContaining({
						'X-API-Key': 'test-key',
						'Content-Type': 'application/json',
					}),
					body: JSON.stringify(config),
				})
			)
			expect(result).toEqual(mockUpdatedConfig)
		})
	})

	describe('Real-time Metrics Subscription', () => {
		it('should create metrics subscription', () => {
			const params: MetricsSubscriptionParams = {
				metricsTypes: ['system', 'audit'],
				updateInterval: 30,
				includeAlerts: true,
			}

			const subscription = metricsService.subscribeToMetrics(params)

			expect(subscription).toBeDefined()
			expect(subscription.id).toMatch(/^metrics-sub-/)
			expect(subscription.isActive).toBe(false)
		})
	})
})
