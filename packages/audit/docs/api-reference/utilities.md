# Utilities API Reference

Complete API documentation for the utility functions and helper classes in the `@repo/audit` package. This reference provides detailed information about validation, sanitization, GDPR compliance utilities, event categorization, and data processing capabilities.

## 📋 Overview

The utilities system provides comprehensive utility functions and helper classes for validation, sanitization, GDPR compliance, event categorization, and data processing capabilities that support the audit logging system.

## ✅ Validation and Sanitization System

### Core Validation Interfaces

```typescript
interface ValidationResult {
  /** Validation success status */
  isValid: boolean
  /** Validation errors */
  errors: AuditValidationError[]
  /** Validation warnings */
  warnings: string[]
}

interface SanitizationResult {
  /** Sanitized audit event */
  sanitizedEvent: AuditLogEvent
  /** Sanitization warnings */
  warnings: AuditSanitizationError[]
  /** Whether event was modified */
  modified: boolean
}

interface ValidationConfig {
  /** Maximum string length allowed */
  maxStringLength: number
  /** Allowed data classifications */
  allowedDataClassifications: DataClassification[]
  /** Required fields for validation */
  requiredFields: Array<keyof AuditLogEvent>
  /** Maximum custom field depth */
  maxCustomFieldDepth: number
  /** Allowed event versions */
  allowedEventVersions: string[]
}

class AuditValidationError extends Error {
  /** Field that failed validation */
  readonly field: string
  /** Value that caused error */
  readonly value: any
  /** Error code */
  readonly code: string
  
  constructor(message: string, field: string, value: any, code: string)
}

class AuditSanitizationError extends Error {
  /** Field that was sanitized */
  readonly field: string
  /** Original value before sanitization */
  readonly originalValue: any
  /** Sanitized value */
  readonly sanitizedValue: any
  
  constructor(message: string, field: string, originalValue: any, sanitizedValue: any)
}
```

### ValidationService Functions

Core validation functions for audit events and components.

```typescript
/** Validate audit event against schema */
function validateAuditEvent(
  event: Partial<AuditLogEvent>,
  config?: ValidationConfig
): ValidationResult

/** Validate session context structure */
function validateSessionContext(sessionContext: SessionContext): AuditValidationError[]

/** Validate custom fields depth to prevent deeply nested objects */
function validateCustomFieldsDepth(
  obj: any,
  maxDepth: number,
  currentDepth?: number,
  path?: string
): AuditValidationError[]

/** Validate compliance requirements for event */
function validateCompliance(
  event: AuditLogEvent,
  rules: string[]
): ValidationResult

/** Check if string is valid ISO 8601 timestamp */
function isValidISO8601(timestamp: string): boolean

/** Check if string is valid IP address (IPv4 or IPv6) */
function isValidIPAddress(ip: string): boolean

/** Validate audit action format and category */
function validateAuditAction(action: string): {
  isValid: boolean
  category: 'System' | 'Authentication' | 'Data' | 'FHIR' | 'Unknown'
  errors: string[]
}
```

### SanitizationService Functions

Security-focused sanitization functions for audit data.

```typescript
/** Sanitize audit event for security and normalization */
function sanitizeAuditEvent(
  event: AuditLogEvent,
  options?: SanitizationOptions
): SanitizationResult

/** Sanitize string to prevent injection attacks */
function sanitizeString(input: string, maxLength?: number): string

/** Sanitize session context with IP normalization */
function sanitizeSessionContext(sessionContext: SessionContext): SessionContext

/** Sanitize custom fields with circular reference protection */
function sanitizeCustomFields(
  obj: any,
  maxDepth?: number,
  seenObjects?: WeakSet<object>
): any

/** Remove sensitive data from logs */
function maskSensitiveData(data: any, sensitiveFields?: string[]): any

interface SanitizationOptions {
  /** Maximum string length */
  maxStringLength?: number
  /** Maximum object depth */
  maxDepth?: number
  /** Fields to mask */
  sensitiveFields?: string[]
  /** Enable HTML sanitization */
  sanitizeHtml?: boolean
  /** Enable SQL injection prevention */
  preventSqlInjection?: boolean
}
```

## 🌍 GDPR Utility Functions

### GDPRUtils Class

Comprehensive GDPR compliance utility functions.

