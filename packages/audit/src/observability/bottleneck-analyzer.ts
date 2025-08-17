/**
 * Performance profiling and bottleneck identification for audit system
 */
import { performance } from 'perf_hooks'

import type {
	AuditOperationMetrics,
	BottleneckAnalysis,
	CallStackFrame,
	PerformanceMetrics,
	ProfilingResult,
} from './types.js'

/**
 * Bottleneck analyzer interface
 */
export interface BottleneckAnalyzer {
	analyzePerformance(operations: AuditOperationMetrics[]): Promise<BottleneckAnalysis[]>
	profileOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T>
	getProfilingResults(): ProfilingResult[]
	identifyBottlenecks(metrics: PerformanceMetrics): BottleneckAnalysis[]
	generateRecommendations(analysis: BottleneckAnalysis[]): string[]
}

/**
 * Performance statistics for operations
 */
interface OperationStats {
	operationName: string
	count: number
	totalTime: number
	averageTime: number
	minTime: number
	maxTime: number
	percentile95: number
	percentile99: number
	errorRate: number
	samples: number[]
}

/**
 * Profiling session
 */
interface ProfilingSession {
	sessionId: string
	operationName: string
	startTime: number
	endTime?: number
	callStack: CallStackFrame[]
	resourceSnapshots: {
		timestamp: number
		cpu: number
		memory: number
	}[]
}

/**
 * Audit system bottleneck analyzer implementation
 */
export class AuditBottleneckAnalyzer implements BottleneckAnalyzer {
	private profilingResults: ProfilingResult[] = []
	private activeSessions: Map<string, ProfilingSession> = new Map()
	private operationStats: Map<string, OperationStats> = new Map()

	// Performance thresholds for bottleneck detection
	private readonly thresholds = {
		// Time thresholds in milliseconds
		eventProcessing: {
			warning: 100,
			critical: 500,
		},
		eventValidation: {
			warning: 50,
			critical: 200,
		},
		eventHashing: {
			warning: 10,
			critical: 50,
		},
		eventStorage: {
			warning: 200,
			critical: 1000,
		},
		queueProcessing: {
			warning: 100,
			critical: 500,
		},
		dbQuery: {
			warning: 100,
			critical: 500,
		},
		redisOperation: {
			warning: 10,
			critical: 50,
		},
	}

	/**
	 * Analyze performance bottlenecks from operation metrics
	 */
	async analyzePerformance(operations: AuditOperationMetrics[]): Promise<BottleneckAnalysis[]> {
		const analyses: BottleneckAnalysis[] = []

		// Group operations by type and name
		const groupedOps = this.groupOperations(operations)

		for (const [operationKey, ops] of groupedOps.entries()) {
			const stats = this.calculateOperationStats(operationKey, ops)
			this.operationStats.set(operationKey, stats)

			const analysis = this.analyzeOperationStats(stats)
			if (analysis) {
				analyses.push(analysis)
			}
		}

		// Sort by severity and impact
		return analyses.sort((a, b) => {
			const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
			const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
			if (severityDiff !== 0) return severityDiff

			// If same severity, sort by average time
			return b.averageTime - a.averageTime
		})
	}

	/**
	 * Profile an operation with detailed performance tracking
	 */
	async profileOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
		const sessionId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		const startTime = performance.now()

		const session: ProfilingSession = {
			sessionId,
			operationName,
			startTime,
			callStack: [],
			resourceSnapshots: [],
		}

		this.activeSessions.set(sessionId, session)

		// Take initial resource snapshot
		this.takeResourceSnapshot(session)

		// Start call stack tracking
		const originalStackTrace = Error.prepareStackTrace
		Error.prepareStackTrace = (_, stack) => stack

