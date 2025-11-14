import type { Logger } from './logger'

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
	maxBundleSize: number // bytes (gzipped)
	maxInitTime: number // milliseconds
	maxRequestTime: number // milliseconds (p95)
	maxMemoryUsage: number // bytes
	maxCacheSize: number // entries
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
	bundleSize: number
	initTime: number
	avgRequestTime: number
	p95RequestTime: number
	p99RequestTime: number
	memoryUsage: number
	cacheHitRate: number
	errorRate: number
}

/**
 * Budget violation details
 */
export interface BudgetViolation {
	metric: string
	actual: number
	budget: number
	severity: 'warning' | 'error'
}

/**
 * Performance report
 */
export interface PerformanceReport {
	timestamp: string
	metrics: PerformanceMetrics
	violations: BudgetViolation[]
	passed: boolean
	summary: string
}

/**
 * Metric data point for tracking
 */
interface MetricDataPoint {
	name: string
	value: number
	timestamp: number
}

/**
 * PerformanceMonitor class for tracking and enforcing performance budgets
 *
 * Features:
 * - Track bundle size, initialization time, request times, and memory usage
 * - Calculate percentiles (p95, p99) for request times
 * - Check against performance budgets
 * - Generate performance reports
 * - Provide warnings for budget violations
 */
export class PerformanceMonitor {
	private budget: PerformanceBudget
	private logger?: Logger
	private metrics: Map<string, MetricDataPoint[]> = new Map()
	private initTime: number = 0
	private bundleSize: number = 0
	private cacheHits: number = 0
	private cacheMisses: number = 0
	private successCount: number = 0
	private errorCount: number = 0
	private startTime: number = Date.now()

