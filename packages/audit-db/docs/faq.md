# Frequently Asked Questions

## General Questions

### Q: What is @repo/audit-db and when should I use it?

**A:** `@repo/audit-db` is a comprehensive audit logging database client designed specifically for healthcare applications requiring compliance with HIPAA, GDPR, and other regulations. Use it when you need:

- Secure, tamper-evident audit logging
- Healthcare compliance (HIPAA, GDPR)
- High-performance audit data storage
- Advanced query and reporting capabilities
- Distributed caching for improved performance

### Q: Which client should I use: AuditDb, AuditDbWithConfig, or EnhancedAuditDb?

**A:** Choose based on your requirements:

- **AuditDb**: Simple applications, development, prototyping
- **AuditDbWithConfig**: Production applications with custom configuration needs
- **EnhancedAuditDb**: High-performance applications requiring advanced features like caching, partitioning, and monitoring

### Q: Is this package only for healthcare applications?

**A:** While designed with healthcare compliance in mind, the package can be used for any application requiring robust audit logging, compliance features, and high performance.

## Installation and Setup

### Q: I'm getting connection errors when trying to connect to the database. What should I check?

**A:** Common connection issues and solutions:

1. **Verify PostgreSQL is running:**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Check your connection string format:**
   ```bash
   # Correct format
   postgresql://username:password@host:port/database
   ```

3. **Verify database exists and user has permissions:**
   ```sql
   -- Check if database exists
   \l
   
   -- Check user permissions
   \du
   ```

4. **Test basic connectivity:**
   ```bash
   psql $AUDIT_DB_URL -c "SELECT 1"
   ```

### Q: Do I need Redis for basic functionality?

**A:** No, Redis is optional and only required for:
- Distributed caching features
- Multi-instance deployments with shared cache
- Advanced performance optimizations

Basic audit logging works fine without Redis using local memory caching or no caching.

### Q: What PostgreSQL version is required?

**A:** PostgreSQL 12 or higher is required. For advanced features like performance monitoring, PostgreSQL 13+ with the `pg_stat_statements` extension is recommended.

## Configuration

### Q: How do I configure different environments (dev, staging, production)?

**A:** Use environment-specific configurations:

```typescript
const config = {
  development: {
    connectionPool: { min: 1, max: 5 },
    queryCache: { maxSizeMB: 50 },
    partitioning: { enabled: false }
  },
  production: {
    connectionPool: { min: 10, max: 50 },
    queryCache: { maxSizeMB: 500 },
    partitioning: { enabled: true },
    monitoring: { enabled: true }
  }
}[process.env.NODE_ENV || 'development']
```

### Q: How do I handle sensitive data in audit logs?

**A:** Follow these practices:

1. **Sanitize metadata before logging:**
   ```typescript
   const sanitizedMetadata = {
     ...metadata,
     password: '[REDACTED]',
     ssn: '[REDACTED]',
     creditCard: '[REDACTED]'
   }
   ```

2. **Use data classification:**
   ```typescript
   const event = {
     action: 'patient.record.access',
     metadata: {
       ...data,
       dataClassification: 'confidential',
       encryptionApplied: true
     }
   }
   ```

3. **Enable encryption at rest and in transit**

## Performance

### Q: My queries are slow. How can I improve performance?

**A:** Performance optimization steps:

1. **Use proper indexes:**
   ```sql
   CREATE INDEX CONCURRENTLY idx_audit_log_principal_timestamp 
   ON audit_log(principal_id, timestamp DESC);
   ```

2. **Enable query caching:**
   ```typescript
   const enhancedDb = new EnhancedAuditDb({
     queryCache: { enabled: true, maxSizeMB: 200 }
   })
   ```

3. **Use database partitioning for large datasets:**
   ```typescript
   {
     partitioning: {
       enabled: true,
       interval: 'monthly',
       retentionDays: 2555
     }
   }
   ```

4. **Use the enhanced client for automatic optimization**

### Q: How do I monitor performance?

**A:** Use built-in monitoring tools:

```typescript
// Get performance metrics
const enhancedDb = new EnhancedAuditDb({ monitoring: { enabled: true } })
const metrics = await enhancedDb.getPerformanceMetrics()

// CLI monitoring
audit-db-performance monitor summary
audit-db-performance monitor slow-queries
```

