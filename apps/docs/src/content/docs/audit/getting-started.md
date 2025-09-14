---
title: Getting Started
description: Complete getting started guide for the @repo/audit-db package with installation, configuration, and first steps.
sidebar_position: 1
---

# Getting Started

Complete guide to get up and running with `@repo/audit-db` for healthcare audit logging with HIPAA and GDPR compliance.

## 📋 Prerequisites

### System Requirements

- **Node.js**: 18+ (compatible with the monorepo setup)
- **PostgreSQL**: 12+ (for database storage)
- **Redis**: 6+ (for distributed caching, optional but recommended)
- **pnpm**: 10+ (package manager for monorepo development)

### Healthcare Compliance Requirements

- HIPAA compliance for patient data access logging
- GDPR compliance for EU data subjects
- 7-year data retention for audit trails
- Cryptographic integrity verification

## 🚀 Installation

### For Monorepo Usage

```bash
# Navigate to your app's or package's directory
cd apps/your-app # or packages/your-package

# Add @repo/audit-db using pnpm
pnpm add '@repo/audit-db@workspace:*'
```

### For External Projects

```bash
# Install via npm/pnpm (when published)
npm install @repo/audit-db
# or
pnpm add @repo/audit-db
```

## ⚙️ Environment Setup

### Required Environment Variables

```env
# Database connection (Required)
AUDIT_DB_URL=\"postgresql://user:password@host:port/database\"

# Redis for caching (Recommended)
REDIS_URL=\"redis://localhost:6379\"

# Connection pool settings (Optional)
AUDIT_DB_POOL_MIN=2
AUDIT_DB_POOL_MAX=10

# Performance monitoring (Optional)
AUDIT_MONITORING_ENABLED=true
AUDIT_SLOW_QUERY_THRESHOLD=1000

# Compliance settings (Required for healthcare)
AUDIT_GDPR_ENABLED=true
AUDIT_HIPAA_ENABLED=true

# Security settings (Recommended)
AUDIT_CRYPTO_SECRET=\"your-secret-key-here\"
AUDIT_HASH_ALGORITHM=\"SHA-256\"
```

### Database Setup

```sql
-- Create audit database
CREATE DATABASE audit_db;

-- Create audit user with appropriate permissions
CREATE USER audit_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE audit_db TO audit_user;

-- Connect to audit database
\\c audit_db;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";
```

## 🏃‍♂️ Quick Start

### 1. Basic Client Setup

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

// Initialize the basic client
const auditDb = new AuditDb()

// Verify connection
const isConnected = await auditDb.checkAuditDbConnection()
if (!isConnected) {
  throw new Error('Failed to connect to audit database')
}

console.log('✅ Connected to audit database')

// Get database instance
const db = auditDb.getDrizzleInstance()
```

### 2. Log Your First Audit Event

```typescript
// Log a user login event
const loginEvent = await db.insert(auditLog).values({
  timestamp: new Date().toISOString(),
  action: 'user.login',
  status: 'success',
  principalId: 'user-123',
  principalType: 'user',
  resourceType: 'authentication',
  sourceIp: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (compatible)',
  metadata: {
    loginMethod: 'email',
    sessionId: 'sess-abc123',
    department: 'healthcare'
  }
}).returning()

console.log('✅ Audit event logged:', loginEvent[0])
```

### 3. Log Healthcare-Specific Events

```typescript
// Log patient record access (HIPAA compliance)
const patientAccess = await db.insert(auditLog).values({
  timestamp: new Date().toISOString(),
  action: 'patient.record.access',
  status: 'success',
  principalId: 'doctor-123',
  principalType: 'healthcare_provider',
  resourceId: 'patient-456',
  resourceType: 'patient_record',
  sourceIp: '10.0.1.50',
  metadata: {
    department: 'cardiology',
    accessReason: 'routine_checkup',
    patientConsent: true,
    dataElements: ['demographics', 'vitals', 'medications'],
    minimumNecessary: true,
    hipaaCompliant: true
  }
}).returning()

console.log('✅ Patient access logged:', patientAccess[0])
```

### 4. Query Audit Events

```typescript
import { eq, desc, gte, and } from 'drizzle-orm'

// Get recent events for a user
const userEvents = await db
  .select()
  .from(auditLog)
  .where(eq(auditLog.principalId, 'user-123'))
  .orderBy(desc(auditLog.timestamp))
  .limit(10)

console.log('📊 User events:', userEvents.length)