```typescript
class GDPRUtils {
  /** Generate deterministic pseudonym for consistent anonymization */
  static generateDeterministicPseudonym(originalId: string, salt?: string): string
  
  /** Generate random pseudonym for non-deterministic anonymization */
  static generateRandomPseudonym(): string
  
  /** Validate GDPR export request parameters */
  static validateExportRequest(request: any): { valid: boolean; errors: string[] }
  
  /** Sanitize data for export by removing sensitive system fields */
  static sanitizeForExport(data: any[]): any[]
  
  /** Check if audit action is compliance-critical and should be preserved */
  static isComplianceCriticalAction(action: string): boolean
  
  /** Calculate data retention expiry date based on policy */
  static calculateRetentionExpiry(createdDate: string, retentionDays: number): string
  
  /** Check if data is eligible for archival based on policy */
  static isEligibleForArchival(
    createdDate: string,
    archiveAfterDays: number,
    currentDate?: string
  ): boolean
  
  /** Check if data is eligible for deletion based on policy */
  static isEligibleForDeletion(
    createdDate: string,
    deleteAfterDays: number,
    currentDate?: string
  ): boolean
  
  /** Generate GDPR compliance report metadata */
  static generateComplianceMetadata(
    operation: string,
    principalId: string,
    requestedBy: string,
    additionalData?: Record<string, any>
  ): Record<string, any>
  
  /** Validate data classification for GDPR processing */
  static validateDataClassification(classification: string): boolean
  
  /** Get recommended retention policy based on data classification */
  static getRecommendedRetentionPolicy(dataClassification: string): {
    retentionDays: number
    archiveAfterDays: number
    deleteAfterDays: number
  }
}
```

### Data Lifecycle Utilities

Helper functions for managing data lifecycle and retention.

```typescript
interface RetentionCalculator {
  /** Calculate retention expiry for event */
  calculateEventExpiry(event: AuditLogEvent, policy: RetentionPolicy): string
  
  /** Check if event has expired */
  isEventExpired(event: AuditLogEvent, policy: RetentionPolicy): boolean
  
  /** Get events eligible for archival */
  getArchivalCandidates(
    events: AuditLogEvent[],
    policies: RetentionPolicy[]
  ): AuditLogEvent[]
  
  /** Get events eligible for deletion */
  getDeletionCandidates(
    events: AuditLogEvent[],
    policies: RetentionPolicy[]
  ): AuditLogEvent[]
}

interface PseudonymizationUtils {
  /** Create pseudonym mapping for referential integrity */
  createPseudonymMapping(
    originalId: string,
    strategy: PseudonymizationStrategy
  ): PseudonymizationMapping
  
  /** Reverse pseudonym mapping if deterministic */
  reversePseudonymMapping(
    pseudonymId: string,
    mappings: PseudonymizationMapping[]
  ): string | null
  
  /** Bulk pseudonymize data */
  bulkPseudonymize(
    data: any[],
    fields: string[],
    strategy: PseudonymizationStrategy
  ): { data: any[]; mappings: PseudonymizationMapping[] }
}

type PseudonymizationStrategy = 'hash' | 'token' | 'encryption'

interface PseudonymizationMapping {
  originalId: string
  pseudonymId: string
  strategy: PseudonymizationStrategy
  createdAt: string
  context: string
}
```

## 🏷️ Event Processing Utilities

### Event Categorization System

Utilities for categorizing and validating audit actions.

```typescript
interface EventCategorizer {
  /** Categorize audit action */
  categorizeAction(action: string): AuditActionCategory
  
  /** Validate action format */
  validateActionFormat(action: string): boolean
  
  /** Get action category rules */
  getActionCategoryRules(): ActionCategoryRules
  
  /** Register custom action category */
  registerCustomCategory(
    category: string,
    patterns: string[],
    validator?: (action: string) => boolean
  ): void
}

type AuditActionCategory = 'System' | 'Authentication' | 'Data' | 'FHIR' | 'Practitioner' | 'Custom'

interface ActionCategoryRules {
  System: string[]
  Authentication: string[]
  Data: string[]
  FHIR: string[]
  Practitioner: string[]
  Custom: Record<string, string[]>
}

/** Built-in action categorization functions */
function categorizeSystemAction(action: string): boolean
function categorizeAuthAction(action: string): boolean
function categorizeDataAction(action: string): boolean
function categorizeFHIRAction(action: string): boolean
function categorizePractitionerAction(action: string): boolean

/** Validation functions for action categories */
function validateSystemAction(action: string): ValidationResult
function validateAuthAction(action: string): ValidationResult
function validateDataAction(action: string): ValidationResult
function validateFHIRAction(action: string): ValidationResult
```

### Data Processing Helpers

Utility functions for common data processing tasks.