### Q: When should I use database partitioning?

**A:** Consider partitioning when:
- You have more than 1 million audit events
- Query performance degrades over time
- You need to archive old data efficiently
- You're required to maintain data for years (compliance)

## Compliance and Security

### Q: How does this package help with GDPR compliance?

**A:** GDPR compliance features include:

- **Data classification and retention policies**
- **Right to access**: Query all data for a data subject
- **Right to rectification**: Update incorrect data
- **Right to erasure**: Delete data when legally required
- **Data portability**: Export data in standard formats
- **Audit trails**: Track all data processing activities

### Q: What about HIPAA compliance?

**A:** HIPAA compliance features:

- **Access controls**: Track who accessed what patient data
- **Audit logs**: Comprehensive logging of PHI access
- **Integrity verification**: Cryptographic verification of log integrity
- **Encryption**: Data encryption at rest and in transit
- **Risk assessment**: Built-in compliance reporting

### Q: How is data integrity ensured?

**A:** Data integrity is maintained through:

- **Cryptographic hashing**: SHA-256 hashes for tamper detection
- **HMAC verification**: Message authentication codes
- **Immutable logs**: Audit events are append-only by design
- **Database constraints**: Foreign key and check constraints
- **Regular integrity checks**: Automated verification processes

## Development and Testing

### Q: How do I test applications using @repo/audit-db?

**A:** Testing strategies:

1. **Unit testing with mocks:**
   ```typescript
   jest.mock('@repo/audit-db', () => ({
     AuditDb: jest.fn().mockImplementation(() => ({
       getDrizzleInstance: () => mockDb,
       checkAuditDbConnection: () => Promise.resolve(true)
     }))
   }))
   ```

2. **Integration testing with test database:**
   ```typescript
   const testDb = new AuditDb(process.env.TEST_AUDIT_DB_URL)
   ```

3. **Use transaction rollback for test isolation:**
   ```typescript
   beforeEach(async () => {
     await testDb.getDrizzleInstance().delete(auditLog)
   })
   ```

### Q: Can I use this package in serverless environments?

**A:** Yes, but consider:

- **Connection pooling**: Use smaller pool sizes for serverless
- **Cold starts**: Initial connections may take longer
- **Memory limits**: Adjust cache sizes appropriately
- **Timeout handling**: Configure appropriate timeouts

```typescript
const serverlessConfig = {
  connectionPool: { min: 0, max: 2, idleTimeout: 5000 },
  queryCache: { maxSizeMB: 10 }
}
```

## Troubleshooting

### Q: I'm getting "Pool exhausted" errors. What should I do?

**A:** Pool exhaustion solutions:

1. **Increase pool size:**
   ```typescript
   { connectionPool: { maxConnections: 50 } }
   ```

2. **Check for connection leaks:**
   ```typescript
   // Always use transactions for multiple operations
   await db.transaction(async (tx) => {
     // Your operations
   })
   ```

3. **Monitor pool usage:**
   ```typescript
   const health = await enhancedDb.getHealthStatus()
   console.log('Pool usage:', health.connectionPool)
   ```

### Q: Cache hit rate is low. How can I improve it?

**A:** Improve cache performance:

1. **Use consistent cache keys:**
   ```typescript
   const cacheKey = `user_events_${userId}_${dateRange}`
   ```

2. **Adjust TTL based on data volatility:**
   ```typescript
   {
     userEvents: { ttl: 300 },    // 5 minutes
     reports: { ttl: 3600 }       // 1 hour
   }
   ```

3. **Implement cache warming:**
   ```typescript
   await client.warmupCache(criticalQueries)
   ```

### Q: How do I handle migration failures?

**A:** Migration troubleshooting:

1. **Check migration status:**
   ```bash
   audit-db verify --verbose
   ```

2. **Roll back if needed:**
   ```bash
   audit-db rollback 0.0.5
   ```

3. **Manual recovery (development only):**
   ```sql
   DROP TABLE IF EXISTS __drizzle_migrations;
   ```

## Advanced Usage

### Q: Can I extend the schema with custom fields?

**A:** Yes, extend the schema:

