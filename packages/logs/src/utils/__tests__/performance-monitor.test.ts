import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PerformanceMonitor } from '../performance-monitor.js'

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		monitor?.stop()
	})

	describe('Configuration', () => {
		it('should use default configuration when none provided', () => {
			monitor = new PerformanceMonitor()
			const config = monitor.getConfig()

			expect(config.enabled).toBe(false)
			expect(config.sampleRate).toBe(0.1)
			expect(config.systemMetricsInterval).toBe(5000)
			expect(config.maxSamples).toBe(1000)
		})

		it('should accept custom configuration', () => {
			monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 0.5,
				systemMetricsInterval: 1000,
				maxSamples: 500,
			})
			const config = monitor.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.sampleRate).toBe(0.5)
			expect(config.systemMetricsInterval).toBe(1000)
			expect(config.maxSamples).toBe(500)
		})

		it('should clamp sample rate between 0 and 1', () => {
			monitor = new PerformanceMonitor({ sampleRate: 1.5 })
			expect(monitor.getConfig().sampleRate).toBe(1)

			monitor.stop()
			monitor = new PerformanceMonitor({ sampleRate: -0.5 })
			expect(monitor.getConfig().sampleRate).toBe(0)
		})

		it('should update configuration', () => {
			monitor = new PerformanceMonitor({ enabled: false })
			monitor.updateConfig({ enabled: true, sampleRate: 0.8 })

			const config = monitor.getConfig()
			expect(config.enabled).toBe(true)
			expect(config.sampleRate).toBe(0.8)
		})
	})

	describe('Sampling', () => {
		it('should not sample when disabled', () => {
			monitor = new PerformanceMonitor({ enabled: false })
			expect(monitor.shouldSample()).toBe(false)
		})

		it('should sample based on sample rate', () => {
			// Mock Math.random to return predictable values
			const mockRandom = vi.spyOn(Math, 'random')

			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 0.5 })

			mockRandom.mockReturnValue(0.3) // Below sample rate
			expect(monitor.shouldSample()).toBe(true)

			mockRandom.mockReturnValue(0.7) // Above sample rate
			expect(monitor.shouldSample()).toBe(false)

			mockRandom.mockRestore()
		})

		it('should always sample when sample rate is 1.0', () => {
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 1.0 })

			// Test multiple times to ensure consistency
			for (let i = 0; i < 10; i++) {
				expect(monitor.shouldSample()).toBe(true)
			}
		})

		it('should never sample when sample rate is 0.0', () => {
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 0.0 })

			// Test multiple times to ensure consistency
			for (let i = 0; i < 10; i++) {
				expect(monitor.shouldSample()).toBe(false)
			}
		})
	})

	describe('Timing Operations', () => {
		it('should return null when sampling is disabled', () => {
			monitor = new PerformanceMonitor({ enabled: false })
			const endTiming = monitor.startTiming()
			const metrics = endTiming()

			expect(metrics).toBeNull()
		})

		it('should return null when sample rate causes no sampling', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.9)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 0.5 })

			const endTiming = monitor.startTiming()
			const metrics = endTiming()

			expect(metrics).toBeNull()
			mockRandom.mockRestore()
		})

		it('should measure operation duration', async () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 0.5 })

			const endTiming = monitor.startTiming()

			// Simulate some work
			await new Promise((resolve) => setTimeout(resolve, 10))

			const metrics = endTiming()

			expect(metrics).not.toBeNull()
			expect(metrics!.duration).toBeGreaterThan(0)
			expect(typeof metrics!.memoryUsage).toBe('number')

			mockRandom.mockRestore()
		})

		it('should track memory usage changes', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 0.5 })

			const endTiming = monitor.startTiming()

			// Allocate some memory
			const largeArray = new Array(1000).fill('test')

			const metrics = endTiming()

			expect(metrics).not.toBeNull()
			expect(typeof metrics!.memoryUsage).toBe('number')

			// Keep reference to prevent GC
			expect(largeArray.length).toBe(1000)

			mockRandom.mockRestore()
		})
	})

	describe('Current Metrics', () => {
		it('should return null when disabled', () => {
			monitor = new PerformanceMonitor({ enabled: false })
			const metrics = monitor.getCurrentMetrics()

			expect(metrics).toBeNull()
		})

		it('should return current CPU and memory usage when enabled', () => {
			monitor = new PerformanceMonitor({ enabled: true })
			const metrics = monitor.getCurrentMetrics()

			expect(metrics).not.toBeNull()
			expect(typeof metrics!.cpuUsage).toBe('number')
			expect(typeof metrics!.memoryUsage).toBe('number')
			expect(metrics!.cpuUsage).toBeGreaterThanOrEqual(0)
			expect(metrics!.memoryUsage).toBeGreaterThan(0)
		})
	})

	describe('Aggregated Metrics', () => {
		it('should return null when disabled', () => {
			monitor = new PerformanceMonitor({ enabled: false })
			const metrics = monitor.getAggregatedMetrics()

			expect(metrics).toBeNull()
		})

		it('should return null when no samples collected', () => {
			monitor = new PerformanceMonitor({ enabled: true })
			const metrics = monitor.getAggregatedMetrics()

			expect(metrics).toBeNull()
		})

		it('should calculate aggregated metrics from samples', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 1.0 })

			// Generate some timing samples
			for (let i = 0; i < 5; i++) {
				const endTiming = monitor.startTiming()
				endTiming() // End timing immediately
			}

			const metrics = monitor.getAggregatedMetrics()

			expect(metrics).not.toBeNull()
			expect(metrics!.operationDuration.samples).toBe(5)
			expect(metrics!.operationDuration.min).toBeGreaterThanOrEqual(0)
			expect(metrics!.operationDuration.max).toBeGreaterThanOrEqual(metrics!.operationDuration.min)
			expect(metrics!.operationDuration.avg).toBeGreaterThanOrEqual(0)
			expect(metrics!.operationDuration.p95).toBeGreaterThanOrEqual(0)
			expect(metrics!.operationDuration.p99).toBeGreaterThanOrEqual(0)

			mockRandom.mockRestore()
		})

		it('should cache aggregated metrics for 30 seconds', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 1.0 })

			// Generate a sample
			const endTiming = monitor.startTiming()
			endTiming()

			const metrics1 = monitor.getAggregatedMetrics()
			const metrics2 = monitor.getAggregatedMetrics()

			// Should return the same object (cached)
			expect(metrics1).toBe(metrics2)

			mockRandom.mockRestore()
		})
	})

	describe('Sample Management', () => {
		it('should limit number of samples to maxSamples', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({
				enabled: true,
				sampleRate: 1.0,
				maxSamples: 3,
			})

			// Generate more samples than the limit
			for (let i = 0; i < 5; i++) {
				const endTiming = monitor.startTiming()
				endTiming()
			}

			const metrics = monitor.getAggregatedMetrics()
			expect(metrics!.operationDuration.samples).toBe(3)

			mockRandom.mockRestore()
		})

		it('should reset samples when reset() is called', () => {
			const mockRandom = vi.spyOn(Math, 'random').mockReturnValue(0.1)
			monitor = new PerformanceMonitor({ enabled: true, sampleRate: 1.0 })

			// Generate samples
			const endTiming = monitor.startTiming()
			endTiming()

			expect(monitor.getAggregatedMetrics()).not.toBeNull()

			monitor.reset()
			expect(monitor.getAggregatedMetrics()).toBeNull()

			mockRandom.mockRestore()
		})
	})

	describe('Lifecycle Management', () => {
		it('should stop system metrics collection when stopped', () => {
			monitor = new PerformanceMonitor({
				enabled: true,
				systemMetricsInterval: 100,
			})

			// Let it run briefly
			return new Promise<void>((resolve) => {
				setTimeout(() => {
					monitor.stop()
					const metrics = monitor.getAggregatedMetrics()
					expect(metrics).toBeNull() // Should be reset
					resolve()
				}, 50)
			})
		})

		it('should restart system metrics when enabled via updateConfig', () => {
			monitor = new PerformanceMonitor({ enabled: false })

			monitor.updateConfig({ enabled: true })
			expect(monitor.getConfig().enabled).toBe(true)

			monitor.updateConfig({ enabled: false })
			expect(monitor.getConfig().enabled).toBe(false)
		})
	})
})
