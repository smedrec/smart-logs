# Configuration Validation

<cite>
**Referenced Files in This Document**   
- [validator.ts](file://packages/audit/src/config/validator.ts) - *Updated in recent commit*
- [types.ts](file://packages/audit/src/config/types.ts) - *Updated in recent commit*
- [manager.ts](file://packages/audit/src/config/manager.ts) - *Updated in recent commit*
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts) - *Added in recent commit*
- [gdpr-utils.ts](file://packages/audit/src/gdpr/gdpr-utils.ts) - *Added in recent commit*
</cite>

## Update Summary
**Changes Made**   
- Added new section for Plugin Configuration Validation
- Added new section for GDPR Pseudonymization Configuration
- Updated Compliance Settings Rules to include pseudonymization strategy validation
- Added new custom validator functions for plugin and GDPR configurations
- Updated section sources to reflect new and modified files
- Enhanced troubleshooting section with new GDPR-related errors

## Table of Contents
1. [Introduction](#introduction)
2. [Configuration Validation Pipeline](#configuration-validation-pipeline)
3. [Validation Rules by Configuration Section](#validation-rules-by-configuration-section)
4. [Error Reporting and Startup Prevention](#error-reporting-and-startup-prevention)
5. [Schema Validation and Custom Validators](#schema-validation-and-custom-validators)
6. [Environment-Specific Rule Enforcement](#environment-specific-rule-enforcement)
7. [Secure Handling of Sensitive Data](#secure-handling-of-sensitive-data)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Common Validation Errors](#troubleshooting-common-validation-errors)

## Introduction
The Configuration Validation system ensures the integrity and correctness of the audit system's configuration before initialization. This document details the validation pipeline, rules for each configuration section, error reporting mechanisms, and how validation failures prevent system startup. The system uses a custom validation framework with comprehensive rules for database URLs, retention periods, compliance settings, integration credentials, plugin configurations, and GDPR pseudonymization settings. While Zod is used elsewhere in the repository for API request validation, this configuration system implements its own schema-based validation approach.

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts)
- [types.ts](file://packages/audit/src/config/types.ts)

## Configuration Validation Pipeline

The configuration validation pipeline executes a comprehensive series of checks before system initialization. The process begins when the `ConfigurationManager` initializes and loads the configuration file, triggering validation through the `validateConfiguration` function.

```mermaid
sequenceDiagram
participant System as System Initialization
participant Manager as ConfigurationManager
participant Validator as validateConfiguration
participant FieldValidator as validateField
participant CrossValidator as validateCrossFieldConstraints
System->>Manager : initialize()
Manager->>Manager : loadConfiguration()
Manager->>Validator : validateConfiguration(config)
loop For each field in schema
Validator->>FieldValidator : validateField(fieldPath, value, rule)
alt Validation Error
FieldValidator-->>Validator : throw ConfigValidationError
end
end
Validator->>CrossValidator : validateCrossFieldConstraints(config)
alt Cross-field Error
CrossValidator-->>Validator : throw ConfigValidationError
end
alt Validation Failures Exist
Validator-->>Manager : throw Error with aggregated messages
Manager-->>System : throw Error
System->>System : Prevent startup
else All Validations Pass
Validator-->>Manager : return void
Manager-->>Manager : Complete initialization
Manager-->>System : Return initialized manager
end
```

**Diagram sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L100-L150)
- [validator.ts](file://packages/audit/src/config/validator.ts#L396-L434)

**Section sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L100-L150)
- [validator.ts](file://packages/audit/src/config/validator.ts#L396-L434)

## Validation Rules by Configuration Section

### Database Configuration Rules
The database configuration validation ensures secure and performant database connections with proper URL formatting and connection parameters.

**:validationSchema['database.url']**
- **required**: true
- **type**: 'string'
- **custom**: Validates URL format with 'postgresql:' or 'postgres:' protocol

**:validationSchema['database.poolSize']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 100

**:validationSchema['database.connectionTimeout']**
- **required**: true
- **type**: 'number'
- **min**: 1000 (1 second)
- **max**: 60000 (60 seconds)

**:validationSchema['database.queryTimeout']**
- **required**: true
- **type**: 'number'
- **min**: 1000 (1 second)
- **max**: 300000 (5 minutes)

**:validationSchema['database.ssl']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['database.maxConnectionAttempts']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 10

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L180-L210)

### Retention Period Rules
Retention period validation ensures compliance with regulatory requirements and prevents excessive data storage.

**:validationSchema['logging.retentionDays']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 365 (1 year)

**:validationSchema['compliance.defaultRetentionDays']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 3650 (10 years)

**:validationSchema['reliableProcessor.deadLetterConfig.maxRetentionDays']**
- **required**: true
- **type**: 'number'
- **min**: 1 (1 day)
- **max**: 365 (1 year)

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L340-L350)

### Compliance Settings Rules
Compliance configuration validation ensures adherence to regulatory requirements like GDPR and HIPAA.

**:validationSchema['compliance.gdpr.enabled']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['compliance.enableAutoArchival']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['compliance.enablePseudonymization']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['compliance.pseudonymizationStrategy']**
- **required**: true
- **type**: 'string'
- **enum**: ['hash', 'token', 'encryption']

**:validationSchema['compliance.reportingSchedule.enabled']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['compliance.reportingSchedule.frequency']**
- **required**: true
- **type**: 'string'
- **enum**: ['daily', 'weekly', 'monthly']

**:validationSchema['compliance.reportingSchedule.recipients']**
- **required**: true
- **type**: 'array'
- **custom**: Validates array of valid email addresses

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L310-L340)
- [types.ts](file://packages/audit/src/config/types.ts#L300-L350)

### Integration Credentials Rules
Integration credentials validation ensures proper authentication and secure connections to external services.

**:validationSchema['redis.url']**
- **required**: true
- **type**: 'string'
- **custom**: Validates URL format with 'redis:' or 'rediss:' protocol

**:validationSchema['redis.connectTimeout']**
- **required**: true
- **type**: 'number'
- **min**: 1000 (1 second)
- **max**: 60000 (60 seconds)

**:validationSchema['redis.commandTimeout']**
- **required**: true
- **type**: 'number'
- **min**: 1000 (1 second)
- **max**: 60000 (60 seconds)

**:validationSchema['redis.retryDelayOnFailover']**
- **required**: true
- **type**: 'number'
- **min**: 100
- **max**: 10000 (10 seconds)

**:validationSchema['security.encryptionKey']**
- **required**: true
- **type**: 'string'
- **custom**: Validates encryption key is at least 32 characters

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L100-L150)

### Plugin Configuration Rules
Plugin configuration validation ensures proper plugin setup and integration with the audit system.

**:validationSchema['plugins.enabled']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['plugins.directory']**
- **required**: true
- **type**: 'string'
- **custom**: Validates directory path exists and is accessible

**:validationSchema['plugins.timeout']**
- **required**: true
- **type**: 'number'
- **min**: 1000 (1 second)
- **max**: 30000 (30 seconds)

**:validationSchema['plugins.maxConcurrent']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 50

**:validationSchema['plugins.retryAttempts']**
- **required**: true
- **type**: 'number'
- **min**: 0
- **max**: 5

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L450-L480)
- [types.ts](file://packages/audit/src/config/types.ts#L400-L450)

### GDPR Pseudonymization Rules
GDPR pseudonymization configuration validation ensures proper data privacy and compliance with GDPR requirements.

**:validationSchema['compliance.pseudonymization.salt']**
- **required**: true
- **type**: 'string'
- **min**: 32 characters

**:validationSchema['compliance.pseudonymization.algorithm']**
- **required**: true
- **type**: 'string'
- **enum**: ['SHA-256', 'SHA-512']

**:validationSchema['compliance.pseudonymization.mappingStorage']**
- **required**: true
- **type**: 'string'
- **enum**: ['database', 'encrypted-file']

**:validationSchema['compliance.pseudonymization.mappingRetentionDays']**
- **required**: true
- **type**: 'number'
- **min**: 1
- **max**: 730 (2 years)

**:validationSchema['compliance.pseudonymization.kms.enabled']**
- **required**: true
- **type**: 'boolean'

**:validationSchema['compliance.pseudonymization.kms.keyId']**
- **required**: true when kms.enabled is true
- **type**: 'string'

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L500-L550)
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts#L50-L100)
- [gdpr-utils.ts](file://packages/audit/src/gdpr/gdpr-utils.ts#L10-L50)

## Error Reporting and Startup Prevention

### Error Reporting Mechanism
The system implements a comprehensive error reporting mechanism that aggregates validation failures and provides detailed information for troubleshooting.

```mermaid
flowchart TD
Start([Validation Start]) --> FieldValidation["Validate Each Field"]
FieldValidation --> FieldError{"Field Invalid?"}
FieldError --> |Yes| CollectError["Collect ConfigValidationError"]
FieldError --> |No| NextField["Process Next Field"]
NextField --> FieldValidation
FieldValidation --> AllFieldsProcessed{"All Fields Processed?"}
AllFieldsProcessed --> |Yes| CrossValidation["Validate Cross-Field Constraints"]
CrossValidation --> CrossError{"Cross-Field Error?"}
CrossError --> |Yes| CollectError
CrossError --> |No| NoErrors{"Errors Exist?"}
CollectError --> NoErrors
NoErrors --> |Yes| AggregateErrors["Aggregate Error Messages"]
AggregateErrors --> FormatError["Format: field: message; field: message"]
FormatError --> ThrowError["Throw Error: Configuration validation failed: ..."]
NoErrors --> |No| Success["Validation Successful"]
Success --> End([Validation Complete])
ThrowError --> End
```

**Diagram sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L396-L434)

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L396-L434)

### Startup Prevention
Validation failures prevent system startup by throwing exceptions during the initialization phase. The `ConfigurationManager.initialize()` method calls `validateConfiguration()` during startup, and any validation errors are propagated up the call stack, preventing the system from initializing.

When validation fails, the system:
1. Aggregates all validation errors into a single descriptive message
2. Throws an Error with the aggregated message
3. Emits an 'error' event through the EventEmitter
4. Prevents further initialization steps from executing
5. Ensures the system remains in a safe, non-operational state

This prevents the system from starting with invalid or potentially dangerous configuration settings.

**Section sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L100-L150)

## Schema Validation and Custom Validators

### Schema Validation Implementation
The configuration validation system uses a custom schema-based approach rather than Zod or similar libraries. The validation schema is defined as a `Record<string, ValidationRule>` object that maps configuration field paths to their validation rules.

```typescript
interface ValidationRule {
	required?: boolean
	type?: 'string' | 'number' | 'boolean' | 'object' | 'array'
	min?: number
	max?: number
	pattern?: RegExp
	enum?: readonly string[]
	custom?: (value: any) => boolean | string
}
```

The system validates configuration by iterating through each field in the schema and applying the appropriate validation rules.

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L50-L90)

### Custom Validator Functions
Custom validators provide flexibility for complex validation logic that cannot be expressed through basic rules.

**:validationSchema['lastUpdated']**
```typescript
custom: (value) => {
	const date = new Date(value)
	return !isNaN(date.getTime()) || 'Invalid ISO date string'
}
```

**:validationSchema['redis.url']**
```typescript
custom: (value) => {
	try {
		const url = new URL(value)
		return url.protocol === 'redis:' || url.protocol === 'rediss:' || 'Invalid Redis URL'
	} catch {
		return 'Invalid URL format'
	}
}
```

**:validationSchema['database.url']**
```typescript
custom: (value) => {
	try {
		const url = new URL(value)
		return (
			url.protocol === 'postgresql:' || url.protocol === 'postgres:' || 'Invalid PostgreSQL URL'
		)
	} catch {
		return 'Invalid URL format'
	}
}
```

**:validationSchema['security.encryptionKey']**
```typescript
custom: (value) => {
	if (value && (typeof value !== 'string' || value.length < 32)) {
		return 'Encryption key must be at least 32 characters'
	}
	return true
}
```

**:validationSchema['compliance.reportingSchedule.recipients']**
```typescript
custom: (value) => {
	if (!Array.isArray(value)) return 'Must be an array'
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return (
		value.every((email) => typeof email === 'string' && emailRegex.test(email)) ||
		'Must be array of valid email addresses'
	)
}
```

**:validationSchema['plugins.directory']**
```typescript
custom: (value) => {
	try {
		const fs = require('fs')
		if (!fs.existsSync(value)) {
			return 'Plugin directory does not exist'
		}
		if (!fs.statSync(value).isDirectory()) {
			return 'Plugin path must be a directory'
		}
		return true
	} catch (error) {
		return 'Error accessing plugin directory'
	}
}
```

**:validationSchema['compliance.pseudonymization.salt']**
```typescript
custom: (value) => {
	if (typeof value !== 'string' || value.length < 32) {
		return 'Pseudonymization salt must be at least 32 characters for cryptographic security'
	}
	return true
}
```

**:validationSchema['compliance.pseudonymization.kms.keyId']**
```typescript
custom: (value, config) => {
	if (config.compliance.pseudonymization.kms.enabled && (!value || value.trim() === '')) {
		return 'KMS key ID is required when KMS encryption is enabled'
	}
	return true
}
```

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L130-L150)
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts#L500-L550)

## Environment-Specific Rule Enforcement

### Production Environment Requirements
The system enforces stricter validation rules in production environments to ensure security and stability.

```mermaid
flowchart TD
Start([Environment Check]) --> IsProduction{"config.environment === 'production'?"}
IsProduction --> |Yes| IntegrityCheck["Validate security.enableIntegrityVerification"]
IsProduction --> |Yes| SSLCheck["Validate database.ssl"]
IsProduction --> |Yes| LogLevelCheck["Validate logging.level ≠ 'debug'"]
IsProduction --> |No| SkipProductionRules["Skip production-specific validations"]
IntegrityCheck --> IntegrityValid{"enableIntegrityVerification === true?"}
IntegrityValid --> |No| ThrowIntegrityError["Throw: security.enableIntegrityVerification must be true in production"]
SSLCheck --> SSLValid{"database.ssl === true?"}
SSLValid --> |No| ThrowSSLError["Throw: database.ssl must be true in production"]
LogLevelCheck --> LogLevelValid{"logging.level ≠ 'debug'?"}
LogLevelValid --> |No| ThrowLogLevelError["Throw: logging.level should not be debug in production"]
ThrowIntegrityError --> End
ThrowSSLError --> End
ThrowLogLevelError --> End
SkipProductionRules --> End
```

**Diagram sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L600-L630)

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L600-L630)

