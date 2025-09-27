import { z } from 'zod'

// ============================================================================
// Health and Status Types
// ============================================================================

/**
 * Health status
 */
export const HealthStatusSchema = z.object({
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	timestamp: z.string().datetime(),
	environment: z.string().min(1),
	uptime: z.number().min(0),
	version: z.string().min(1),
})
export type HealthStatus = z.infer<typeof HealthStatusSchema>

/**
 * Detailed health status
 */
export const DetailedHealthStatusSchema = z.object({
	status: z.enum(['healthy', 'degraded', 'unhealthy']),
	timestamp: z.string().datetime(),
	uptime: z.number().min(0),
	version: z.string().min(1),
	services: z.record(
		z.object({
			status: z.enum(['healthy', 'degraded', 'unhealthy']),
			responseTime: z.number().min(0).optional(),
			lastCheck: z.string().datetime(),
			details: z.record(z.unknown()).optional(),
		})
	),
	metrics: z
		.object({
			memoryUsage: z.number().min(0),
			cpuUsage: z.number().min(0).max(100),
			activeConnections: z.number().int().min(0),
			requestsPerSecond: z.number().min(0),
		})
		.optional(),
})
export type DetailedHealthStatus = z.infer<typeof DetailedHealthStatusSchema>

/**
 * Version information
 */
export const VersionInfoSchema = z.object({
	version: z.string().min(1),
	buildDate: z.string().datetime(),
	gitCommit: z.string().optional(),
	environment: z.string().optional(),
	apiVersion: z.string().min(1),
})
export type VersionInfo = z.infer<typeof VersionInfoSchema>

/**
 * Readiness status for deployment health checks
 */
export const ReadinessStatusSchema = z.object({
	ready: z.boolean(),
	timestamp: z.string().datetime(),
	checks: z.array(
		z.object({
			name: z.string().min(1),
			ready: z.boolean(),
			message: z.string().optional(),
			duration: z.number().min(0),
		})
	),
	dependencies: z.object({
		database: z.boolean(),
		cache: z.boolean(),
		externalServices: z.boolean(),
		migrations: z.boolean().optional(),
	}),
})
export type ReadinessStatus = z.infer<typeof ReadinessStatusSchema>

// ============================================================================
// Utility Types and Type Guards
// ============================================================================

/**
 * Type guard for health status
 */
export const isHealthStatus = (value: unknown): value is HealthStatus => {
	return HealthStatusSchema.safeParse(value).success
}

/**
 * Type guard for detailed health status
 */
export const isDetailedHealthStatus = (value: unknown): value is DetailedHealthStatus => {
	return DetailedHealthStatusSchema.safeParse(value).success
}

/**
 * Type guard for readiness status
 */
export const isReadinessStatus = (value: unknown): value is ReadinessStatus => {
	return ReadinessStatusSchema.safeParse(value).success
}

/**
 * Type guard for version info
 */
export const isVersionInfo = (value: unknown): value is VersionInfo => {
	return VersionInfoSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates health status data
 */
export const validateHealthStatus = (data: unknown) => {
	return HealthStatusSchema.safeParse(data)
}

/**
 * Validates detailed health status data
 */
export const validateDetailedHealthStatus = (data: unknown) => {
	return DetailedHealthStatusSchema.safeParse(data)
}

/**
 * Validates readiness status data
 */
export const validateReadinessStatus = (data: unknown) => {
	return ReadinessStatusSchema.safeParse(data)
}

/**
 * Validates version info data
 */
export const validateVersionInfo = (data: unknown) => {
	return VersionInfoSchema.safeParse(data)
}
