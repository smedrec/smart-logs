# Your First Audit Event

This tutorial will guide you through creating your first audit event using the `@repo/audit` package. You'll learn the basics of event logging, understand different event types, and see practical examples for healthcare applications.

## 📋 Prerequisites

Before starting this tutorial, ensure you have:

- ✅ Completed the [Installation Guide](./installation.md)
- ✅ Configured your environment using the [Configuration Guide](./configuration.md)
- ✅ PostgreSQL and Redis running
- ✅ Basic TypeScript knowledge

## 🚀 Quick Start

Let's create your first audit event with minimal setup:

### Step 1: Initialize the Audit Service

```typescript
// src/audit-setup.ts
import { Audit, AuditConfig } from '@repo/audit'
import { db } from '@repo/audit-db' // Your database connection

// Basic configuration for development
const config: AuditConfig = {
  version: '1.0',
  environment: 'development',
  reliableProcessor: {
    queueName: 'my-first-audit'
  }
}

// Create audit service instance
export const auditService = new Audit(config, db)
```

### Step 2: Log Your First Event

```typescript
// src/first-event.ts
import { auditService } from './audit-setup'

async function logFirstEvent() {
  try {
    // Create a simple audit event
    await auditService.log({
      principalId: 'user-123',
      action: 'user.first_login',
      status: 'success',
      outcomeDescription: 'User successfully completed first login',
      details: {
        timestamp: new Date().toISOString(),
        userAgent: 'Tutorial/1.0',
        ipAddress: '127.0.0.1'
      }
    })
    
    console.log('✅ First audit event logged successfully!')
  } catch (error) {
    console.error('❌ Failed to log audit event:', error)
  }
}

// Run the function
logFirstEvent()
```

### Step 3: Verify the Event

```typescript
// src/verify-event.ts
import { db } from '@repo/audit-db'

async function verifyFirstEvent() {
  try {
    // Query the audit_log table to see your event
    const events = await db.select()
      .from(auditLog)
      .where(eq(auditLog.action, 'user.first_login'))
      .limit(1)
    
    if (events.length > 0) {
      console.log('✅ Event found in database:', events[0])
    } else {
      console.log('❌ No events found')
    }
  } catch (error) {
    console.error('Error querying events:', error)
  }
}

verifyFirstEvent()
```

## 🏥 Healthcare-Specific Events

Now let's explore healthcare-specific audit events that are common in medical applications:

### Authentication Events

Healthcare systems require detailed authentication logging:

```typescript
// User login event
await auditService.logAuth({
  principalId: 'dr.smith@hospital.com',
  action: 'login',
  status: 'success',
  authMethod: 'password',
  sessionContext: {
    sessionId: 'sess_abc123',
    ipAddress: '192.168.1.100',
    userAgent: 'EMR-Browser/2.1',
    location: 'Emergency Department'
  },
  outcomeDescription: 'Physician successfully logged into EMR system'
})

// Failed login attempt
await auditService.logAuth({
  principalId: 'unknown_user@hospital.com',
  action: 'login',
  status: 'failure',
  authMethod: 'password',
  reason: 'Invalid credentials',
  sessionContext: {
    ipAddress: '192.168.1.200',
    userAgent: 'Unknown-Client/1.0'
  },
  outcomeDescription: 'Failed login attempt detected'
})
```

### FHIR Resource Access

Log access to patient data through FHIR resources:

```typescript
// Patient record access
await auditService.logFHIR({
  principalId: 'practitioner-456',
  organizationId: 'hospital-central',
  action: 'fhir.patient.read',
  resourceType: 'Patient',
  resourceId: 'patient-789',
  status: 'success',
  sessionContext: {
    sessionId: 'sess_def456',
    ipAddress: '10.0.1.50',
    userAgent: 'EMR-System/3.2'
  },
  fhirContext: {
    version: 'R4',
    interaction: 'read',
    compartment: 'Patient/patient-789',
    endpoint: '/fhir/Patient/patient-789'
  },
  outcomeDescription: 'Physician accessed patient record for consultation'
})

// Medication order creation
await auditService.logFHIR({
  principalId: 'doctor-123',
  action: 'fhir.medicationrequest.create',
  resourceType: 'MedicationRequest',
  resourceId: 'med-req-456',
  status: 'success',
  fhirContext: {
    version: 'R4',
    interaction: 'create',
    medication: 'Lisinopril 10mg',
    patient: 'patient-789'
  },
  outcomeDescription: 'New medication prescribed for hypertension'
})
```