### Environment-Specific Validation Rules
The validation system applies different rules based on the environment configuration:

**:Production Environment Rules**
- **security.enableIntegrityVerification**: Must be true
- **database.ssl**: Must be true
- **logging.level**: Should not be 'debug'

**:Cross-Field Validation Rules**
- **retry.maxDelay ≥ retry.baseDelay**: Ensures retry delay progression is logical
- **security.encryptionKey required when security.enableLogEncryption is true**: Prevents encryption without a key
- **compliance.reportingSchedule.recipients not empty when reporting enabled**: Ensures reports have recipients
- **compliance.pseudonymization.kms.keyId required when compliance.pseudonymization.kms.enabled is true**: Ensures KMS configuration is complete

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L555-L630)

## Secure Handling of Sensitive Data

### Sensitive Data Protection
The configuration system implements multiple layers of protection for sensitive data during validation and storage.

```mermaid
classDiagram
class ConfigurationManager {
-encryptionKey : Buffer | null
-secureStorageConfig : SecureStorageConfig
+initializeEncryption() : Promise~void~
+encryptConfigFile(data : string) : Promise~void~
+decryptConfigFile() : Promise~string~
+sanitizeConfig(config : AuditConfig) : any
+maskSensitiveUrl(url : string) : string
}
class SecureStorageConfig {
+enabled : boolean
+algorithm : 'AES-256-GCM' | 'AES-256-CBC'
+kdf : 'PBKDF2' | 'scrypt'
+salt : string
+iterations : number
}
ConfigurationManager --> SecureStorageConfig : "uses"
```

