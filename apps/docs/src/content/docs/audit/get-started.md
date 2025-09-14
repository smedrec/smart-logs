---
title: Quick Start Guide
description: Quick overview and getting started with the SMEDREC Audit System.
---

# Quick Start Guide

> **📖 For comprehensive setup instructions, visit our [Getting Started Guide](./getting-started.md)**

The SMEDREC Audit System provides comprehensive audit logging capabilities for healthcare applications, ensuring compliance with HIPAA, GDPR, and other regulatory requirements.

## Overview

The audit system consists of two main packages:

- **[@repo/audit](./audit.md)** - Core audit logging SDK for generating and sending audit events
- **[@repo/audit-db](./audit-db.md)** - Database layer for storing and querying audit logs

## Quick Installation

```bash
# Install audit database package
npm install @repo/audit-db

# Install peer dependencies
npm install drizzle-orm postgres redis
```

## Basic Usage

```typescript
import { AuditDb } from '@repo/audit-db'

// Initialize the audit database client
const auditDb = new AuditDb()

// Check connection
const isConnected = await auditDb.checkAuditDbConnection()

// Log a HIPAA-compliant audit event
await auditDb.logAuditEvent({
  timestamp: new Date().toISOString(),
  action: 'fhir.patient.access',
  status: 'success',
  principalId: 'physician-123',
  principalType: 'healthcare_provider',
  resourceId: 'patient-456',
  resourceType: 'Patient',
  sourceIp: '192.168.1.100',
  metadata: {
    accessReason: 'patient-care',
    dataElements: ['demographics', 'allergies'],
    hipaaCompliant: true
  }
})
```

## Environment Setup

```env
# Required
AUDIT_DB_URL="postgresql://user:pass@localhost:5432/audit_db"
AUDIT_REDIS_URL="redis://localhost:6379"

# Recommended for production
AUDIT_CRYPTO_SECRET="your-256-bit-secret-key"
AUDIT_ENABLE_ENCRYPTION=true
```

## Key Features

- **🏥 Healthcare-Focused**: Built for HIPAA, GDPR, and healthcare compliance
- **🔒 Enterprise Security**: Encryption, integrity verification, and anomaly detection
- **⚡ High Performance**: Redis caching and database partitioning
- **🛠️ Developer-Friendly**: TypeScript-first with comprehensive documentation

## Next Steps

📖 **[Complete Getting Started Guide](./getting-started.md)** - Comprehensive setup and healthcare examples

📚 **[API Reference](./api-reference.md)** - Complete API documentation

💡 **[Examples](./examples.md)** - Healthcare implementation patterns

🔒 **[Security Guide](./security.md)** - Security best practices and compliance

🚀 **[Performance Optimization](./performance-optimization.md)** - Production optimization techniques
