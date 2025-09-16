# Getting Started

<cite>
**Referenced Files in This Document**   
- [package.json](file://package.json)
- [apps/server/package.json](file://apps\server\package.json)
- [apps/web/package.json](file://apps\web\package.json)
- [apps/native/package.json](file://apps\native\package.json)
- [apps/worker/package.json](file://apps\worker\package.json)
- [apps/docs/package.json](file://apps\docs\package.json)
- [apps/server/init-scripts/01-init-audit-db.sql](file://apps\server\init-scripts\01-init-audit-db.sql)
- [packages/audit-client/docs/GETTING_STARTED.md](file://packages\audit-client\docs\GETTING_STARTED.md) - *Updated in recent commit*
- [apps/docs/astro.config.mjs](file://apps\docs\astro.config.mjs) - *Sidebar restructured in recent commit*
- [apps/docs/src/content/docs/audit/get-started.md](file://apps\docs\src\content\docs\audit\get-started.md) - *Quick start content updated*
- [packages/audit-client/docs/PLUGIN_ARCHITECTURE.md](file://packages\audit-client\docs\PLUGIN_ARCHITECTURE.md) - *Added plugin architecture documentation*
- [packages/audit-client/docs/FRAMEWORK_INTEGRATION.md](file://packages\audit-client\docs\FRAMEWORK_INTEGRATION.md) - *Added framework integration examples*
- [packages/audit/src/config/types.ts](file://packages\audit\src\config\types.ts) - *Updated in commit 75f0971d*
- [apps/worker/src/index.ts](file://apps\worker\src\index.ts) - *Updated in commit f954e0a3*
- [packages/audit/src/observability/tracer.ts](file://packages\audit\src\observability\tracer.ts) - *OTLP exporter implementation*
- [packages/infisical-kms/src/client.ts](file://packages\infisical-kms\src\client.ts) - *KMS client implementation*
</cite>

## Update Summary
- Added new section for OTLP Exporter Configuration based on recent commit changes
- Added new section for KMS Encryption Configuration based on recent commit changes
- Updated Quick Start with Audit Client Library to include OTLP configuration
- Updated Plugin Architecture System to include observability plugins
- Added environment variable references for OTLP and KMS configuration
- Enhanced Common Setup Issues with solutions for OTLP and KMS related problems
- Updated Introduction to reflect new observability and security features

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Running Applications](#running-applications)
4. [Local Database Setup](#local-database-setup)
5. [Environment Variables and Service Configuration](#environment-variables-and-service-configuration)
6. [Quick Start with Audit Client Library](#quick-start-with-audit-client-library)
7. [Plugin Architecture System](#plugin-architecture-system)
8. [Framework Integration Examples](#framework-integration-examples)
9. [OTLP Exporter Configuration](#otlp-exporter-configuration)
10. [KMS Encryption Configuration](#kms-encryption-configuration)
11. [Common Setup Issues and Solutions](#common-setup-issues-and-solutions)

## Introduction
This guide provides comprehensive instructions for setting up the SMEDREC Smart Logs development environment. You will learn how to install dependencies, run applications, configure the database, and use the audit client library to emit test events. By following this guide, developers can have the full system running locally within 15 minutes.

The audit system has been restructured with a new client library approach, deprecating the previous SDK in favor of a more modular and maintainable architecture with extensible plugin capabilities. Recent updates have enhanced the system with OpenTelemetry (OTLP) exporter support for distributed tracing and KMS encryption for secure configuration management.

## Development Environment Setup

### PNPM Installation
The project uses PNPM as its package manager. Install PNPM globally using npm:

```bash
npm install -g pnpm@10.15.1
```

Verify the installation:

```bash
pnpm --version
```

### Workspace Bootstrapping
Navigate to the workspace root directory and install all dependencies:

```bash
cd 
pnpm install
```

This command installs all dependencies across the monorepo's apps and packages as defined in the `pnpm-workspace.yaml` file.

### Dependency Resolution
The repository uses a monorepo structure with shared packages. All workspace dependencies are referenced with the `workspace:*` syntax in package.json files. PNPM automatically resolves these dependencies to their local versions during installation.

**Section sources**
- [package.json](file://package.json)

## Running Applications

Each application in the workspace can be started using the scripts defined in its package.json file.

### Web Application
Start the web application on port 3001:

```bash
pnpm dev:web
```

Or run directly from the web app directory:

```bash
cd apps/web
pnpm dev
```

The application will be available at `http://localhost:3001`.

### Native Application
Start the Expo-based native application:

```bash
pnpm dev:native
```

This launches the Expo development server. Use the Expo Go app on your mobile device or run:

```bash
pnpm android  # For Android emulator
pnpm ios      # For iOS simulator
pnpm web      # For web preview
```

### Server Application
Start the backend server:

```bash
pnpm dev:server
```

Or run directly from the server directory:

```bash
cd apps/server
pnpm dev
```

The server will be available at `http://localhost:3000`.

### Worker Application
Start the background worker process:

```bash
pnpm dev:worker
```

This runs the worker with file watching enabled for development.

### Documentation Application
Start the documentation site:

```bash
cd apps/docs
pnpm dev
```

The documentation will be available at `http://localhost:4321`.

**Section sources**
- [apps/server/package.json](file://apps\server\package.json)
- [apps/web/package.json](file://apps\web\package.json)
- [apps/native/package.json](file://apps\native\package.json)
- [apps/worker/package.json](file://apps\worker\package.json)
- [apps/docs/package.json](file://apps\docs\package.json)

## Local Database Setup

### Database Initialization
The system uses PostgreSQL for the audit database. Initialize the database using the provided SQL script:

```bash
pnpm db:start
```

This command starts the database container as defined in the docker-compose configuration.

### Running Database Migrations
Apply the Drizzle ORM migrations:

```bash
pnpm db:migrate
```

This command runs all migration files located in `packages/audit-db/drizzle/migrations/`.

### Manual Database Initialization
For manual setup, execute the initialization script:

```bash
psql -U postgres -f apps/server/init-scripts/01-init-audit-db.sql
```

This script:
- Creates required PostgreSQL extensions (uuid-ossp, pgcrypto, pg_stat_statements)
- Creates the audit schema
- Sets up the audit_app_user role with appropriate permissions
- Configures performance optimization settings

```sql
-- Example from 01-init-audit-db.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS audit;
```

### Database Management Commands
Use these additional commands for database management:

```bash
pnpm db:studio    # Open Drizzle Studio for database visualization
pnpm db:generate  # Generate new migration after schema changes
pnpm db:push      # Push schema directly to database (development only)
pnpm db:stop      # Stop the database container
```

**Section sources**
- [apps/server/init-scripts/01-init-audit-db.sql](file://apps\server\init-scripts\01-init-audit-db.sql)

## Environment Variables and Service Configuration

### Required Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
AUDIT_DB_URL=postgresql://audit:password@localhost:5432/audit_db
REDIS_URL=redis://localhost:6379

# API Configuration
PORT=3000
NODE_ENV=development

# Authentication
AUTH_SECRET=your-auth-secret-key

# OTLP Configuration
OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTLP_API_KEY=your-otlp-api-key

# KMS Configuration
KMS_BASE_URL=https://kms.example.com
KMS_ACCESS_TOKEN=your-kms-access-token
KMS_ENCRYPTION_KEY=key-encryption-123
KMS_SIGNING_KEY=key-signing-456
```

### Service Connections
Ensure the following services are running and properly connected:

- **PostgreSQL**: Running on port 5432
- **Redis**: Running on port 6379
- **Inngest**: For workflow processing (if applicable)
- **OpenTelemetry Collector**: Running on port 4318 for OTLP traces

The server application automatically connects to these services using the environment variables.

## Quick Start with Audit Client Library

### Client Library Installation
The audit system now uses a new client library architecture. Install the audit client package:

```bash
pnpm add '@repo/audit-client@workspace:*'
```

### Basic Usage
Import and initialize the audit client:

```typescript
import { AuditClient } from '@repo/audit-client';

// Initialize the audit client
const auditClient = new AuditClient({
  baseUrl: process.env.AUDIT_API_URL || 'https://api.smartlogs.com',
  authentication: {
    type: 'apiKey',
    apiKey: process.env.AUDIT_API_KEY || 'your-api-key-here',
  },
  logging: {
    level: 'info',
    includeRequestBody: false,
    includeResponseBody: false,
  },
});

async function logAuditEvent() {
  try {
    // Log an audit event
    const event = await auditClient.events.create({
      action: 'user.login',
      principalId: 'user-123',
      organizationId: 'org-456',
      status: 'success',
      outcomeDescription: 'User successfully logged in via password.',
      targetResourceType: 'User',
      targetResourceId: 'user-123',
      sessionContext: {
        ipAddress: '198.51.100.10',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      details: {
        mfa_used: true,
      },
    });

    console.log('✅ Audit event created successfully:', event.id);

    // Query events
    const results = await auditClient.events.query({
      filter: {
        actions: ['user.login'],
        statuses: ['success'],
      },
      pagination: {
        limit: 10,
      },
    });

    console.log(`Found ${results.events.length} login events.`);
  } catch (error) {
    console.error('❌ Error creating audit event:', error);
  } finally {
    await auditClient.destroy();
  }
}

logAuditEvent();
```

### Configuration Options
The audit client supports various configuration options:

```typescript
const auditClient = new AuditClient({
  // API endpoint
  baseUrl: 'https://api.smartlogs.com',
  
  // Authentication configuration
  authentication: {
    type: 'apiKey',
    apiKey: 'your-api-key-here',
  },
  
  // Retry configuration
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffMultiplier: 2,
    maxDelayMs: 10000,
  },
  
  // Cache configuration
  cache: {
    enabled: true,
    defaultTtlMs: 60000,
    maxItems: 1000,
  },
  
  // Logging configuration
  logging: {
    enabled: true,
    level: 'info',
    maskSensitiveData: true,
    sensitiveFields: ['password', 'token', 'secret'],
  },
});
```

**Section sources**
- [packages/audit-client/docs/GETTING_STARTED.md](file://packages\audit-client\docs\GETTING_STARTED.md)
- [packages/audit-client/src/core/client.ts](file://packages\audit-client\src\core\client.ts)
- [apps/docs/src/content/docs/audit/get-started.md](file://apps\docs\src\content\docs\audit\get-started.md)

## Plugin Architecture System

The Audit Client Library includes a comprehensive plugin architecture that allows developers to extend functionality through custom middleware, storage backends, and authentication methods.

### Core Plugin Types
- **Middleware Plugins**: Process requests and responses
- **Storage Plugins**: Custom cache storage backends
- **Authentication Plugins**: Custom authentication methods

### Built-in Plugins
#### Request Logging Plugin
```typescript
const client = new AuditClient({
  plugins: {
    middleware: {
      enabled: true,
      plugins: ['request-logging'],
    },
  },
  logging: {
    level: 'info',
  },
});
```

#### Correlation ID Plugin
```typescript
const client = new AuditClient({
  plugins: {
    middleware: {
      enabled: true,
      plugins: ['correlation-id'],
    },
  },
});
```

#### Redis Storage Plugin
```typescript
const client = new AuditClient({
  plugins: {
    storage: {
      enabled: true,
      plugins: {
        'redis-storage': {
          host: 'localhost',
          port: 6379,
          password: 'redis-password',
        },
      },
    },
  },
});
```

### Custom Plugin Example
```typescript
import type { MiddlewarePlugin, MiddlewareRequest, MiddlewareNext } from '@repo/audit-client';

class CustomTimingPlugin implements MiddlewarePlugin {
  readonly name = 'custom-timing';
  readonly version = '1.0.0';
  readonly type = 'middleware' as const;

  async processRequest(
    request: MiddlewareRequest,
    next: MiddlewareNext
  ): Promise<MiddlewareRequest> {
    request.headers['X-Request-Start-Time'] = Date.now().toString();
    return next(request);
  }
}

// Register the plugin
await auditClient.plugins.getRegistry().register(new CustomTimingPlugin());
```

**Section sources**
- [packages/audit-client/docs/PLUGIN_ARCHITECTURE.md](file://packages\audit-client\docs\PLUGIN_ARCHITECTURE.md)
- [packages/audit-client/src/infrastructure/plugins/README.md](file://packages\audit-client\src\infrastructure\plugins\README.md)
- [packages/audit-client/src/core/client.ts](file://packages\audit-client\src\core\client.ts)

## Framework Integration Examples

### Express.js Integration
**`src/audit-client.ts`**
```typescript
import { AuditClient } from '@repo/audit-client';

export const auditClient = new AuditClient({
  baseUrl: process.env.AUDIT_API_URL || 'https://api.smartlogs.com',
  authentication: {
    type: 'apiKey',
    apiKey: process.env.AUDIT_API_KEY,
  },
});

// Gracefully shut down the client on app exit
process.on('SIGINT', async () => {
  await auditClient.destroy();
  process.exit(0);
});
```

**`src/middleware/audit-logger.ts`**
```typescript
import { auditClient } from '../audit-client';

export function auditRequest(req, res, next) {
  const { method, path, ip, user } = req;

  auditClient.events
    .create({
      action: 'api.request',
      principalId: user ? user.id : 'anonymous',
      organizationId: user ? user.organizationId : 'unknown',
      status: 'attempt',
      sessionContext: {
        ipAddress: ip,
        userAgent: req.get('User-Agent'),
      },
      details: {
        method,
        path,
        params: req.params,
        query: req.query,
      },
    })
    .catch((error) => {
      console.error('Failed to log audit request:', error);
    });

  next();
}
```

### Next.js Integration
**`lib/audit-client.ts`**
```typescript
import { AuditClient } from '@repo/audit-client';

declare global {
  var auditClient: AuditClient | undefined;
}

const client =
  globalThis.auditClient ||
  new AuditClient({
    baseUrl: process.env.AUDIT_API_URL!,
    authentication: {
      type: 'apiKey',
      apiKey: process.env.AUDIT_API_KEY!,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.auditClient = client;
}

export const auditClient = client;
```

**`app/actions.ts`**
```typescript
'use server'

import { auditClient } from '@/lib/audit-client';

export async function deleteDocument(documentId: string) {
  const session = await auth();

  if (!session) {
    throw new Error('Unauthorized');
  }

  await auditClient.events.create({
    action: 'document.delete',
    principalId: session.user.id,
    organizationId: session.user.organizationId,
    status: 'success',
    targetResourceId: documentId,
  });
}
```

**Section sources**
- [packages/audit-client/docs/FRAMEWORK_INTEGRATION.md](file://packages\audit-client\docs\FRAMEWORK_INTEGRATION.md)
- [packages/audit-client/src/examples/client-usage.ts](file://packages\audit-client\src\examples\client-usage.ts)
- [packages/audit-client/src/core/client.ts](file://packages\audit-client\src\core\client.ts)

## OTLP Exporter Configuration

### Overview
The audit system now supports OpenTelemetry Protocol (OTLP) exporter for distributed tracing. This allows integration with various observability platforms like Grafana Tempo, DataDog, OpenObserve, and Honeycomb.

### Configuration
The OTLP exporter is configured through environment variables and code configuration:

```typescript
const observabilityConfig = {
  tracing: {
    enabled: true,
    serviceName: 'audit-system',
    sampleRate: 1.0,
    exporterType: 'otlp' as const,
    exporterEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: {
      'stream-name': 'default',
    },
  },
};
```

### Environment Variables
Set these environment variables for OTLP configuration:

```env
# OTLP Configuration
OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTLP_API_KEY=your-api-key-here
# OR for custom headers
OTLP_AUTH_HEADER="Authorization: Bearer your-token-here"
```

### Supported Platforms
#### Grafana Tempo
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://tempo-us-central1.grafana.net/tempo/v1/traces'
}
```

#### DataDog
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://trace.agent.datadoghq.com/v1/traces'
}
```

#### OpenObserve
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://your-org.observe.com/api/default/traces'
}
```

#### Honeycomb
```typescript
const config = {
  enabled: true,
  serviceName: 'audit-system',
  sampleRate: 0.1,
  exporterType: 'otlp' as const,
  exporterEndpoint: 'https://api.honeycomb.io/v1/traces/your-dataset'
}
```

### Features
#### Batch Processing
- **Automatic batching**: Spans are automatically batched for efficient transmission
- **Configurable batch size**: Default 100 spans per batch
- **Timeout-based flushing**: Batches are flushed every 5 seconds
- **Immediate flushing**: Large batches are sent immediately

#### Error Handling & Reliability
- **Exponential backoff**: Automatic retry with increasing delays
- **Rate limiting handling**: Respects `Retry-After` headers
- **Circuit breaking**: Fails fast for client errors (4xx)
- **Network resilience**: Retries network failures up to 3 times

#### Performance Optimizations
- **Compression support**: Automatic compression for large payloads (future feature)
- **Efficient encoding**: Proper OTLP format with base64 encoding
- **Memory management**: Automatic cleanup of old spans

**Section sources**
- [apps/worker/src/index.ts](file://apps\worker\src\index.ts)
- [packages/audit/src/observability/tracer.ts](file://packages\audit\src\observability\tracer.ts)
- [packages/audit/docs/observability/otlp-configuration.md](file://packages\audit\docs\observability\otlp-configuration.md)

## KMS Encryption Configuration

### Overview
The audit system now supports KMS (Key Management Service) encryption for secure configuration management. This allows encryption of sensitive configuration data using external KMS providers.

### Configuration
The KMS encryption is configured through environment variables and code configuration:

```typescript
const securityConfig: SecurityConfig = {
  enableIntegrityVerification: true,
  hashAlgorithm: 'SHA-256',
  enableEventSigning: true,
  encryptionKey: 'your-encryption-key',
  enableLogEncryption: true,
  kms: {
    enabled: true,
    encryptionKey: process.env.KMS_ENCRYPTION_KEY || 'key-encryption-123',
    signingKey: process.env.KMS_SIGNING_KEY || 'key-signing-456',
    accessToken: process.env.KMS_ACCESS_TOKEN || 'your-kms-access-token',
    baseUrl: process.env.KMS_BASE_URL || 'https://kms.example.com',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2',
    salt: 'your-salt-here',
    iterations: 10000,
  }
};
```

### Environment Variables
Set these environment variables for KMS configuration:

```env
# KMS Configuration
KMS_BASE_URL=https://kms.example.com
KMS_ACCESS_TOKEN=your-kms-access-token
KMS_ENCRYPTION_KEY=key-encryption-123
KMS_SIGNING_KEY=key-signing-456
```

### KMS Client Implementation
The Infisical KMS client provides methods for encryption and decryption:

```typescript
import { InfisicalKmsClient } from '@repo/infisical-kms';

// Initialize KMS client
const kmsClient = new InfisicalKmsClient({
  baseUrl: process.env.KMS_BASE_URL!,
  accessToken: process.env.KMS_ACCESS_TOKEN!,
  encryptionKey: process.env.KMS_ENCRYPTION_KEY!,
  signingKey: process.env.KMS_SIGNING_KEY!,
});

// Encrypt data
const encrypted = await kmsClient.encrypt('sensitive-data');
console.log('Encrypted:', encrypted.ciphertext);

// Decrypt data
const decrypted = await kmsClient.decrypt(encrypted.ciphertext);
console.log('Decrypted:', decrypted.plaintext);
```

### Error Handling
The KMS client provides specific error classes for error handling:

```typescript
import { InfisicalKmsClient, KmsApiError, KmsError } from '@repo/infisical-kms';

try {
  const encrypted = await kmsClient.encrypt('sensitive-data');
} catch (error) {
  if (error instanceof KmsApiError) {
    console.error('KMS API error:', error.message, 'Status:', error.status);
  } else if (error instanceof KmsError) {
    console.error('KMS client error:', error.message);
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

### Use Cases
#### Secure Configuration Storage
```typescript
// Encrypt configuration file
const configManager = new ConfigurationManager(process.env.CONFIG_PATH!, 's3');
await configManager.initialize();

// The configuration manager automatically uses KMS for encryption
// when kms.enabled is set to true in the secureStorageConfig
```

#### Data Encryption
```typescript
// Encrypt sensitive audit data
const encryptedData = await kmsClient.encrypt(JSON.stringify(auditEvent));
auditEvent.encryptedPayload = encryptedData.ciphertext;
```

#### Digital Signatures
```typescript
// Sign audit events for integrity verification
const signature = await kmsClient.sign(JSON.stringify(auditEvent), 'HMAC-SHA256');
auditEvent.signature = signature.signature;
auditEvent.signingKeyId = signature.keyId;
```

**Section sources**
- [packages/audit/src/config/types.ts](file://packages\audit\src\config\types.ts)
- [packages/infisical-kms/src/client.ts](file://packages\infisical-kms\src\client.ts)
- [packages/audit/src/config/manager.ts](file://packages\audit\src\config\manager.ts)

## Common Setup Issues and Solutions

### PNPM Installation Issues
**Problem**: PNPM commands not found after installation  
**Solution**: Ensure npm global binaries are in your system PATH, or use:
```bash
npx pnpm install
```

### Database Connection Errors
**Problem**: "Connection refused" when running migrations  
**Solution**: Start the database first:
```bash
pnpm db:start
# Wait a few seconds for PostgreSQL to initialize
pnpm db:migrate
```

### Redis Connection Issues
**Problem**: Worker application fails to connect to Redis  
**Solution**: Ensure Redis is running:
```bash
docker ps | grep redis
# If not running:
pnpm db:start
```

### Port Conflicts
**Problem**: "Port already in use" errors  
**Solution**: Change ports in environment variables:
```env
PORT=3002
REDIS_URL=redis://localhost:6380
```

### Missing Dependencies
**Problem**: Module not found errors  
**Solution**: Clean and reinstall dependencies:
```bash
pnpm clean
pnpm install
```

### Migration Failures
**Problem**: Migration errors due to schema conflicts  
**Solution**: Reset the database (development only):
```bash
pnpm db:down
pnpm db:migrate
```

### OTLP Exporter Issues
**Problem**: "OTLP exporter endpoint not configured" warnings  
**Solution**: Set the OTLP_ENDPOINT environment variable:
```bash
export OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

**Problem**: Authentication failures with OTLP endpoint  
**Solution**: Set the appropriate authentication method:
```bash
# For API key authentication
export OTLP_API_KEY=your-api-key-here

# For custom header authentication
export OTLP_AUTH_HEADER="Authorization: Bearer your-token-here"
```

### KMS Configuration Issues
**Problem**: "KMS client not initialized" errors  
**Solution**: Ensure all KMS environment variables are set:
```bash
export KMS_BASE_URL=https://kms.example.com
export KMS_ACCESS_TOKEN=your-access-token
export KMS_ENCRYPTION_KEY=key-encryption-123
export KMS_SIGNING_KEY=key-signing-456
```

**Problem**: Encryption/decryption failures  
**Solution**: Verify KMS service is accessible and credentials are correct:
```bash
# Test KMS connectivity
curl -H "Authorization: Bearer $KMS_ACCESS_TOKEN" $KMS_BASE_URL/api/v1/kms/health
```

These solutions address the most common setup issues encountered when initializing the development environment.