```typescript
interface DataProcessingUtils {
  /** Normalize IP address format */
  normalizeIPAddress(ip: string): string
  
  /** Validate and format timestamp */
  validateTimestamp(timestamp: string): { valid: boolean; formatted?: string }
  
  /** Extract domain from email address */
  extractEmailDomain(email: string): string | null
  
  /** Generate correlation ID */
  generateCorrelationId(): string
  
  /** Parse user agent string */
  parseUserAgent(userAgent: string): {
    browser?: string
    version?: string
    os?: string
    device?: string
  }
  
  /** Validate data classification */
  validateDataClassification(classification: string): boolean
  
  /** Normalize data classification */
  normalizeDataClassification(classification: string): DataClassification
  
  /** Check if action involves PHI */
  involvesPHI(action: string, resourceType?: string): boolean
  
  /** Extract healthcare resource type from FHIR action */
  extractFHIRResourceType(action: string): string | null
}

/** IP address utilities */
function isValidIPv4(ip: string): boolean
function isValidIPv6(ip: string): boolean
function normalizeIPv4(ip: string): string
function normalizeIPv6(ip: string): string
function getIPVersion(ip: string): 'IPv4' | 'IPv6' | 'Invalid'

/** Timestamp utilities */
function parseISO8601(timestamp: string): Date | null
function formatISO8601(date: Date): string
function validateTimestampRange(timestamp: string, minDate?: Date, maxDate?: Date): boolean

/** String utilities */
function truncateString(str: string, maxLength: number, suffix?: string): string
function escapeHtml(str: string): string
function removeSqlInjectionPatterns(str: string): string
function normalizeWhitespace(str: string): string
```

## 🔧 Configuration Utilities

### Configuration Validation Helpers

Utility functions for configuration validation and normalization.

```typescript
interface ConfigurationValidators {
  /** Validate audit configuration */
  validateAuditConfig(config: any): ValidationResult
  
  /** Validate security configuration */
  validateSecurityConfig(config: any): ValidationResult
  
  /** Validate compliance configuration */
  validateComplianceConfig(config: any): ValidationResult
  
  /** Validate monitoring configuration */
  validateMonitoringConfig(config: any): ValidationResult
  
  /** Validate database configuration */
  validateDatabaseConfig(config: any): ValidationResult
  
  /** Normalize configuration values */
  normalizeConfig(config: any): any
  
  /** Get default configuration for environment */
  getDefaultConfig(environment: string): any
  
  /** Merge configuration objects */
  mergeConfigs(...configs: any[]): any
}

/** Environment-specific configuration helpers */
function getEnvironmentConfig(environment: string): any
function validateEnvironmentVariables(requiredVars: string[]): { valid: boolean; missing: string[] }
function parseEnvironmentValue(value: string, type: 'string' | 'number' | 'boolean' | 'json'): any
```

## 💡 Usage Examples

### Event Validation

```typescript
import { validateAuditEvent, ValidationConfig } from '@repo/audit'

// Custom validation configuration
const validationConfig: ValidationConfig = {
  maxStringLength: 5000,
  allowedDataClassifications: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'],
  requiredFields: ['timestamp', 'action', 'status', 'principalId'],
  maxCustomFieldDepth: 5,
  allowedEventVersions: ['1.0', '1.1', '2.0']
}

// Validate audit event
const event = {
  timestamp: new Date().toISOString(),
  action: 'user.login',
  status: 'success',
  principalId: 'user-123',
  sessionContext: {
    sessionId: 'session-456',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...'
  }
}

const validationResult = validateAuditEvent(event, validationConfig)
if (!validationResult.isValid) {
  console.error('Validation errors:', validationResult.errors)
}
```

### Event Sanitization

```typescript
import { sanitizeAuditEvent, SanitizationOptions } from '@repo/audit'

// Sanitization options
const sanitizationOptions: SanitizationOptions = {
  maxStringLength: 10000,
  maxDepth: 3,
  sensitiveFields: ['password', 'ssn', 'creditCard'],
  sanitizeHtml: true,
  preventSqlInjection: true
}

// Sanitize potentially unsafe event
const unsafeEvent = {
  timestamp: new Date().toISOString(),
  action: 'user.update',
  status: 'success',
  principalId: 'user-123',
  details: {
    password: 'secret123',
    note: '<script>alert("xss")</script>User updated',
    query: "SELECT * FROM users WHERE id = '1' OR '1'='1'"
  }
}

const sanitizationResult = sanitizeAuditEvent(unsafeEvent, sanitizationOptions)
console.log('Sanitized event:', sanitizationResult.sanitizedEvent)
if (sanitizationResult.warnings.length > 0) {
  console.warn('Sanitization warnings:', sanitizationResult.warnings)
}
```

### GDPR Utilities

