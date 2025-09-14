---
title: Frequently Asked Questions
description: Common questions and answers about @repo/audit-db package.
---

# Frequently Asked Questions

This FAQ addresses common questions about implementing, configuring, and using the @repo/audit-db package in healthcare environments.

## General Questions

### What is @repo/audit-db?

@repo/audit-db is a comprehensive audit logging solution designed specifically for healthcare applications. It provides HIPAA and GDPR compliant audit trails with enterprise-grade features including:

- Multi-client architecture (AuditDb, AuditDbWithConfig, EnhancedAuditDb)
- Cryptographic integrity verification (SHA-256, HMAC)
- High-performance caching with Redis
- PostgreSQL with Drizzle ORM integration
- Database partitioning for scalability
- Healthcare-specific audit patterns

### Why should I use @repo/audit-db over other audit solutions?

@repo/audit-db is purpose-built for healthcare environments with unique requirements:

- **Regulatory Compliance**: Built-in HIPAA, GDPR, and SOX compliance features
- **Healthcare Focus**: Pre-configured patterns for patient data access, prescription logging, and clinical workflows
- **Enterprise Scale**: Handles millions of audit events with partitioning and caching
- **Developer Experience**: TypeScript-first with comprehensive documentation and examples
- **Security**: End-to-end encryption, integrity verification, and anomaly detection

## Installation and Setup

### How do I install @repo/audit-db?

```bash
# Install the package
npm install @repo/audit-db

# Install CLI tools (optional)
npm install -g @repo/audit-db-cli

# Install peer dependencies
npm install drizzle-orm postgres redis
```

### What are the minimum system requirements?

**For Basic Usage:**
- Node.js 18+ or 20+
- PostgreSQL 12+
- Redis 6+
- 2GB RAM minimum

**For Production Healthcare Environments:**
- Node.js 20 LTS
- PostgreSQL 14+ with encryption at rest
- Redis 7+ with TLS
- 8GB RAM minimum
- SSD storage for database
- Backup and disaster recovery plan

### How do I set up the database schema?

```bash
# Using CLI tools
audit-db setup --env production

# Or programmatically
import { AuditDb } from '@repo/audit-db'

const auditDb = new AuditDb()
const isConnected = await auditDb.checkAuditDbConnection()
if (isConnected) {
  // Schema is automatically set up on first connection
  console.log('Audit database ready')
}
```

### What environment variables do I need?

**Required:**
```bash
AUDIT_DB_URL="postgresql://user:pass@localhost:5432/audit_db"
AUDIT_REDIS_URL="redis://localhost:6379"
```

**Recommended for Production:**
```bash
AUDIT_CRYPTO_SECRET="your-256-bit-secret-key"
AUDIT_ENABLE_ENCRYPTION=true
AUDIT_ENABLE_SIGNATURES=true
AUDIT_LOG_LEVEL="info"
```

## Configuration and Usage

### How do I choose between different client types?

**Use `AuditDb` when:**
- Simple audit logging needs
- Development and testing
- Basic compliance requirements

**Use `AuditDbWithConfig` when:**
- Custom configuration needed
- Multiple environments
- Specific performance tuning

**Use `EnhancedAuditDb` when:**
- Production healthcare environments
- Advanced features (caching, partitioning, monitoring)
- High-volume audit logging (>1M events/day)

### How do I log a HIPAA-compliant audit event?

```typescript
import { AuditDb } from '@repo/audit-db'

const auditDb = new AuditDb()

await auditDb.logAuditEvent({
  timestamp: new Date().toISOString(),
  action: 'fhir.patient.access',
  status: 'success',
  principalId: 'provider-123', // Required: who performed the action
  principalType: 'healthcare_provider',
  resourceId: 'patient-456', // Required: what was accessed
  resourceType: 'Patient',
  sourceIp: '192.168.1.100',
  metadata: {
    accessReason: 'patient-care',
    dataElements: ['demographics', 'allergies'],
    hipaaCompliant: true
  }
})
```

### How do I implement role-based audit logging?

