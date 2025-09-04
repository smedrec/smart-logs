import { BaseResource } from '../core/base-resource'

import type { RequestOptions } from '../core/base-resource'

/**
 * Memory usage metrics
 */
export interface MemoryUsage {
	used: number
	free: number
	total: number
	percentage: number
}

/**
 * CPU usage metrics
 */
export interface CpuUsage {
	percentage: number
	loadAverage: number[]
	cores: number
}

/**
 * Database metrics
 */
export interface DatabaseMetrics {
	connectionCount: number
	activeQueries: number
	averageQueryTime: number
	slowQueries: number
	totalQueries: number
	errorRate: number
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
	hitRate: number
	missRate: number
	evictionRate: number
	memoryUsage: number
	totalRequests: number
	totalHits: number
	totalMisses: number
}

/**
 * API metrics
 */
export interface ApiMetrics {
	requestsPerSecond: number
	averageResponseTime: number
	errorRate: number
	activeConnections: number
	totalRequests: number
	totalErrors: number
	endpointStats: Record<string, EndpointStats>
}

/**
 * Endpoint-specific statistics
 */
export interface EndpointStats {
	requestCount: number
	averageResponseTime: number
	errorCount: number
	errorRate: number
	lastAccessed: string
}

/**
 * System metrics interface
 */
export interface SystemMetrics {
	timestamp: string
	server: {
		uptime: number
		memoryUsage: MemoryUsage
		cpuUsage: CpuUsage
		diskUsage?: {
			used: number
			free: number
			total: number
			percentage: number
		}
	}
	database: DatabaseMetrics
	cache: CacheMetrics
	api: ApiMetrics
}

/**
 * Audit-specific metrics
 */
export interface AuditMetrics {
	timestamp: string
	timeRange: {
		startDate: string
		endDate: string
	}
	eventsProcessed: number
	processingLatency: {
		average: number
		p50: number
		p95: number
		p99: number
		min: number
		max: number
	}
	integrityVerifications: {
		total: number
		passed: number
		failed: number
		averageTime: number
		successRate: number
	}
	complianceReports: {
		generated: number
		scheduled: number
		failed: number
		averageGenerationTime: number
	}
	errorRates: {
		total: number
		byType: Record<string, number>
		byEndpoint: Record<string, number>
		byStatus: Record<string, number>
	}
	dataClassificationStats: {
		PUBLIC: number
		INTERNAL: number
		CONFIDENTIAL: number
		PHI: number
	}
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
	timestamp: string
	responseTime: {
		average: number
		p50: number
		p95: number
		p99: number
		min: number
		max: number
	}
	throughput: {
		requestsPerSecond: number
		eventsPerSecond: number
		reportsPerHour: number
	}
	resourceUtilization: {
		cpu: number
		memory: number
		disk: number
		network: {
			bytesIn: number
			bytesOut: number
			packetsIn: number
			packetsOut: number
		}
	}
	concurrency: {
		activeConnections: number
		queuedRequests: number
		processingThreads: number
	}
}

/**
 * Usage metrics parameters
 */
export interface UsageMetricsParams {
	timeRange?: {
		startDate: string
		endDate: string
	}
	granularity?: 'hour' | 'day' | 'week' | 'month'
	includeBreakdown?: boolean
}

/**
 * Usage metrics interface
 */
