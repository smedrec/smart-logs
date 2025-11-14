import { BaseResource } from '../core/base-resource'
import { LoggingHelper } from '../utils/logging-helper'
import {
	assertDefined,
	assertType,
	isDetailedHealthStatus,
	isHealthStatus,
	isNonEmptyString,
	isObject,
} from '../utils/type-guards'
import {
	validateDetailedHealthStatus,
	validateHealthStatus,
	validateReadinessStatus,
	validateVersionInfo,
	ValidationError,
} from '../utils/validation'

import type {
	DetailedHealthStatus,
	HealthStatus,
	ReadinessStatus,
	VersionInfo,
} from '@/types/health'
import type { RequestOptions } from '../core/base-resource'

/**
 * Individual component health status
 */
export interface ComponentHealth {
	status: 'healthy' | 'unhealthy' | 'degraded'
	lastChecked: string
	responseTime?: number
	errorMessage?: string
	details?: Record<string, any>
}

/**
 * Service dependency health information
 */
export interface ServiceDependency {
	name: string
	type: 'database' | 'cache' | 'external_api' | 'storage' | 'queue'
	status: 'healthy' | 'unhealthy' | 'degraded'
	url?: string
	lastChecked: string
	responseTime?: number
	errorMessage?: string
	version?: string
}

/**
 * Liveness probe response
 */
export interface LivenessStatus {
	alive: boolean
	timestamp: string
	uptime: number
	lastActivity: string
	message?: string
}

/**
 * API status information
 */
export interface ApiStatus {
	status: 'operational' | 'degraded' | 'maintenance' | 'outage'
	timestamp: string
	endpoints: {
		[endpoint: string]: {
			status: 'operational' | 'degraded' | 'down'
			responseTime: number
			errorRate: number
			lastChecked: string
		}
	}
	rateLimit: {
		current: number
		limit: number
		resetTime: string
	}
	maintenance?: {
		scheduled: boolean
		startTime?: string
		endTime?: string
		message?: string
	}
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
	timeout?: number
	includeDetails?: boolean
	checkDependencies?: boolean
	componentChecks?: string[]
}

/**
 * Health monitoring subscription parameters
 */
export interface HealthSubscriptionParams {
	interval?: number // seconds
	includeMetrics?: boolean
	alertOnStatusChange?: boolean
	components?: string[]
}

/**
 * Real-time health data
 */
export interface RealTimeHealthData {
	timestamp: string
	type: 'status_change' | 'metric_update' | 'alert'
	data: HealthStatus | DetailedHealthStatus | ComponentHealth
	previousStatus?: string
	component?: string
}

/**
 * Health monitoring subscription interface
 */
export interface HealthSubscription {
	id: string
	isActive: boolean
	connect(): Promise<void>
	disconnect(): void
	onData(callback: (data: RealTimeHealthData) => void): void
	onError(callback: (error: Error) => void): void
	onClose(callback: () => void): void
}

/**
 * Health Service for system monitoring
 *
 * Provides comprehensive health monitoring capabilities including:
 * - Simple and detailed health checks
 * - Readiness and liveness probes for Kubernetes/container environments
 * - Version information and API status monitoring
 * - Service dependency health monitoring
 * - Real-time health status streaming
 * - Component-level health breakdown
 */
export class HealthService extends BaseResource {
	constructor(config: any, logger?: any, performanceMonitor?: any) {
		super(config, logger, performanceMonitor)
	}

	/**
	 * Perform a simple health check
	 *
	 * @param config Optional health check configuration
	 * @returns Promise<HealthStatus> Basic health status
	 */
	async check(config: HealthCheckConfig = {}): Promise<HealthStatus> {
		const options: RequestOptions = {
			method: 'GET',
		}

		// Add query parameters if configuration is provided
		if (Object.keys(config).length > 0) {
			options.query = {
				timeout: config.timeout,
				includeDetails: config.includeDetails,
				checkDependencies: config.checkDependencies,
				componentChecks: config.componentChecks?.join(','),
			}
		}

		const response = await this.request<HealthStatus>('/health', options)
		// Validate response using type guards
		assertType(response, isHealthStatus, 'Invalid health status response from server')
		return response
	}

	/**
	 * Perform a detailed health check with component breakdown
	 *
	 * @param config Optional health check configuration
	 * @returns Promise<DetailedHealthStatus> Comprehensive health status
	 */
	async detailed(config: HealthCheckConfig = {}): Promise<DetailedHealthStatus> {
		const options: RequestOptions = {
			method: 'GET',
			query: {
				...config,
				includeDetails: true,
				checkDependencies: true,
				componentChecks: config.componentChecks?.join(','),
			},
		}

		const response = await this.request<DetailedHealthStatus>('/health/detailed', options)

		// Validate response using type guards
		assertType(
			response,
			isDetailedHealthStatus,
			'Invalid detailed health status response from server'
		)
		return response
	}

