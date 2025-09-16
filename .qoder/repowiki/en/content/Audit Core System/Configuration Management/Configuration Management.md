# Configuration Management

<cite>
**Referenced Files in This Document**   
- [manager.ts](file://packages\audit\src\config\manager.ts) - *Updated in recent commit*
- [types.ts](file://packages\audit\src\config\types.ts) - *Updated in recent commit*
- [validator.ts](file://packages\audit\src\config\validator.ts) - *Updated in recent commit*
- [factory.ts](file://packages\audit\src\config\factory.ts)
- [api-reference.md](file://apps\docs\src\content\docs\audit\api-reference.md)
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts) - *Added GDPR pseudonymization features*
- [gdpr-utils.ts](file://packages\audit\src\gdpr\gdpr-utils.ts) - *Added GDPR utility functions*
- [audit-client/src/infrastructure/plugins/utils.ts](file://packages\audit-client\src\infrastructure\plugins\utils.ts) - *Added plugin architecture*
</cite>

## Update Summary
**Changes Made**   
- Updated documentation to reflect the centralized documentation approach
- Removed outdated references to README content that has been moved to the documentation site
- Updated configuration guide references to point to the new documentation structure
- Maintained all technical details about configuration options and implementation
- Updated file references to reflect the new documentation location

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Manager Design](#configuration-manager-design)
3. [Configuration Schema and Options](#configuration-schema-and-options)
4. [Hierarchical Configuration Loading](#hierarchical-configuration-loading)
5. [Environment-Specific Configuration](#environment-specific-configuration)
6. [Runtime Reconfiguration and Hot Reloading](#runtime-reconfiguration-and-hot-reloading)
7. [Configuration Validation](#configuration-validation)
8. [Secure Configuration Storage](#secure-configuration-storage)
9. [Integration with Subsystems](#integration-with-subsystems)
10. [Configuration Initialization Patterns](#configuration-initialization-patterns)
11. [Common Configuration Errors](#common-configuration-errors)
12. [Extending the Configuration Schema](#extending-the-configuration-schema)
13. [Plugin Architecture](#plugin-architecture)
14. [GDPR Pseudonymization Configuration](#gdpr-pseudonymization-configuration)

## Introduction
The Configuration Management system provides a comprehensive solution for managing application settings across different environments. It supports hierarchical configuration loading, environment-specific overrides, runtime reconfiguration, and secure storage. The system is designed to handle complex configuration needs for audit logging, database connections, retention policies, compliance requirements, and integration endpoints. This document details the design and implementation of the Config Manager class, its integration with various subsystems, and best practices for configuration management.

## Configuration Manager Design

The ConfigurationManager class implements a robust configuration management system with support for hot-reloading, versioning, and secure storage. It extends EventEmitter to provide event-driven notifications for configuration changes and initialization events.

```mermaid
classDiagram
class ConfigurationManager {
-db : PostgresJsDatabase
-s3 : S3Client
-config : AuditConfig
-configPath : string
-storageType : StorageType
-hotReloadConfig : HotReloadConfig
-secureStorageConfig : SecureStorageConfig
-watcherActive : boolean
-encryptionKey : Buffer
-bucket : string
+initialize() : Promise~void~
+getConfig() : AuditConfig
+getEnvironment() : Environment
+isProduction() : boolean
+isDevelopment() : boolean
+isTest() : boolean
+getConfigValue~T~(path : string) : T
+updateConfig(path : string, newValue : any, changedBy : string, reason? : string) : Promise~void~
+getChangeHistory(limit? : number) : Promise~ConfigChangeEvent[]~
+getVersion() : string
+reloadConfiguration() : Promise~void~
+validateCurrentConfig() : Promise~void~
+toJSON() : string
+exportConfig(includeSensitive : boolean) : Partial~AuditConfig~
+shutdown() : Promise~void~
}
class ConfigurationManager "extends" EventEmitter
ConfigurationManager --> AuditConfig : "manages"
ConfigurationManager --> ConfigChangeEvent : "emits"
ConfigurationManager --> EventEmitter : "extends"
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)

## Configuration Schema and Options

The configuration schema is defined through TypeScript interfaces that provide type safety and comprehensive documentation for all configuration options. The AuditConfig interface serves as the root configuration object, containing nested configurations for various subsystems.

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
+plugins : PluginConfig[]
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
+custom : ComplianceRule[]
}
class PluginConfig {
+name : string
+enabled : boolean
+config : Record<string, any>
+dependencies : string[]
+loadOrder : number
}
AuditConfig --> RedisConfig
AuditConfig --> DatabaseConfig
AuditConfig --> ServerConfig
AuditConfig --> ComplianceConfig
AuditConfig --> SecurityConfig
AuditConfig --> MonitoringConfig
AuditConfig --> LoggingConfig
AuditConfig --> PluginConfig
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L0-L682)

## Hierarchical Configuration Loading

The configuration manager supports multiple storage types and hierarchical loading from different sources. It can load configuration from local files or S3 storage, with optional encryption for secure storage.

```mermaid
sequenceDiagram
participant App as Application
participant ConfigManager as ConfigurationManager
participant Storage as Storage (File/S3)
participant Encryption as Encryption Service
App->>ConfigManager : initialize()
ConfigManager->>ConfigManager : detectEnvironment()
alt Secure Storage Enabled
ConfigManager->>Encryption : initializeEncryption()
Encryption-->>ConfigManager : encryptionKey
end
alt Storage Type S3
ConfigManager->>ConfigManager : initializeS3()
ConfigManager->>Storage : GetObject(configPath)
Storage-->>ConfigManager : encryptedConfig
else Storage Type File
ConfigManager->>Storage : readFile(configPath)
Storage-->>ConfigManager : configData
end
alt Secure Storage Enabled
ConfigManager->>Encryption : decryptConfigFile()
Encryption-->>ConfigManager : decryptedConfig
end
ConfigManager->>ConfigManager : validateConfiguration()
ConfigManager->>ConfigManager : setDefaults()
ConfigManager->>ConfigManager : initializeDatabase()
alt Hot Reload Enabled
ConfigManager->>ConfigManager : startHotReloading()
end
ConfigManager-->>App : initialized
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)

## Environment-Specific Configuration

The system provides factory functions for creating environment-specific configurations with appropriate defaults for development, staging, and production environments. These configurations inherit from a base configuration with environment-appropriate overrides.

```mermaid
classDiagram
class ConfigFactory {
+createDevelopmentConfig() : AuditConfig
+createStagingConfig() : AuditConfig
+createProductionConfig() : AuditConfig
}
class AuditConfig {
+environment : Environment
+version : string
+lastUpdated : string
}
ConfigFactory --> AuditConfig : "creates"
AuditConfig <|-- DevelopmentConfig : "extends"
AuditConfig <|-- StagingConfig : "extends"
AuditConfig <|-- ProductionConfig : "extends"
DevelopmentConfig : -Default values for development
DevelopmentConfig : -Local URLs
DevelopmentConfig : -Debug logging
DevelopmentConfig : -No SSL
StagingConfig : -Staging URLs
StagingConfig : -SSL enabled
StagingConfig : -Higher concurrency
StagingConfig : -Email reporting enabled
ProductionConfig : -Production URLs
-ProductionConfig : -Strict security
ProductionConfig : -High availability
ProductionConfig : -Compliance features
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L0-L751)

## Runtime Reconfiguration and Hot Reloading

The configuration manager supports runtime reconfiguration through the updateConfig method, which validates changes before applying them and records all changes in the database for audit purposes. It also supports hot reloading of configuration files when enabled.

```mermaid
sequenceDiagram
participant App as Application
participant ConfigManager as ConfigurationManager
participant DB as Database
participant Event as Event Listeners
App->>ConfigManager : updateConfig(path, newValue, changedBy, reason)
ConfigManager->>ConfigManager : validateNewConfiguration()
alt Validation Successful
ConfigManager->>ConfigManager : applyChange()
ConfigManager->>DB : INSERT config_change_event
DB-->>ConfigManager : success
ConfigManager->>ConfigManager : saveConfiguration()
ConfigManager->>ConfigManager : emit configChanged
ConfigManager->>Event : configChanged event
ConfigManager->>ConfigManager : checkHotReloadable()
alt Field is Hot Reloadable
ConfigManager->>Event : hotReload event
end
ConfigManager-->>App : success
else Validation Failed
ConfigManager-->>App : ConfigValidationError
end
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)

## Configuration Validation

The validation system ensures that all configuration values meet required constraints through a comprehensive schema with type checking, range validation, pattern matching, and custom validation functions. It also enforces cross-field constraints and environment-specific requirements.

```mermaid
flowchart TD
Start([Validate Configuration]) --> IterateFields["Iterate through all fields in schema"]
IterateFields --> GetField["Get field value by path"]
GetField --> CheckRequired{"Required?"}
CheckRequired --> |Yes| CheckNull{"Null/Undefined?"}
CheckNull --> |Yes| ThrowError["Throw ConfigValidationError"]
CheckRequired --> |No| CheckNull
CheckNull --> |No| CheckType["Validate type"]
CheckType --> TypeValid{"Type valid?"}
TypeValid --> |No| ThrowError
TypeValid --> |Yes| CheckRange["Validate numeric range"]
CheckRange --> RangeValid{"Within range?"}
RangeValid --> |No| ThrowError
RangeValid --> |Yes| CheckPattern["Validate pattern"]
CheckPattern --> PatternValid{"Matches pattern?"}
PatternValid --> |No| ThrowError
PatternValid --> |Yes| CheckEnum["Validate enum"]
CheckEnum --> EnumValid{"Valid value?"}
EnumValid --> |No| ThrowError
EnumValid --> |Yes| CheckCustom["Run custom validation"]
CheckCustom --> CustomValid{"Custom validation passed?"}
CustomValid --> |No| ThrowError
CustomValid --> |Yes| NextField["Next field"]
NextField --> IterateFields
IterateFields --> AllFields{"All fields processed?"}
AllFields --> |Yes| CrossValidation["Run cross-field validation"]
CrossValidation --> CrossValid{"Cross-validation passed?"}
CrossValid --> |No| ThrowError
CrossValid --> |Yes| Success["Configuration valid"]
ThrowError --> CollectErrors["Collect error"]
CollectErrors --> AllFields
Success --> End([Validation complete])
```

**Section sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L0-L659)

## Secure Configuration Storage

The configuration manager supports secure storage of configuration files through encryption using AES-256-GCM or AES-256-CBC algorithms with PBKDF2 or scrypt key derivation. This ensures that sensitive configuration data is protected at rest.

```mermaid
sequenceDiagram
participant App as Application
participant ConfigManager as ConfigurationManager
participant Encryption as Crypto Module
participant Storage as Storage (File/S3)
App->>ConfigManager : initialize() with secureStorageConfig
ConfigManager->>ConfigManager : initializeEncryption()
ConfigManager->>Encryption : pbkdf2/scrypt(password, salt)
Encryption-->>ConfigManager : encryptionKey
ConfigManager->>ConfigManager : loadConfiguration()
alt Secure Storage Enabled
ConfigManager->>Storage : Read encrypted config
Storage-->>ConfigManager : encryptedData
ConfigManager->>Encryption : createDecipheriv()
Encryption->>Encryption : setAuthTag() if GCM
Encryption->>Encryption : decrypt data
Encryption-->>ConfigManager : decrypted config
ConfigManager->>ConfigManager : parse JSON
else Secure Storage Disabled
ConfigManager->>Storage : Read config file
Storage-->>ConfigManager : configData
end
ConfigManager-->>App : configuration loaded
```

**Section sources**
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)

## Integration with Subsystems

The configuration system integrates with various subsystems including archival, monitoring, and GDPR compliance. It provides configuration options that directly affect the behavior of these subsystems and enables runtime reconfiguration of their settings.

```mermaid
graph TD
ConfigurationManager --> Archival
ConfigurationManager --> Monitoring
ConfigurationManager --> GDPRCompliance
ConfigurationManager --> Database
ConfigurationManager --> Redis
ConfigurationManager --> Security
ConfigurationManager --> PluginSystem
subgraph Archival
A1[Archive Configuration]
A2[Compression Settings]
A3[Batch Size]
A4[Integrity Verification]
end
subgraph Monitoring
M1[Metrics Collection]
M2[Alert Thresholds]
M3[Health Checks]
M4[Performance Monitoring]
end
subgraph GDPRCompliance
G1[Data Retention]
G2[Pseudonymization]
G3[Reporting Schedule]
G4[Legal Basis]
end
subgraph PluginSystem
P1[Plugin Registration]
P2[Dependency Management]
P3[Lifecycle Hooks]
P4[Configuration Validation]
end
ConfigurationManager --> A1
ConfigurationManager --> M1
ConfigurationManager --> G1
ConfigurationManager --> P1
ConfigurationManager --> Database
ConfigurationManager --> Redis
ConfigurationManager --> Security
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L0-L682)
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L0-L600)

## Configuration Initialization Patterns

The system provides multiple patterns for configuration initialization, including factory functions for environment-specific defaults and utility functions for creating and retrieving configuration manager instances.

```mermaid
sequenceDiagram
participant App as Application
participant Factory as ConfigFactory
participant Manager as ConfigurationManager
participant Default as DefaultManager
App->>Factory : createDevelopmentConfig()
Factory-->>App : AuditConfig object
App->>Manager : new ConfigurationManager(configPath, storageType, hotReloadConfig, secureStorageConfig)
Manager->>Default : defaultManager = null?
Default-->>Manager : yes
Manager->>Manager : store as defaultManager
Manager-->>App : ConfigurationManager instance
App->>Manager : initializeConfig(configPath, storageType, hotReloadConfig, secureStorageConfig)
Manager->>Manager : getConfigurationManager()
Manager->>Manager : initialize()
Manager-->>App : initialized ConfigurationManager
App->>Manager : getConfigurationManager()
Manager->>Default : return defaultManager
Manager-->>App : existing instance
```

**Section sources**
- [factory.ts](file://packages\audit\src\config\factory.ts#L0-L751)
- [manager.ts](file://packages\audit\src\config\manager.ts#L0-L874)

## Common Configuration Errors

The validation system identifies and reports common configuration errors, including invalid types, out-of-range values, missing required fields, and environment-specific violations. These errors are aggregated and reported with detailed messages.

```mermaid
flowchart TD
Start([Configuration Error]) --> ErrorType{"Error Type"}
ErrorType --> RequiredError
ErrorType --> TypeError
ErrorType --> RangeError
ErrorType --> PatternError
ErrorType --> EnumError
ErrorType --> CustomError
ErrorType --> CrossFieldError
ErrorType --> EnvironmentError
RequiredError --> Message["Field is required"]
TypeError --> Message
RangeError --> Message
PatternError --> Message
EnumError --> Message
CustomError --> Message
CrossFieldError --> Message
EnvironmentError --> Message
Message --> Context["Field path, value, constraint"]
Context --> Aggregation["Aggregate all errors"]
Aggregation --> Report["Configuration validation failed: error1; error2; ..."]
Report --> Throw["Throw Error with aggregated message"]
```

**Section sources**
- [validator.ts](file://packages\audit\src\config\validator.ts#L0-L659)

## Extending the Configuration Schema

The configuration schema can be extended for custom deployments by adding new configuration sections or modifying existing ones. The system's modular design allows for easy extension while maintaining type safety and validation.

```mermaid
classDiagram
class AuditConfig {
+environment : Environment
+version : string
+lastUpdated : string
}
class CustomConfig {
+customFeature : boolean
+customEndpoint : string
+customTimeout : number
+customRetentionPolicy : string
}
class ExtendedAuditConfig {
+environment : Environment
+version : string
+lastUpdated : string
+custom : CustomConfig
}
AuditConfig <|-- ExtendedAuditConfig : "extends"
ExtendedAuditConfig --> CustomConfig : "contains"
class CustomValidator {
+validateCustomConfig(config : CustomConfig) : void
+getCustomValidationSchema() : Record~string, ValidationRule~
}
class CustomFactory {
+createCustomConfig() : ExtendedAuditConfig
+createCustomDevelopmentConfig() : ExtendedAuditConfig
+createCustomProductionConfig() : ExtendedAuditConfig
}
CustomValidator --> ExtendedAuditConfig : "validates"
CustomFactory --> ExtendedAuditConfig : "creates"
```

**Section sources**
- [types.ts](file://packages\audit\src\config\types.ts#L0-L682)
- [validator.ts](file://packages\audit\src\config\validator.ts#L0-L659)
- [factory.ts](file://packages\audit\src\config\factory.ts#L0-L751)

## Plugin Architecture

The configuration system now supports a comprehensive plugin architecture that allows for extensibility and customization. Plugins can be registered, configured, and managed through the configuration system, with support for dependency resolution and lifecycle management.

```mermaid
classDiagram
class PluginRegistry {
+plugins : Map<string, Plugin>
+register(plugin : Plugin, config : any) : Promise<void>
+unregister(pluginName : string) : Promise<void>
+getPlugin(pluginName : string) : Plugin | undefined
+hasPlugin(pluginName : string) : boolean
+getDependencies(pluginName : string) : string[]
+getDependents(pluginName : string) : string[]
}
class Plugin {
+name : string
+version : string
+description : string
+dependencies : string[]
+configSchema : ValidationSchema
+initialize(config : any) : Promise<void>
+shutdown() : Promise<void>
+validateConfig(config : any) : ValidationResult
}
class PluginConfig {
+name : string
+enabled : boolean
+config : Record<string, any>
+loadOrder : number
}
class ValidationResult {
+valid : boolean
+errors : string[]
}
PluginRegistry --> Plugin : "manages"
PluginRegistry --> PluginConfig : "uses"
Plugin --> ValidationResult : "returns"
PluginConfig --> Plugin : "configures"
```

**Section sources**
- [audit-client/src/infrastructure/plugins/utils.ts](file://packages\audit-client\src\infrastructure\plugins\utils.ts#L0-L500)
- [audit-client/src/infrastructure/plugins/index.ts](file://packages\audit-client\src\infrastructure\plugins\index.ts#L0-L11)

## GDPR Pseudonymization Configuration

The GDPR compliance system provides robust pseudonymization capabilities to support data protection requirements. The configuration enables different pseudonymization strategies and ensures referential integrity is maintained.

```mermaid
sequenceDiagram
participant App as Application
participant GDPRService as GDPRComplianceService
participant KMS as KMS Service
participant DB as Database
participant Audit as Audit System
App->>GDPRService : pseudonymizeUserData(principalId, strategy, requestedBy)
GDPRService->>GDPRService : generatePseudonymId(principalId, strategy)
alt Strategy is hash
GDPRService->>GDPRService : SHA-256(originalId + salt)
else Strategy is token
GDPRService->>GDPRService : randomBytes(16).toString('hex')
else Strategy is encryption
GDPRService->>KMS : encrypt(originalId)
KMS-->>GDPRService : encryptedId
end
GDPRService->>DB : Store pseudonym mapping
DB-->>GDPRService : success
GDPRService->>DB : Update audit logs with pseudonymId
DB-->>GDPRService : updateResult
GDPRService->>Audit : logGDPRActivity(pseudonymization)
Audit-->>GDPRService : logged
GDPRService-->>App : {pseudonymId, recordsAffected}
```

**Section sources**
- [gdpr-compliance.ts](file://packages\audit\src\gdpr\gdpr-compliance.ts#L192-L275)
- [gdpr-utils.ts](file://packages\audit\src\gdpr\gdpr-utils.ts#L0-L45)
- [types.ts](file://packages\audit\src\config\types.ts#L500-L550)