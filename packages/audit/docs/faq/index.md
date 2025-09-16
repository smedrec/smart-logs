# Frequently Asked Questions (FAQ)

Answers to common questions about implementing and using the `@repo/audit` package in healthcare environments.

## 📋 General Questions

### What is the @repo/audit package?

The `@repo/audit` package is a comprehensive audit logging system designed specifically for healthcare applications. It provides:

- **HIPAA and GDPR compliant** audit event logging
- **Cryptographic integrity** with tamper detection
- **Reliable event processing** with guaranteed delivery
- **FHIR-specific** audit capabilities
- **Real-time monitoring** and alerting
- **High-performance** batch processing

### Why is audit logging important in healthcare?

Healthcare audit logging is critical for:

- **Regulatory Compliance**: HIPAA requires detailed audit controls (45 CFR §164.312(b))
- **Security Monitoring**: Detect unauthorized access to Protected Health Information (PHI)
- **Legal Protection**: Provide evidence of proper data handling procedures
- **Quality Assurance**: Track system usage and identify improvement opportunities
- **Breach Detection**: Identify and respond to potential security incidents

### What makes this package healthcare-specific?

Key healthcare features include:

- **FHIR Integration**: Native support for HL7 FHIR resource audit events
- **PHI Protection**: Specialized handling of Protected Health Information
- **HIPAA Compliance**: Built-in validation for HIPAA audit requirements
- **Clinical Workflows**: Pre-built patterns for common medical scenarios
- **Break-Glass Access**: Emergency access tracking and monitoring
- **Medical Terminology**: Healthcare-specific action types and classifications

## 🏥 Healthcare Compliance

### Does this package meet HIPAA requirements?

Yes, when properly configured, the package meets HIPAA audit control requirements:

- **§164.312(b) Audit Controls**: Records and examines access to ePHI
- **§164.308(a)(1)(ii)(D) Information System Activity Review**: Enables regular monitoring
- **§164.316(b)(2) Documentation**: Maintains required 6-year retention
- **§164.308(a)(5) Assigned Security Responsibility**: Provides accountability tracking

**Example HIPAA-compliant configuration:**
```typescript
const hipaaConfig: AuditConfig = {
  compliance: {
    hipaa: {
      enabled: true,
      retentionYears: 6,
      requiredFields: ['principalId', 'targetResourceType', 'sessionContext'],
      enableSecurityIncidentReporting: true
    }
  },
  security: {
    enableTamperDetection: true,
    requireDigitalSignatures: true
  }
}
```

### How does it support GDPR compliance?

The package includes comprehensive GDPR support:

- **Data Subject Rights**: Export, deletion, and portability
- **Legal Basis Tracking**: Document lawful basis for processing
- **Consent Management**: Track consent status and withdrawals
- **Breach Notification**: 72-hour notification capabilities
- **Data Minimization**: Configurable data reduction strategies

**Example GDPR implementation:**
```typescript
// Log GDPR-compliant data processing
await GDPRAuditService.logDataProcessing({
  principalId: 'nurse-456',
  dataSubjectId: 'patient-123',
  processingPurpose: 'medical_treatment',
  legalBasis: 'vital_interests',
  dataCategories: ['medical_history', 'current_symptoms'],
  retentionPeriod: 365
})
```

### What about other healthcare regulations?

The package is designed to support additional regulations:

- **21 CFR Part 11**: FDA electronic records requirements
- **SOC 2 Type II**: Security and availability controls
- **HITECH**: Health Information Technology compliance
- **State Privacy Laws**: California CPPA, Illinois BIPA, etc.

Custom compliance configurations can be implemented for specific regulatory requirements.

## 🔒 Security Questions

### How secure are the audit logs?

Audit logs use multiple security layers:

1. **Cryptographic Hashing**: SHA-256 for tamper detection
2. **Digital Signatures**: HMAC-SHA256 for authenticity
3. **Encryption**: AES-256-GCM for data protection
4. **Key Management**: Integration with Infisical KMS
5. **Access Controls**: Role-based access to audit data

**Security verification example:**
```typescript
// Verify event integrity
const isIntact = auditService.verifyEventHash(event, expectedHash)
const isAuthentic = await auditService.verifyEventSignature(event, signature)

if (!isIntact || !isAuthentic) {
  // Handle potential tampering
  await handleSecurityIncident('audit_log_tampering')
}
```

### Can audit logs be tampered with?

The package provides strong tamper protection:

- **Immutable Hashes**: Each event has a cryptographic hash
- **Digital Signatures**: Events are signed with secret keys
- **Chain Verification**: Sequential hash verification available
- **Real-time Monitoring**: Automatic integrity checking
- **Breach Detection**: Immediate alerts on tampering attempts

However, security depends on proper implementation and key management.

