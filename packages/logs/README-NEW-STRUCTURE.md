# Structured Logging Package - New Architecture

This document describes the new directory structure and interfaces implemented for the structured logging rewrite.

## Directory Structure

```
src/
├── types/                    # Core type definitions and interfaces
│   ├── logger.ts            # Logger interface and related types
│   ├── transport.ts         # Transport interfaces and configurations
│   ├── batch.ts             # Batching and retry interfaces
│   ├── log-entry.ts         # Log entry structure definitions
│   ├── config.ts            # Zod schemas and configuration types
│   └── index.ts             # Type exports
├── config/                   # Configuration management
│   ├── config-loader.ts     # Environment variable and config loading
│   └── index.ts             # Config exports
├── core/                     # Core logging implementations
│   ├── structured-logger.ts # Main logger implementation (placeholder)
│   ├── log-processor.ts     # Log processing logic (placeholder)
│   ├── correlation-manager.ts # Correlation ID management (placeholder)
│   └── index.ts             # Core exports
├── transports/              # Transport implementations
│   ├── console-transport.ts # Console output (placeholder)
│   ├── file-transport.ts    # File output with rotation (placeholder)
│   ├── otlp-transport.ts    # OTLP export (placeholder)
│   ├── redis-transport.ts   # Redis output (placeholder)
│   └── index.ts             # Transport exports
├── batch/                   # Batching and queuing
│   ├── batch-manager.ts     # Batch processing (placeholder)
│   ├── retry-manager.ts     # Retry logic (placeholder)
│   ├── circuit-breaker.ts   # Circuit breaker pattern (placeholder)
│   └── index.ts             # Batch exports
├── utils/                   # Utility functions
│   ├── serializer.ts        # Log serialization (placeholder)
│   ├── performance-monitor.ts # Performance monitoring (placeholder)
│   ├── id-generator.ts      # ID generation utilities (placeholder)
│   └── index.ts             # Utility exports
└── index.ts                 # Main package exports
```

## Key Interfaces

### Logger Interface

```typescript
interface Logger {
	debug(message: string, fields?: LogFields): Promise<void>
	info(message: string, fields?: LogFields): Promise<void>
	warn(message: string, fields?: LogFields): Promise<void>
	error(message: string, fields?: LogFields): Promise<void>
	fatal(message: string, fields?: LogFields): Promise<void>

	setRequestId(requestId: string): void
	setCorrelationId(correlationId: string): void
	withContext(context: LogContext): Logger

	flush(): Promise<void>
	close(): Promise<void>
}
```

### Transport Interface

```typescript
interface LogTransport {
	readonly name: string
	send(entries: LogEntry[]): Promise<void>
	flush(): Promise<void>
	close(): Promise<void>
	isHealthy(): boolean
}
```

### Configuration Validation

All configuration is validated using Zod schemas with runtime type checking:

```typescript
const config = ConfigLoader.load({
	level: 'info',
	service: 'my-service',
	console: {
		enabled: true,
		format: 'pretty',
	},
})
```

## Requirements Addressed

### Requirement 1.1: Type Safety and Interface Consistency

- ✅ Complete Logger interface with all required methods
- ✅ Consistent TypeScript interfaces throughout
- ✅ No `any` or `Record<string, any>` types in public APIs
- ✅ Proper async method signatures

### Requirement 1.3: Runtime Configuration Validation

- ✅ Zod schemas for all configuration options
- ✅ Runtime validation with clear error messages
- ✅ Environment variable parsing with type conversion

### Requirement 1.4: Clear Error Messages

- ✅ Detailed validation error messages
- ✅ Path-specific error reporting
- ✅ Early failure with clear feedback

## Next Steps

The placeholders created in this task will be implemented in subsequent tasks:

- **Task 2.1**: Implement Logger interface and types
- **Task 2.2**: Build StructuredLogger core class
- **Task 2.3**: Implement LogSerializer
- **Task 3.1**: Create BatchManager
- **Task 4.1**: Implement ConsoleTransport
- **Task 5.1**: Create FileTransport
- **Task 6.1**: Build OTLPTransport
- **Task 7.1**: Implement RedisTransport

## Usage Example

```typescript
import { ConfigLoader, Logger } from '@repo/logs'

// Load configuration with validation
const config = ConfigLoader.load({
	level: 'info',
	service: 'my-service',
})

// Create logger instance (when implemented)
// const logger = new StructuredLogger(config)
// await logger.info('Application started', { version: '1.0.0' })
```

This structure provides a solid foundation for the production-ready logging system with clear separation of concerns and type safety throughout.