**Diagram sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L50-L100)

**Section sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L50-L100)

### Data Masking and Sanitization
The system masks sensitive information in logs and debugging output:

- **Database URLs**: Username and password masked
- **Redis URLs**: Authentication credentials masked
- **Encryption keys**: Replaced with '***MASKED***'
- **SMTP passwords**: Replaced with '***MASKED***'
- **Webhook authorization headers**: Replaced with '***MASKED***'
- **Pseudonymization salts**: Replaced with '***MASKED***'
- **KMS credentials**: Replaced with '***MASKED***'

The `sanitizeConfig()` method removes sensitive information from configuration objects before logging or debugging, while the `maskSensitiveUrl()` method specifically handles URL masking.

**Section sources**
- [manager.ts](file://packages/audit/src/config/manager.ts#L750-L800)

## Performance Considerations

### Validation Performance
The configuration validation system is designed for optimal performance during system startup:

- **Single-pass validation**: All fields are validated in a single iteration
- **Early termination**: Validation stops at the first error for required fields
- **Efficient type checking**: Uses typeof operator for type validation
- **Regex pre-compilation**: Regular expressions are defined as constants
- **Minimal object creation**: Avoids unnecessary object creation during validation

The validation process is synchronous and completes quickly, typically in milliseconds, even for large configuration objects.

### Partial Configuration Validation
For configuration updates, the system uses `validatePartialConfiguration()` which merges the partial configuration with the current configuration before validation, avoiding the need to revalidate unchanged fields.

```typescript
export async function validatePartialConfiguration(
	partialConfig: Partial<AuditConfig>,
	baseConfig: AuditConfig
): Promise<void> {
	// Create a merged configuration for validation
	const mergedConfig = { ...baseConfig, ...partialConfig }
	await validateConfiguration(mergedConfig)
}
```

This approach ensures that only the relevant configuration changes are validated while maintaining the context of the complete configuration.

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L635-L645)