		try {
			const result = await operation()

			session.endTime = performance.now()

			// Take final resource snapshot
			this.takeResourceSnapshot(session)

			// Generate profiling result
			const profilingResult = this.generateProfilingResult(session)
			this.profilingResults.push(profilingResult)

			// Cleanup old results (keep last 100)
			if (this.profilingResults.length > 100) {
				this.profilingResults = this.profilingResults.slice(-100)
			}

			return result
		} catch (error) {
			session.endTime = performance.now()
			this.takeResourceSnapshot(session)

			const profilingResult = this.generateProfilingResult(session)
			profilingResult.breakdown['error'] = {
				count: 1,
				totalTime: session.endTime - session.startTime,
				averageTime: session.endTime - session.startTime,
				maxTime: session.endTime - session.startTime,
				minTime: session.endTime - session.startTime,
			}
			this.profilingResults.push(profilingResult)

			throw error
		} finally {
			// Restore original stack trace
			if (originalStackTrace) {
				Error.prepareStackTrace = originalStackTrace
			}
			this.activeSessions.delete(sessionId)
		}
	}

	/**
	 * Get all profiling results
	 */
	getProfilingResults(): ProfilingResult[] {
		return [...this.profilingResults]
	}

	/**
	 * Identify bottlenecks from performance metrics
	 */
	identifyBottlenecks(metrics: PerformanceMetrics): BottleneckAnalysis[] {
		const bottlenecks: BottleneckAnalysis[] = []

		// Analyze each performance metric against thresholds
		const checks = [
			{
				component: 'Event Processing',
				operation: 'process_event',
				value: metrics.eventProcessingTime,
				thresholds: this.thresholds.eventProcessing,
			},
			{
				component: 'Event Validation',
				operation: 'validate_event',
				value: metrics.eventValidationTime,
				thresholds: this.thresholds.eventValidation,
			},
			{
				component: 'Event Hashing',
				operation: 'hash_event',
				value: metrics.eventHashingTime,
				thresholds: this.thresholds.eventHashing,
			},
			{
				component: 'Event Storage',
				operation: 'store_event',
				value: metrics.eventStorageTime,
				thresholds: this.thresholds.eventStorage,
			},
			{
				component: 'Queue Processing',
				operation: 'queue_process',
				value: metrics.queueProcessingTime,
				thresholds: this.thresholds.queueProcessing,
			},
			{
				component: 'Database Query',
				operation: 'db_query',
				value: metrics.dbQueryTime,
				thresholds: this.thresholds.dbQuery,
			},
			{
				component: 'Redis Operation',
				operation: 'redis_op',
				value: metrics.redisOperationTime,
				thresholds: this.thresholds.redisOperation,
			},
		]

		for (const check of checks) {
			const severity = this.determineSeverity(check.value, check.thresholds)

			if (severity !== 'LOW') {
				bottlenecks.push({
					component: check.component,
					operation: check.operation,
					averageTime: check.value,
					maxTime: check.value * 1.5, // Estimate
					minTime: check.value * 0.5, // Estimate
					percentile95: check.value * 1.2, // Estimate
					percentile99: check.value * 1.4, // Estimate
					sampleCount: 1,
					isBottleneck: true,
					severity,
					recommendations: this.generateComponentRecommendations(
						check.component,
						check.value,
						severity
					),
					timestamp: new Date().toISOString(),
				})
			}
		}

		return bottlenecks
	}

	/**
	 * Generate recommendations based on bottleneck analysis
	 */
	generateRecommendations(analyses: BottleneckAnalysis[]): string[] {
		const recommendations: string[] = []
		const componentIssues = new Map<string, BottleneckAnalysis[]>()

		// Group analyses by component
		for (const analysis of analyses) {
			if (!componentIssues.has(analysis.component)) {
				componentIssues.set(analysis.component, [])
			}
			componentIssues.get(analysis.component)!.push(analysis)
		}

		// Generate system-wide recommendations
		if (analyses.length > 5) {
			recommendations.push(
				'Consider implementing horizontal scaling due to multiple performance bottlenecks'
			)
		}

		const criticalIssues = analyses.filter((a) => a.severity === 'CRITICAL')
		if (criticalIssues.length > 0) {
			recommendations.push(
				'Address critical performance issues immediately to prevent system degradation'
			)
		}

		// Generate component-specific recommendations
		for (const [component, issues] of componentIssues.entries()) {
			const avgTime = issues.reduce((sum, issue) => sum + issue.averageTime, 0) / issues.length

			if (component.includes('Database') && avgTime > 200) {
				recommendations.push(
					'Consider database query optimization, indexing, or connection pooling'
				)
			}

			if (component.includes('Queue') && avgTime > 100) {
				recommendations.push(
					'Consider increasing queue worker concurrency or optimizing queue processing'
				)
			}

			if (component.includes('Redis') && avgTime > 20) {
				recommendations.push('Consider Redis connection pooling or pipeline optimization')
			}

			if (component.includes('Event Processing') && avgTime > 200) {
				recommendations.push('Consider event processing optimization or async processing patterns')
			}
		}

		return recommendations
	}

	/**
	 * Group operations by type and name
	 */
	private groupOperations(
		operations: AuditOperationMetrics[]
	): Map<string, AuditOperationMetrics[]> {
		const grouped = new Map<string, AuditOperationMetrics[]>()

		for (const op of operations) {
			const key = `${op.operationType}:${op.operationName}`
			if (!grouped.has(key)) {
				grouped.set(key, [])
			}
			grouped.get(key)!.push(op)
		}

		return grouped
	}

	/**
	 * Calculate statistics for a group of operations
	 */
	private calculateOperationStats(
		operationKey: string,
		operations: AuditOperationMetrics[]
	): OperationStats {
		const durations = operations.map((op) => op.duration).sort((a, b) => a - b)
		const errors = operations.filter((op) => !op.success).length

		return {
			operationName: operationKey,
			count: operations.length,
			totalTime: durations.reduce((sum, d) => sum + d, 0),
			averageTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
			minTime: durations[0] || 0,
			maxTime: durations[durations.length - 1] || 0,
			percentile95: this.calculatePercentile(durations, 0.95),
			percentile99: this.calculatePercentile(durations, 0.99),
			errorRate: operations.length > 0 ? errors / operations.length : 0,
			samples: durations,
		}
	}

	/**
	 * Calculate percentile from sorted array
	 */
	private calculatePercentile(sortedArray: number[], percentile: number): number {
		if (sortedArray.length === 0) return 0

		const index = Math.ceil(sortedArray.length * percentile) - 1
		return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
	}

	/**
	 * Analyze operation statistics for bottlenecks
	 */
	private analyzeOperationStats(stats: OperationStats): BottleneckAnalysis | null {
		// Determine if this is a bottleneck based on various criteria
		const isBottleneck =
			stats.averageTime > 100 || // Average time > 100ms
			stats.percentile95 > 200 || // 95th percentile > 200ms
			stats.errorRate > 0.05 || // Error rate > 5%
			stats.maxTime > 1000 // Max time > 1s

		if (!isBottleneck) {
			return null
		}

		// Determine severity
		let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'

		if (stats.averageTime > 500 || stats.errorRate > 0.2) {
			severity = 'CRITICAL'
		} else if (stats.averageTime > 200 || stats.errorRate > 0.1) {
			severity = 'HIGH'
		} else if (stats.averageTime > 100 || stats.errorRate > 0.05) {
			severity = 'MEDIUM'
		}

		return {
			component: stats.operationName.split(':')[0],
			operation: stats.operationName.split(':')[1] || stats.operationName,
			averageTime: stats.averageTime,
			maxTime: stats.maxTime,
			minTime: stats.minTime,
			percentile95: stats.percentile95,
			percentile99: stats.percentile99,
			sampleCount: stats.count,
			isBottleneck: true,
			severity,
			recommendations: this.generateStatsRecommendations(stats, severity),
			timestamp: new Date().toISOString(),
		}
	}

	/**
	 * Generate recommendations based on operation statistics
	 */
	private generateStatsRecommendations(stats: OperationStats, severity: string): string[] {
		const recommendations: string[] = []

		if (stats.errorRate > 0.1) {
			recommendations.push(
				`High error rate (${(stats.errorRate * 100).toFixed(1)}%) - investigate error causes`
			)
		}

		if (stats.averageTime > 200) {
			recommendations.push(
				`High average processing time (${stats.averageTime.toFixed(1)}ms) - optimize operation logic`
			)
		}

		if (stats.percentile95 > stats.averageTime * 2) {
			recommendations.push(
				'High variance in processing times - investigate performance inconsistencies'
			)
		}

		if (stats.maxTime > stats.averageTime * 5) {
			recommendations.push('Extreme outliers detected - implement timeout mechanisms')
		}

		if (severity === 'CRITICAL') {
			recommendations.push('CRITICAL: Immediate attention required to prevent system impact')
		}

		return recommendations
	}

	/**
	 * Determine severity based on value and thresholds
	 */
	private determineSeverity(
		value: number,
		thresholds: { warning: number; critical: number }
	): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
		if (value >= thresholds.critical) {
			return 'CRITICAL'
		} else if (value >= thresholds.warning * 1.5) {
			return 'HIGH'
		} else if (value >= thresholds.warning) {
			return 'MEDIUM'
		}
		return 'LOW'
	}

	/**
	 * Generate component-specific recommendations
	 */
	private generateComponentRecommendations(
		component: string,
		value: number,
		severity: string
	): string[] {
		const recommendations: string[] = []

		switch (component) {
			case 'Event Processing':
				recommendations.push('Consider optimizing event processing pipeline')
				if (value > 300) recommendations.push('Implement async processing for heavy operations')
				break

			case 'Event Validation':
				recommendations.push('Optimize validation logic and schema checks')
				if (value > 100) recommendations.push('Consider caching validation schemas')
				break

			case 'Event Hashing':
				recommendations.push('Consider using faster hashing algorithms or hardware acceleration')
				break

			case 'Event Storage':
				recommendations.push('Optimize database writes and consider batch operations')
				if (value > 500) recommendations.push('Implement write-behind caching')
				break

			case 'Queue Processing':
				recommendations.push('Increase queue worker concurrency')
				recommendations.push('Optimize queue message processing logic')
				break

			case 'Database Query':
				recommendations.push('Add database indexes for frequently queried fields')
				recommendations.push('Consider query optimization and connection pooling')
				break

			case 'Redis Operation':
				recommendations.push('Implement Redis pipelining for batch operations')
				recommendations.push('Consider Redis connection pooling')
				break
		}

		if (severity === 'CRITICAL') {
			recommendations.unshift('URGENT: This component is severely impacting system performance')
		}

		return recommendations
	}

	/**
	 * Take a resource usage snapshot
	 */
	private takeResourceSnapshot(session: ProfilingSession): void {
		const memUsage = process.memoryUsage()
		const cpuUsage = process.cpuUsage()

		session.resourceSnapshots.push({
			timestamp: performance.now(),
			cpu: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to milliseconds
			memory: memUsage.heapUsed,
		})
	}

	/**
	 * Generate profiling result from session
	 */
	private generateProfilingResult(session: ProfilingSession): ProfilingResult {
		const duration = (session.endTime || performance.now()) - session.startTime

		return {
			profileId: session.sessionId,
			component: 'audit-system',
			operation: session.operationName,
			startTime: session.startTime,
			endTime: session.endTime || performance.now(),
			duration,
			callStack: session.callStack,
			resourceUsage: {
				cpu: session.resourceSnapshots.map((s) => s.cpu),
				memory: session.resourceSnapshots.map((s) => s.memory),
				timestamps: session.resourceSnapshots.map((s) => s.timestamp),
			},
			breakdown: {
				[session.operationName]: {
					count: 1,
					totalTime: duration,
					averageTime: duration,
					maxTime: duration,
					minTime: duration,
				},
			},
			recommendations: this.generateProfilingRecommendations(session, duration),
			metadata: {
				sessionId: session.sessionId,
				resourceSnapshotCount: session.resourceSnapshots.length,
			},
		}
	}

	/**
	 * Generate recommendations from profiling session
	 */
	private generateProfilingRecommendations(session: ProfilingSession, duration: number): string[] {
		const recommendations: string[] = []

		if (duration > 1000) {
			recommendations.push('Operation took over 1 second - consider optimization')
		}

		if (session.resourceSnapshots.length > 1) {
			const memoryGrowth =
				session.resourceSnapshots[session.resourceSnapshots.length - 1].memory -
				session.resourceSnapshots[0].memory

			if (memoryGrowth > 10 * 1024 * 1024) {
				// 10MB
				recommendations.push('Significant memory growth detected - check for memory leaks')
			}
		}

		return recommendations
	}
}
