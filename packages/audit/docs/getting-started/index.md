# Getting Started

Welcome to the `@repo/audit` package documentation! This section will guide you through the initial setup and basic usage of the healthcare audit logging system.

## 📋 Overview

The `@repo/audit` package provides a comprehensive audit logging solution designed specifically for healthcare applications. It ensures compliance with HIPAA and GDPR regulations while offering cryptographically secure, tamper-resistant audit trails.

## 🎯 What You'll Learn

This getting started guide covers:

1. **[Installation](./installation.md)** - How to install and set up the audit package
2. **[Configuration](./configuration.md)** - Basic configuration options and environment setup
3. **[First Audit Event](./first-audit-event.md)** - Creating your first audit event

## ⚡ Quick Start

If you're already familiar with the system, here's a minimal example to get you started:

```typescript
import { Audit, AuditConfig } from '@repo/audit'
import { db } from './database' // Your Drizzle database instance

// Basic configuration
const config: AuditConfig = {
  version: '1.0',
  environment: 'development',
  reliableProcessor: {
    queueName: 'healthcare-audit'
  }
}

// Initialize audit service
const auditService = new Audit(config, db)

// Log your first event
await auditService.log({
  principalId: 'user-123',
  action: 'user.login',
  status: 'success',
  outcomeDescription: 'User successfully logged in'
})
```

## 🏥 Healthcare Context

This audit system is purpose-built for healthcare environments and includes:

- **FHIR Integration**: Native support for FHIR resource audit events
- **Regulatory Compliance**: Built-in HIPAA and GDPR validation
- **PHI Protection**: Secure handling of Protected Health Information
- **Tamper Detection**: Cryptographic integrity verification
- **Reliable Delivery**: Guaranteed event processing with circuit breakers

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (version 18 or higher)
- **pnpm** (package manager for the monorepo)
- **PostgreSQL** (for audit data storage)
- **Redis** (for reliable message queuing)
- **Basic TypeScript knowledge**

## 🛠️ Development Environment

The audit system is part of a larger monorepo and integrates with several other packages:

- `@repo/audit-db` - Database schema and migrations
- `@repo/redis-client` - Shared Redis connection management
- `@repo/auth` - Authentication integration
- `@repo/hono-helpers` - API utilities

## 📖 Next Steps

1. Start with [Installation](./installation.md) to set up the package
2. Configure your environment with [Configuration](./configuration.md)
3. Create your first audit event with [First Audit Event](./first-audit-event.md)
4. Explore [Tutorials](../tutorials/) for specific use cases
5. Reference the [API Documentation](../api-reference/) for detailed information

## 💡 Need Help?

- Check the [FAQ](../faq/) for common questions
- Review [Troubleshooting](../troubleshooting/) for common issues
- Explore [Examples](../examples/) for practical implementations
- Review the main [README](../README.md) for an overview

Let's get started with the [Installation Guide](./installation.md)!