# Configuration API Reference

Complete API documentation for the configuration management system in the `@repo/audit` package. This reference provides detailed information about configuration interfaces, managers, and validation systems.

## 📋 Overview

The configuration management system provides comprehensive environment-specific settings, hot-reloading capabilities, secure storage with KMS encryption, and validation across all audit system components.

## 🔧 Core Interfaces

### AuditConfig Interface

The main configuration interface containing all system settings.

```typescript
interface AuditConfig {
  /** Configuration version for compatibility tracking */
  version: string
  
  /** Deployment environment (development, staging, production, test) */
  environment: 'development' | 'staging' | 'production' | 'test'
  
  /** Reliable event processor configuration */
  reliableProcessor: ReliableProcessorConfig
  
  /** Security and cryptographic settings */
  security: SecurityConfig
  
  /** Compliance validation settings */
  compliance: ComplianceConfig
  
  /** Monitoring and observability configuration */
  observability: ObservabilityConfig
  
  /** Database connection settings */
  database: DatabaseConfig
  
  /** Redis cache configuration */
  redis: RedisConfig
  
  /** Server and API settings */
  server: ServerConfig
  
  /** Worker service configuration */
  worker: WorkerConfig
}
```

### SecurityConfig Interface

Configuration for cryptographic operations and security features.

```typescript
interface SecurityConfig {
  /** Enable cryptographic signing of audit events */
  enableSigning: boolean
  
  /** Cryptographic signing algorithm */
  signingAlgorithm: 'HMAC-SHA256' | 'RSASSA_PSS_SHA_256' | 'ECDSA_SHA_256'
  
  /** HMAC secret key for local signing (base64 encoded) */
  hmacSecret?: string
  
  /** KMS integration settings */
  kms?: {
    /** Enable KMS integration */
    enabled: boolean
    
    /** KMS provider (currently supports Infisical) */
    provider: 'infisical'
    
    /** KMS configuration */
    config: InfisicalKMSConfig
  }
  
  /** Secure storage configuration */
  secureStorage?: SecureStorageConfig
  
  /** Hash verification settings */
  hashVerification: {
    /** Enable hash verification */
    enabled: boolean
    
    /** Hash algorithm */
    algorithm: 'SHA-256'
  }
}

interface InfisicalKMSConfig {
  /** Infisical client ID */
  clientId: string
  
  /** Infisical client secret */
  clientSecret: string
  
  /** Infisical project ID */
  projectId: string
  
  /** Environment for secret retrieval */
  environment: string
  
  /** Secret path prefix */
  secretPath: string
}

interface SecureStorageConfig {
  /** Enable secure storage encryption */
  enabled: boolean
  
  /** Encryption algorithm */
  algorithm: 'AES-256-GCM' | 'AES-256-CBC'
  
  /** Key derivation function */
  kdf: 'PBKDF2' | 'scrypt'
  
  /** Salt for key derivation (base64 encoded) */
  salt: string
  
  /** Key derivation iterations */
  iterations: number
}
```

### ComplianceConfig Interface

Configuration for HIPAA and GDPR compliance features.

```typescript
interface ComplianceConfig {
  /** HIPAA compliance settings */
  hipaa: {
    /** Enable HIPAA validation */
    enabled: boolean
    
    /** Required fields for PHI access events */
    requiredFields: string[]
    
    /** Data retention period in days */
    retentionPeriod: number
    
    /** Enable automatic PHI detection */
    autoDetectPHI: boolean
  }
  
  /** GDPR compliance settings */
  gdpr: {
    /** Enable GDPR validation */
    enabled: boolean
    
    /** Data retention periods by category */
    retentionPolicies: Record<string, number>
    
    /** Enable right to erasure processing */
    enableRightToErasure: boolean
    
    /** Enable data portability */
    enableDataPortability: boolean
    
    /** Legal basis tracking */
    trackLegalBasis: boolean
  }
  
  /** Compliance reporting configuration */
  reporting: {
    /** Enable automated reporting */
    enabled: boolean
    
    /** Report generation schedule (cron format) */
    schedule: string
    
    /** Report recipients */
    recipients: string[]
    
    /** Report formats */
    formats: ('json' | 'csv' | 'xml')[]
  }
}
```

### MonitoringConfig Interface

Configuration for system monitoring and health checks.

```typescript
interface MonitoringConfig {
  /** Health check configuration */
  healthChecks: {
    /** Enable health checks */
    enabled: boolean
    
    /** Health check interval in milliseconds */
    interval: number
    
    /** Health check timeout in milliseconds */
    timeout: number
    
    /** Components to monitor */
    components: ('database' | 'redis' | 'queue' | 'circuit-breaker')[]
  }
  
  /** Metrics collection settings */
  metrics: {
    /** Enable metrics collection */
    enabled: boolean
    
    /** Metrics collection interval in milliseconds */
    interval: number
    
    /** Metrics to collect */
    types: ('latency' | 'throughput' | 'error-rate' | 'queue-depth')[]
  }
  
  /** Alert configuration */
  alerts: {
    /** Enable alerting */
    enabled: boolean
    
    /** Alert thresholds */
    thresholds: {
      /** Error rate threshold (percentage) */
      errorRate: number
      
      /** Processing latency threshold in milliseconds */
      latency: number
      
      /** Queue depth threshold */
      queueDepth: number
    }
    
    /** Notification providers */
    providers: NotificationProvider[]
  }
}

interface NotificationProvider {
  /** Provider type */
  type: 'email' | 'slack' | 'webhook'
  
  /** Provider configuration */
  config: Record<string, any>
  
  /** Alert severities to handle */
  severities: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[]
}
```