export interface UsageMetrics {
	timestamp: string
	timeRange: {
		startDate: string
		endDate: string
	}
	apiUsage: {
		totalRequests: number
		uniqueUsers: number
		topEndpoints: Array<{
			endpoint: string
			requestCount: number
			percentage: number
		}>
		rateLimitHits: number
		quotaUsage: {
			current: number
			limit: number
			percentage: number
		}
	}
	auditEvents: {
		totalEvents: number
		eventsByType: Record<string, number>
		eventsByOrganization: Record<string, number>
		eventsByDataClassification: Record<string, number>
	}
	reports: {
		totalGenerated: number
		reportsByType: Record<string, number>
		scheduledReports: number
		onDemandReports: number
	}
	storage: {
		totalSize: number
		growthRate: number
		retentionCompliance: number
	}
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Alert status types
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed'

/**
 * Alert interface
 */
export interface Alert {
	id: string
	title: string
	description: string
	severity: AlertSeverity
	status: AlertStatus
	source: string
	category: string
	createdAt: string
	updatedAt: string
	acknowledgedAt?: string
	acknowledgedBy?: string
	resolvedAt?: string
	resolvedBy?: string
	resolution?: string
	metadata: Record<string, any>
	affectedResources?: string[]
	relatedAlerts?: string[]
}

/**
 * Alert query parameters
 */
export interface AlertsParams {
	status?: AlertStatus[]
	severity?: AlertSeverity[]
	category?: string[]
	source?: string[]
	timeRange?: {
		startDate: string
		endDate: string
	}
	pagination?: {
		limit?: number
		offset?: number
	}
	sort?: {
		field: 'createdAt' | 'updatedAt' | 'severity' | 'status'
		direction: 'asc' | 'desc'
	}
}

/**
 * Paginated alerts response
 */
export interface PaginatedAlerts {
	alerts: Alert[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	summary: {
		totalActive: number
		totalAcknowledged: number
		totalResolved: number
		bySeverity: Record<AlertSeverity, number>
		byCategory: Record<string, number>
	}
}

/**
 * Audit metrics query parameters
 */
export interface AuditMetricsParams {
	timeRange?: {
		startDate: string
		endDate: string
	}
	granularity?: 'hour' | 'day' | 'week' | 'month'
	includeBreakdown?: boolean
	organizationIds?: string[]
	dataClassifications?: string[]
}

/**
 * Real-time metrics subscription parameters
 */
export interface MetricsSubscriptionParams {
	metricsTypes: ('system' | 'audit' | 'performance' | 'usage')[]
	updateInterval?: number // seconds
	includeAlerts?: boolean
}

/**
 * Real-time metrics data
 */
export interface RealTimeMetricsData {
	timestamp: string
	type: 'system' | 'audit' | 'performance' | 'usage' | 'alert'
	data: SystemMetrics | AuditMetrics | PerformanceMetrics | UsageMetrics | Alert
}

/**
 * Metrics subscription interface
 */
export interface MetricsSubscription {
	id: string
	isActive: boolean
	connect(): Promise<void>
	disconnect(): void
	onData(callback: (data: RealTimeMetricsData) => void): void
	onError(callback: (error: Error) => void): void
	onClose(callback: () => void): void
}

/**
 * Alert acknowledgment request
 */
export interface AcknowledgeAlertRequest {
	acknowledgedBy: string
	notes?: string
}

/**
 * Alert resolution request
 */
export interface ResolveAlertRequest {
	resolvedBy: string
	resolution: string
	notes?: string
}

/**
 * Metrics and Monitoring Service
 *
 * Provides comprehensive system monitoring capabilities including:
 * - System metrics (CPU, memory, disk, network)
 * - Audit-specific metrics (events, compliance, integrity)
 * - Performance metrics (response times, throughput)
 * - Usage statistics and quotas
 * - Alert management and real-time notifications
 * - Real-time metrics streaming
 */
export class MetricsService extends BaseResource {
	constructor(config: any, logger?: any) {
		super(config, logger)
	}

	/**
	 * Get current system metrics
	 *
	 * @returns Promise<SystemMetrics> Current system performance metrics
	 */
	async getSystemMetrics(): Promise<SystemMetrics> {
		return this.request<SystemMetrics>('/metrics/system', {
			method: 'GET',
		})
	}

