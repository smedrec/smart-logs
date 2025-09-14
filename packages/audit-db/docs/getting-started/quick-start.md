# Quick Start Tutorial

Get up and running with `@repo/audit-db` in just a few minutes! This tutorial will guide you through the essential operations you need to start using the audit database.

## Overview

In this tutorial, you'll learn how to:
- Initialize a database client
- Perform basic audit logging operations
- Query audit events
- Handle errors properly
- Set up basic performance monitoring

**Time to complete**: 5-10 minutes

## Prerequisites

- ✅ Completed [Installation](./installation.md)
- ✅ Database connection verified
- ✅ Environment variables configured

## Step 1: Initialize Your First Client

Let's start with the basic `AuditDb` client:

```typescript
// quick-start-example.ts
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

async function main() {
  // Initialize the audit database client
  const auditDb = new AuditDb()
  
  // Verify the connection
  const isConnected = await auditDb.checkAuditDbConnection()
  if (!isConnected) {
    throw new Error('Failed to connect to audit database')
  }
  
  console.log('✅ Connected to audit database')
  
  // Get the Drizzle ORM instance for queries
  const db = auditDb.getDrizzleInstance()
  
  return { auditDb, db }
}

main().catch(console.error)
```

## Step 2: Log Your First Audit Event

Now let's log an audit event:

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

async function logAuditEvent() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  try {
    // Log a user login event
    const newEvent = await db
      .insert(auditLog)
      .values({
        timestamp: new Date().toISOString(),
        action: 'user.login',
        status: 'success',
        principalId: 'user-123',
        principalType: 'user',
        resourceType: 'authentication',
        sourceIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (compatible audit client)',
        metadata: {
          loginMethod: 'email',
          department: 'healthcare'
        }
      })
      .returning()
    
    console.log('✅ Audit event logged:', newEvent[0])
    return newEvent[0]
    
  } catch (error) {
    console.error('❌ Failed to log audit event:', error)
    throw error
  }
}

// Usage
logAuditEvent()
```

## Step 3: Query Audit Events

Learn how to retrieve and filter audit events:

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'
import { eq, gte, and, desc } from 'drizzle-orm'

async function queryAuditEvents() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  try {
    // Get recent events (last 10)
    const recentEvents = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.timestamp))
      .limit(10)
    
    console.log('📊 Recent events:', recentEvents.length)
    
    // Get events for a specific user
    const userEvents = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.principalId, 'user-123'))
      .orderBy(desc(auditLog.timestamp))
    
    console.log('👤 User events:', userEvents.length)
    
    // Get events from the last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const recentActivity = await db
      .select()
      .from(auditLog)
      .where(gte(auditLog.timestamp, yesterday.toISOString()))
      .orderBy(desc(auditLog.timestamp))
    
    console.log('⏰ Last 24h events:', recentActivity.length)
    
    // Get failed login attempts
    const failedLogins = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, 'user.login'),
          eq(auditLog.status, 'failure')
        )
      )
      .orderBy(desc(auditLog.timestamp))
    
    console.log('🔒 Failed logins:', failedLogins.length)
    
    return {
      recentEvents,
      userEvents,
      recentActivity,
      failedLogins
    }
    
  } catch (error) {
    console.error('❌ Failed to query audit events:', error)
    throw error
  }
}

// Usage
queryAuditEvents()
```

## Step 4: Healthcare-Specific Examples

Here are examples specific to healthcare audit logging:

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

async function healthcareAuditExamples() {
  const auditDb = new AuditDb()
  const db = auditDb.getDrizzleInstance()
  
  // Example 1: Patient record access
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'patient.record.access',
    status: 'success',
    principalId: 'doctor-456',
    principalType: 'healthcare_provider',
    resourceId: 'patient-789',
    resourceType: 'patient_record',
    sourceIp: '10.0.1.50',
    metadata: {
      department: 'cardiology',
      accessReason: 'routine_checkup',
      patientConsent: true,
      dataElements: ['demographics', 'vitals', 'medications']
    }
  })
  
  // Example 2: Prescription creation
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'prescription.create',
    status: 'success',
    principalId: 'doctor-456',
    principalType: 'healthcare_provider',
    resourceId: 'prescription-101',
    resourceType: 'prescription',
    metadata: {
      patientId: 'patient-789',
      medicationId: 'med-202',
      dosage: '10mg',
      frequency: 'twice_daily',
      duration: '30_days'
    }
  })
  
  // Example 3: Lab result access
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'lab_result.access',
    status: 'success',
    principalId: 'nurse-303',
    principalType: 'healthcare_provider',
    resourceId: 'lab-result-404',
    resourceType: 'lab_result',
    metadata: {
      patientId: 'patient-789',
      testType: 'blood_glucose',
      urgency: 'routine',
      accessedBy: 'primary_care_team'
    }
  })
  
  console.log('✅ Healthcare audit events logged')
}