```typescript
// Define roles with audit requirements
const roles = {
  'physician': {
    requiredFields: ['patientId', 'clinicalJustification'],
    autoLog: ['patient.access', 'prescription.create']
  },
  'nurse': {
    requiredFields: ['patientId', 'supervisingPhysician'],
    autoLog: ['patient.care', 'medication.administer']
  },
  'admin': {
    requiredFields: ['approver', 'businessJustification'],
    autoLog: ['system.config', 'user.manage']
  }
}

// Middleware for automatic role-based logging
async function auditMiddleware(req, res, next) {
  const userRole = await getUserRole(req.user.id)
  const roleConfig = roles[userRole]
  
  if (roleConfig.autoLog.some(pattern => req.path.includes(pattern))) {
    await auditDb.logAuditEvent({
      action: `${userRole}.${req.method}.${req.path}`,
      principalId: req.user.id,
      principalType: userRole,
      status: 'attempt',
      sourceIp: req.ip,
      metadata: {
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID
      }
    })
  }
  
  next()
}
```

## Performance and Scalability

### How do I optimize performance for high-volume logging?

**1. Use Enhanced Client with Caching:**
```typescript
const auditDb = new EnhancedAuditDb({
  connectionPool: {
    minConnections: 10,
    maxConnections: 50
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 500,
    defaultTTL: 900
  },
  batchProcessing: {
    enabled: true,
    batchSize: 100,
    flushInterval: 5000
  }
})
```

**2. Implement Database Partitioning:**
```bash
# Create monthly partitions
audit-db partition --create-monthly --months 12

# Or programmatically
await auditDb.createPartitions({
  type: 'monthly',
  count: 12,
  startDate: new Date('2024-01-01')
})
```

**3. Use Async Logging:**
```typescript
// Non-blocking audit logging
auditDb.logAuditEventAsync({
  action: 'fhir.patient.access',
  status: 'success',
  // ... other fields
}).catch(err => console.error('Audit logging failed:', err))
```

### How much storage will I need?

**Estimation Guidelines:**
- **Low Volume** (1K events/day): ~1GB/year
- **Medium Volume** (10K events/day): ~10GB/year  
- **High Volume** (100K events/day): ~100GB/year
- **Enterprise Volume** (1M+ events/day): ~1TB/year

**Factors affecting storage:**
- Metadata size (JSON objects)
- Retention period (HIPAA requires 6-7 years)
- Compression (can reduce by 60-80%)
- Encryption overhead (5-10% increase)

### When should I use database partitioning?

Consider partitioning when:
- Storing >1M audit events
- Retention period >2 years
- Query performance degrading
- Backup/restore times excessive

Benefits:
- Faster queries (partition pruning)
- Easier data lifecycle management
- Improved backup/restore performance
- Better parallel processing

## Security and Compliance

### How do I ensure HIPAA compliance?

**Required HIPAA Elements:**
1. **Who**: Always log `principalId` and `principalType`
2. **What**: Log specific `action` and `resourceType`
3. **When**: Automatic `timestamp` (use ISO 8601)
4. **Where**: Log `sourceIp` and `sessionContext`
5. **Outcome**: Always include `status`

**Example HIPAA-compliant event:**
```typescript
await auditDb.logAuditEvent({
  principalId: 'physician-123',
  principalType: 'healthcare_provider',
  action: 'fhir.patient.read',
  resourceType: 'Patient',
  resourceId: 'patient-456',
  timestamp: new Date().toISOString(),
  status: 'success',
  sourceIp: '10.0.1.100',
  sessionContext: {
    sessionId: 'sess-789',
    facilityId: 'hospital-main'
  },
  metadata: {
    accessReason: 'patient-care',
    dataElements: ['demographics', 'conditions'],
    minimumNecessary: true
  }
})
```

### How do I implement data encryption?

**Automatic Encryption (Recommended):**
```typescript
const auditDb = new EnhancedAuditDb({
  encryption: {
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyRotationDays: 90
  }
})
```

**Manual Encryption:**
```bash
# Encrypt existing data
audit-db encrypt --columns metadata,outcomeDescription

# Rotate encryption keys
audit-db encrypt --rotate-keys --backup-old-keys
```

### How do I handle data retention and disposal?

**Automated Retention (Recommended):**
```typescript
await auditDb.logAuditEvent({
  // ... event data
  retentionPolicy: 'hipaa-6-years' // or 'gdpr-standard', 'sox-7-years'
})
```