### How are encryption keys managed?

The package supports multiple key management options:

1. **Infisical KMS**: Recommended for production environments
2. **Hardware Security Modules (HSM)**: For high-security requirements
3. **Environment Variables**: For development/testing
4. **Custom Key Providers**: Extensible key management interface

**Best practices:**
- Rotate keys every 30-90 days
- Use hardware-backed key storage in production
- Implement key escrow for compliance
- Monitor key access and usage

## ⚡ Performance Questions

### How fast can it process events?

Performance depends on configuration and infrastructure:

- **Standard Setup**: 1,000-5,000 events/second
- **Optimized Configuration**: 10,000+ events/second
- **High-Performance Setup**: 50,000+ events/second

**Performance optimization example:**
```typescript
const highPerformanceConfig = {
  reliableProcessor: {
    batchSize: 500,           // Large batches
    concurrency: 20,          // Many workers
    enableBatching: true,     // Batch processing
    enableCircuitBreaker: true
  }
}
```

### Will audit logging slow down my application?

With proper configuration, audit logging has minimal impact:

- **Asynchronous Processing**: Events are queued, not blocking
- **Batch Operations**: Multiple events processed together
- **Circuit Breaker**: Prevents cascade failures
- **Graceful Degradation**: Continues operation during issues

**Non-blocking implementation:**
```typescript
// This returns immediately, doesn't block application
await auditService.log({
  principalId: 'user-123',
  action: 'patient.view',
  status: 'success'
})
// Application continues without waiting for processing
```

### How much storage space is required?

Storage requirements vary by volume and retention:

- **Typical Event Size**: 1-5 KB per event
- **Daily Volume Example**: 100,000 events = ~500 MB/day
- **6-Year HIPAA Retention**: ~1 TB per 100k events/day
- **Compression**: 50-70% reduction with proper archival

**Storage optimization strategies:**
- Implement table partitioning
- Use data compression
- Archive old events to cold storage
- Implement tiered storage policies

## 🔧 Integration Questions

### How do I integrate with my existing EMR system?

Integration approaches depend on your EMR architecture:

1. **API Middleware**: Intercept API calls and add audit logging
2. **Database Triggers**: Audit database changes automatically
3. **Event Bus Integration**: Subscribe to application events
4. **Direct Integration**: Add audit calls to application code

**API middleware example:**
```typescript
// Express.js middleware for automatic auditing
app.use('/api/patients', auditMiddleware({
  auditPaths: [/\/api\/patients/],
  includeRequestBody: false,  // Don't log PHI in requests
  includeResponseBody: false
}))
```

### Can I use this with microservices?

Yes, the package is designed for microservices architectures:

- **Distributed Tracing**: Use correlation IDs across services
- **Centralized Logging**: Single audit database for all services
- **Service-Specific Queues**: Separate queues per service if needed
- **Cross-Service Events**: Track events across service boundaries

**Microservices configuration:**
```typescript
// Service A
await auditService.log({
  principalId: 'user-123',
  action: 'patient.lookup',
  correlationId: 'req-456',
  details: { sourceService: 'patient-service' }
})

// Service B (same correlation ID)
await auditService.log({
  principalId: 'user-123',
  action: 'billing.calculate',
  correlationId: 'req-456',
  details: { sourceService: 'billing-service' }
})
```

### What databases are supported?

The package primarily uses PostgreSQL but supports:

- **Primary**: PostgreSQL 12+ (recommended for healthcare)
- **Development**: SQLite (for testing and development)
- **Cloud**: AWS RDS, Google Cloud SQL, Azure Database
- **Managed**: Supabase, PlanetScale (with PostgreSQL)

PostgreSQL is recommended for production healthcare environments due to:
- Superior compliance features
- Advanced partitioning capabilities
- Robust backup and recovery
- Extensive monitoring tools

## 🎯 Implementation Questions

### How do I get started quickly?

Follow the quick start process:

1. **Install dependencies:**
```bash
pnpm add @repo/audit
```

2. **Basic configuration:**
```typescript
const config: AuditConfig = {
  version: '1.0',
  environment: 'development',
  reliableProcessor: { queueName: 'audit-events' }
}
```

3. **Initialize service:**
```typescript
const auditService = new Audit(config, db)
```

4. **Log first event:**
```typescript
await auditService.log({
  principalId: 'user-123',
  action: 'user.login',
  status: 'success'
})
```

### What's the learning curve like?

The learning curve varies by experience:

- **Basic Implementation**: 1-2 days for simple audit logging
- **Healthcare Compliance**: 1-2 weeks to understand HIPAA/GDPR requirements
- **Advanced Features**: 2-4 weeks for high-performance, enterprise setup
- **Complete Mastery**: 1-2 months for complex healthcare environments

