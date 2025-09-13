# Getting Started

<cite>
**Referenced Files in This Document**   
- [package.json](file://package.json)
- [apps/server/package.json](file://apps/server/package.json)
- [apps/web/package.json](file://apps/web/package.json)
- [apps/native/package.json](file://apps/native/package.json)
- [apps/worker/package.json](file://apps/worker/package.json)
- [apps/docs/package.json](file://apps/docs/package.json)
- [apps/server/init-scripts/01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)
- [packages/audit-sdk/examples/basic-usage.ts](file://packages/audit-sdk/examples/basic-usage.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Development Environment Setup](#development-environment-setup)
3. [Running Applications](#running-applications)
4. [Local Database Setup](#local-database-setup)
5. [Environment Variables and Service Configuration](#environment-variables-and-service-configuration)
6. [Hello World Example with Audit SDK](#hello-world-example-with-audit-sdk)
7. [Common Setup Issues and Solutions](#common-setup-issues-and-solutions)

## Introduction
This guide provides comprehensive instructions for setting up the SMEDREC Smart Logs development environment. You will learn how to install dependencies, run applications, configure the database, and use the audit SDK to emit test events. By following this guide, developers can have the full system running locally within 15 minutes.

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
- [apps/server/package.json](file://apps/server/package.json)
- [apps/web/package.json](file://apps/web/package.json)
- [apps/native/package.json](file://apps/native/package.json)
- [apps/worker/package.json](file://apps/worker/package.json)
- [apps/docs/package.json](file://apps/docs/package.json)

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
- [apps/server/init-scripts/01-init-audit-db.sql](file://apps/server/init-scripts/01-init-audit-db.sql)

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
```

### Service Connections
Ensure the following services are running and properly connected:

- **PostgreSQL**: Running on port 5432
- **Redis**: Running on port 6379
- **Inngest**: For workflow processing (if applicable)

The server application automatically connects to these services using the environment variables.

## Hello World Example with Audit SDK

### SDK Initialization
Create a simple script to test the Audit SDK:

```typescript
// hello-world.ts
import { AuditSDK } from '@repo/audit-sdk';

// Initialize the SDK with local configuration
const auditSDK = new AuditSDK({
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  databaseUrl: process.env.AUDIT_DB_URL || 'postgresql://audit:password@localhost:5432/audit_db',
  defaults: {
    dataClassification: 'INTERNAL',
    generateHash: true,
  },
});

async function helloWorld() {
  try {
    // Emit a test audit event
    await auditSDK.log({
      principalId: 'hello-world-user',
      action: 'test.event.emitted',
      status: 'success',
      outcomeDescription: 'Hello World test event from getting started guide',
    });

    console.log('✅ Hello World audit event emitted successfully!');

    // Check system health
    const health = await auditSDK.getHealth();
    console.log('📊 Audit system health:', health);
  } catch (error) {
    console.error('❌ Error emitting audit event:', error);
  } finally {
    await auditSDK.close();
  }
}

helloWorld();
```

### Running the Example
Execute the Hello World example:

```bash
# From the root directory
cd packages/audit-sdk
npx tsx ../../examples/hello-world.ts
```

Expected output:
```
✅ Hello World audit event emitted successfully!
📊 Audit system health: { redis: 'connected', database: 'connected', timestamp: '2024-01-15T10:00:00.000Z' }
```

This example demonstrates the basic usage pattern of the Audit SDK: initialize, log events, check health, and clean up connections.

**Section sources**
- [packages/audit-sdk/examples/basic-usage.ts](file://packages/audit-sdk/examples/basic-usage.ts)

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

These solutions address the most common setup issues encountered when initializing the development environment.