```typescript
import { GDPRUtils } from '@repo/audit'

// Generate consistent pseudonyms
const originalId = 'user-123'
const pseudonym1 = GDPRUtils.generateDeterministicPseudonym(originalId)
const pseudonym2 = GDPRUtils.generateDeterministicPseudonym(originalId)
console.log('Pseudonyms match:', pseudonym1 === pseudonym2) // true

// Validate export request
const exportRequest = {
  principalId: 'user-456',
  requestType: 'portability',
  format: 'json',
  requestedBy: 'user-456',
  dateRange: {
    start: '2023-01-01T00:00:00.000Z',
    end: '2023-12-31T23:59:59.999Z'
  }
}

const validation = GDPRUtils.validateExportRequest(exportRequest)
if (!validation.valid) {
  console.error('Export request errors:', validation.errors)
}

// Check retention eligibility
const eventDate = '2023-01-01T00:00:00.000Z'
const isArchivalReady = GDPRUtils.isEligibleForArchival(eventDate, 365) // 1 year
const isDeletionReady = GDPRUtils.isEligibleForDeletion(eventDate, 2190) // 6 years

console.log('Archival ready:', isArchivalReady)
console.log('Deletion ready:', isDeletionReady)
```

### Event Categorization

```typescript
import { EventCategorizer, categorizeSystemAction } from '@repo/audit'

const categorizer = new EventCategorizer()

// Categorize different actions
const actions = [
  'system.startup',
  'auth.login.success',
  'data.read',
  'fhir.patient.create',
  'practitioner.license.verify'
]

actions.forEach(action => {
  const category = categorizer.categorizeAction(action)
  const isValid = categorizer.validateActionFormat(action)
  console.log(`${action}: ${category} (valid: ${isValid})`)
})

// Register custom category
categorizer.registerCustomCategory(
  'Billing',
  ['billing.*', 'invoice.*', 'payment.*'],
  (action) => action.startsWith('billing.') || action.startsWith('invoice.')
)

// Use built-in categorization functions
const isSystemAction = categorizeSystemAction('system.configuration.change')
console.log('Is system action:', isSystemAction)
```

### Data Processing Utilities

```typescript
import { DataProcessingUtils } from '@repo/audit'

const utils = new DataProcessingUtils()

// Normalize IP addresses
const ipv4 = utils.normalizeIPAddress('192.168.001.100')
const ipv6 = utils.normalizeIPAddress('2001:0db8:0000:0000:0000:ff00:0042:8329')
console.log('Normalized IPv4:', ipv4) // '192.168.1.100'
console.log('Normalized IPv6:', ipv6) // '2001:db8::ff00:42:8329'

// Parse user agent
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const parsed = utils.parseUserAgent(userAgent)
console.log('Parsed user agent:', parsed)

// Check PHI involvement
const involvesPHI = utils.involvesPHI('fhir.patient.read', 'Patient')
console.log('Involves PHI:', involvesPHI) // true

// Extract FHIR resource type
const resourceType = utils.extractFHIRResourceType('fhir.patient.create')
console.log('FHIR resource type:', resourceType) // 'Patient'

// Generate correlation ID
const correlationId = utils.generateCorrelationId()
console.log('Correlation ID:', correlationId)
```

### Configuration Validation

```typescript
import { ConfigurationValidators } from '@repo/audit'

const validators = new ConfigurationValidators()

// Validate configuration
const config = {
  version: '1.0',
  environment: 'production',
  security: {
    enableSigning: true,
    hmacSecret: 'base64-encoded-secret'
  },
  compliance: {
    hipaa: { enabled: true },
    gdpr: { enabled: true }
  }
}

const configValidation = validators.validateAuditConfig(config)
if (!configValidation.isValid) {
  console.error('Config validation errors:', configValidation.errors)
}

// Normalize and merge configurations
const normalizedConfig = validators.normalizeConfig(config)
const defaultConfig = validators.getDefaultConfig('production')
const mergedConfig = validators.mergeConfigs(defaultConfig, normalizedConfig)

console.log('Final configuration:', mergedConfig)
```

## 🔗 Related APIs

- **[Configuration](./configuration.md)** - Configuration utility integration
- **[Compliance](./compliance.md)** - GDPR utility usage
- **[Monitoring](./monitoring.md)** - Validation in monitoring
- **[Cryptography](./cryptography.md)** - Data processing for security

## 📚 Utility Best Practices

### Validation Guidelines

- **Comprehensive Validation**: Always validate both structure and content
- **Error Handling**: Provide clear, actionable error messages
- **Performance**: Use efficient validation algorithms for high-volume processing
- **Extensibility**: Support custom validation rules and configurations

### Sanitization Best Practices

- **Defense in Depth**: Apply multiple sanitization layers
- **Context-Aware**: Use appropriate sanitization for data context
- **Preserve Functionality**: Maintain data utility while ensuring security
- **Audit Trail**: Log sanitization actions for compliance

### GDPR Compliance Guidelines

- **Data Minimization**: Process only necessary data
- **Purpose Limitation**: Use data only for specified purposes
- **Retention Limits**: Implement appropriate retention policies
- **Rights Support**: Enable data subject rights exercise

For detailed utility implementation guides, see the [Utilities Setup Guide](../guides/utilities-setup.md).