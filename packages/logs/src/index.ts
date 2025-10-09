// Core types and interfaces
export * from './types/index.js'

// Configuration management
export * from './config/index.js'

// Core logging components
export * from './core/index.js'

// Transport implementations
export * from './transports/index.js'

// Async operation handling implementations (new)
// Note: The core implementations are already exported via './core/index.js'

// Utilities
export * from './utils/index.js'

// Legacy exports for backward compatibility (avoiding duplicates)
export { StructuredLogger, LoggerFactory, createRequestLogger } from './logging.js'
export * from './console.js'
