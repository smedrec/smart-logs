/**
 * Performance Monitoring Utilities
 *
 * Provides utilities for monitoring page load times, API response times,
 * and other performance metrics for the compliance reporting system.
 *
 * Requirements: Performance and monitoring from design
 */

import React from 'react'

interface PerformanceMetric {
	name: string
	value: number
	timestamp: number
	metadata?: Record<string, any>
}

interface ApiPerformanceMetric extends PerformanceMetric {
	endpoint: string
	method: string
	status?: number
	error?: string
}

class PerformanceMonitor {
	private metrics: PerformanceMetric[] = []
	private apiMetrics: ApiPerformanceMetric[] = []
	private maxMetrics = 100 // Keep last 100 metrics

	/**
	 * Measure page load time
	 */
	measurePageLoad(pageName: string): void {
		if (typeof window === 'undefined' || !window.performance) return

		const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
		if (!navigation) return

		const loadTime = navigation.loadEventEnd - navigation.fetchStart
		const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
		const firstPaint = this.getFirstPaint()

		this.recordMetric({
			name: `page_load_${pageName}`,
			value: loadTime,
			timestamp: Date.now(),
			metadata: {
				domContentLoaded,
				firstPaint,
				transferSize: navigation.transferSize,
			},
		})

		// Log in development
		if (process.env.NODE_ENV === 'development') {
			console.log(`[Performance] Page Load - ${pageName}:`, {
				loadTime: `${loadTime.toFixed(2)}ms`,
				domContentLoaded: `${domContentLoaded.toFixed(2)}ms`,
				firstPaint: firstPaint ? `${firstPaint.toFixed(2)}ms` : 'N/A',
			})
		}
	}

	/**
	 * Measure API call performance
	 */
	measureApiCall(
		endpoint: string,
		method: string,
		startTime: number,
		status?: number,
		error?: string
	): void {
		const duration = performance.now() - startTime

		const metric: ApiPerformanceMetric = {
			name: `api_call_${method}_${endpoint}`,
			value: duration,
			timestamp: Date.now(),
			endpoint,
			method,
			status,
			error,
		}

		this.recordApiMetric(metric)

		// Log slow API calls in development
		if (process.env.NODE_ENV === 'development' && duration > 1000) {
			console.warn(`[Performance] Slow API Call - ${method} ${endpoint}:`, {
				duration: `${duration.toFixed(2)}ms`,
				status,
			})
		}
	}

	/**
	 * Measure component render time
	 */
	measureComponentRender(componentName: string, renderTime: number): void {
		this.recordMetric({
			name: `component_render_${componentName}`,
			value: renderTime,
			timestamp: Date.now(),
		})

		// Log slow renders in development
		if (process.env.NODE_ENV === 'development' && renderTime > 100) {
			console.warn(`[Performance] Slow Component Render - ${componentName}:`, {
				renderTime: `${renderTime.toFixed(2)}ms`,
			})
		}
	}

	/**
	 * Get First Paint timing
	 */
	private getFirstPaint(): number | null {
		if (typeof window === 'undefined' || !window.performance) return null

		const paintEntries = performance.getEntriesByType('paint')
		const firstPaint = paintEntries.find((entry) => entry.name === 'first-paint')
		return firstPaint ? firstPaint.startTime : null
	}

	/**
	 * Record a performance metric
	 */
	private recordMetric(metric: PerformanceMetric): void {
		this.metrics.push(metric)

		// Keep only last N metrics
		if (this.metrics.length > this.maxMetrics) {
			this.metrics.shift()
		}

		// In production, send to monitoring service
		if (process.env.NODE_ENV === 'production') {
			this.sendToMonitoringService(metric)
		}
	}

	/**
	 * Record an API performance metric
	 */
	private recordApiMetric(metric: ApiPerformanceMetric): void {
		this.apiMetrics.push(metric)

		// Keep only last N metrics
		if (this.apiMetrics.length > this.maxMetrics) {
			this.apiMetrics.shift()
		}

		// In production, send to monitoring service
		if (process.env.NODE_ENV === 'production') {
			this.sendToMonitoringService(metric)
		}
	}

	/**
	 * Send metrics to monitoring service (placeholder for integration)
	 */
	private sendToMonitoringService(metric: PerformanceMetric | ApiPerformanceMetric): void {
		// TODO: Integrate with monitoring service (e.g., Sentry, LogRocket, DataDog)
		// Example:
		// if (window.Sentry) {
		//   window.Sentry.captureMessage('Performance Metric', {
		//     level: 'info',
		//     extra: metric,
		//   })
		// }
	}

	/**
	 * Get performance summary
	 */
	getSummary(): {
		avgPageLoad: number
		avgApiCall: number
		slowApiCalls: ApiPerformanceMetric[]
		recentMetrics: PerformanceMetric[]
	} {
		const pageLoadMetrics = this.metrics.filter((m) => m.name.startsWith('page_load_'))
		const avgPageLoad =
			pageLoadMetrics.length > 0
				? pageLoadMetrics.reduce((sum, m) => sum + m.value, 0) / pageLoadMetrics.length
				: 0

		const avgApiCall =
			this.apiMetrics.length > 0
				? this.apiMetrics.reduce((sum, m) => sum + m.value, 0) / this.apiMetrics.length
				: 0

		const slowApiCalls = this.apiMetrics.filter((m) => m.value > 1000)

		return {
			avgPageLoad,
			avgApiCall,
			slowApiCalls,
			recentMetrics: this.metrics.slice(-10),
		}
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.metrics = []
		this.apiMetrics = []
	}
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * React hook for measuring component render performance
 */
export function usePerformanceMonitor(componentName: string) {
	const startTime = performance.now()

	React.useEffect(() => {
		const renderTime = performance.now() - startTime
		performanceMonitor.measureComponentRender(componentName, renderTime)
	}, [componentName, startTime])
}

/**
 * Higher-order function to measure API call performance
 */
export function withApiPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	endpoint: string,
	method: string
): T {
	return (async (...args: any[]) => {
		const startTime = performance.now()
		try {
			const result = await fn(...args)
			performanceMonitor.measureApiCall(endpoint, method, startTime, 200)
			return result
		} catch (error) {
			performanceMonitor.measureApiCall(
				endpoint,
				method,
				startTime,
				undefined,
				error instanceof Error ? error.message : 'Unknown error'
			)
			throw error
		}
	}) as T
}

// Export for use in other modules
export type { PerformanceMetric, ApiPerformanceMetric }
