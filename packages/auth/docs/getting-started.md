# Getting Started with @repo/auth

This comprehensive guide will walk you through setting up and using the @repo/auth package in your application. The package provides enterprise-grade authentication and authorization features built on Better Auth.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **pnpm** as your package manager
- **PostgreSQL 14+** database
- **Redis 6+** server
- **TypeScript** knowledge (recommended)
- Basic understanding of authentication concepts

## Step 1: Environment Setup

### 1.1 Database Configuration

First, set up your PostgreSQL database. You can use the included Docker configuration:

```bash
cd packages/auth
pnpm db:start
```

This will start a PostgreSQL container with the necessary configuration.

### 1.2 Environment Variables

Create a `.env` file in your application root with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/smartlogs_auth"

# Redis Configuration  
REDIS_URL="redis://localhost:6379"

# Authentication Configuration
SESSION_SECRET="your-super-secret-session-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

# Application Configuration
APP_PUBLIC_URL="http://localhost:3000"

# Optional: For production deployments
NODE_ENV="development"
```

**Important Security Notes:**
- Use a strong, unique `SESSION_SECRET` (minimum 32 characters)
- Never commit secrets to version control
- Use different secrets for different environments

### 1.3 Database Schema Setup

Generate and apply database migrations:

```bash
# Generate migration files
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Optional: Open Drizzle Studio to view schema
pnpm db:studio
```

### 1.4 Generate Better Auth Schema

Generate the Better Auth schema based on your configuration:

```bash
pnpm better-auth:generate
```

This command analyzes your `auth.ts` configuration and generates the corresponding database schema.

## Step 2: Basic Integration

### 2.1 Initialize the Auth Service

Create an auth service in your application:

```typescript path=/src/lib/auth.ts start=null
import { Auth, createAuthorizationService } from '@repo/auth'
import { Inngest } from 'inngest'
import type { AuditConfig } from '@repo/audit'

// Your application configuration
const config: AuditConfig = {
  server: {
    auth: {
      dbUrl: process.env.DATABASE_URL!,
      redisUrl: process.env.REDIS_URL!,
      sessionSecret: process.env.SESSION_SECRET!,
      betterAuthUrl: process.env.BETTER_AUTH_URL!,
      trustedOrigins: [
        process.env.APP_PUBLIC_URL!,
        'http://localhost:3000', // Add your development URLs
      ],
      poolSize: 10 // Adjust based on your needs
    }
  }
}

// Initialize Inngest for email workflows
const inngest = new Inngest({ 
  id: 'smart-logs-auth',
  name: 'Smart Logs Authentication'
})

// Create auth instance
export const auth = new Auth(config, inngest)

// Create authorization service
export const authz = createAuthorizationService(
  auth.getDrizzleInstance(),
  auth.getRedisInstance()
)

// Export instances for use in your app
export const authInstance = auth.getAuthInstance()
export const db = auth.getDrizzleInstance()
export const redis = auth.getRedisInstance()
```

### 2.2 Integration with Your API Framework

#### With Hono (Recommended)

```typescript path=/src/app.ts start=null
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authInstance } from './lib/auth'

const app = new Hono()

// Configure CORS
app.use('*', cors({
  origin: [process.env.APP_PUBLIC_URL!, 'http://localhost:3000'],
  credentials: true
}))

// Auth routes - handles all Better Auth endpoints
app.use('/api/auth/*', async (c, next) => {
  return authInstance.handler(c.req.raw)
})

// Protected route example
app.get('/api/protected', async (c) => {
  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers
  })
  
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  return c.json({ 
    message: 'Hello authenticated user!', 
    user: session.user 
  })
})

export default app
```

#### With Express

```typescript path=/src/server.ts start=null
import express from 'express'
import cors from 'cors'
import { authInstance } from './lib/auth'

const app = express()

// Configure CORS
app.use(cors({
  origin: [process.env.APP_PUBLIC_URL!, 'http://localhost:3000'],
  credentials: true
}))

app.use(express.json())