// Get recent patient access events
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
const patientAccesses = await db
  .select()
  .from(auditLog)
  .where(
    and(
      eq(auditLog.resourceType, 'patient_record'),
      gte(auditLog.timestamp, yesterday.toISOString())
    )
  )
  .orderBy(desc(auditLog.timestamp))

console.log('🏥 Patient accesses (24h):', patientAccesses.length)
```

## 🔧 Configuration Options

### Basic Configuration

```typescript
import { AuditDbWithConfig } from '@repo/audit-db'

const auditDb = new AuditDbWithConfig({
  connectionString: process.env.AUDIT_DB_URL!,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
  },
  ssl: process.env.NODE_ENV === 'production'
})
```

### Enhanced Configuration for Production

```typescript
import { EnhancedAuditDb } from '@repo/audit-db'

const auditDb = new EnhancedAuditDb({
  connection: {
    connectionString: process.env.AUDIT_DB_URL!,
    ssl: true
  },
  connectionPool: {
    minConnections: 5,
    maxConnections: 25,
    idleTimeout: 30000
  },
  queryCache: {
    enabled: true,
    maxSizeMB: 200,
    defaultTTL: 600
  },
  redis: {
    redisKeyPrefix: 'audit_cache',
    enableLocalCache: true,
    enableCompression: true
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 1000,
    autoOptimization: true
  },
  compliance: {
    gdprEnabled: true,
    hipaaEnabled: true,
    integrityVerification: true
  }
})
```

## 🏥 Healthcare Use Cases

### Patient Data Access Logging

```typescript
class HealthcareAuditLogger {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  async logPatientAccess({
    doctorId,
    patientId,
    department,
    accessReason,
    dataElements
  }: PatientAccessEvent) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'patient.record.access',
      status: 'success',
      principalId: doctorId,
      principalType: 'healthcare_provider',
      resourceId: patientId,
      resourceType: 'patient_record',
      sourceIp: this.getClientIP(),
      metadata: {
        department,
        accessReason,
        dataElements,
        minimumNecessary: true,
        patientConsent: await this.verifyConsent(patientId),
        hipaaCompliant: true
      }
    }).returning()
  }
  
  async logPrescription({
    doctorId,
    patientId,
    medication,
    dosage
  }: PrescriptionEvent) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'prescription.create',
      status: 'success',
      principalId: doctorId,
      principalType: 'healthcare_provider',
      resourceId: `prescription-${Date.now()}`,
      resourceType: 'prescription',
      metadata: {
        patientId,
        medication,
        dosage,
        prescribedAt: new Date().toISOString()
      }
    }).returning()
  }
  
  private async verifyConsent(patientId: string): Promise<boolean> {
    // Implementation to verify patient consent
    return true
  }
  
  private getClientIP(): string {
    return '10.0.1.50' // Implementation specific
  }
}
```

### GDPR Compliance Example

```typescript
class GDPRCompliantLogger {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  async logDataSubjectRequest({
    dataSubjectId,
    requestType,
    dataCategories
  }: DataSubjectRequest) {
    return await this.db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: `gdpr.data_subject.${requestType}`,
      status: 'success',
      principalId: dataSubjectId,
      principalType: 'data_subject',
      resourceType: 'personal_data',
      metadata: {
        requestType,
        dataCategories,
        legalBasis: 'data_subject_rights',
        gdprArticle: this.getGDPRArticle(requestType),
        processingLawfulness: true,
        gdprCompliant: true
      }
    }).returning()
  }
  
  private getGDPRArticle(requestType: string): string {
    const articles = {
      access: 'Article 15',
      rectification: 'Article 16',
      erasure: 'Article 17',
      portability: 'Article 20'
    }
    return articles[requestType] || 'Unknown'
  }
}
```

## 🔍 Database Management

### Schema Migrations

```bash
# Generate new migration after schema changes
pnpm --filter @repo/audit-db db:generate

# Apply pending migrations
pnpm --filter @repo/audit-db db:migrate

# Launch Drizzle Studio for database exploration
pnpm --filter @repo/audit-db db:studio

# Push schema changes directly (development only)
pnpm --filter @repo/audit-db db:push
```

### Database Health Check

```typescript
async function checkDatabaseHealth() {
  const auditDb = new AuditDb()
  
  // Test connection
  const isConnected = await auditDb.checkAuditDbConnection()
  if (!isConnected) {
    throw new Error('Database connection failed')
  }
  
  // Test basic operations
  const db = auditDb.getDrizzleInstance()
  
  try {
    // Test insert
    const testEvent = await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: 'health.check',
      status: 'success',
      principalId: 'system',
      principalType: 'system',
      metadata: { healthCheck: true }
    }).returning()
    
    // Test query
    const recentEvents = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.timestamp))
      .limit(1)
    
    console.log('✅ Database health check passed')
    return { healthy: true, testEventId: testEvent[0].id }
    
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    throw error
  }
}
```

## 🚨 Error Handling

### Comprehensive Error Management

```typescript
class RobustAuditLogger {
  private db: ReturnType<AuditDb['getDrizzleInstance']>
  