	constructor(budget: PerformanceBudget, logger?: Logger) {
		this.budget = budget
		if (logger !== undefined) {
			this.logger = logger
		}
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(name: string, value: number): void {
		const dataPoint: MetricDataPoint = {
			name,
			value,
			timestamp: Date.now(),
		}

		if (!this.metrics.has(name)) {
			this.metrics.set(name, [])
		}

		this.metrics.get(name)!.push(dataPoint)

		// Track specific metrics for aggregation
		if (name === 'init_time') {
			this.initTime = value
		} else if (name === 'bundle_size') {
			this.bundleSize = value
		} else if (name === 'cache_hit') {
			this.cacheHits++
		} else if (name === 'cache_miss') {
			this.cacheMisses++
		} else if (name === 'request_success') {
			this.successCount++
		} else if (name === 'request_error') {
			this.errorCount++
		}
	}

	/**
	 * Get current performance metrics
	 */
	getMetrics(): PerformanceMetrics {
		const requestTimes = this.getMetricValues('request_time')

		return {
			bundleSize: this.bundleSize,
			initTime: this.initTime,
			avgRequestTime: this.getAverageMetric('request_time'),
			p95RequestTime: this.getPercentile('request_time', 95),
			p99RequestTime: this.getPercentile('request_time', 99),
			memoryUsage: this.getCurrentMemoryUsage(),
			cacheHitRate: this.getCacheHitRate(),
			errorRate: this.getErrorRate(),
		}
	}

	/**
	 * Check performance against budget and return violations
	 */
	checkBudget(): BudgetViolation[] {
		const violations: BudgetViolation[] = []
		const metrics = this.getMetrics()

		// Check bundle size
		if (metrics.bundleSize > this.budget.maxBundleSize) {
			const exceedPercentage =
				((metrics.bundleSize - this.budget.maxBundleSize) / this.budget.maxBundleSize) * 100

			violations.push({
				metric: 'bundleSize',
				actual: metrics.bundleSize,
				budget: this.budget.maxBundleSize,
				severity: exceedPercentage > 20 ? 'error' : 'warning',
			})
		}

		// Check init time
		if (metrics.initTime > this.budget.maxInitTime) {
			const exceedPercentage =
				((metrics.initTime - this.budget.maxInitTime) / this.budget.maxInitTime) * 100

			violations.push({
				metric: 'initTime',
				actual: metrics.initTime,
				budget: this.budget.maxInitTime,
				severity: exceedPercentage > 20 ? 'error' : 'warning',
			})
		}

		// Check p95 request time
		if (metrics.p95RequestTime > this.budget.maxRequestTime) {
			const exceedPercentage =
				((metrics.p95RequestTime - this.budget.maxRequestTime) / this.budget.maxRequestTime) * 100

			violations.push({
				metric: 'p95RequestTime',
				actual: metrics.p95RequestTime,
				budget: this.budget.maxRequestTime,
				severity: exceedPercentage > 20 ? 'error' : 'warning',
			})
		}

		// Check memory usage
		if (metrics.memoryUsage > this.budget.maxMemoryUsage) {
			const exceedPercentage =
				((metrics.memoryUsage - this.budget.maxMemoryUsage) / this.budget.maxMemoryUsage) * 100

			violations.push({
				metric: 'memoryUsage',
				actual: metrics.memoryUsage,
				budget: this.budget.maxMemoryUsage,
				severity: exceedPercentage > 20 ? 'error' : 'warning',
			})
		}

		// Log violations if logger is available
		if (violations.length > 0 && this.logger) {
			for (const violation of violations) {
				const message = `Performance budget violation: ${violation.metric} (${violation.actual} > ${violation.budget})`

				if (violation.severity === 'error') {
					this.logger.error(message, { violation })
				} else {
					this.logger.warn(message, { violation })
				}
			}
		}

		return violations
	}

	/**
	 * Generate a comprehensive performance report
	 */
	getReport(): PerformanceReport {
		const metrics = this.getMetrics()
		const violations = this.checkBudget()
		const passed = violations.length === 0

		// Generate summary
		let summary = ''
		if (passed) {
			summary = 'All performance budgets are within acceptable limits.'
		} else {
			const errorCount = violations.filter((v) => v.severity === 'error').length
			const warningCount = violations.filter((v) => v.severity === 'warning').length

			summary = `Performance budget violations detected: ${errorCount} error(s), ${warningCount} warning(s).`

			// Add details about violations
			const violationDetails = violations
				.map((v) => {
					const exceedPercentage = ((v.actual - v.budget) / v.budget) * 100
					return `${v.metric}: ${v.actual} exceeds budget ${v.budget} by ${exceedPercentage.toFixed(1)}%`
				})
				.join('; ')

			summary += ` Details: ${violationDetails}`
		}

		return {
			timestamp: new Date().toISOString(),
			metrics,
			violations,
			passed,
			summary,
		}
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.metrics.clear()
		this.initTime = 0
		this.bundleSize = 0
		this.cacheHits = 0
		this.cacheMisses = 0
		this.successCount = 0
		this.errorCount = 0
		this.startTime = Date.now()
	}

	/**
	 * Get average value for a metric
	 */
	private getAverageMetric(name: string): number {
		const values = this.getMetricValues(name)

		if (values.length === 0) {
			return 0
		}

		const sum = values.reduce((acc, val) => acc + val, 0)
		return sum / values.length
	}

	/**
	 * Calculate percentile for a metric
	 */
	private getPercentile(name: string, percentile: number): number {
		const values = this.getMetricValues(name)

		if (values.length === 0) {
			return 0
		}

		// Sort values in ascending order
		const sorted = [...values].sort((a, b) => a - b)

		// Calculate percentile index
		const index = Math.ceil((percentile / 100) * sorted.length) - 1

		return sorted[Math.max(0, index)] || 0
	}

	/**
	 * Get all values for a specific metric
	 */
	private getMetricValues(name: string): number[] {
		const dataPoints = this.metrics.get(name)

		if (!dataPoints) {
			return []
		}

		return dataPoints.map((dp) => dp.value)
	}

	/**
	 * Get current memory usage
	 */
	private getCurrentMemoryUsage(): number {
		// Try to get memory usage from performance API
		if (typeof performance !== 'undefined' && (performance as any).memory) {
			return (performance as any).memory.usedJSHeapSize || 0
		}

		// Try to get memory usage from Node.js process
		if (typeof process !== 'undefined' && process.memoryUsage) {
			return process.memoryUsage().heapUsed
		}

		// Fallback: estimate from metrics
		const memoryMetrics = this.getMetricValues('memory_usage')
		if (memoryMetrics.length > 0) {
			return memoryMetrics[memoryMetrics.length - 1] || 0
		}

		return 0
	}

	/**
	 * Calculate cache hit rate
	 */
	private getCacheHitRate(): number {
		const totalCacheRequests = this.cacheHits + this.cacheMisses

		if (totalCacheRequests === 0) {
			return 0
		}

		return this.cacheHits / totalCacheRequests
	}

	/**
	 * Calculate error rate
	 */
	private getErrorRate(): number {
		const totalRequests = this.successCount + this.errorCount

		if (totalRequests === 0) {
			return 0
		}

		return this.errorCount / totalRequests
	}

	/**
	 * Get bundle size (if available)
	 */
	getBundleSize(): number {
		return this.bundleSize
	}

	/**
	 * Set bundle size
	 */
	setBundleSize(size: number): void {
		this.bundleSize = size
		this.recordMetric('bundle_size', size)
	}

	/**
	 * Get initialization time
	 */
	getInitTime(): number {
		return this.initTime
	}

	/**
	 * Set initialization time
	 */
	setInitTime(time: number): void {
		this.initTime = time
		this.recordMetric('init_time', time)
	}

	/**
	 * Record a cache hit
	 */
	recordCacheHit(): void {
		this.recordMetric('cache_hit', 1)
	}

	/**
	 * Record a cache miss
	 */
	recordCacheMiss(): void {
		this.recordMetric('cache_miss', 1)
	}

	/**
	 * Record a successful request
	 */
	recordSuccess(): void {
		this.recordMetric('request_success', 1)
	}

	/**
	 * Record a failed request
	 */
	recordError(): void {
		this.recordMetric('request_error', 1)
	}

	/**
	 * Record a request time
	 */
	recordRequestTime(duration: number): void {
		this.recordMetric('request_time', duration)
	}

	/**
	 * Record memory usage
	 */
	recordMemoryUsage(bytes: number): void {
		this.recordMetric('memory_usage', bytes)
	}

	/**
	 * Get performance budget
	 */
	getBudget(): PerformanceBudget {
		return { ...this.budget }
	}

	/**
	 * Update performance budget
	 */
	updateBudget(updates: Partial<PerformanceBudget>): void {
		this.budget = { ...this.budget, ...updates }
	}
}
