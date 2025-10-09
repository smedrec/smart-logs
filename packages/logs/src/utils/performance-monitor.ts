import { performance } from 'node:perf_hooks'

import type { PerformanceMetrics } from '../types/index.js'

/**
 * Configuration for performance monitoring
 */
export interface PerformanceMonitorConfig {
	/** Enable performance monitoring */
	enabled: boolean
	/** Sampling rate (0.0 to 1.0) - what percentage of operations to sample */
	sampleRate: number
	/** Interval for collecting system metrics in milliseconds */
	systemMetricsInterval: number
	/** Maximum number of samples to keep in memory for aggregation */
	maxSamples: number
}

/**
 * Aggregated performance metrics
 */
export interface AggregatedMetrics {
	cpuUsage: {
		min: number
		max: number
		avg: number
		samples: number
	}
	memoryUsage: {
		min: number
		max: number
		avg: number
		samples: number
	}
	operationDuration: {
		min: number
		max: number
		avg: number
		p95: number
		p99: number
		samples: number
	}
	lastUpdated: Date
}

/**
 * Performance sample for aggregation
 */
interface PerformanceSample {
	timestamp: Date
	cpuUsage?: number
	memoryUsage?: number
	duration?: number
}

/**
 * PerformanceMonitor class with configurable sampling rates
 * Implements requirement 3.1: Performance metrics sampling
 * Implements requirement 3.4: Efficient sampling strategies
 */
export class PerformanceMonitor {
	private readonly config: PerformanceMonitorConfig
	private readonly samples: PerformanceSample[] = []
	private systemMetricsTimer?: NodeJS.Timeout
	private lastCpuUsage?: NodeJS.CpuUsage
	private aggregatedMetrics?: AggregatedMetrics

	constructor(config: Partial<PerformanceMonitorConfig> = {}) {
		this.config = {
			enabled: config.enabled ?? false,
			sampleRate: Math.max(0, Math.min(1, config.sampleRate ?? 0.1)),
			systemMetricsInterval: config.systemMetricsInterval ?? 5000,
			maxSamples: config.maxSamples ?? 1000,
		}

		if (this.config.enabled) {
			this.startSystemMetricsCollection()
		}
	}

	/**
	 * Check if we should sample this operation based on sampling rate
	 */
	shouldSample(): boolean {
		if (!this.config.enabled) return false
		return Math.random() < this.config.sampleRate
	}

	/**
	 * Start timing an operation
	 * Returns a function to end the timing
	 */
	startTiming(): () => PerformanceMetrics | null {
		if (!this.shouldSample()) {
			return () => null
		}

		const startTime = performance.now()
		const startMemory = process.memoryUsage()

		return (): PerformanceMetrics => {
			const endTime = performance.now()
			const endMemory = process.memoryUsage()
			const duration = endTime - startTime

			const metrics: PerformanceMetrics = {
				duration,
				memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
			}

			// Add to samples for aggregation
			this.addSample({
				timestamp: new Date(),
				duration,
				memoryUsage: metrics.memoryUsage,
			})

			return metrics
		}
	}

	/**
	 * Get current CPU usage percentage
	 */
	private getCurrentCpuUsage(): number {
		const currentUsage = process.cpuUsage(this.lastCpuUsage)
		this.lastCpuUsage = process.cpuUsage()

		const totalUsage = currentUsage.user + currentUsage.system
		// Convert microseconds to percentage (approximate)
		return (totalUsage / 1000000) * 100
	}

	/**
	 * Get current memory usage in bytes
	 */
	private getCurrentMemoryUsage(): number {
		return process.memoryUsage().heapUsed
	}

	/**
	 * Start collecting system metrics at regular intervals
	 */
	private startSystemMetricsCollection(): void {
		// Initialize CPU usage baseline
		this.lastCpuUsage = process.cpuUsage()

		this.systemMetricsTimer = setInterval(() => {
			if (this.shouldSample()) {
				const cpuUsage = this.getCurrentCpuUsage()
				const memoryUsage = this.getCurrentMemoryUsage()

				this.addSample({
					timestamp: new Date(),
					cpuUsage,
					memoryUsage,
				})
			}
		}, this.config.systemMetricsInterval)
	}