  constructor() {
    const auditDb = new AuditDb()
    this.db = auditDb.getDrizzleInstance()
  }
  
  async logEventSafely(eventData: AuditEventData, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.db
          .insert(auditLog)
          .values({
            timestamp: new Date().toISOString(),
            ...eventData
          })
          .returning()
        
        console.log(`✅ Event logged successfully (attempt ${attempt})`, result[0].id)
        return result[0]
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error)
        
        if (attempt === retries) {
          // Log failure for audit trail
          await this.logFailure(eventData, error)
          throw error
        }
        
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        )
      }
    }
  }
  
  private async logFailure(originalData: any, error: any) {
    try {
      await this.db.insert(auditLog).values({
        timestamp: new Date().toISOString(),
        action: 'audit.logging.failure',
        status: 'failure',
        principalId: originalData.principalId || 'unknown',
        principalType: 'system',
        metadata: {
          originalAction: originalData.action,
          errorMessage: error.message,
          failureTime: new Date().toISOString()
        }
      })
    } catch (logError) {
      console.error('Failed to log audit failure:', logError)
    }
  }
}
```

## 📋 Development Checklist

### Initial Setup

- [ ] Install `@repo/audit-db` package
- [ ] Configure environment variables
- [ ] Set up PostgreSQL database
- [ ] Verify database connection
- [ ] Run initial schema migration

### Basic Implementation

- [ ] Initialize audit client
- [ ] Implement basic event logging
- [ ] Add error handling
- [ ] Test with sample events
- [ ] Verify events in database

### Healthcare Compliance

- [ ] Enable HIPAA compliance features
- [ ] Configure GDPR settings
- [ ] Implement patient consent verification
- [ ] Set up data retention policies
- [ ] Test compliance reporting

### Production Readiness

- [ ] Configure enhanced client
- [ ] Set up Redis caching
- [ ] Enable performance monitoring
- [ ] Configure alerting
- [ ] Set up automated backups

## 🔗 Common Integration Patterns

### Express.js Integration

```typescript
import express from 'express'
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

const app = express()
const auditDb = new AuditDb()
const db = auditDb.getDrizzleInstance()

// Audit middleware
app.use(async (req, res, next) => {
  const startTime = Date.now()
  
  res.on('finish', async () => {
    const processingTime = Date.now() - startTime
    
    await db.insert(auditLog).values({
      timestamp: new Date().toISOString(),
      action: `api.${req.method.toLowerCase()}.${req.path}`,
      status: res.statusCode < 400 ? 'success' : 'failure',
      principalId: req.user?.id || 'anonymous',
      sourceIp: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        processingTime
      }
    })
  })
  
  next()
})
```

### React Hook Integration

```typescript
import { useCallback } from 'react'

export function useAuditLogger() {
  const logEvent = useCallback(async (event: AuditEvent) => {
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
          sessionContext: {
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        })
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }, [])
  
  return { logEvent }
}
```

## 🎯 Next Steps

Now that you have the basics working, explore advanced features:

### Performance & Scalability
- **[Performance Optimization](./performance-optimization)** - Advanced performance tuning
- **[Caching Strategies](./caching-strategies)** - Redis-based caching
- **[Database Partitioning](./partitioning-guide)** - Large-scale data management

### Compliance & Security
- **[Compliance Features](./compliance-features)** - HIPAA/GDPR implementation
- **[Security](./security)** - Security best practices

### Development & Operations
- **[Examples](./examples)** - Comprehensive code examples
- **[CLI Reference](./cli-reference)** - Command-line tools
- **[FAQ](./faq)** - Common questions and solutions

## 🎉 Congratulations!

You've successfully set up `@repo/audit-db` for healthcare audit logging. Your system now provides:

- ✅ HIPAA and GDPR compliant audit trails
- ✅ Robust error handling and retry mechanisms
- ✅ Healthcare-specific event logging
- ✅ Database health monitoring
- ✅ Production-ready configuration

Start logging your first healthcare audit events and explore the advanced features as your needs grow!