## 🏗️ Configuration Management

### ConfigurationManager Class

The main class for configuration management, validation, and hot-reloading.

```typescript
class ConfigurationManager {
  constructor(options?: ConfigManagerOptions)
  
  /** Load configuration from file or environment */
  loadConfig(): Promise<AuditConfig>
  
  /** Validate configuration against schema */
  validateConfig(config: AuditConfig): ValidationResult
  
  /** Update configuration with hot-reloading */
  updateConfig(config: Partial<AuditConfig>): Promise<void>
  
  /** Watch for configuration file changes */
  enableHotReload(options: HotReloadOptions): void
  
  /** Disable configuration watching */
  disableHotReload(): void
  
  /** Encrypt configuration for secure storage */
  encryptConfig(config: AuditConfig): Promise<string>
  
  /** Decrypt configuration from secure storage */
  decryptConfig(encryptedData: string): Promise<AuditConfig>
  
  /** Get current configuration */
  getCurrentConfig(): AuditConfig
  
  /** Get configuration change history */
  getChangeHistory(): ConfigChange[]
  
  /** Sanitize configuration for logging */
  sanitizeConfig(config: AuditConfig): any
}

interface ConfigManagerOptions {
  /** Configuration file path */
  configPath?: string
  
  /** Enable hot reloading */
  enableHotReload?: boolean
  
  /** Watch file paths for changes */
  watchPaths?: string[]
  
  /** Enable secure storage */
  enableSecureStorage?: boolean
  
  /** Encryption passphrase for secure storage */
  encryptionPassphrase?: string
}

interface HotReloadOptions {
  /** File paths to watch */
  watchPaths: string[]
  
  /** Debounce delay in milliseconds */
  debounceDelay?: number
  
  /** Enable S3 configuration watching */
  enableS3Watch?: boolean
  
  /** S3 configuration */
  s3Config?: S3WatchConfig
}

interface ValidationResult {
  /** Validation success status */
  isValid: boolean
  
  /** Validation errors */
  errors: ValidationError[]
  
  /** Validation warnings */
  warnings: ValidationWarning[]
}

interface ConfigChange {
  /** Change timestamp */
  timestamp: string
  
  /** Previous configuration (sanitized) */
  previous: any
  
  /** New configuration (sanitized) */
  current: any
  
  /** Change reason */
  reason: string
  
  /** User who made the change */
  changedBy?: string
}
```

### Configuration Factory

Factory functions for creating and managing configurations.

```typescript
class ConfigurationFactory {
  /** Create default configuration for environment */
  static createDefault(environment: string): AuditConfig
  
  /** Create configuration from environment variables */
  static fromEnvironment(): AuditConfig
  
  /** Create configuration from file */
  static fromFile(filePath: string): Promise<AuditConfig>
  
  /** Create configuration from S3 */
  static fromS3(s3Config: S3Config): Promise<AuditConfig>
  
  /** Merge multiple configurations */
  static merge(...configs: Partial<AuditConfig>[]): AuditConfig
  
  /** Create environment-specific configuration */
  static forEnvironment(
    base: AuditConfig, 
    environment: string
  ): AuditConfig
}

interface S3Config {
  /** S3 bucket name */
  bucket: string
  
  /** Configuration object key */
  key: string
  
  /** AWS region */
  region: string
  
  /** AWS access key ID */
  accessKeyId?: string
  
  /** AWS secret access key */
  secretAccessKey?: string
}
```

## 🔍 Configuration Validation

### Validation Schema

Comprehensive validation using schema definitions.

```typescript
interface ConfigValidator {
  /** Validate full configuration */
  validateAuditConfig(config: AuditConfig): ValidationResult
  
  /** Validate security configuration */
  validateSecurityConfig(config: SecurityConfig): ValidationResult
  
  /** Validate compliance configuration */
  validateComplianceConfig(config: ComplianceConfig): ValidationResult
  
  /** Validate monitoring configuration */
  validateMonitoringConfig(config: MonitoringConfig): ValidationResult
  
  /** Validate environment-specific settings */
  validateEnvironmentConfig(
    config: AuditConfig, 
    environment: string
  ): ValidationResult
  
  /** Custom validation rules */
  addCustomRule(
    name: string, 
    validator: (config: any) => ValidationResult
  ): void
}

interface ValidationError {
  /** Error path in configuration */
  path: string
  
  /** Error message */
  message: string
  
  /** Error code */
  code: string
  
  /** Current value that failed validation */
  value: any
  
  /** Expected value or constraint */
  expected?: any
}

interface ValidationWarning {
  /** Warning path in configuration */
  path: string
  
  /** Warning message */
  message: string
  
  /** Warning severity */
  severity: 'low' | 'medium' | 'high'
  
  /** Suggested action */
  suggestion?: string
}
```