	/**
	 * Check readiness status (Kubernetes readiness probe)
	 *
	 * @returns Promise<ReadinessStatus> Service readiness status
	 */
	async ready(): Promise<ReadinessStatus> {
		return this.request<ReadinessStatus>('/health/ready', {
			method: 'GET',
		})
	}

	/**
	 * Check liveness status (Kubernetes liveness probe)
	 *
	 * @returns Promise<LivenessStatus> Service liveness status
	 */
	async alive(): Promise<LivenessStatus> {
		return this.request<LivenessStatus>('/health/alive', {
			method: 'GET',
		})
	}

	/**
	 * Get API version and build information
	 *
	 * @returns Promise<VersionInfo> Version and build details
	 */
	async version(): Promise<VersionInfo> {
		return this.request<VersionInfo>('/health/version', {
			method: 'GET',
		})
	}

	/**
	 * Get current API status and endpoint health
	 *
	 * @returns Promise<ApiStatus> API operational status
	 */
	async status(): Promise<ApiStatus> {
		return this.request<ApiStatus>('/health/status', {
			method: 'GET',
		})
	}

	/**
	 * Check health of a specific component
	 *
	 * @param component Component name to check
	 * @returns Promise<ComponentHealth> Component health status
	 */
	async checkComponent(component: string): Promise<ComponentHealth> {
		return this.request<ComponentHealth>(`/health/components/${component}`, {
			method: 'GET',
		})
	}

	/**
	 * Get health status of all service dependencies
	 *
	 * @returns Promise<ServiceDependency[]> List of dependency health statuses
	 */
	async getDependencies(): Promise<ServiceDependency[]> {
		return this.request<ServiceDependency[]>('/health/dependencies', {
			method: 'GET',
		})
	}

	/**
	 * Check health of a specific service dependency
	 *
	 * @param dependencyName Name of the dependency to check
	 * @returns Promise<ServiceDependency> Dependency health status
	 */
	async checkDependency(dependencyName: string): Promise<ServiceDependency> {
		return this.request<ServiceDependency>(`/health/dependencies/${dependencyName}`, {
			method: 'GET',
		})
	}

	/**
	 * Get health check history for analysis
	 *
	 * @param timeRange Time range for historical data
	 * @param component Optional specific component to filter
	 * @returns Promise<any[]> Historical health check data
	 */
	async getHealthHistory(
		timeRange: { startDate: string; endDate: string },
		component?: string
	): Promise<
		Array<{
			timestamp: string
			status: string
			component?: string
			responseTime: number
			details?: Record<string, any>
		}>
	> {
		return this.request('/health/history', {
			method: 'GET',
			query: {
				startDate: timeRange.startDate,
				endDate: timeRange.endDate,
				component,
			},
		})
	}

	/**
	 * Get health metrics and statistics
	 *
	 * @returns Promise<any> Health metrics data
	 */
	async getHealthMetrics(): Promise<{
		uptime: {
			current: number
			average: number
			availability: number
		}
		responseTime: {
			average: number
			p50: number
			p95: number
			p99: number
		}
		errorRates: {
			total: number
			byComponent: Record<string, number>
			byDependency: Record<string, number>
		}
		statusDistribution: {
			healthy: number
			degraded: number
			unhealthy: number
		}
		trends: {
			uptimeTrend: number
			responseTimeTrend: number
			errorRateTrend: number
		}
	}> {
		return this.request('/health/metrics', {
			method: 'GET',
		})
	}

	/**
	 * Subscribe to real-time health status updates
	 *
	 * @param params Subscription parameters
	 * @returns HealthSubscription Real-time health subscription
	 */
	subscribeToHealth(params: HealthSubscriptionParams = {}): HealthSubscription {
		return new HealthSubscriptionImpl(this.config.baseUrl, params, this.authManager)
	}

	/**
	 * Trigger a manual health check for all components
	 *
	 * @returns Promise<DetailedHealthStatus> Results of manual health check
	 */
	async triggerHealthCheck(): Promise<DetailedHealthStatus> {
		return this.request<DetailedHealthStatus>('/health/check', {
			method: 'POST',
		})
	}

	/**
	 * Reset health check cache and force fresh checks
	 *
	 * @returns Promise<void>
	 */
	async resetHealthCache(): Promise<void> {
		await this.request<void>('/health/cache/reset', {
			method: 'POST',
		})
	}

	/**
	 * Get health check configuration
	 *
	 * @returns Promise<any> Current health check configuration
	 */
	async getHealthConfig(): Promise<{
		checkInterval: number
		timeout: number
		retryAttempts: number
		alertThresholds: Record<string, any>
		enabledChecks: string[]
		dependencyChecks: Record<string, any>
	}> {
		return this.request('/health/config', {
			method: 'GET',
		})
	}