	/**
	 * Get audit-specific metrics
	 *
	 * @param params Query parameters for audit metrics
	 * @returns Promise<AuditMetrics> Audit system metrics
	 */
	async getAuditMetrics(params: AuditMetricsParams = {}): Promise<AuditMetrics> {
		return this.request<AuditMetrics>('/metrics/audit', {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Get performance metrics
	 *
	 * @returns Promise<PerformanceMetrics> System performance metrics
	 */
	async getPerformanceMetrics(): Promise<PerformanceMetrics> {
		return this.request<PerformanceMetrics>('/metrics/performance', {
			method: 'GET',
		})
	}

	/**
	 * Get API usage metrics and statistics
	 *
	 * @param params Query parameters for usage metrics
	 * @returns Promise<UsageMetrics> API usage statistics
	 */
	async getUsageMetrics(params: UsageMetricsParams = {}): Promise<UsageMetrics> {
		return this.request<UsageMetrics>('/metrics/usage', {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Get all active alerts
	 *
	 * @param params Query parameters for filtering alerts
	 * @returns Promise<PaginatedAlerts> List of system alerts
	 */
	async getAlerts(params: AlertsParams = {}): Promise<PaginatedAlerts> {
		return this.request<PaginatedAlerts>('/alerts', {
			method: 'GET',
			query: params,
		})
	}

	/**
	 * Get a specific alert by ID
	 *
	 * @param id Alert ID
	 * @returns Promise<Alert | null> Alert details or null if not found
	 */
	async getAlert(id: string): Promise<Alert | null> {
		try {
			return await this.request<Alert>(`/alerts/${id}`, {
				method: 'GET',
			})
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Acknowledge an alert
	 *
	 * @param id Alert ID
	 * @param request Acknowledgment details
	 * @returns Promise<Alert> Updated alert
	 */
	async acknowledgeAlert(id: string, request: AcknowledgeAlertRequest): Promise<Alert> {
		return this.request<Alert>(`/alerts/${id}/acknowledge`, {
			method: 'POST',
			body: request,
		})
	}

	/**
	 * Resolve an alert
	 *
	 * @param id Alert ID
	 * @param request Resolution details
	 * @returns Promise<Alert> Updated alert
	 */
	async resolveAlert(id: string, request: ResolveAlertRequest): Promise<Alert> {
		return this.request<Alert>(`/alerts/${id}/resolve`, {
			method: 'POST',
			body: request,
		})
	}

	/**
	 * Suppress an alert temporarily
	 *
	 * @param id Alert ID
	 * @param duration Suppression duration in minutes
	 * @param reason Reason for suppression
	 * @returns Promise<Alert> Updated alert
	 */
	async suppressAlert(id: string, duration: number, reason: string): Promise<Alert> {
		return this.request<Alert>(`/alerts/${id}/suppress`, {
			method: 'POST',
			body: {
				duration,
				reason,
			},
		})
	}

	/**
	 * Get historical metrics data
	 *
	 * @param type Metrics type
	 * @param timeRange Time range for historical data
	 * @param granularity Data granularity
	 * @returns Promise<any[]> Historical metrics data
	 */
	async getHistoricalMetrics(
		type: 'system' | 'audit' | 'performance' | 'usage',
		timeRange: { startDate: string; endDate: string },
		granularity: 'hour' | 'day' | 'week' | 'month' = 'hour'
	): Promise<any[]> {
		return this.request<any[]>(`/metrics/${type}/historical`, {
			method: 'GET',
			query: {
				startDate: timeRange.startDate,
				endDate: timeRange.endDate,
				granularity,
			},
		})
	}

	/**
	 * Export metrics data
	 *
	 * @param type Metrics type
	 * @param timeRange Time range for export
	 * @param format Export format
	 * @returns Promise<Blob> Exported metrics data
	 */
	async exportMetrics(
		type: 'system' | 'audit' | 'performance' | 'usage',
		timeRange: { startDate: string; endDate: string },
		format: 'csv' | 'json' | 'xlsx' = 'csv'
	): Promise<Blob> {
		return this.request<Blob>(`/metrics/${type}/export`, {
			method: 'POST',
			body: {
				timeRange,
				format,
			},
			responseType: 'blob',
		})
	}

	/**
	 * Subscribe to real-time metrics updates
	 *
	 * @param params Subscription parameters
	 * @returns MetricsSubscription Real-time metrics subscription
	 */
	subscribeToMetrics(params: MetricsSubscriptionParams): MetricsSubscription {
		return new MetricsSubscriptionImpl(this.config.baseUrl, params, this.authManager)
	}

	/**
	 * Get metrics summary dashboard data
	 *
	 * @returns Promise<any> Dashboard summary data
	 */
	async getDashboardSummary(): Promise<{
		system: Partial<SystemMetrics>
		audit: Partial<AuditMetrics>
		performance: Partial<PerformanceMetrics>
		alerts: {
			total: number
			critical: number
			high: number
			recent: Alert[]
		}
		trends: {
			eventsGrowth: number
			performanceTrend: number
			errorRateTrend: number
		}
	}> {
		return this.request('/metrics/dashboard', {
			method: 'GET',
		})
	}

	/**
	 * Create a custom metrics query
	 *
	 * @param query Custom metrics query
	 * @returns Promise<any> Query results
	 */
	async customQuery(query: {
		metrics: string[]
		filters?: Record<string, any>
		timeRange?: { startDate: string; endDate: string }
		groupBy?: string[]
		aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
	}): Promise<any> {
		return this.request('/metrics/query', {
			method: 'POST',
			body: query,
		})
	}

	/**
	 * Get metrics configuration and thresholds
	 *
	 * @returns Promise<any> Metrics configuration
	 */
	async getMetricsConfig(): Promise<{
		alertThresholds: Record<string, any>
		retentionPolicies: Record<string, any>
		samplingRates: Record<string, number>
		enabledMetrics: string[]
	}> {
		return this.request('/metrics/config', {
			method: 'GET',
		})
	}

	/**
	 * Update metrics configuration
	 *
	 * @param config Updated configuration
	 * @returns Promise<any> Updated configuration
	 */
	async updateMetricsConfig(config: {
		alertThresholds?: Record<string, any>
		retentionPolicies?: Record<string, any>
		samplingRates?: Record<string, number>
		enabledMetrics?: string[]
	}): Promise<any> {
		return this.request('/metrics/config', {
			method: 'PUT',
			body: config,
		})
	}
}

/**
 * Implementation of MetricsSubscription for real-time metrics streaming
 */
class MetricsSubscriptionImpl implements MetricsSubscription {
	public readonly id: string
	public isActive: boolean = false

	private ws: WebSocket | null = null
	private eventSource: EventSource | null = null
	private reconnectAttempts: number = 0
	private maxReconnectAttempts: number = 5
	private reconnectDelay: number = 1000

	private dataCallbacks: Array<(data: RealTimeMetricsData) => void> = []
	private errorCallbacks: Array<(error: Error) => void> = []
	private closeCallbacks: Array<() => void> = []

	constructor(
		private baseUrl: string,
		private params: MetricsSubscriptionParams,
		private authManager: any
	) {
		this.id = `metrics-sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	async connect(): Promise<void> {
		if (this.isActive) {
			return
		}

		try {
			const authHeaders = await this.authManager.getAuthHeaders()
			const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/metrics/stream'

			// Try WebSocket first, fallback to Server-Sent Events
			if (typeof WebSocket !== 'undefined') {
				await this.connectWebSocket(wsUrl, authHeaders)
			} else {
				await this.connectEventSource(wsUrl, authHeaders)
			}

			this.isActive = true
			this.reconnectAttempts = 0
		} catch (error) {
			this.handleError(error as Error)
		}
	}

	disconnect(): void {
		this.isActive = false

		if (this.ws) {
			this.ws.close()
			this.ws = null
		}

		if (this.eventSource) {
			this.eventSource.close()
			this.eventSource = null
		}

		this.closeCallbacks.forEach((callback) => callback())
	}

	onData(callback: (data: RealTimeMetricsData) => void): void {
		this.dataCallbacks.push(callback)
	}

	onError(callback: (error: Error) => void): void {
		this.errorCallbacks.push(callback)
	}

	onClose(callback: () => void): void {
		this.closeCallbacks.push(callback)
	}

	private async connectWebSocket(url: string, authHeaders: Record<string, string>): Promise<void> {
		return new Promise((resolve, reject) => {
			// Note: WebSocket doesn't support custom headers directly
			// In a real implementation, you'd need to pass auth via query params or subprotocol
			const queryParams = new URLSearchParams()
			queryParams.set('metricsTypes', this.params.metricsTypes.join(','))
			if (this.params.updateInterval) {
				queryParams.set('updateInterval', this.params.updateInterval.toString())
			}
			if (this.params.includeAlerts !== undefined) {
				queryParams.set('includeAlerts', this.params.includeAlerts.toString())
			}
			const wsUrl = `${url}?${queryParams.toString()}`

			this.ws = new WebSocket(wsUrl)

			this.ws.onopen = () => {
				resolve()
			}

			this.ws.onmessage = (event) => {
				try {
					const data: RealTimeMetricsData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse metrics data'))
				}
			}

			this.ws.onerror = (error) => {
				reject(new Error('WebSocket connection failed'))
			}

			this.ws.onclose = () => {
				this.isActive = false
				this.attemptReconnect()
			}
		})
	}

	private async connectEventSource(
		url: string,
		authHeaders: Record<string, string>
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const queryParams = new URLSearchParams()
			queryParams.set('metricsTypes', this.params.metricsTypes.join(','))
			if (this.params.updateInterval) {
				queryParams.set('updateInterval', this.params.updateInterval.toString())
			}
			if (this.params.includeAlerts !== undefined) {
				queryParams.set('includeAlerts', this.params.includeAlerts.toString())
			}
			const sseUrl = `${url.replace('/stream', '/sse')}?${queryParams.toString()}`

			this.eventSource = new EventSource(sseUrl)

			this.eventSource.onopen = () => {
				resolve()
			}

			this.eventSource.onmessage = (event) => {
				try {
					const data: RealTimeMetricsData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse metrics data'))
				}
			}

			this.eventSource.onerror = (error) => {
				if (this.eventSource?.readyState === EventSource.CONNECTING) {
					// Still connecting, wait
					return
				}
				reject(new Error('EventSource connection failed'))
			}
		})
	}

	private handleError(error: Error): void {
		this.errorCallbacks.forEach((callback) => callback(error))
	}

	private attemptReconnect(): void {
		if (!this.isActive || this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.disconnect()
			return
		}

		this.reconnectAttempts++
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

		setTimeout(() => {
			if (this.isActive) {
				this.connect().catch((error) => {
					this.handleError(error)
				})
			}
		}, delay)
	}
}