**Manual Cleanup:**
```bash
# Apply retention policies
audit-db cleanup --apply-retention

# Preview what will be deleted
audit-db cleanup --dry-run --show-affected

# Emergency cleanup for storage
audit-db cleanup --emergency --free-space 50GB
```

## Troubleshooting

### Why are my audit events not being logged?

**Common Causes:**

1. **Database Connection Issues:**
```typescript
// Check connection
const isConnected = await auditDb.checkAuditDbConnection()
if (!isConnected) {
  console.error('Cannot connect to audit database')
}
```

2. **Validation Errors:**
```typescript
// Enable verbose logging
process.env.AUDIT_LOG_LEVEL = 'debug'

// Check for validation errors
try {
  await auditDb.logAuditEvent(eventData)
} catch (error) {
  console.error('Validation failed:', error.message)
}
```

3. **Redis Connection Issues:**
```typescript
// Test Redis connection
import Redis from 'ioredis'
const redis = new Redis(process.env.AUDIT_REDIS_URL)
await redis.ping() // Should return 'PONG'
```

### Why is performance slow?

**Performance Diagnostics:**

1. **Check Connection Pool:**
```bash
audit-db monitor --metrics connections,queries --duration 5m
```

2. **Analyze Slow Queries:**
```bash
audit-db diagnose --issue slow-queries
```

3. **Review Index Usage:**
```bash
audit-db index --analyze
audit-db index --create-recommended
```

### How do I recover from data corruption?

**Data Integrity Check:**
```bash
# Verify integrity
audit-db integrity --verify-hashes --report

# Fix corrupted hashes
audit-db integrity --fix-hashes --confirm
```

**Restore from Backup:**
```bash
# List available backups
ls /var/backups/audit/

# Restore specific backup
audit-db restore --backup backup-20240115-120000.sql --confirm
```

## Integration Questions

### How do I integrate with Express.js?

```typescript
import express from 'express'
import { AuditDb } from '@repo/audit-db'

const app = express()
const auditDb = new AuditDb()

// Audit middleware
app.use(async (req, res, next) => {
  // Log request
  req.auditContext = {
    startTime: Date.now(),
    sessionId: req.sessionID,
    userId: req.user?.id
  }
  
  next()
})

// Response audit logging
app.use((req, res, next) => {
  const originalSend = res.send
  
  res.send = function(data) {
    // Log response
    auditDb.logAuditEventAsync({
      action: `api.${req.method}.${req.path}`,
      principalId: req.user?.id || 'anonymous',
      status: res.statusCode < 400 ? 'success' : 'failure',
      sourceIp: req.ip,
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: Date.now() - req.auditContext.startTime
      }
    })
    
    return originalSend.call(this, data)
  }
  
  next()
})
```

### How do I integrate with React applications?

```typescript
// React Context for audit logging
import { createContext, useContext } from 'react'

const AuditContext = createContext()

export function AuditProvider({ children }) {
  const logUserAction = async (action, details) => {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: `ui.${action}`,
        principalId: getCurrentUserId(),
        status: 'success',
        metadata: {
          component: details.component,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      })
    })
  }
  
  return (
    <AuditContext.Provider value={{ logUserAction }}>
      {children}
    </AuditContext.Provider>
  )
}

// Usage in components
export function PatientSearch() {
  const { logUserAction } = useContext(AuditContext)
  
  const handleSearch = async (searchTerm) => {
    await logUserAction('patient.search', {
      component: 'PatientSearch',
      searchTerm: searchTerm // Be careful with PII
    })
    
    // Perform search...
  }
  
  return (
    <SearchInput onSearch={handleSearch} />
  )
}
```

### How do I integrate with FHIR servers?

```typescript
import { AuditDb } from '@repo/audit-db'

class FHIRAuditLogger {
  constructor(private auditDb: AuditDb) {}
  
  async logFHIROperation(operation: {
    resource: string
    id?: string
    action: 'create' | 'read' | 'update' | 'delete' | 'search'
    user: string
    outcome: 'success' | 'failure'
    details?: any
  }) {
    await this.auditDb.logAuditEvent({
      action: `fhir.${operation.resource}.${operation.action}`,
      principalId: operation.user,
      principalType: 'fhir_client',
      resourceType: operation.resource,
      resourceId: operation.id,
      status: operation.outcome,
      metadata: {
        fhirVersion: '4.0.1',
        operationDetails: operation.details,
        compliance: {
          hipaa: true,
          dataCategory: this.getDataCategory(operation.resource)
        }
      }
    })
  }
  
  private getDataCategory(resource: string): string {
    const phiResources = ['Patient', 'Encounter', 'Observation', 'Condition']
    return phiResources.includes(resource) ? 'PHI' : 'non-PHI'
  }
}

// Usage
const fhirAudit = new FHIRAuditLogger(auditDb)

// Log patient access
await fhirAudit.logFHIROperation({
  resource: 'Patient',
  id: 'patient-123',
  action: 'read',
  user: 'physician-456',
  outcome: 'success'
})
```

