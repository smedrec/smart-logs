import { z } from 'zod'

/**
 * Zod schemas for configuration validation with runtime type checking
 * Addresses requirements 1.3 and 1.4: Runtime validation with clear error messages
 */

// Base log level schema
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal'])

// Console transport configuration schema
export const ConsoleConfigSchema = z.object({
	name: z.string().default('console'),
	enabled: z.boolean().default(true),
	level: LogLevelSchema.optional(),
	format: z.enum(['json', 'pretty']).default('pretty'),
	colorize: z.boolean().default(true),
})

// File transport configuration schema
export const FileConfigSchema = z.object({
	name: z.string().default('file'),
	enabled: z.boolean().default(false),
	level: LogLevelSchema.optional(),
	filename: z.string().min(1, 'Filename cannot be empty').optional(),
	maxSize: z
		.number()
		.min(1024, 'Max size must be at least 1KB')
		.default(10 * 1024 * 1024), // 10MB
	maxFiles: z.number().min(1, 'Must keep at least 1 file').default(5),
	rotateDaily: z.boolean().default(false),
	rotationInterval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
	compress: z.boolean().default(true),
	retentionDays: z.number().min(1, 'Retention must be at least 1 day').default(30),
})

// OTLP transport configuration schema
export const OTLPConfigSchema = z.object({
	name: z.string().default('otlp'),
	enabled: z.boolean().default(false),
	level: LogLevelSchema.optional(),
	endpoint: z
		.string()
		.min(1, 'OTLP endpoint cannot be empty')
		.refine(
			(url) => {
				try {
					new URL(url)
					return true
				} catch {
					return false
				}
			},
			{ message: 'OTLP endpoint must be a valid URL' }
		)
		.optional(),
	headers: z.record(z.string(), z.string()).optional(),
	timeoutMs: z.number().min(1000, 'Timeout must be at least 1 second').default(30000),
	batchSize: z.number().min(1, 'Batch size must be at least 1').default(100),
	batchTimeoutMs: z.number().min(100, 'Batch timeout must be at least 100ms').default(5000),
	maxConcurrency: z.number().min(1, 'Max concurrency must be at least 1').default(10),
	circuitBreakerThreshold: z
		.number()
		.min(1, 'Circuit breaker threshold must be at least 1')
		.default(5),
	circuitBreakerResetMs: z
		.number()
		.min(1000, 'Circuit breaker reset must be at least 1 second')
		.default(60000),
})

// Redis transport configuration schema
export const RedisConfigSchema = z.object({
	name: z.string().default('redis'),
	enabled: z.boolean().default(false),
	level: LogLevelSchema.optional(),
	host: z.string().min(1, 'Redis host cannot be empty').default('localhost'),
	port: z.number().min(1, 'Port must be positive').max(65535, 'Port must be valid').default(6379),
	password: z.string().optional(),
	database: z.number().min(0, 'Database number must be non-negative').default(0),
	keyPrefix: z.string().default('logs:'),
	listName: z.string().min(1, 'List name cannot be empty').default('application-logs'),
	maxRetries: z.number().min(0, 'Max retries must be non-negative').default(3),
	// Connection settings
	connectTimeoutMs: z
		.number()
		.min(1000, 'Connect timeout must be at least 1 second')
		.default(10000),
	commandTimeoutMs: z.number().min(1000, 'Command timeout must be at least 1 second').default(5000),
	// Advanced options
	enableAutoPipelining: z.boolean().default(true),
	enableOfflineQueue: z.boolean().default(false),
	// Data structure options
	dataStructure: z.enum(['list', 'stream', 'pubsub']).default('list'),
	streamName: z.string().optional(),
	channelName: z.string().optional(),
	// Cluster support
	enableCluster: z.boolean().default(false),
	clusterNodes: z.array(z.string()).optional(),
	// TLS support
	enableTLS: z.boolean().default(false),
	tlsOptions: z
		.object({
			rejectUnauthorized: z.boolean().default(true),
			ca: z.string().optional(),
			cert: z.string().optional(),
			key: z.string().optional(),
		})
		.optional(),
})

// Performance configuration schema
export const PerformanceConfigSchema = z.object({
	enabled: z.boolean().default(false),
	sampleRate: z
		.number()
		.min(0, 'Sample rate must be non-negative')
		.max(1, 'Sample rate cannot exceed 1')
		.default(0.1),
	collectCpuUsage: z.boolean().default(true),
	collectMemoryUsage: z.boolean().default(true),
})

