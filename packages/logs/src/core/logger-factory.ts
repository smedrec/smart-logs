import { ConfigLoader } from '../config/config-loader.js'
import { LogLevel } from '../types/logger.js'
import { StructuredLogger } from './structured-logger.js'

import type {
	ConsoleConfig,
	FileConfig,
	LoggingConfig,
	OTLPConfig,
	RedisConfig,
} from '../types/config.js'

/**
 * Logger Factory for creating pre-configured logger instances
 * Provides convenient methods for common logging scenarios
 */
export class LoggerFactory {
	/**
	 * Create a development logger with console output and pretty formatting
	 */
	static createDevelopmentLogger(
		service: string,
		options: {
			level?: LogLevel
			environment?: string
			enablePerformance?: boolean
		} = {}
	): StructuredLogger {
		const logger = new StructuredLogger({
			service,
			environment: options.environment || 'development',
			minLevel: options.level || LogLevel.DEBUG,
			console: {
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: options.level || LogLevel.DEBUG,
			},
		})
		// Initialize in background (best-effort)
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a production logger with JSON console output
	 */
	static createProductionLogger(
		service: string,
		options: {
			level?: LogLevel
			environment?: string
			otlpEndpoint?: string
			fileConfig?: Partial<FileConfig>
			redisConfig?: Partial<RedisConfig>
		} = {}
	): StructuredLogger {
		const config: any = {
			service,
			environment: options.environment || 'production',
			minLevel: options.level || LogLevel.INFO,
			console: {
				enabled: true,
				format: 'json',
				colorize: false,
				level: options.level || LogLevel.INFO,
			},
		}

		// Add OTLP if endpoint provided
		if (options.otlpEndpoint) {
			config.otlp = {
				enabled: true,
				endpoint: options.otlpEndpoint,
				batchSize: 50,
				batchTimeoutMs: 10000,
				timeoutMs: 30000,
			}
		}

		// Add file logging if configured
		if (options.fileConfig) {
			config.file = {
				enabled: true,
				filename: 'application.log',
				maxSize: 10 * 1024 * 1024, // 10MB
				maxFiles: 5,
				rotateDaily: true,
				compress: true,
				...options.fileConfig,
			}
		}

		// Add Redis if configured
		if (options.redisConfig) {
			config.redis = {
				enabled: true,
				host: 'localhost',
				port: 6379,
				listName: `${service}-logs`,
				...options.redisConfig,
			}
		}

		const logger = new StructuredLogger(config)
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a logger with console and OTLP transports (common use case)
	 */
	static createConsoleAndOTLPLogger(
		service: string,
		otlpEndpoint: string,
		options: {
			level?: LogLevel
			environment?: string
			consoleFormat?: 'json' | 'pretty'
		} = {}
	): StructuredLogger {
		const logger = new StructuredLogger({
			service,
			environment: options.environment || 'production',
			minLevel: options.level || LogLevel.INFO,
			console: {
				enabled: true,
				format: options.consoleFormat || 'json',
				colorize: options.consoleFormat === 'pretty',
			},
			otlp: {
				enabled: true,
				endpoint: otlpEndpoint,
				batchSize: 50,
				batchTimeoutMs: 5000,
				timeoutMs: 30000,
			},
		})
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a logger with custom configuration object
	 */
	static createCustomLogger(config: {
		service: string
		environment?: string
		minLevel?: LogLevel
		console?: Partial<ConsoleConfig>
		file?: Partial<FileConfig>
		otlp?: Partial<OTLPConfig>
		redis?: Partial<RedisConfig>
	}): StructuredLogger {
		const fullConfig = {
			...config,
			environment: config.environment || 'development',
		}
		const logger = new StructuredLogger(fullConfig)
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a logger from configuration file
	 */
	static async createFromConfigFile(
		configPath: string,
		overrides: Partial<LoggingConfig> = {}
	): Promise<StructuredLogger> {
		const config = ConfigLoader.loadFromPath(configPath, overrides)
		const logger = new StructuredLogger(config)
		await logger.init()
		return logger
	}

	/**
	 * Create a logger from environment variables
	 */
	static createFromEnvironment(overrides: Partial<LoggingConfig> = {}): StructuredLogger {
		const config = ConfigLoader.load(overrides)
		const logger = new StructuredLogger(config)
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a minimal logger with only console output (for testing)
	 */
	static createMinimalLogger(service: string = 'test'): StructuredLogger {
		const logger = new StructuredLogger({
			service,
			environment: 'test',
			minLevel: LogLevel.DEBUG,
			console: {
				enabled: true,
				format: 'pretty',
				colorize: false, // Avoid colors in tests
			},
		})
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}

	/**
	 * Create a silent logger (no transports) for testing
	 */
	static createSilentLogger(service: string = 'test'): StructuredLogger {
		const logger = new StructuredLogger({
			service,
			environment: 'test',
			minLevel: LogLevel.DEBUG,
			console: {
				enabled: false, // Disable console output
			},
		})
		logger.init().catch((err) => console.error('Logger init failed:', err))
		return logger
	}
}

/**
 * Convenience function to create a development logger
 */
export function createDevelopmentLogger(service: string): StructuredLogger {
	return LoggerFactory.createDevelopmentLogger(service)
}

/**
 * Convenience function to create a production logger
 */
export function createProductionLogger(service: string, otlpEndpoint?: string): StructuredLogger {
	return LoggerFactory.createProductionLogger(service, {
		otlpEndpoint,
	})
}

/**
 * Convenience function to create a logger with console and OTLP
 */
export function createConsoleAndOTLPLogger(
	service: string,
	otlpEndpoint: string
): StructuredLogger {
	return LoggerFactory.createConsoleAndOTLPLogger(service, otlpEndpoint)
}