## Best Practices

### What are the recommended audit logging patterns?

**1. Log Early and Often:**
```typescript
// Log both attempts and outcomes
await auditDb.logAuditEvent({ status: 'attempt', ... })
try {
  // Perform sensitive operation
  const result = await accessPatientData(patientId)
  await auditDb.logAuditEvent({ status: 'success', ... })
} catch (error) {
  await auditDb.logAuditEvent({ status: 'failure', outcomeDescription: error.message })
}
```

**2. Include Contextual Information:**
```typescript
await auditDb.logAuditEvent({
  // Required fields
  action: 'fhir.patient.access',
  principalId: 'user-123',
  status: 'success',
  
  // Contextual information
  sessionContext: {
    sessionId: 'sess-456',
    facilityId: 'hospital-main',
    departmentId: 'cardiology'
  },
  businessContext: {
    caseId: 'case-789',
    appointmentId: 'appt-101112',
    workflowStep: 'initial-assessment'
  }
})
```

**3. Use Consistent Naming Conventions:**
```typescript
// Action naming pattern: system.resource.operation
const actions = {
  'fhir.patient.create',
  'fhir.patient.read',
  'fhir.patient.update',
  'fhir.patient.delete',
  'emr.prescription.create',
  'emr.prescription.dispense',
  'auth.login.attempt',
  'auth.login.success',
  'auth.logout'
}
```

### How should I handle audit logging in microservices?

**Centralized Audit Service:**
```typescript
// Shared audit service
class CentralizedAuditService {
  async logServiceEvent(service: string, event: AuditEvent) {
    await this.auditDb.logAuditEvent({
      ...event,
      serviceContext: {
        serviceName: service,
        serviceVersion: process.env.SERVICE_VERSION,
        instanceId: process.env.HOSTNAME,
        traceId: this.getTraceId()
      }
    })
  }
}

// Usage in individual services
const auditService = new CentralizedAuditService()

// In user service
await auditService.logServiceEvent('user-service', {
  action: 'user.create',
  principalId: 'admin-123',
  status: 'success'
})

// In patient service
await auditService.logServiceEvent('patient-service', {
  action: 'patient.access',
  principalId: 'physician-456',
  status: 'success',
  resourceId: 'patient-789'
})
```

## Migration and Upgrades

### How do I migrate from another audit system?

**Data Migration Script:**
```bash
# Export data from old system
old-audit-system export --format json --output old-audit-data.json

# Transform data format (if needed)
node transform-audit-data.js old-audit-data.json transformed-data.json

# Import into @repo/audit-db
audit-db import --file transformed-data.json --validate --batch-size 1000
```

**Gradual Migration:**
```typescript
// Dual logging during migration period
class DualAuditLogger {
  constructor(
    private oldAuditService: OldAuditService,
    private newAuditDb: AuditDb
  ) {}
  
  async logEvent(event: AuditEvent) {
    // Log to both systems
    await Promise.allSettled([
      this.oldAuditService.log(this.transformToOldFormat(event)),
      this.newAuditDb.logAuditEvent(event)
    ])
  }
}
```

### How do I upgrade between versions?

**Check Version Compatibility:**
```bash
# Check current version
npm list @repo/audit-db

# Check for updates
npm outdated @repo/audit-db

# Review breaking changes
npm info @repo/audit-db versions --json
```

**Migration Process:**
```bash
# 1. Backup existing data
audit-db backup --name "pre-upgrade-backup"

# 2. Update package
npm update @repo/audit-db

# 3. Run migrations
audit-db migrate

# 4. Verify upgrade
audit-db health --recommendations
```

Still have questions? Check our [Roadmap](./roadmap) for upcoming features or reach out to our support team.