// Usage
healthcareAuditExamples()
```

## Step 5: Error Handling and Best Practices

Implement proper error handling and logging:

```typescript
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'

class AuditLogger {
  private auditDb: AuditDb
  private db: any
  
  constructor() {
    this.auditDb = new AuditDb()
    this.db = this.auditDb.getDrizzleInstance()
  }
  
  async initialize(): Promise<boolean> {
    try {
      const isConnected = await this.auditDb.checkAuditDbConnection()
      if (!isConnected) {
        throw new Error('Database connection failed')
      }
      console.log('✅ AuditLogger initialized')
      return true
    } catch (error) {
      console.error('❌ AuditLogger initialization failed:', error)
      return false
    }
  }
  
  async logEvent(eventData: {
    action: string
    status: 'success' | 'failure' | 'warning'
    principalId: string
    principalType?: string
    resourceId?: string
    resourceType?: string
    sourceIp?: string
    userAgent?: string
    metadata?: Record<string, any>
  }) {
    try {
      const event = await this.db
        .insert(auditLog)
        .values({
          timestamp: new Date().toISOString(),
          ...eventData
        })
        .returning()
      
      console.log(`✅ Audit event logged: ${eventData.action}`)
      return event[0]
      
    } catch (error) {
      console.error(`❌ Failed to log audit event: ${eventData.action}`, error)
      
      // Log the failure itself (if possible)
      try {
        await this.db.insert(auditLog).values({
          timestamp: new Date().toISOString(),
          action: 'audit.logging.failure',
          status: 'failure',
          principalId: 'system',
          principalType: 'system',
          metadata: {
            originalAction: eventData.action,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined
          }
        })
      } catch (logError) {
        console.error('❌ Failed to log audit failure:', logError)
      }
      
      throw error
    }
  }
  
  async getEventsByUser(principalId: string, limit: number = 10) {
    try {
      return await this.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.principalId, principalId))
        .orderBy(desc(auditLog.timestamp))
        .limit(limit)
    } catch (error) {
      console.error('❌ Failed to query events by user:', error)
      throw error
    }
  }
  
  async getEventsByAction(action: string, limit: number = 10) {
    try {
      return await this.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, action))
        .orderBy(desc(auditLog.timestamp))
        .limit(limit)
    } catch (error) {
      console.error('❌ Failed to query events by action:', error)
      throw error
    }
  }
}

// Usage example
async function useAuditLogger() {
  const logger = new AuditLogger()
  
  // Initialize
  const initialized = await logger.initialize()
  if (!initialized) {
    console.error('Failed to initialize audit logger')
    return
  }
  
  // Log some events
  await logger.logEvent({
    action: 'user.login',
    status: 'success',
    principalId: 'user-123',
    principalType: 'user',
    sourceIp: '192.168.1.100'
  })
  
  await logger.logEvent({
    action: 'patient.record.access',
    status: 'success',
    principalId: 'doctor-456',
    principalType: 'healthcare_provider',
    resourceId: 'patient-789',
    resourceType: 'patient_record',
    metadata: {
      department: 'emergency',
      urgency: 'high'
    }
  })
  
  // Query events
  const userEvents = await logger.getEventsByUser('user-123')
  const loginEvents = await logger.getEventsByAction('user.login')
  
  console.log('User events:', userEvents.length)
  console.log('Login events:', loginEvents.length)
}

// Run the example
useAuditLogger().catch(console.error)
```

## Step 6: Performance Monitoring (Optional)

Get started with basic performance monitoring:

```typescript
import { AuditDb } from '@repo/audit-db'

async function performanceExample() {
  const auditDb = new AuditDb()
  
  // Time a query
  const startTime = Date.now()
  
  const db = auditDb.getDrizzleInstance()
  const events = await db
    .select()
    .from(auditLog)
    .limit(100)
  
  const endTime = Date.now()
  const queryTime = endTime - startTime
  
  console.log(`📊 Query completed in ${queryTime}ms`)
  console.log(`📊 Retrieved ${events.length} events`)
  
  // Log performance metrics
  await db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    action: 'performance.query.metrics',
    status: 'success',
    principalId: 'system',
    principalType: 'system',
    metadata: {
      queryType: 'select_recent_events',
      executionTime: queryTime,
      recordCount: events.length,
      performanceCategory: queryTime > 1000 ? 'slow' : 'normal'
    }
  })
}