**Recommended learning path:**
1. Start with [Getting Started](../getting-started/) guide
2. Complete [Basic Implementation](../tutorials/basic-implementation.md) tutorial
3. Study [Healthcare Compliance](../tutorials/healthcare-compliance.md)
4. Review [Examples](../examples/) for your use case

### Do I need to hire specialists?

For most implementations, existing development teams can handle:

- **Basic Setup**: Any developer familiar with TypeScript/Node.js
- **Healthcare Features**: Developers with healthcare domain knowledge
- **Compliance Review**: May require compliance officer consultation
- **Security Audit**: Security professionals for production validation

**When to consider specialists:**
- Large-scale healthcare implementations (>10,000 users)
- High-security requirements (government, research)
- Complex compliance requirements (multiple regulations)
- Performance-critical applications (real-time clinical systems)

## 🚨 Troubleshooting Questions

### Why are my events not showing up in the database?

Common causes and solutions:

1. **Queue Worker Issues:**
```typescript
// Check queue status
const stats = await auditService.getQueueStats()
console.log('Failed jobs:', stats.failed)
```

2. **Database Connection Problems:**
```typescript
// Test database connection
const result = await db.execute('SELECT 1')
```

3. **Validation Failures:**
```typescript
// Check event validation
const validation = validateAuditEvent(event)
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors)
}
```

### How do I handle high-volume scenarios?

For high-volume environments:

1. **Enable Batch Processing:**
```typescript
const config = {
  reliableProcessor: {
    batchSize: 200,
    concurrency: 15,
    enableBatching: true
  }
}
```

2. **Optimize Database:**
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_audit_timestamp ON audit_log (timestamp DESC);
```

3. **Monitor Performance:**
```typescript
// Regular performance monitoring
const metrics = await auditService.getMetrics()
console.log('Processing latency:', metrics.processingLatency)
```

### What if audit logging fails?

Implement robust error handling:

1. **Graceful Degradation:**
```typescript
try {
  await auditService.log(event)
} catch (error) {
  // Log error but don't break application
  console.error('Audit logging failed:', error)
  // Implement fallback storage
  await fallbackAuditStorage.store(event)
}
```

2. **Circuit Breaker Pattern:**
```typescript
const config = {
  reliableProcessor: {
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 10
  }
}
```

3. **Dead Letter Queue:**
```typescript
// Failed events go to DLQ for manual review
const config = {
  reliableProcessor: {
    enableDLQ: true,
    dlqMaxRetries: 3
  }
}
```

## 💰 Cost and Licensing Questions

### What are the infrastructure costs?

Typical infrastructure costs for healthcare audit logging:

**Small Practice (1,000 events/day):**
- PostgreSQL: $20-50/month
- Redis: $10-20/month
- Storage: $5-10/month
- **Total: $35-80/month**

**Medium Hospital (100,000 events/day):**
- PostgreSQL: $200-500/month
- Redis: $50-100/month
- Storage: $50-100/month
- **Total: $300-700/month**

**Large Health System (1M+ events/day):**
- PostgreSQL: $1,000-3,000/month
- Redis: $200-500/month
- Storage: $200-500/month
- **Total: $1,400-4,000/month**

### Is there a free tier or trial?

The audit package itself is open-source, but consider:

- **Development**: Free for development and testing
- **Production**: Infrastructure costs apply
- **Support**: Community support is free
- **Enterprise**: Professional support may require licensing

### How does it compare to commercial solutions?

**Advantages of @repo/audit:**
- Open-source and customizable
- Healthcare-specific features
- No per-event licensing fees
- Full control over data and infrastructure
- Integrated with modern development practices

**Commercial alternatives typically:**
- Cost $0.10-1.00 per event
- Have vendor lock-in
- May not meet specific healthcare requirements
- Require extensive integration work

## 📞 Getting More Help

### Where can I find more examples?

Comprehensive examples are available:

- **[Examples Section](../examples/)**: Practical healthcare scenarios
- **[Tutorials](../tutorials/)**: Step-by-step implementation guides
- **GitHub Repository**: Additional community examples
- **Healthcare Forums**: Community discussions and patterns

### How do I contribute or request features?

Follow the contribution process:

1. **Check existing issues** for similar requests
2. **Create detailed feature requests** with healthcare context
3. **Submit pull requests** following coding standards
4. **Participate in community discussions**

### What support options are available?

**Community Support:**
- GitHub issues and discussions
- Documentation and examples
- Community forums and chat

**Professional Support:**
- Enterprise consulting available
- Custom implementation services
- Compliance auditing and validation
- Performance optimization consulting

For urgent production issues, follow the escalation procedures outlined in the project repository.

---

**Have a question not covered here?** Check the [Troubleshooting Guide](../troubleshooting/) or submit an issue following the project contribution guidelines.