### Data Modification Events

Track changes to sensitive medical data:

```typescript
// Patient information update
await auditService.logData({
  principalId: 'nurse-789',
  action: 'patient.update',
  resourceType: 'Patient',
  resourceId: 'patient-123',
  status: 'success',
  dataClassification: 'PHI',
  changes: {
    field: 'contactPhone',
    oldValue: '(555) 123-4567',
    newValue: '(555) 987-6543'
  },
  sessionContext: {
    sessionId: 'sess_ghi789',
    department: 'Cardiology',
    workstation: 'CARD-WS-01'
  },
  outcomeDescription: 'Patient contact information updated'
})
```

## 🔒 Security and Compliance Events

Log security-related events for compliance:

```typescript
// Security incident
await auditService.logCritical({
  principalId: 'security-system',
  action: 'security.unauthorized_access',
  status: 'failure',
  dataClassification: 'CONFIDENTIAL',
  securityContext: {
    threatLevel: 'medium',
    attackVector: 'brute_force_login',
    blockedIP: '203.0.113.1',
    detectionRule: 'FAILED_LOGIN_THRESHOLD'
  },
  outcomeDescription: 'Blocked IP after 5 failed login attempts'
}, {
  priority: 1, // High priority for immediate processing
  compliance: ['hipaa'], // Mark for HIPAA compliance reporting
  notify: ['security-team'] // Immediate notification
})

// Data export for GDPR request
await auditService.log({
  principalId: 'privacy-officer@hospital.com',
  action: 'gdpr.data_export',
  targetResourceType: 'Patient',
  targetResourceId: 'patient-456',
  status: 'success',
  complianceContext: {
    regulation: 'GDPR',
    requestType: 'data_portability',
    requestId: 'gdpr-req-789',
    legalBasis: 'consent'
  },
  outcomeDescription: 'Patient data exported for GDPR portability request'
})
```

## 🎯 Event Types and Categories

The audit system automatically categorizes events based on their action patterns:

### System Events

```typescript
// System startup
await auditService.log({
  principalId: 'system',
  action: 'system.startup',
  status: 'success',
  systemComponent: 'EMR-Core',
  outcomeDescription: 'EMR system started successfully'
})

// Configuration change
await auditService.log({
  principalId: 'admin-123',
  action: 'system.config_change',
  status: 'success',
  configurationChanges: {
    sessionTimeout: {
      old: '30 minutes',
      new: '15 minutes'
    }
  },
  outcomeDescription: 'Updated session timeout for security compliance'
})
```

### Data Events

```typescript
// Bulk data processing
await auditService.logData({
  principalId: 'etl-system',
  action: 'data.batch_import',
  resourceType: 'LabResult',
  status: 'success',
  dataVolume: {
    recordsProcessed: 1500,
    recordsSuccessful: 1498,
    recordsFailed: 2
  },
  outcomeDescription: 'Daily lab results imported from external system'
})
```

## 🔍 Event Validation and Best Practices

### Required Fields

All audit events must include these fields:

```typescript
const requiredEvent = {
  action: 'user.action',     // What happened (required)
  status: 'success',         // Outcome (required)
  principalId: 'user-123',   // Who did it (recommended)
  timestamp: '2024-01-15T10:30:00.000Z', // When (auto-generated if not provided)
  outcomeDescription: 'Description of what happened' // Details (recommended)
}
```

### Field Validation

The system validates events automatically:

```typescript
try {
  // This will fail validation - missing required 'status' field
  await auditService.log({
    action: 'invalid.event',
    // status: missing!
    principalId: 'user-123'
  })
} catch (error) {
  console.error('Validation error:', error.message)
  // Output: "Validation error: Missing required field 'status'"
}
```

### Best Practices for Event Data