performanceExample()
```

## Complete Working Example

Here's a complete example that puts it all together:

```typescript
// complete-example.ts
import { AuditDb } from '@repo/audit-db'
import { auditLog } from '@repo/audit-db/schema'
import { eq, gte, desc } from 'drizzle-orm'

async function completeExample() {
  console.log('🚀 Starting audit database quick start example')
  
  try {
    // 1. Initialize
    const auditDb = new AuditDb()
    const isConnected = await auditDb.checkAuditDbConnection()
    
    if (!isConnected) {
      throw new Error('Database connection failed')
    }
    console.log('✅ Database connected')
    
    const db = auditDb.getDrizzleInstance()
    
    // 2. Log some sample events
    const events = [
      {
        action: 'user.login',
        status: 'success' as const,
        principalId: 'user-123',
        principalType: 'user',
        sourceIp: '192.168.1.100'
      },
      {
        action: 'patient.record.access',
        status: 'success' as const,
        principalId: 'doctor-456',
        principalType: 'healthcare_provider',
        resourceId: 'patient-789',
        resourceType: 'patient_record',
        metadata: { department: 'cardiology' }
      },
      {
        action: 'prescription.create',
        status: 'success' as const,
        principalId: 'doctor-456',
        principalType: 'healthcare_provider',
        resourceId: 'prescription-101',
        resourceType: 'prescription',
        metadata: { patientId: 'patient-789', medication: 'aspirin' }
      }
    ]
    
    for (const eventData of events) {
      await db.insert(auditLog).values({
        timestamp: new Date().toISOString(),
        ...eventData
      })
      console.log(`✅ Logged: ${eventData.action}`)
    }
    
    // 3. Query the events
    const recentEvents = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.timestamp))
      .limit(5)
    
    console.log(`📊 Found ${recentEvents.length} recent events:`)
    recentEvents.forEach(event => {
      console.log(`  - ${event.action} by ${event.principalId} at ${event.timestamp}`)
    })
    
    // 4. Query by user
    const doctorEvents = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.principalId, 'doctor-456'))
      .orderBy(desc(auditLog.timestamp))
    
    console.log(`👨‍⚕️ Doctor has ${doctorEvents.length} events`)
    
    console.log('🎉 Quick start example completed successfully!')
    
  } catch (error) {
    console.error('❌ Example failed:', error)
    throw error
  }
}

// Run the complete example
completeExample()
```

To run this example:

```bash
# Save as complete-example.ts and run
npx tsx complete-example.ts
```

## Next Steps

Congratulations! You've successfully:
- ✅ Connected to the audit database
- ✅ Logged audit events
- ✅ Queried audit data
- ✅ Implemented error handling
- ✅ Explored healthcare-specific examples

### Where to go next:

#### For Basic Usage
- **[Configuration Guide](./configuration.md)** - Learn about configuration options
- **[Basic Usage Tutorial](../tutorials/basic-usage.md)** - Dive deeper into common operations

#### For Advanced Features
- **[Performance Optimization](../tutorials/performance-optimization.md)** - Use the enhanced client
- **[Redis Caching](../tutorials/redis-caching.md)** - Implement distributed caching
- **[Database Partitioning](../tutorials/partitioning-setup.md)** - Set up partitioning for large datasets

#### For Compliance
- **[Compliance Configuration](../tutorials/compliance-configuration.md)** - GDPR/HIPAA compliance
- **[Security Best Practices](../guides/security-compliance.md)** - Security guidelines

#### For Production
- **[Environment Setup](../guides/environment-setup.md)** - Production configuration
- **[Monitoring Setup](../guides/monitoring-alerts.md)** - Health monitoring and alerts

## Troubleshooting

### Common Issues

**Connection errors**: Check your `AUDIT_DB_URL` environment variable and ensure PostgreSQL is running.

**Permission errors**: Ensure your database user has the necessary permissions on the audit database.

**Import errors**: Make sure you've installed all dependencies with `pnpm install`.

For more help, see the [Troubleshooting Guide](../guides/troubleshooting.md) or [FAQ](../faq.md).

## Summary

You've learned the essentials of using `@repo/audit-db`:

- How to initialize and connect to the database
- How to log healthcare audit events
- How to query and filter audit data
- How to implement proper error handling
- How to monitor basic performance

This foundation will serve you well as you explore the more advanced features of the package!