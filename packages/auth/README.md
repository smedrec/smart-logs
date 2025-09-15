# @repo/auth

A comprehensive authentication and authorization package built on Better Auth, designed for enterprise-grade applications requiring robust security, fine-grained permissions, and multi-tenant organization support.

## 🏗️ Architecture Overview

The @repo/auth package provides a complete authentication and authorization solution with the following core components:

### Core Components

- **Auth Class**: Main authentication service built on Better Auth
- **AuthorizationService**: Advanced RBAC system with permission caching
- **Database Layer**: Drizzle ORM with PostgreSQL schemas
- **Redis Integration**: High-performance caching and secondary storage
- **Multi-tenant Support**: Organization-based access control with teams

### Key Features

- ✅ **Email & Password Authentication** with verification
- ✅ **Organization Management** with teams and invitations
- ✅ **Role-Based Access Control (RBAC)** with inheritance
- ✅ **API Key Management** with rate limiting
- ✅ **OAuth 2.0/OIDC Provider** support
- ✅ **MCP (Model Context Protocol)** integration
- ✅ **Redis-based Permission Caching** for performance
- ✅ **Audit Logging** integration
- ✅ **Email Services** integration
- ✅ **Session Management** with custom IDs and organization context

## 🚀 Quick Start

### Installation

Since this is a workspace package, it's already available in your monorepo:

```bash
pnpm install
```

### Basic Setup

```typescript
import { Auth, createAuthorizationService } from '@repo/auth'
import { Inngest } from 'inngest'

// Initialize with configuration
const config = {
  server: {
    auth: {
      dbUrl: process.env.DATABASE_URL,
      redisUrl: process.env.REDIS_URL,
      sessionSecret: process.env.SESSION_SECRET,
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      trustedOrigins: ['http://localhost:3000'],
      poolSize: 10
    }
  }
}

const inngest = new Inngest({ id: 'your-app' })

// Create auth instance
const auth = new Auth(config, inngest)

// Create authorization service
const authz = createAuthorizationService(
  auth.getDrizzleInstance(),
  auth.getRedisInstance()
)
```

## 📚 Core Concepts

### Authentication

The Auth class provides a comprehensive authentication solution:

- **Better Auth Integration**: Built on the robust Better Auth framework
- **Email Verification**: Automatic email verification with customizable templates
- **Password Reset**: Secure password reset flow with email notifications
- **Session Management**: Enhanced sessions with organization context
- **Custom Session IDs**: Unique session identifiers for better tracking

### Authorization

The AuthorizationService implements a powerful RBAC system:

- **System-level Roles**: Global roles like `user` and `admin`
- **Organization-level Roles**: Context-specific roles like `org:member`, `org:admin`, `org:owner`
- **Permission Inheritance**: Roles can inherit permissions from other roles
- **Resource-based Permissions**: Fine-grained control over resources and actions
- **Contextual Permissions**: Support for conditional permissions based on ownership

### Multi-tenancy

Organizations are first-class citizens in the system:

- **Organization Management**: Complete CRUD operations for organizations
- **Team Support**: Sub-organization teams with up to 10 teams per organization
- **Member Management**: Invite, remove, and manage organization members
- **Active Organization**: Users have a current active organization context
- **Role Assignment**: Different roles per organization for the same user

### Performance & Caching

- **Redis Caching**: Permissions are cached for 5 minutes to improve performance
- **Connection Pooling**: Configurable database connection pools
- **Efficient Queries**: Optimized database queries with Drizzle ORM
- **Cache Invalidation**: Automatic cache clearing when permissions change

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
SESSION_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"

# Application
APP_PUBLIC_URL="http://localhost:3000"
```

### Database Setup

1. **Start the database**:
   ```bash
   cd packages/auth
   pnpm db:start
   ```

2. **Generate and run migrations**:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

3. **Optional: Use Drizzle Studio**:
   ```bash
   pnpm db:studio
   ```

### Better Auth Schema Generation

Generate the Better Auth schema when auth configuration changes:

```bash
pnpm better-auth:generate
```

## 🎯 Usage Examples

### Basic Authentication

```typescript
import { Auth } from '@repo/auth'