## Troubleshooting Common Validation Errors

### Common Validation Errors and Solutions

**:Error: "Field database.url is required"**
- **Cause**: Database URL is missing from configuration
- **Solution**: Add a valid PostgreSQL URL to the database.url field
- **Example**: `postgresql://user:password@localhost:5432/audit_db`

**:Error: "Field database.ssl must be true in production"**
- **Cause**: SSL is disabled in production environment
- **Solution**: Set database.ssl to true in production configuration
- **Security Note**: SSL is required in production to encrypt database traffic

**:Error: "logging.level should not be debug in production"**
- **Cause**: Debug logging is enabled in production
- **Solution**: Set logging.level to 'info', 'warn', or 'error' in production
- **Performance Note**: Debug logging generates excessive output and impacts performance

**:Error: "security.encryptionKey is required when security.enableLogEncryption is true"**
- **Cause**: Log encryption is enabled but no encryption key is provided
- **Solution**: Either disable log encryption or provide a 32+ character encryption key
- **Security Note**: Never commit encryption keys to version control

**:Error: "compliance.reportingSchedule.recipients must not be empty when reporting is enabled"**
- **Cause**: Reporting is enabled but no recipients are specified
- **Solution**: Add valid email addresses to the recipients array or disable reporting
- **Example**: `["admin@company.com", "compliance@company.com"]`

