/**
 * Observability and metrics types for comprehensive audit system monitoring
 */

/**
 * Trace context for distributed tracing
 */
export interface TraceContext {
	traceId: string
	spanId: string
	parentSpanId?: string
	baggage?: Record<string, string>
	flags?: number
}

/**
 * Span interface for distributed tracing
 */
export interface Span {
	traceId: string
	spanId: string
	parentSpanId?: string
	operationName: string
	startTime: number
	endTime?: number
	duration?: number
	tags: Record<string, any>
	logs: SpanLog[]
	status: SpanStatus
	component: string

	// Methods for span manipulation
	setTag(key: string, value: any): void
	setTags(tags: Record<string, any>): void
	log(
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		fields?: Record<string, any>
	): void
	setStatus(code: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED', message?: string): void
	finish(): void
}

/**
 * Span log entry
 */
export interface SpanLog {
	timestamp: number
	level: 'debug' | 'info' | 'warn' | 'error'
	message: string
	fields?: Record<string, any>
}

/**
 * Span status
 */
export interface SpanStatus {
	code: 'OK' | 'ERROR' | 'TIMEOUT' | 'CANCELLED'
	message?: string
}

/**
 * Performance metrics for audit operations
 */
export interface PerformanceMetrics {
	// Event processing metrics
	eventProcessingTime: number
	eventValidationTime: number
	eventHashingTime: number
	eventPseudonymizationTime: number
	eventStorageTime: number

	// Queue metrics
	queueWaitTime: number
	queueProcessingTime: number
	queueDepth: number

	// Database metrics
	dbConnectionTime: number
	dbQueryTime: number
	dbTransactionTime: number

	// Redis metrics
	redisConnectionTime: number
	redisOperationTime: number

	// Memory metrics
	memoryUsage: number
	heapUsed: number
	heapTotal: number

	// CPU metrics
	cpuUsage: number

	timestamp: string
}

/**
 * Bottleneck identification result
 */
export interface BottleneckAnalysis {
	component: string
	operation: string
	averageTime: number
	maxTime: number
	minTime: number
	percentile95: number
	percentile99: number
	sampleCount: number
	isBottleneck: boolean
	severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
	recommendations: string[]
	timestamp: string
}

/**
 * System resource metrics
 */
export interface SystemMetrics {
	cpu: {
		usage: number
		loadAverage: number[]
	}
	memory: {
		used: number
		total: number
		free: number
		heapUsed: number
		heapTotal: number
	}
	disk: {
		used: number
		total: number
		free: number
	}
	network: {
		bytesIn: number
		bytesOut: number
		packetsIn: number
		packetsOut: number
	}
	timestamp: string
}

/**
 * Audit operation metrics
 */
export interface AuditOperationMetrics {
	operationType: 'CREATE' | 'VALIDATE' | 'HASH' | 'STORE' | 'RETRIEVE' | 'ARCHIVE'
	operationName: string
	duration: number
	success: boolean
	errorType?: string
	errorMessage?: string
	metadata: Record<string, any>
	timestamp: string
	traceId?: string
	spanId?: string
}

/**
 * Dashboard metrics aggregation
 */
export interface DashboardMetrics {
	// Overview metrics
	totalEvents: number
	eventsPerSecond: number
	averageProcessingTime: number
	errorRate: number

	// Performance metrics
	throughput: number
	latency: PerformanceMetrics
	bottlenecks: BottleneckAnalysis[]

	// System health
	systemMetrics: SystemMetrics
	componentHealth: Record<string, ComponentHealthMetrics>

	// Alerts and patterns
	activeAlerts: number
	suspiciousPatterns: number

	// Time series data
	timeSeriesData: TimeSeriesMetrics[]

	timestamp: string
}

/**
 * Component health metrics
 */
export interface ComponentHealthMetrics {
	name: string
	status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
	uptime: number
	responseTime: number
	errorRate: number
	throughput: number
	lastCheck: string
}

/**
 * Time series metrics for trending
 */
export interface TimeSeriesMetrics {
	timestamp: string
	eventsProcessed: number
	processingLatency: number
	errorRate: number
	queueDepth: number
	cpuUsage: number
	memoryUsage: number
}

/**
 * Profiling result
 */
export interface ProfilingResult {
	profileId: string
	component: string
	operation: string
	startTime: number
	endTime: number
	duration: number

	// Call stack information
	callStack: CallStackFrame[]

	// Resource usage during profiling
	resourceUsage: {
		cpu: number[]
		memory: number[]
		timestamps: number[]
	}

	// Performance breakdown
	breakdown: {
		[operation: string]: {
			count: number
			totalTime: number
			averageTime: number
			maxTime: number
			minTime: number
		}
	}

	// Recommendations
	recommendations: string[]

	metadata: Record<string, any>
}

/**
 * Call stack frame for profiling
 */
export interface CallStackFrame {
	functionName: string
	fileName: string
	lineNumber: number
	columnNumber: number
	duration: number
	selfTime: number
	children: CallStackFrame[]
}
