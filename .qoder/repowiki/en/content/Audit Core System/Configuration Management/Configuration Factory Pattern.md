# Configuration Factory Pattern

<cite>
**Referenced Files in This Document**   
- [factory.ts](file://packages\audit\src\config\factory.ts) - *Updated in recent commit*
- [types.ts](file://packages\audit\src\config\types.ts) - *Updated in recent commit*
- [validator.ts](file://packages\audit\src\config\validator.ts) - *Updated in recent commit*
- [manager.ts](file://packages\audit\src\config\manager.ts) - *Updated in recent commit*
- [configuration.md](file://packages\audit\docs\getting-started\configuration.md) - *Documentation moved to centralized site*
- [logging.ts](file://packages\logs\src\logging.ts) - *Introduced StructuredLogger and LoggerFactory*
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts) - *Added in recent commit*
- [index.ts](file://apps\worker\src\index.ts) - *Updated in recent commit*
</cite>

## Update Summary
**Changes Made**   
- Added new section on Database Preset Handler integration with the Configuration Factory
- Updated Configuration Factory Overview to include preset handler injection
- Added new diagram showing factory integration with preset handler
- Updated Factory Creation Workflow to include preset handler initialization
- Added new section on Dependency Injection with Preset Handler
- Updated Factory Usage Examples to include preset handler integration
- Added new code example for preset handler creation
- Updated section sources to include new files
- Added diagram sources for new architectural diagrams

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Factory Overview](#configuration-factory-overview)
3. [Core Configuration Types](#core-configuration-types)
4. [Factory Creation Workflow](#factory-creation-workflow)
5. [Environment-Specific Configuration Profiles](#environment-specific-configuration-profiles)
6. [Configuration Validation Pipeline](#configuration-validation-pipeline)
7. [Configuration Manager Integration](#configuration-manager-integration)
8. [Factory Usage Examples](#factory-usage-examples)
9. [Advanced Configuration Patterns](#advanced-configuration-patterns)
10. [Error Handling and Validation](#error-handling-and-validation)
11. [Extension Points and Customization](#extension-points-and-customization)
12. [Database Preset Handler Integration](#database-preset-handler-integration)

## Introduction
The Configuration Factory Pattern in the audit system provides a robust mechanism for creating and managing environment-specific configurations with proper defaults, validation, and dependency injection. This document details the implementation of the factory pattern, its integration with the configuration manager and validator, and practical usage patterns for initializing audit systems across different deployment scenarios.

The recent documentation update has centralized all audit-related documentation on a comprehensive site, replacing the extensive README content with a brief overview and redirect. This change does not affect the underlying implementation but improves documentation organization and accessibility.

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [types.ts](file://packages\audit\src\config\types.ts#L1-L712)

## Configuration Factory Overview
The Configuration Factory Pattern implements a comprehensive system for creating audit configurations with environment-specific defaults, validation, and merging capabilities. The factory provides multiple entry points for configuration creation, including environment-specific profiles, minimal configurations, and merged configurations with override precedence.

The factory system is designed to handle the complexity of audit system configuration across development, staging, production, and test environments, ensuring consistent defaults while allowing for environment-specific optimizations and security requirements.

```mermaid
classDiagram
class ConfigurationFactory {
+createDevelopmentConfig() : AuditConfig
+createStagingConfig() : AuditConfig
+createProductionConfig() : AuditConfig
+createTestConfig() : AuditConfig
+createConfigForEnvironment(env : string) : AuditConfig
+createMinimalConfig(env : Environment) : Partial<AuditConfig>
+mergeConfigurations(base : AuditConfig, override : Partial<AuditConfig>) : AuditConfig
}
class ConfigurationManager {
+initialize() : Promise<void>
+getConfig() : AuditConfig
+updateConfig(path : string, value : any, changedBy : string, reason? : string) : Promise<void>
+validateCurrentConfig() : Promise<void>
+reloadConfiguration() : Promise<void>
}
class ConfigValidator {
+validateConfiguration(config : AuditConfig) : Promise<void>
+validatePartialConfiguration(partial : Partial<AuditConfig>, base : AuditConfig) : Promise<void>
}
class DatabasePresetHandler {
+getPresets(organizationId? : string) : Promise<(AuditPreset & { id? : string })[]>
+getPreset(name : string, organizationId? : string) : Promise<(AuditPreset & { id? : string }) | null>
+createPreset(preset : AuditPreset & { createdBy : string }) : Promise<AuditPreset & { id? : string }>
+updatePreset(preset : AuditPreset & { id : string; updatedBy : string }) : Promise<AuditPreset & { id? : string }>
+deletePreset(name : string, organizationId : string) : Promise<{ success : true }>
}
ConfigurationFactory --> ConfigurationManager : "integrates with"
ConfigurationFactory --> ConfigValidator : "uses for validation"
ConfigurationManager --> ConfigValidator : "delegates validation"
ConfigurationFactory --> DatabasePresetHandler : "creates and injects"
```

**Diagram sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

## Core Configuration Types
The configuration system is built around the `AuditConfig` interface, which defines the complete structure of the audit system configuration. The interface includes nested configurations for various system components, ensuring type safety and comprehensive documentation.

The configuration types define a hierarchical structure that covers all aspects of the audit system, from database and Redis connections to server settings, worker configurations, security policies, and compliance requirements.

```mermaid
classDiagram
class AuditConfig {
+environment : Environment
+version : string
+lastUpdated : string
+redis : RedisConfig
+database : DatabaseConfig
+enhancedClient : EnhancedClientConfig
+server : ServerConfig
+worker : WorkerConfig
+retry : RetryConfig
+reliableProcessor : ReliableProcessorConfig
+monitoring : MonitoringConfig
+security : SecurityConfig
+compliance : ComplianceConfig
+validation : ValidationConfig
+archive : ArchiveConfig
+logging : LoggingConfig
}
class RedisConfig {
+url : string
+connectTimeout : number
+commandTimeout : number
+maxRetriesPerRequest : number | null
+retryDelayOnFailover : number
+enableOfflineQueue : boolean
+enableAutoPipelining : boolean
}
class DatabaseConfig {
+url : string
+poolSize : number
+connectionTimeout : number
+queryTimeout : number
+ssl : boolean
+maxConnectionAttempts : number
}
class ServerConfig {
+port : number
+host : string
+environment : Environment
+timeout : number
+cors : CorsConfig
+rateLimit : RateLimitConfig
+auth : AuthConfig
+monitoring : ServerMonitoringConfig
+security : ServerSecurityConfig
+performance : PerformanceConfig
+api : ApiConfig
+externalServices : ExternalServicesConfig
}
class WorkerConfig {
+concurrency : number
+queueName : string
+port : number
+gracefulShutdown : boolean
+shutdownTimeout : number
}
class SecurityConfig {
+enableIntegrityVerification : boolean
+hashAlgorithm : 'SHA-256'
+enableEventSigning : boolean
+encryptionKey : string
+enableLogEncryption : boolean
}
class ComplianceConfig {
+hipaa : HIPAAConfig
+gdpr : GDPRConfig
+defaultRetentionDays : number
+defaultDataClassification : DataClassification
+generateHash : boolean
+generateSignature : boolean
+enableAutoArchival : boolean
+enablePseudonymization : boolean
+reportingSchedule : ReportingScheduleConfig
}
AuditConfig --> RedisConfig
AuditConfig --> DatabaseConfig
AuditConfig --> ServerConfig
AuditConfig --> WorkerConfig
AuditConfig --> SecurityConfig
AuditConfig --> ComplianceConfig
```

**Diagram sources**
- [types.ts](file://packages\audit\src\config\types.ts#L1-L712)

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L1-L712)

## Factory Creation Workflow
The configuration factory follows a hierarchical creation workflow that starts with environment-specific base configurations and allows for merging and customization. The workflow ensures that configurations are validated and properly bootstrapped before being used by the system.

The creation process begins with the selection of an environment profile, which provides sensible defaults for that environment. The factory then allows for merging with custom configurations, ensuring that environment-specific requirements are maintained while allowing for necessary overrides.

```mermaid
sequenceDiagram
participant User as "Application Code"
participant Factory as "ConfigurationFactory"
participant Validator as "ConfigValidator"
participant Manager as "ConfigurationManager"
participant PresetHandler as "DatabasePresetHandler"
User->>Factory : createConfigForEnvironment(env)
alt Development Environment
Factory->>Factory : createDevelopmentConfig()
Factory->>Factory : Apply environment variables
Factory->>Factory : Set development defaults
else Staging Environment
Factory->>Factory : createStagingConfig()
Factory->>Factory : Extend development config
Factory->>Factory : Apply staging optimizations
else Production Environment
Factory->>Factory : createProductionConfig()
Factory->>Factory : Extend staging config
Factory->>Factory : Apply production security
else Test Environment
Factory->>Factory : createTestConfig()
Factory->>Factory : Extend development config
Factory->>Factory : Apply test constraints
end
Factory->>Validator : validateConfiguration(config)
Validator-->>Factory : Validation results
alt Validation Failed
Factory-->>User : Throw validation error
else Validation Passed
Factory-->>User : Return validated config
User->>PresetHandler : createDatabasePresetHandler(auditDbInstance)
PresetHandler-->>User : Return preset handler
User->>Manager : initializeConfig(config, presetHandler)
Manager->>Validator : validateConfiguration(config)
Manager->>Manager : Load configuration
Manager->>Manager : Start hot reloading (if enabled)
Manager-->>User : Initialized manager
end
```

**Diagram sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

## Environment-Specific Configuration Profiles
The factory provides four distinct configuration profiles tailored to different deployment scenarios: development, staging, production, and test. Each profile inherits from the previous one, creating a hierarchy of increasing strictness and optimization.

The environment-specific profiles ensure that appropriate defaults are applied based on the deployment context, from relaxed settings in development to stringent security requirements in production.

### Development Configuration
The development configuration profile provides permissive settings optimized for local development and debugging. It includes features like verbose logging, relaxed security, and accessible endpoints to facilitate rapid development.

```typescript
export function createDevelopmentConfig(): AuditConfig {
	return {
		environment: 'development',
		version: '1.0.0',
		lastUpdated: new Date().toISOString(),
		redis: {
			url: process.env.REDIS_URL || 'redis://localhost:6379',
			connectTimeout: 10000,
			commandTimeout: 10000,
			maxRetriesPerRequest: null,
			retryDelayOnFailover: 100,
			enableOfflineQueue: true,
			enableAutoPipelining: true,
		},
		database: {
			url: process.env.AUDIT_DB_URL || 'postgresql://localhost:5432/audit_dev',
			poolSize: 10,
			connectionTimeout: 10000,
			queryTimeout: 30000,
			ssl: false,
			maxConnectionAttempts: 3,
		},
		server: {
			port: 3000,
			host: '0.0.0.0',
			environment: 'development',
			timeout: 30000,
			cors: {
				origin: '*',
				credentials: true,
				allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: [
					'Content-Type',
					'Authorization',
					'x-application',
					'x-requestid',
					'x-version',
				],
			},
			logging: {
				level: 'debug',
				structured: true,
				format: 'json',
				enableCorrelationIds: true,
				retentionDays: 30,
			},
		},
		// ... other configuration properties
	}
}
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L15-L150)

### Staging Configuration
The staging configuration extends the development profile with more restrictive settings that mirror production. It includes enhanced security, performance monitoring, and compliance features to validate the system before production deployment.

```typescript
export function createStagingConfig(): AuditConfig {
	const baseConfig = createDevelopmentConfig()

	return {
		...baseConfig,
		environment: 'staging',
		redis: {
			...baseConfig.redis,
			url: process.env.REDIS_URL || 'redis://redis-staging:6379',
		},
		database: {
			...baseConfig.database,
			url: process.env.AUDIT_DB_URL || 'postgresql://postgres-staging:5432/audit_staging',
			ssl: true,
			poolSize: 15,
		},
		security: {
			...baseConfig.security,
			enableEventSigning: true,
			enableLogEncryption: true,
		},
		logging: {
			...baseConfig.logging,
			level: 'info',
			retentionDays: 90,
		},
		// ... other configuration properties
	}
}
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L152-L350)

### Production Configuration
The production configuration extends the staging profile with the most stringent security and performance settings. It includes production-grade security requirements, optimized performance parameters, and strict compliance policies.

```typescript
export function createProductionConfig(): AuditConfig {
	const baseConfig = createStagingConfig()

	return {
		...baseConfig,
		environment: 'production',
		redis: {
			...baseConfig.redis,
			url: process.env.REDIS_URL || 'rediss://redis-prod:6380',
			connectTimeout: 5000,
			commandTimeout: 3000,
			maxRetriesPerRequest: 5,
		},
		database: {
			...baseConfig.database,
			url: process.env.AUDIT_DB_URL || 'postgresql://postgres-prod:5432/audit_prod',
			ssl: true,
			poolSize: 25,
			connectionTimeout: 5000,
			queryTimeout: 60000,
			maxConnectionAttempts: 5,
		},
		security: {
			...baseConfig.security,
			enableIntegrityVerification: true,
			hashAlgorithm: 'SHA-256',
			enableEventSigning: true,
			enableLogEncryption: true,
		},
		logging: {
			...baseConfig.logging,
			level: 'warn',
			retentionDays: 365,
		},
		// ... other configuration properties
	}
}
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L352-L550)

### Test Configuration
The test configuration extends the development profile with settings optimized for automated testing. It includes reduced timeouts, minimal logging, and disabled monitoring to ensure fast test execution and predictable behavior.

```typescript
export function createTestConfig(): AuditConfig {
	const baseConfig = createDevelopmentConfig()

	return {
		...baseConfig,
		environment: 'test',
		monitoring: {
			...baseConfig.monitoring,
			enabled: false,
			metricsInterval: 60000,
			healthCheckInterval: 60000,
		},
		security: {
			...baseConfig.security,
			enableIntegrityVerification: false,
			enableEventSigning: false,
			enableLogEncryption: false,
		},
		compliance: {
			...baseConfig.compliance,
			defaultRetentionDays: 1,
			enableAutoArchival: false,
			enablePseudonymization: false,
		},
		logging: {
			...baseConfig.logging,
			level: 'error',
			retentionDays: 1,
		},
		// ... other configuration properties
	}
}
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L552-L700)

## Configuration Validation Pipeline
The configuration validation system provides comprehensive validation for audit system configurations, ensuring that all settings meet required constraints before the system is initialized. The validation pipeline executes during configuration creation and instantiation, preventing invalid configurations from being used.

The validation system uses a schema-based approach with field-specific rules for type checking, range validation, pattern matching, and custom validation logic. It also includes cross-field validation to ensure consistency between related configuration parameters.

```mermaid
flowchart TD
Start([Configuration Creation]) --> SchemaValidation["Apply Schema Validation"]
SchemaValidation --> FieldValidation["Validate Individual Fields"]
FieldValidation --> TypeCheck{"Type Valid?"}
TypeCheck --> |No| ValidationError["Throw Type Error"]
TypeCheck --> |Yes| RangeCheck{"Range Valid?"}
RangeCheck --> |No| ValidationError
RangeCheck --> |Yes| PatternCheck{"Pattern Valid?"}
PatternCheck --> |No| ValidationError
PatternCheck --> |Yes| EnumCheck{"Enum Valid?"}
EnumCheck --> |No| ValidationError
EnumCheck --> |Yes| CustomValidation["Execute Custom Validation"]
CustomValidation --> CustomValid{"Custom Valid?"}
CustomValid --> |No| ValidationError
CustomValid --> |Yes| CrossFieldValidation["Execute Cross-Field Validation"]
CrossFieldValidation --> CrossValid{"Cross-Field Valid?"}
CrossValid --> |No| ValidationError
CrossValid --> |Yes| EnvironmentValidation["Execute Environment-Specific Validation"]
EnvironmentValidation --> EnvValid{"Environment Rules Valid?"}
EnvValid --> |No| ValidationError
EnvValid --> |Yes| Success["Configuration Validated"]
ValidationError --> End([Error Handling])
Success --> End
style ValidationError fill:#f9f,stroke:#333,stroke-width:2px
style Success fill:#bbf,stroke:#333,stroke-width:2px
```

**Diagram sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)

**Section sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L1-L658)

## Configuration Manager Integration
The Configuration Factory Pattern integrates closely with the ConfigurationManager to provide a complete configuration lifecycle management system. The manager handles configuration loading, validation, hot-reloading, and secure storage, while the factory provides the initial configuration templates.

The integration between the factory and manager ensures that configurations are properly validated, persisted, and monitored throughout their lifecycle, providing a robust foundation for the audit system.

```mermaid
sequenceDiagram
participant App as "Application"
participant Factory as "ConfigurationFactory"
participant Manager as "ConfigurationManager"
participant Validator as "ConfigValidator"
participant Storage as "File/S3 Storage"
App->>Factory : createConfigForEnvironment('production')
Factory->>Factory : Create production config with defaults
Factory->>Validator : validateConfiguration(config)
Validator-->>Factory : Validation successful
Factory-->>App : Return validated config
App->>Manager : initializeConfig(config, '/path/to/config.json')
Manager->>Manager : Initialize encryption (if enabled)
Manager->>Manager : Initialize S3 client (if storage type is S3)
Manager->>Storage : Save configuration
Storage-->>Manager : Save confirmation
Manager->>Validator : validateConfiguration(config)
Validator-->>Manager : Validation successful
Manager->>Manager : Start hot reloading (if enabled)
Manager->>Manager : Initialize database connection
Manager-->>App : Configuration manager initialized
App->>Manager : updateConfig('server.port', 4000, 'admin', 'Change port')
Manager->>Manager : Validate updated configuration
Manager->>Storage : Save updated configuration
Manager->>Manager : Emit configChanged event
Manager->>Manager : Check if field is hot-reloadable
Manager->>Manager : Emit hotReload event (if applicable)
Manager-->>App : Update successful
```

**Diagram sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L1-L938)
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)

## Factory Usage Examples
The Configuration Factory Pattern provides several practical usage patterns for initializing audit systems with custom configurations. These examples demonstrate how to use the factory in different scenarios, from simple environment-based initialization to complex configuration merging.

### Basic Environment-Based Initialization
The simplest usage pattern is to create a configuration based on the current environment, which automatically applies appropriate defaults.

```typescript
import { createConfigForEnvironment } from '@smart-logs/audit/config/factory'
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Initialize configuration based on environment
const environment = process.env.NODE_ENV || 'development'
const config = createConfigForEnvironment(environment)
const configManager = await initializeConfig(config, './config/audit.json')

// Use the configuration
const serverPort = configManager.getConfigValue<number>('server.port')
console.log(`Server will run on port ${serverPort}`)
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L702-L725)
- [manager.ts](file://packages\audit\src\config\manager.ts#L814-L872)

### Custom Configuration with Merging
For scenarios requiring custom settings while maintaining environment-specific defaults, the factory provides a merge configuration function.

```typescript
import { 
  createConfigForEnvironment, 
  mergeConfigurations 
} from '@smart-logs/audit/config/factory'
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Create base configuration for production
const baseConfig = createConfigForEnvironment('production')

// Define custom overrides
const customConfig = {
  server: {
    port: 8080,
    cors: {
      origin: ['https://myapp.com', 'https://admin.myapp.com']
    }
  },
  logging: {
    level: 'info',
    retentionDays: 180
  },
  compliance: {
    reportingSchedule: {
      enabled: true,
      frequency: 'daily',
      recipients: ['compliance@mycompany.com']
    }
  }
}

// Merge configurations with override precedence
const finalConfig = mergeConfigurations(baseConfig, customConfig)
const configManager = await initializeConfig(finalConfig, './config/audit.json')
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L727-L750)

### Minimal Configuration for Testing
For testing scenarios, the factory provides a minimal configuration function that includes only required fields.

```typescript
import { createMinimalConfig } from '@smart-logs/audit/config/factory'
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Create minimal configuration for testing
const minimalConfig = createMinimalConfig('test')
const configManager = await initializeConfig(minimalConfig, './config/test.json')

// The minimal configuration includes only essential fields
// while allowing the system to function for testing purposes
console.log('Minimal config created with environment:', minimalConfig.environment)
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L600-L650)

### Dynamic Configuration Updates
The configuration manager allows for dynamic updates to the configuration at runtime, with proper validation and change tracking.

```typescript
import { createConfigForEnvironment } from '@smart-logs/audit/config/factory'
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Initialize configuration
const config = createConfigForEnvironment('production')
const configManager = await initializeConfig(config, './config/audit.json')

// Listen for configuration changes
configManager.on('configChanged', (changeEvent) => {
  console.log(`Configuration changed: ${changeEvent.field}`)
  console.log(`Previous value: ${changeEvent.previousValue}`)
  console.log(`New value: ${changeEvent.newValue}`)
  console.log(`Changed by: ${changeEvent.changedBy}`)
})

// Update configuration dynamically
await configManager.updateConfig(
  'server.rateLimit.maxRequests', 
  200, 
  'system', 
  'Increase rate limit for high traffic period'
)

// The change is validated, persisted, and events are emitted
console.log('Rate limit updated successfully')
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L200-L300)

## Advanced Configuration Patterns
The Configuration Factory Pattern supports several advanced patterns for complex deployment scenarios, including secure configuration storage, hot-reloading, and multi-environment deployment strategies.

### Secure Configuration Storage
The configuration system supports secure storage of configuration files using encryption, protecting sensitive information like database credentials and encryption keys.

```typescript
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Initialize configuration manager with secure storage
const secureStorageConfig = {
  enabled: true,
  algorithm: 'AES-256-GCM',
  kdf: 'PBKDF2',
  salt: process.env.AUDIT_CONFIG_SALT || 'your-salt-here',
  iterations: 100000,
}

const configManager = await initializeConfig(
  './config/audit.json',
  'file',
  undefined,
  secureStorageConfig
)

// The configuration file is encrypted when saved and decrypted when loaded
// protecting sensitive information at rest
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L100-L150)

### Configuration Hot-Reloading
The system supports hot-reloading of configuration files, allowing changes to be applied without restarting the application.

```typescript
import { initializeConfig } from '@smart-logs/audit/config/manager'

// Initialize configuration manager with hot-reloading
const hotReloadConfig = {
  enabled: true,
  reloadableFields: [
    'server.rateLimit.maxRequests',
    'server.rateLimit.windowMs',
    'monitoring.alertThresholds.errorRate',
    'monitoring.alertThresholds.processingLatency'
  ],
  checkInterval: 10000, // Check every 10 seconds
}

const configManager = await initializeConfig(
  './config/audit.json',
  'file',
  hotReloadConfig
)

// Listen for hot-reload events
configManager.on('hotReload', (event) => {
  console.log(`Hot-reload applied: ${event.path}`)
  console.log(`New value: ${event.newValue}`)
  
  // Apply runtime changes based on the updated configuration
  if (event.path === 'server.rateLimit.maxRequests') {
    // Update rate limiter with new value
    rateLimiter.updateMaxRequests(event.newValue)
  }
})
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L500-L600)

## Error Handling and Validation
The configuration system implements comprehensive error handling and validation to ensure that invalid configurations are caught early and provide meaningful error messages.

### Validation Error Handling
The validation system aggregates all validation errors and provides detailed information about each failure, making it easier to diagnose configuration issues.

```typescript
import { validateConfiguration } from '@smart-logs/audit/config/validator'

try {
  await validateConfiguration(config)
  console.log('Configuration is valid')
} catch (error) {
  if (error instanceof Error) {
    console.error('Configuration validation failed:')
    console.error(error.message)
    
    // Extract individual validation errors from the message
    const validationErrors = error.message
      .replace('Configuration validation failed: ', '')
      .split('; ')
      .map(err => {
        const [field, ...rest] = err.split(': ')
        return {
          field,
          message: rest.join(': ')
        }
      })
    
    validationErrors.forEach(err => {
      console.error(`- ${err.field}: ${err.message}`)
    })
  }
}
```

**Section sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L100-L200)

### Environment-Specific Validation Rules
The validation system includes environment-specific rules that enforce stricter requirements in production environments.

```typescript
function validateCrossFieldConstraints(config: AuditConfig): void {
  // Environment-specific validations
  if (config.environment === 'production') {
    if (!config.security.enableIntegrityVerification) {
      throw new ConfigValidationError(
        'security.enableIntegrityVerification must be true in production',
        'security.enableIntegrityVerification',
        config.security.enableIntegrityVerification,
        'production-required'
      )
    }

    if (!config.database.ssl) {
      throw new ConfigValidationError(
        'database.ssl must be true in production',
        'database.ssl',
        config.database.ssl,
        'production-required'
      )
    }

    if (config.logging.level === 'debug') {
      throw new ConfigValidationError(
        'logging.level should not be debug in production',
        'logging.level',
        config.logging.level,
        'production-constraint'
      )
    }
  }
}
```

**Section sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L500-L550)

## Extension Points and Customization
The Configuration Factory Pattern provides several extension points for customizing the configuration system to meet specific requirements.

### Custom Configuration Factories
Applications can extend the factory pattern to create custom configuration profiles for specialized deployment scenarios.

```typescript
// Custom factory for high-availability environments
function createHighAvailabilityConfig(): AuditConfig {
  const baseConfig = createProductionConfig()
  
  return {
    ...baseConfig,
    database: {
      ...baseConfig.database,
      url: process.env.AUDIT_DB_URL || 'postgresql://cluster-primary:5432/audit_prod',
      readReplica: {
        url: process.env.AUDIT_DB_READ_REPLICA_URL || 'postgresql://cluster-secondary:5432/audit_prod',
        poolSize: 10,
      }
    },
    reliableProcessor: {
      ...baseConfig.reliableProcessor,
      retryConfig: {
        ...baseConfig.reliableProcessor.retryConfig,
        maxRetries: 10,
        baseDelay: 5000,
      },
      circuitBreakerConfig: {
        ...baseConfig.reliableProcessor.circuitBreakerConfig,
        failureThreshold: 2,
        recoveryTimeout: 120000,
      }
    },
    monitoring: {
      ...baseConfig.monitoring,
      alertThresholds: {
        ...baseConfig.monitoring.alertThresholds,
        errorRate: 0.005,
        processingLatency: 1000,
      }
    }
  }
}
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)

### Integration with Dependency Injection Containers
The configuration system can be integrated with dependency injection containers to provide configuration-driven service instantiation.

```typescript
// Example with a hypothetical DI container
import { Container } from 'inversify'
import { createConfigForEnvironment } from '@smart-logs/audit/config/factory'

// Create container
const container = new Container()

// Register configuration
const config = createConfigForEnvironment(process.env.NODE_ENV || 'development')
container.bind<AuditConfig>('AuditConfig').toConstantValue(config)

// Register services that depend on configuration
container.bind<DatabaseService>('DatabaseService').toDynamicValue((context) => {
  const config = context.container.get<AuditConfig>('AuditConfig')
  return new DatabaseService(config.database.url, config.database.poolSize)
})

// Register monitoring service
container.bind<MonitoringService>('MonitoringService').toDynamicValue((context) => {
  const config = context.container.get<AuditConfig>('AuditConfig')
  return new MonitoringService({
    enabled: config.monitoring.enabled,
    metricsInterval: config.monitoring.metricsInterval,
    alertThresholds: config.monitoring.alertThresholds
  })
})
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L1-L799)
- [index.ts](file://packages\audit\src\index.ts#L1-L73)

## Database Preset Handler Integration
The Configuration Factory Pattern now integrates with the DatabasePresetHandler to provide database-backed preset management for audit configurations. This integration allows the factory to create and inject preset handlers that retrieve configuration presets from the database with organization-specific overrides and default fallbacks.

### DatabasePresetHandler Implementation
The DatabasePresetHandler class implements the PresetHandler interface and provides methods for managing audit presets stored in the database. It uses the EnhancedAuditDatabaseClient to execute optimized queries with caching for improved performance.

```mermaid
classDiagram
class DatabasePresetHandler {
+getPresets(organizationId? : string) : Promise<(AuditPreset & { id? : string })[]>
+getPreset(name : string, organizationId? : string) : Promise<(AuditPreset & { id? : string }) | null>
+createPreset(preset : AuditPreset & { createdBy : string }) : Promise<AuditPreset & { id? : string }>
+updatePreset(preset : AuditPreset & { id : string; updatedBy : string }) : Promise<AuditPreset & { id? : string }>
+deletePreset(name : string, organizationId : string) : Promise<{ success : true }>
}
class PresetHandler {
<<interface>>
+getPresets(organizationId? : string) : Promise<(AuditPreset & { id? : string })[]>
+getPreset(name : string, organizationId? : string) : Promise<(AuditPreset & { id? : string }) | null>
+createPreset(preset : AuditPreset & { createdBy : string }) : Promise<AuditPreset & { id? : string }>
+updatePreset(preset : AuditPreset & { id : string; updatedBy : string }) : Promise<AuditPreset & { id? : string }>
+deletePreset(name : string, organizationId : string) : Promise<{ success : true }>
}
class EnhancedAuditDatabaseClient {
+executeOptimizedQuery(query : Function, options? : QueryOptions) : Promise<any>
+getDatabase() : PostgresJsDatabase
+getEnhancedClientInstance() : EnhancedAuditDatabaseClient
}
DatabasePresetHandler --> PresetHandler : "implements"
DatabasePresetHandler --> EnhancedAuditDatabaseClient : "uses"
```

**Diagram sources**
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

**Section sources**
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L1-L284)

### Factory Integration with Preset Handler
The configuration factory pattern now includes integration with the DatabasePresetHandler through the createDatabasePresetHandler factory function. This function creates a new instance of DatabasePresetHandler using an EnhancedAuditDb instance, allowing the audit system to access database-stored presets during initialization.

```typescript
/**
 * Factory function to create DatabasePresetHandler
 */
export function createDatabasePresetHandler(
	auditDbInstance: EnhancedAuditDb
): DatabasePresetHandler {
	return new DatabasePresetHandler(auditDbInstance)
}
```

The integration is demonstrated in the worker's index.ts file, where the preset handler is created and injected into the Audit service:

```typescript
// From apps/worker/src/index.ts
if (!presetDatabaseHandler) presetDatabaseHandler = createDatabasePresetHandler(auditDbService)

if (!audit) audit = new Audit(config, presetDatabaseHandler, connection)
```

This pattern allows for dependency injection of the preset handler while maintaining separation of concerns between configuration management and preset retrieval.

**Section sources**
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L275-L284)
- [index.ts](file://apps\worker\src\index.ts#L300-L310)

### Preset Retrieval Workflow
The DatabasePresetHandler implements a sophisticated workflow for retrieving presets with organization-specific overrides and default fallbacks. When retrieving presets, it executes a single optimized query that fetches both organization-specific presets and default presets, then merges them with organization presets taking priority.

```mermaid
sequenceDiagram
participant Client as "Audit Service"
participant Handler as "DatabasePresetHandler"
participant Client as "EnhancedAuditDatabaseClient"
participant DB as "PostgreSQL"
Client->>Handler : getPresets(orgId)
Handler->>Client : executeOptimizedQuery()
Client->>DB : SELECT * FROM audit_preset WHERE organization_id IN (orgId, '*')
DB-->>Client : Return rows with priority
Client-->>Handler : Query result
Handler->>Handler : mergePresetsWithPriority(rows)
Handler-->>Client : Return merged presets
Note over Handler,DB : Single query with priority sorting<br/>ensures organization presets override defaults
```

The handler uses a CASE statement in the SQL query to assign priority to organization-specific presets, ensuring they take precedence over default presets with the same name:

```typescript
const result = await this.client.executeOptimizedQuery(
	(db) =>
		db.execute(sql`
			SELECT *,
					 CASE WHEN organization_id = ${orgId} THEN 1 ELSE 0 END as priority
			FROM audit_preset
			WHERE organization_id IN (${orgId}, '*')
			ORDER BY name, priority DESC
		`),
	{ cacheKey: `get_merged_presets_${orgId}` }
)
```

**Section sources**
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L30-L60)

### Dependency Injection Pattern
The integration between the Configuration Factory and DatabasePresetHandler follows a dependency injection pattern where the factory-created configuration is used to initialize services that depend on both the configuration and the preset handler.

```typescript
// Example of complete initialization workflow
async function initializeAuditSystem() {
	// 1. Create configuration using factory
	const config = createConfigForEnvironment(process.env.NODE_ENV || 'development')
	
	// 2. Initialize database connection
	const auditDbInstance = new EnhancedAuditDb(connection, config.enhancedClient)
	
	// 3. Create preset handler using factory function
	const presetHandler = createDatabasePresetHandler(auditDbInstance)
	
	// 4. Initialize audit service with configuration and preset handler
	const audit = new Audit(config, presetHandler, connection)
	
	return audit
}
```

This pattern ensures that the Audit service receives both the environment-specific configuration from the factory and the database-backed preset handler, enabling comprehensive audit event processing with customizable presets.

**Section sources**
- [database-preset-handler.ts](file://packages\audit\src\preset\database-preset-handler.ts#L275-L284)
- [factory.ts](file://packages\audit\src\config\factory.ts#L702-L725)