**:Error: "Field retry.maxDelay must be greater than or equal to retry.baseDelay"**
- **Cause**: Maximum retry delay is less than base delay
- **Solution**: Ensure retry.maxDelay ≥ retry.baseDelay
- **Example**: baseDelay: 1000, maxDelay: 10000

**:Error: "Invalid Redis URL"**
- **Cause**: Redis URL has incorrect protocol or format
- **Solution**: Use redis:// for non-SSL or rediss:// for SSL connections
- **Example**: `redis://localhost:6379` or `rediss://user:pass@redis.example.com:6379`

**:Error: "Pseudonymization salt must be at least 32 characters for cryptographic security"**
- **Cause**: Pseudonymization salt is too short
- **Solution**: Provide a salt with at least 32 random characters
- **Security Note**: Use a cryptographically secure random generator to create the salt

**:Error: "KMS key ID is required when KMS encryption is enabled"**
- **Cause**: KMS encryption is enabled but no key ID is provided
- **Solution**: Specify a valid KMS key ID in the configuration
- **Security Note**: Ensure the KMS service account has proper permissions to access the specified key

**:Error: "Plugin directory does not exist"**
- **Cause**: The specified plugin directory path does not exist
- **Solution**: Create the directory or update the configuration to point to a valid path
- **Example**: `plugins/directory: "./custom-plugins"` should point to an existing directory

**:Error: "compliance.pseudonymization.strategy must be one of: hash, token, encryption"**
- **Cause**: Invalid pseudonymization strategy specified
- **Solution**: Use one of the supported strategies: 'hash', 'token', or 'encryption'
- **Note**: 'hash' provides deterministic pseudonymization, 'token' provides random pseudonymization, and 'encryption' provides reversible pseudonymization

**Section sources**
- [validator.ts](file://packages/audit/src/config/validator.ts#L555-L630)
- [gdpr-compliance.ts](file://packages/audit/src/gdpr/gdpr-compliance.ts#L500-L550)