```typescript
// ✅ Good: Clear, specific action names
await auditService.log({
  action: 'patient.chart.view',
  status: 'success',
  principalId: 'dr.jones@hospital.com'
})

// ❌ Avoid: Vague action names
await auditService.log({
  action: 'access',  // Too vague
  status: 'success'
})

// ✅ Good: Include relevant context
await auditService.log({
  action: 'patient.chart.print',
  status: 'success',
  principalId: 'nurse-456',
  sessionContext: {
    sessionId: 'sess_123',
    department: 'ICU',
    printerLocation: 'ICU-Printer-01'
  },
  details: {
    chartSections: ['medications', 'vitals', 'notes'],
    pageCount: 5
  }
})
```

## 🔧 Error Handling

Handle potential errors gracefully:

```typescript
async function robustAuditLogging() {
  try {
    await auditService.log({
      principalId: 'user-123',
      action: 'patient.access',
      status: 'success'
    })
  } catch (error) {
    if (error.name === 'AuditValidationError') {
      console.error('Event validation failed:', error.message)
      // Handle validation errors (fix the event data)
    } else if (error.name === 'RedisConnectionError') {
      console.error('Queue service unavailable:', error.message)
      // Handle queue failures (maybe store locally temporarily)
    } else {
      console.error('Unexpected audit error:', error)
      // Handle other errors
    }
  }
}
```

## 📊 Monitoring Your Events

Check that your events are being processed:

```typescript
// Get audit service health
const health = await auditService.getHealth()
console.log('Audit service health:', health)

// Check queue status
const queueStats = await auditService.getQueueStats()
console.log('Queue stats:', {
  waiting: queueStats.waiting,
  active: queueStats.active,
  completed: queueStats.completed,
  failed: queueStats.failed
})
```

## 🧹 Cleanup

Don't forget to close connections when your application shuts down:

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down audit service...')
  await auditService.closeConnection()
  console.log('Audit service closed')
  process.exit(0)
})
```

## ✅ Verification Checklist

After completing this tutorial, verify that:

- [ ] You can create and log basic audit events
- [ ] Events appear in your PostgreSQL database
- [ ] Healthcare-specific events (auth, FHIR, data) work correctly
- [ ] Event validation catches missing required fields
- [ ] Error handling works for invalid events
- [ ] Queue processing is working (check Redis)

## 🚨 Common Issues

### Issue: Events Not Appearing in Database

**Possible Causes:**
- Queue worker not processing events
- Database connection issues
- Redis connection problems

**Debug Steps:**
```typescript
// Check queue status
const stats = await auditService.getQueueStats()
console.log('Queue stats:', stats)

// Check database connection
const testQuery = await db.select().from(auditLog).limit(1)
console.log('Database working:', testQuery)
```

### Issue: Validation Errors

**Common Problems:**
- Missing required fields (`action`, `status`)
- Invalid enum values for `status`
- Malformed timestamps

**Solution:**
```typescript
// Use TypeScript interfaces for type safety
import type { AuditLogEvent } from '@repo/audit'

const event: AuditLogEvent = {
  action: 'user.login',
  status: 'success', // Must be: 'attempt' | 'success' | 'failure'
  principalId: 'user-123',
  timestamp: new Date().toISOString() // Valid ISO format
}
```

## 📝 Next Steps

Congratulations! You've successfully created your first audit events. Now explore:

1. **[Healthcare Compliance Tutorial](../tutorials/healthcare-compliance.md)** - Learn HIPAA/GDPR compliance features
2. **[FHIR Integration Tutorial](../tutorials/fhir-integration.md)** - Deep dive into FHIR resource auditing
3. **[Security Configuration Tutorial](../tutorials/security-configuration.md)** - Enable cryptographic security features
4. **[Monitoring Setup Tutorial](../tutorials/monitoring-setup.md)** - Set up observability and alerting
5. **[API Reference](../api-reference/)** - Explore all available methods and options

## 💡 Pro Tips

- **Start simple**: Begin with basic events and add complexity gradually
- **Use TypeScript**: Leverage type safety to avoid validation errors
- **Test thoroughly**: Verify events in both queue and database
- **Monitor performance**: Watch queue depth and processing latency
- **Follow naming conventions**: Use clear, consistent action names
- **Include context**: Add relevant session and system context
- **Handle errors**: Always wrap audit calls in try-catch blocks

Need help? Check the [FAQ](../faq/general.md) or [Troubleshooting Guide](../troubleshooting/common-issues.md)!