	/**
	 * Update health check configuration
	 *
	 * @param config Updated health check configuration
	 * @returns Promise<any> Updated configuration
	 */
	async updateHealthConfig(config: {
		checkInterval?: number
		timeout?: number
		retryAttempts?: number
		alertThresholds?: Record<string, any>
		enabledChecks?: string[]
		dependencyChecks?: Record<string, any>
	}): Promise<any> {
		return this.request('/health/config', {
			method: 'PUT',
			body: config,
		})
	}

	/**
	 * Get system information for debugging
	 *
	 * @returns Promise<any> System information
	 */
	async getSystemInfo(): Promise<{
		hostname: string
		platform: string
		architecture: string
		nodeVersion: string
		processId: number
		parentProcessId: number
		workingDirectory: string
		execPath: string
		memoryUsage: {
			rss: number
			heapTotal: number
			heapUsed: number
			external: number
			arrayBuffers: number
		}
		cpuUsage: {
			user: number
			system: number
		}
		loadAverage: number[]
		networkInterfaces: Record<string, any>
		environment: string
	}> {
		return this.request('/health/system', {
			method: 'GET',
		})
	}

	/**
	 * Perform a connectivity test to external services
	 *
	 * @param services List of service names to test
	 * @returns Promise<any> Connectivity test results
	 */
	async testConnectivity(services?: string[]): Promise<{
		timestamp: string
		results: Array<{
			service: string
			status: 'connected' | 'failed' | 'timeout'
			responseTime: number
			error?: string
			details?: Record<string, any>
		}>
		summary: {
			total: number
			connected: number
			failed: number
			averageResponseTime: number
		}
	}> {
		return this.request('/health/connectivity', {
			method: 'POST',
			body: {
				services,
			},
		})
	}
}

/**
 * Implementation of HealthSubscription for real-time health monitoring
 */
class HealthSubscriptionImpl implements HealthSubscription {
	public readonly id: string
	public isActive: boolean = false

	private ws: WebSocket | null = null
	private eventSource: EventSource | null = null
	private reconnectAttempts: number = 0
	private maxReconnectAttempts: number = 5
	private reconnectDelay: number = 1000

	private dataCallbacks: Array<(data: RealTimeHealthData) => void> = []
	private errorCallbacks: Array<(error: Error) => void> = []
	private closeCallbacks: Array<() => void> = []

	constructor(
		private baseUrl: string,
		private params: HealthSubscriptionParams,
		private authManager: any
	) {
		this.id = `health-sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
	}

	async connect(): Promise<void> {
		if (this.isActive) {
			return
		}

		try {
			const authHeaders = await this.authManager.getAuthHeaders()
			const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/health/stream'

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

	onData(callback: (data: RealTimeHealthData) => void): void {
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
			// Build query parameters for WebSocket connection
			const queryParams = new URLSearchParams()
			if (this.params.interval) {
				queryParams.set('interval', this.params.interval.toString())
			}
			if (this.params.includeMetrics !== undefined) {
				queryParams.set('includeMetrics', this.params.includeMetrics.toString())
			}
			if (this.params.alertOnStatusChange !== undefined) {
				queryParams.set('alertOnStatusChange', this.params.alertOnStatusChange.toString())
			}
			if (this.params.components) {
				queryParams.set('components', this.params.components.join(','))
			}

			const wsUrl = `${url}?${queryParams.toString()}`
			this.ws = new WebSocket(wsUrl)

			this.ws.onopen = () => {
				resolve()
			}

			this.ws.onmessage = (event) => {
				try {
					const data: RealTimeHealthData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse health data'))
				}
			}

			this.ws.onerror = () => {
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
			if (this.params.interval) {
				queryParams.set('interval', this.params.interval.toString())
			}
			if (this.params.includeMetrics !== undefined) {
				queryParams.set('includeMetrics', this.params.includeMetrics.toString())
			}
			if (this.params.alertOnStatusChange !== undefined) {
				queryParams.set('alertOnStatusChange', this.params.alertOnStatusChange.toString())
			}
			if (this.params.components) {
				queryParams.set('components', this.params.components.join(','))
			}

			const sseUrl = `${url.replace('/stream', '/sse')}?${queryParams.toString()}`
			this.eventSource = new EventSource(sseUrl)

			this.eventSource.onopen = () => {
				resolve()
			}

			this.eventSource.onmessage = (event) => {
				try {
					const data: RealTimeHealthData = JSON.parse(event.data)
					this.dataCallbacks.forEach((callback) => callback(data))
				} catch (error) {
					this.handleError(new Error('Failed to parse health data'))
				}
			}

			this.eventSource.onerror = () => {
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