	/**
	 * Add a performance sample and maintain sample limit
	 */
	private addSample(sample: PerformanceSample): void {
		this.samples.push(sample)

		// Remove old samples if we exceed the limit
		if (this.samples.length > this.config.maxSamples) {
			this.samples.splice(0, this.samples.length - this.config.maxSamples)
		}

		// Invalidate cached aggregated metrics
		this.aggregatedMetrics = undefined
	}

	/**
	 * Get aggregated performance metrics
	 */
	getAggregatedMetrics(): AggregatedMetrics | null {
		if (!this.config.enabled || this.samples.length === 0) {
			return null
		}

		// Return cached metrics if available and recent
		if (
			this.aggregatedMetrics &&
			Date.now() - this.aggregatedMetrics.lastUpdated.getTime() < 30000
		) {
			return this.aggregatedMetrics
		}

		// Calculate aggregated metrics
		const cpuSamples = this.samples.filter((s) => s.cpuUsage !== undefined).map((s) => s.cpuUsage!)
		const memorySamples = this.samples
			.filter((s) => s.memoryUsage !== undefined)
			.map((s) => s.memoryUsage!)
		const durationSamples = this.samples
			.filter((s) => s.duration !== undefined)
			.map((s) => s.duration!)

		this.aggregatedMetrics = {
			cpuUsage: this.calculateStats(cpuSamples),
			memoryUsage: this.calculateStats(memorySamples),
			operationDuration: this.calculateStatsWithPercentiles(durationSamples),
			lastUpdated: new Date(),
		}

		return this.aggregatedMetrics
	}

	/**
	 * Calculate basic statistics for a set of values
	 */
	private calculateStats(values: number[]): {
		min: number
		max: number
		avg: number
		samples: number
	} {
		if (values.length === 0) {
			return { min: 0, max: 0, avg: 0, samples: 0 }
		}

		const min = Math.min(...values)
		const max = Math.max(...values)
		const avg = values.reduce((sum, val) => sum + val, 0) / values.length

		return { min, max, avg, samples: values.length }
	}

	/**
	 * Calculate statistics with percentiles for duration metrics
	 */
	private calculateStatsWithPercentiles(values: number[]): {
		min: number
		max: number
		avg: number
		p95: number
		p99: number
		samples: number
	} {
		if (values.length === 0) {
			return { min: 0, max: 0, avg: 0, p95: 0, p99: 0, samples: 0 }
		}

		const sorted = [...values].sort((a, b) => a - b)
		const min = sorted[0]
		const max = sorted[sorted.length - 1]
		const avg = values.reduce((sum, val) => sum + val, 0) / values.length

		const p95Index = Math.floor(sorted.length * 0.95)
		const p99Index = Math.floor(sorted.length * 0.99)
		const p95 = sorted[Math.min(p95Index, sorted.length - 1)]
		const p99 = sorted[Math.min(p99Index, sorted.length - 1)]

		return { min, max, avg, p95, p99, samples: values.length }
	}

	/**
	 * Get current performance metrics for immediate use
	 */
	getCurrentMetrics(): PerformanceMetrics | null {
		if (!this.config.enabled) return null

		return {
			cpuUsage: this.getCurrentCpuUsage(),
			memoryUsage: this.getCurrentMemoryUsage(),
		}
	}

	/**
	 * Reset all collected samples
	 */
	reset(): void {
		this.samples.length = 0
		this.aggregatedMetrics = undefined
	}

	/**
	 * Stop performance monitoring and cleanup resources
	 */
	stop(): void {
		if (this.systemMetricsTimer) {
			clearInterval(this.systemMetricsTimer)
			this.systemMetricsTimer = undefined
		}
		this.reset()
	}

	/**
	 * Get configuration
	 */
	getConfig(): PerformanceMonitorConfig {
		return { ...this.config }
	}

	/**
	 * Update configuration (requires restart for some changes)
	 */
	updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
		const oldEnabled = this.config.enabled

		Object.assign(this.config, newConfig)

		// Restart if enabled state changed
		if (oldEnabled !== this.config.enabled) {
			this.stop()
			if (this.config.enabled) {
				this.startSystemMetricsCollection()
			}
		}
	}
}