## 🔐 Secure Configuration Storage

### Encryption and Security Features

```typescript
interface SecureConfigManager {
  /** Initialize encryption with passphrase */
  initializeEncryption(passphrase: string): Promise<void>
  
  /** Encrypt configuration file */
  encryptConfigFile(data: string): Promise<void>
  
  /** Decrypt configuration file */
  decryptConfigFile(): Promise<string>
  
  /** Mask sensitive URLs and secrets */
  maskSensitiveData(config: AuditConfig): AuditConfig
  
  /** Rotate encryption keys */
  rotateEncryptionKey(newPassphrase: string): Promise<void>
  
  /** Backup encrypted configuration */
  backupConfiguration(): Promise<string>
  
  /** Restore configuration from backup */
  restoreConfiguration(backupData: string): Promise<void>
}
```

## 📊 Configuration Events

### Event Handling and Notifications

```typescript
interface ConfigurationEvents {
  /** Configuration loaded event */
  'config:loaded': (config: AuditConfig) => void
  
  /** Configuration changed event */
  'config:changed': (newConfig: AuditConfig, oldConfig: AuditConfig) => void
  
  /** Configuration validation failed event */
  'config:validation-failed': (errors: ValidationError[]) => void
  
  /** Configuration file watched event */
  'config:file-changed': (filePath: string) => void
  
  /** Encryption key rotated event */
  'config:key-rotated': () => void
  
  /** Configuration backup created event */
  'config:backup-created': (backupPath: string) => void
}

// Event listener setup
const configManager = new ConfigurationManager()

configManager.on('config:changed', (newConfig, oldConfig) => {
  console.log('Configuration updated')
  // Handle configuration change
})

configManager.on('config:validation-failed', (errors) => {
  console.error('Configuration validation failed:', errors)
  // Handle validation errors
})
```

## 💡 Usage Examples

### Basic Configuration Setup

```typescript
import { ConfigurationManager, ConfigurationFactory } from '@repo/audit'

// Create default configuration
const config = ConfigurationFactory.createDefault('production')

// Initialize configuration manager
const configManager = new ConfigurationManager({
  configPath: './audit-config.json',
  enableHotReload: true,
  enableSecureStorage: true
})

// Load and validate configuration
const loadedConfig = await configManager.loadConfig()
const validation = configManager.validateConfig(loadedConfig)

if (!validation.isValid) {
  console.error('Configuration validation failed:', validation.errors)
  process.exit(1)
}
```

### Environment-Specific Configuration

```typescript
// Create base configuration
const baseConfig = ConfigurationFactory.createDefault('production')

// Override for specific environment
const envConfig = ConfigurationFactory.forEnvironment(baseConfig, 'staging')

// Merge with custom settings
const finalConfig = ConfigurationFactory.merge(
  envConfig,
  {
    security: {
      enableSigning: true,
      signingAlgorithm: 'HMAC-SHA256'
    },
    compliance: {
      hipaa: { enabled: true },
      gdpr: { enabled: true }
    }
  }
)
```

### Hot Reloading Setup

```typescript
// Enable hot reloading with file watching
configManager.enableHotReload({
  watchPaths: ['./config/audit.json', './config/security.json'],
  debounceDelay: 1000,
  enableS3Watch: true,
  s3Config: {
    bucket: 'config-bucket',
    key: 'audit/production.json',
    region: 'us-east-1'
  }
})

// Handle configuration changes
configManager.on('config:changed', async (newConfig, oldConfig) => {
  // Validate new configuration
  const validation = configManager.validateConfig(newConfig)
  
  if (validation.isValid) {
    // Apply new configuration
    await auditService.updateConfig(newConfig)
    console.log('Configuration updated successfully')
  } else {
    console.error('Invalid configuration received:', validation.errors)
    // Revert to previous configuration
    await configManager.updateConfig(oldConfig)
  }
})
```

### Secure Storage

```typescript
// Initialize secure storage
await configManager.initializeEncryption('secure-passphrase')

// Encrypt and store configuration
await configManager.encryptConfig(config)

// Decrypt and load configuration
const decryptedConfig = await configManager.decryptConfig(encryptedData)

// Mask sensitive data for logging
const sanitizedConfig = configManager.sanitizeConfig(config)
console.log('Current configuration:', sanitizedConfig)
```

## 🔗 Related APIs

- **[Audit Class](./audit-class.md)** - Main audit service configuration
- **[Cryptography](./cryptography.md)** - Security configuration usage
- **[Monitoring](./monitoring.md)** - Monitoring configuration setup
- **[Compliance](./compliance.md)** - Compliance configuration options

## 📚 Configuration Schema Reference

For complete configuration schema definitions and validation rules, see the [Configuration Schema](../guides/configuration-schema.md) guide.

## 🔧 Migration and Versioning

For information about configuration migration and version compatibility, see the [Configuration Migration](../guides/configuration-migration.md) guide.