// Batch configuration schema
export const BatchConfigSchema = z.object({
	maxSize: z.number().min(1, 'Batch size must be at least 1').default(100),
	timeoutMs: z.number().min(100, 'Batch timeout must be at least 100ms').default(5000),
	maxConcurrency: z.number().min(1, 'Max concurrency must be at least 1').default(10),
	maxQueueSize: z.number().min(1, 'Max queue size must be at least 1').default(10000),
})

// Retry configuration schema
export const RetryConfigSchema = z.object({
	maxAttempts: z.number().min(0, 'Max attempts must be non-negative').default(3),
	initialDelayMs: z.number().min(100, 'Initial delay must be at least 100ms').default(1000),
	maxDelayMs: z.number().min(1000, 'Max delay must be at least 1 second').default(30000),
	multiplier: z.number().min(1, 'Multiplier must be at least 1').default(2),
})

// Main logging configuration schema
export const LoggingConfigSchema = z.object({
	// Core settings
	level: LogLevelSchema.default('info'),
	service: z.string().min(1, 'Service name cannot be empty').default('application'),
	environment: z.string().min(1, 'Environment cannot be empty').default('development'),
	version: z.string().default('1.0.0'),

	// Transport configurations
	console: ConsoleConfigSchema.optional(),
	file: FileConfigSchema.optional(),
	otlp: OTLPConfigSchema.optional(),
	redis: RedisConfigSchema.optional(),

	// Feature configurations
	performance: PerformanceConfigSchema.optional(),
	batch: BatchConfigSchema.optional(),
	retry: RetryConfigSchema.optional(),

	// Reliability settings
	shutdownTimeoutMs: z
		.number()
		.min(1000, 'Shutdown timeout must be at least 1 second')
		.default(30000),
	enableCorrelationIds: z.boolean().default(true),
	enableRequestTracking: z.boolean().default(true),

	// Development settings
	enableDebugMode: z.boolean().default(false),
	prettyPrint: z.boolean().default(true),
})

// Infer TypeScript types from Zod schemas
export type LogLevel = z.infer<typeof LogLevelSchema>
export type ConsoleConfig = z.infer<typeof ConsoleConfigSchema>
export type FileConfig = z.infer<typeof FileConfigSchema>
export type OTLPConfig = z.infer<typeof OTLPConfigSchema>
export type RedisConfig = z.infer<typeof RedisConfigSchema>
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>
export type BatchConfig = z.infer<typeof BatchConfigSchema>
export type RetryConfig = z.infer<typeof RetryConfigSchema>
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>

/**
 * Configuration validation utility
 * Provides clear error messages for invalid configurations
 */
export class ConfigValidator {
	static validate(config: unknown): LoggingConfig {
		try {
			return LoggingConfigSchema.parse(config)
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ')
				throw new Error(`Configuration validation failed: ${errorMessages}`)
			}
			throw error
		}
	}

	static validatePartial(config: unknown): Partial<LoggingConfig> {
		try {
			// Create a schema without defaults for partial validation
			const partialSchema = z
				.object({
					level: LogLevelSchema.optional(),
					service: z.string().min(1, 'Service name cannot be empty').optional(),
					environment: z.string().min(1, 'Environment cannot be empty').optional(),
					version: z.string().optional(),
					console: ConsoleConfigSchema.optional(),
					file: FileConfigSchema.optional(),
					otlp: OTLPConfigSchema.optional(),
					redis: RedisConfigSchema.optional(),
					performance: PerformanceConfigSchema.optional(),
					batch: BatchConfigSchema.optional(),
					retry: RetryConfigSchema.optional(),
					shutdownTimeoutMs: z
						.number()
						.min(1000, 'Shutdown timeout must be at least 1 second')
						.optional(),
					enableCorrelationIds: z.boolean().optional(),
					enableRequestTracking: z.boolean().optional(),
					enableDebugMode: z.boolean().optional(),
					prettyPrint: z.boolean().optional(),
				})
				.strict()

			return partialSchema.parse(config)
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errorMessages = error.issues
					.map((err: any) => `${err.path.join('.')}: ${err.message}`)
					.join(', ')
				throw new Error(`Partial configuration validation failed: ${errorMessages}`)
			}
			throw error
		}
	}
}