// Auth routes
app.use('/api/auth/*', async (req, res) => {
  return authInstance.handler(req, res)
})

// Protected route example
app.get('/api/protected', async (req, res) => {
  try {
    const session = await authInstance.api.getSession({
      headers: req.headers
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    res.json({ 
      message: 'Hello authenticated user!', 
      user: session.user 
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

## Step 3: Frontend Integration

### 3.1 Install Better Auth Client

```bash
pnpm add better-auth
```

### 3.2 Create Auth Client

```typescript path=/src/lib/auth-client.ts start=null
import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000',
  credentials: 'include'
})
```

### 3.3 React Integration Example

```tsx path=/src/components/AuthForm.tsx start=null
'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        await authClient.signUp.email({
          email,
          password,
          name
        })
        alert('Sign up successful! Please check your email for verification.')
      } else {
        await authClient.signIn.email({
          email,
          password
        })
        alert('Signed in successfully!')
        // Redirect to dashboard or refresh page
        window.location.href = '/dashboard'
      }
    } catch (error) {
      console.error('Auth error:', error)
      alert('Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold">
        {isSignUp ? 'Sign Up' : 'Sign In'}
      </h2>
      
      {isSignUp && (
        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
      )}
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full p-2 border rounded"
      />
      
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full p-2 border rounded"
      />
      
      <button
        type="submit"
        disabled={loading}
        className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
      </button>
      
      <button
        type="button"
        onClick={() => setIsSignUp(!isSignUp)}
        className="w-full p-2 text-blue-500 underline"
      >
        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
      </button>
    </form>
  )
}
```

## Step 4: Organization Setup

### 4.1 Create Your First Organization

After authentication is working, you'll need to create organizations for multi-tenant support:

```typescript path=/src/lib/organization.ts start=null
import { authInstance, db } from './auth'
import { organization, member } from '@repo/auth'

export async function createOrganization(
  userId: string,
  orgData: {
    name: string
    slug?: string
    retentionDays?: number
  }
) {
  try {
    // Create organization
    const [newOrg] = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: orgData.name,
      slug: orgData.slug || orgData.name.toLowerCase().replace(/\s+/g, '-'),
      retentionDays: orgData.retentionDays || 90,
      createdAt: new Date(),
      metadata: null,
      logo: null
    }).returning()

    // Add user as organization owner
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: newOrg.id,
      userId: userId,
      role: 'owner',
      createdAt: new Date()
    })

    return newOrg
  } catch (error) {
    console.error('Failed to create organization:', error)
    throw error
  }
}
```

### 4.2 Organization Context Middleware

Create middleware to ensure users have an active organization:

```typescript path=/src/middleware/auth.ts start=null
import { authInstance, authz } from '@/lib/auth'
import type { Context, Next } from 'hono'

export async function requireAuth(c: Context, next: Next) {
  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers
  })
  
  if (!session) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  // Store session in context
  c.set('session', session)
  await next()
}

export async function requireOrganization(c: Context, next: Next) {
  const session = c.get('session')
  
  if (!session?.session.activeOrganizationId) {
    return c.json({ 
      error: 'Active organization required',
      code: 'NO_ACTIVE_ORG'
    }, 403)
  }
  
  await next()
}

export function requirePermission(resource: string, action: string) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    const hasPermission = await authz.hasPermission(
      session, 
      resource, 
      action
    )
    
    if (!hasPermission) {
      return c.json({ 
        error: 'Insufficient permissions',
        required: { resource, action }
      }, 403)
    }
    
    await next()
  }
}
```

## Step 5: Permission Management

### 5.1 Using Built-in Permissions

```typescript path=/src/controllers/audit.ts start=null
import { PERMISSIONS } from '@repo/auth'
import { requireAuth, requirePermission } from '@/middleware/auth'

// Example: Protected audit endpoint
app.get('/api/audit/events', 
  requireAuth,
  requirePermission(
    PERMISSIONS.AUDIT.EVENTS.READ.resource,
    PERMISSIONS.AUDIT.EVENTS.READ.action
  ),
  async (c) => {
    const session = c.get('session')
    
    // User has permission to read audit events
    const events = await getAuditEvents(session.session.activeOrganizationId)
    
    return c.json({ events })
  }
)
```

### 5.2 Custom Permission Checking

```typescript path=/src/lib/permissions.ts start=null
import { authz, type Session } from '@repo/auth'

export async function checkAuditAccess(
  session: Session,
  auditId: string,
  action: 'read' | 'write' | 'delete'
) {
  // Check if user has general permission
  const hasGeneralPermission = await authz.hasPermission(
    session,
    'audit.events',
    action
  )
  
  if (hasGeneralPermission) {
    return true
  }
  
  // Check resource-specific permission (e.g., ownership)
  const hasResourcePermission = await authz.hasPermission(
    session,
    'audit.events',
    action,
    { 
      ownerId: session.user.id,
      organizationId: session.session.activeOrganizationId 
    }
  )
  
  return hasResourcePermission
}
```

## Step 6: Testing Your Setup

### 6.1 Basic Health Check

Create a health check endpoint to verify your setup:

```typescript path=/src/routes/health.ts start=null
app.get('/health', async (c) => {
  try {
    // Test database connection
    await db.select().from(user).limit(1)
    
    // Test Redis connection
    await redis.ping()
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        auth: 'configured'
      }
    })
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})
```

### 6.2 Manual Testing Flow

1. **Start your application**:
   ```bash
   pnpm dev
   ```

2. **Test registration**:
   - Navigate to your sign-up form
   - Register with a test email
   - Check email for verification link

3. **Test authentication**:
   - Sign in with verified account
   - Access protected endpoints
   - Verify session persistence

4. **Test permissions**:
   - Create organization
   - Test different permission levels
   - Verify access control

## Step 7: Production Considerations

### 7.1 Environment Variables

For production, ensure you have:

```bash
# Production Database
DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname"

# Production Redis (with password)
REDIS_URL="redis://user:password@redis-host:6379"

# Secure session secret (use a key management service)
SESSION_SECRET="your-super-secure-production-secret"

# Production URLs
BETTER_AUTH_URL="https://your-domain.com"
APP_PUBLIC_URL="https://your-domain.com"

# Production environment
NODE_ENV="production"
```

### 7.2 Security Checklist

- [ ] Use HTTPS in production
- [ ] Implement proper CORS policies
- [ ] Set up rate limiting
- [ ] Configure secure headers
- [ ] Enable database SSL
- [ ] Use Redis AUTH/SSL
- [ ] Implement proper logging
- [ ] Set up monitoring and alerts

### 7.3 Performance Optimization

- **Connection Pooling**: Adjust `poolSize` based on your load
- **Redis Caching**: Monitor cache hit rates
- **Database Indexes**: Ensure proper indexing for your queries
- **CDN**: Use CDN for static assets

## Next Steps

Now that you have @repo/auth set up, explore these advanced topics:

1. **[API Integration Tutorial](tutorials/api-integration.md)** - Detailed API integration patterns
2. **[Organization Management](tutorials/organization-management.md)** - Advanced organization features
3. **[Custom Permissions](tutorials/custom-permissions.md)** - Creating custom permission systems
4. **[OAuth Integration](tutorials/oauth-integration.md)** - Adding OAuth providers
5. **[Mobile App Integration](tutorials/mobile-integration.md)** - Using with React Native/Expo

## Troubleshooting

If you encounter issues, check:

1. **[Troubleshooting Guide](troubleshooting.md)** - Common problems and solutions
2. **[FAQ](faq.md)** - Frequently asked questions
3. **Logs**: Check your application and database logs
4. **Network**: Verify database and Redis connectivity

## Support

For additional help:

- Review the [API documentation](api/)
- Check the [examples directory](examples/)
- Consult the Better Auth documentation
- Contact the package maintainers

---

**Congratulations!** You now have a fully functional authentication and authorization system. The @repo/auth package provides enterprise-grade security with the flexibility to customize for your specific needs.