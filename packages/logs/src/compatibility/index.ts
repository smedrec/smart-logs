/**
 * @fileoverview Compatibility Layer Exports
 *
 * Provides easy access to all backward compatibility utilities
 * and migration tools for the structured logging system.
 */

// Legacy logger wrappers
export {
	LegacyLoggerWrapper,
	LegacyStructuredLoggerWrapper,
	LegacyLoggerFactory,
	createRequestLogger,
} from './legacy-logger.js'

// Legacy types for backward compatibility
export type {
	Fields,
	LegacyLogger,
	LegacyLoggingConfig,
	LegacyLogContext,
	LegacyLoggerConfig,
} from './legacy-logger.js'

// Migration utilities
export {
	ConfigMigrator,
	CodeMigrator,
	MigrationAssistant,
	LegacyUsageDetector,
} from './migration-utils.js'