```typescript
// Extend the base schema
const customAuditLog = {
  ...auditLog,
  customField: text('custom_field'),
  organizationId: text('organization_id')
}
```

### Q: How do I implement multi-tenancy?

**A:** Multi-tenancy approaches:

1. **Schema-based separation:**
   ```typescript
   const tenantDb = new AuditDb(`${baseUrl}?search_path=tenant_${tenantId}`)
   ```

2. **Row-level filtering:**
   ```typescript
   const tenantEvents = await db
     .select()
     .from(auditLog)
     .where(eq(auditLog.organizationId, tenantId))
   ```

### Q: Can I use this with other ORMs besides Drizzle?

**A:** The package is built specifically for Drizzle ORM. For other ORMs, you would need to:

1. Use the direct database connection
2. Implement your own query layer
3. Handle schema management separately

### Q: How do I backup and restore audit data?

**A:** Backup strategies:

1. **Regular PostgreSQL backups:**
   ```bash
   pg_dump $AUDIT_DB_URL > backup.sql
   ```

2. **Partition-level backups:**
   ```bash
   pg_dump --table=audit_log_2024_01 $AUDIT_DB_URL > partition_backup.sql
   ```

3. **Application-level exports:**
   ```typescript
   const data = await db.select().from(auditLog)
   fs.writeFileSync('audit_export.json', JSON.stringify(data))
   ```

## Best Practices

### Q: What are the recommended indexing strategies?

**A:** Index recommendations:

```sql
-- Primary queries
CREATE INDEX CONCURRENTLY idx_audit_log_principal_id ON audit_log(principal_id);
CREATE INDEX CONCURRENTLY idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX CONCURRENTLY idx_audit_log_action ON audit_log(action);

-- Compound indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_audit_log_principal_timestamp 
ON audit_log(principal_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_audit_log_resource 
ON audit_log(resource_type, resource_id);

-- GIN index for metadata queries
CREATE INDEX CONCURRENTLY idx_audit_log_metadata_gin 
ON audit_log USING GIN (metadata);
```

### Q: How should I structure metadata for optimal querying?

**A:** Metadata best practices:

```typescript
// Good: Consistent structure
const metadata = {
  department: 'cardiology',
  patientId: 'patient-123',
  accessReason: 'treatment',
  dataElements: ['demographics', 'vitals'],
  sessionId: 'sess-abc123'
}

// Avoid: Inconsistent or deeply nested structures
const badMetadata = {
  dept: 'cardio',  // Inconsistent naming
  patient: {
    id: 'patient-123',
    data: {
      elements: ['demographics']  // Too deeply nested
    }
  }
}
```

### Q: What's the recommended data retention strategy?

**A:** Retention strategy:

1. **Compliance-based retention:**
   ```typescript
   const retentionPolicies = {
     patient_data: 2555,    // 7 years (HIPAA)
     financial_data: 2555,  // 7 years (SOX)
     system_logs: 365,      // 1 year
     debug_logs: 30         // 30 days
   }
   ```

2. **Automated cleanup:**
   ```bash
   # Schedule regular cleanup
   0 2 * * 0 audit-db-performance partition cleanup
   ```

3. **Archive before deletion:**
   ```typescript
   // Export before deletion
   const oldData = await getDataOlderThan(retentionDate)
   await exportToArchive(oldData)
   await deleteOldData(retentionDate)
   ```

## Getting Help

### Q: Where can I get more help?

**A:** Support resources:

1. **Documentation**: Complete guides in the `/docs` folder
2. **GitHub Issues**: Report bugs or request features
3. **CLI Help**: `audit-db --help` and `audit-db-performance --help`
4. **Health Checks**: Use built-in diagnostic tools

### Q: How do I report a bug or request a feature?

**A:** When reporting issues:

1. **Include environment details**:
   - Node.js version
   - PostgreSQL version
   - Package version
   - Configuration (sanitized)

2. **Provide reproduction steps**
3. **Include error messages and stack traces**
4. **Use appropriate issue templates in GitHub**

### Q: Is there a community or forum for discussions?

**A:** Since this is part of the smart-logs monorepo:

1. Use GitHub Discussions for general questions
2. GitHub Issues for bug reports and feature requests
3. Internal team channels for development discussions