// Get auth instance methods
const authInstance = auth.getAuthInstance()

// Use in your API routes (example with Hono)
app.use('/api/auth/*', async (c, next) => {
  return authInstance.handler(c.req.raw)
})
```

### Permission Checking

```typescript
import { AuthorizationService, PERMISSIONS } from '@repo/auth'

// Check if user has permission
const hasPermission = await authz.hasPermission(
  session,
  PERMISSIONS.AUDIT.EVENTS.READ.resource,
  PERMISSIONS.AUDIT.EVENTS.READ.action
)

if (!hasPermission) {
  throw new Error('Insufficient permissions')
}
```

### Organization Access

```typescript
// Check organization access
const canAccess = await authz.canAccessOrganization(session, organizationId)

// Get user's role in organization
const role = await authz.getOrganizationRole(session, organizationId)
```

### Custom Permissions

```typescript
// Add custom role
await authz.addRole({
  name: 'myorg:custom-role',
  description: 'Custom role for specific needs',
  permissions: [
    { resource: 'custom.resource', action: 'read' },
    { resource: 'custom.resource', action: 'write' }
  ],
  inherits: ['org:member'] // Inherits from org member role
})
```

## 🏛️ Database Schema

The package includes several database schemas:

### Authentication Tables
- `user`: User accounts and profiles
- `account`: OAuth account connections
- `verification`: Email verification tokens
- `apikey`: API key management
- `oauth_*`: OAuth 2.0/OIDC tables

### Organization Tables
- `organization`: Organization definitions
- `member`: Organization memberships
- `team`: Organization teams
- `team_member`: Team memberships
- `invitation`: Pending invitations
- `active_organization`: User's current active organization

### Authorization Tables
- `organization_role`: Custom organization roles
- `report_config`: Organization-specific configurations

## 🔒 Security Features

### Authentication Security
- **Email Verification**: Required for account activation
- **Password Requirements**: Configurable minimum/maximum length
- **Session Security**: Secure token generation and validation
- **Rate Limiting**: Built-in rate limiting for API keys
- **Trusted Origins**: CORS protection with configurable origins

### Authorization Security
- **Principle of Least Privilege**: Users start with minimal permissions
- **Role Inheritance**: Secure permission inheritance chains
- **Context Validation**: Resource ownership and organization membership checks
- **Cache Security**: Secure permission caching with TTL
- **Audit Integration**: All authentication events are logged

## 🧪 Testing

Run the test suite:

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:ci

# Run tests in watch mode
pnpm test:watch
```

## 📖 API Reference

### Main Classes

- **[Auth](docs/api/auth.md)**: Main authentication service
- **[AuthorizationService](docs/api/authorization.md)**: Permission management
- **[Session](docs/api/session.md)**: Session type definitions
- **[Permissions](docs/api/permissions.md)**: Permission constants and types

### Utilities

- **[Database](docs/api/database.md)**: Database connection and schema
- **[Functions](docs/api/functions.md)**: Helper functions
- **[Types](docs/api/types.md)**: TypeScript type definitions

## 📋 Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Step-by-step setup
- **[Tutorials](docs/tutorials/)** - Common use cases with examples
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions
- **[FAQ](docs/faq.md)** - Frequently asked questions

## 🤝 Dependencies

### Runtime Dependencies
- `better-auth`: Core authentication framework
- `@better-auth/expo`: Expo/React Native support
- `drizzle-orm`: Database ORM
- `ioredis`: Redis client
- `postgres`: PostgreSQL client
- `inngest`: Event-driven workflows
- `@repo/audit`: Audit logging integration
- `@repo/mailer`: Email service integration

### Development Dependencies
- `@types/node`: Node.js type definitions
- `typescript`: TypeScript compiler
- `vitest`: Testing framework

## 📄 License

This package is part of the smart-logs monorepo and follows the same licensing terms.

## 🆘 Support

For support, please refer to:
1. [Troubleshooting Guide](docs/troubleshooting.md)
2. [FAQ](docs/faq.md)
3. Package maintainers

---

**Note**: This package is designed for technical users and requires understanding of authentication concepts, database management, and TypeScript/JavaScript development.