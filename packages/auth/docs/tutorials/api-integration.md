# API Integration Tutorial

This tutorial covers advanced integration patterns for the @repo/auth package, including middleware creation, session management, and permission-based access control across different API frameworks.

## Table of Contents

1. [Framework Integration Patterns](#framework-integration-patterns)
2. [Advanced Middleware](#advanced-middleware)
3. [Session Management](#session-management)
4. [Permission-based Routing](#permission-based-routing)
5. [API Key Authentication](#api-key-authentication)
6. [OAuth Integration](#oauth-integration)
7. [Error Handling](#error-handling)
8. [Performance Optimization](#performance-optimization)

## Framework Integration Patterns

### Hono Framework Integration

```typescript path=/src/lib/auth-hono.ts start=null
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timing } from 'hono/timing'
import { authInstance, authz } from './auth'
import type { Context } from 'hono'
import type { Session } from '@repo/auth'

// Extend Hono context with auth
declare module 'hono' {
  interface ContextVariableMap {
    session: Session
    user: Session['user']
    permissions: string[]
  }
}

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', timing())
app.use('*', cors({
  origin: [
    process.env.APP_PUBLIC_URL!,
    'http://localhost:3000',
    'https://your-domain.com'
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie']
}))

// Auth routes - Better Auth handler
app.use('/api/auth/*', async (c) => {
  return authInstance.handler(c.req.raw)
})

// Session middleware
app.use('/api/*', async (c, next) => {
  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers
  })
  
  if (session) {
    c.set('session', session)
    c.set('user', session.user)
  }
  
  await next()
})

export default app
```

### Express Framework Integration

```typescript path=/src/lib/auth-express.ts start=null
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authInstance, authz } from './auth'
import type { Request, Response, NextFunction } from 'express'
import type { Session } from '@repo/auth'

// Extend Express Request with auth
declare global {
  namespace Express {
    interface Request {
      session?: Session
      user?: Session['user']
      permissions?: string[]
    }
  }
}

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: [
    process.env.APP_PUBLIC_URL!,
    'http://localhost:3000'
  ],
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
})
app.use('/api/', limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Auth routes
app.use('/api/auth/*', async (req, res) => {
  try {
    return await authInstance.handler(req, res)
  } catch (error) {
    console.error('Auth handler error:', error)
    res.status(500).json({ error: 'Authentication service error' })
  }
})

// Session middleware for protected routes
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await authInstance.api.getSession({
      headers: req.headers
    })
    
    if (session) {
      req.session = session
      req.user = session.user
    }
    
    next()
  } catch (error) {
    console.error('Session middleware error:', error)
    next()
  }
})

export default app
```

### Fastify Framework Integration

```typescript path=/src/lib/auth-fastify.ts start=null
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { authInstance, authz } from './auth'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { Session } from '@repo/auth'

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info'
  }
})

// Register plugins
await fastify.register(helmet)
await fastify.register(cors, {
  origin: [
    process.env.APP_PUBLIC_URL!,
    'http://localhost:3000'
  ],
  credentials: true
})

await fastify.register(rateLimit, {
  max: 1000,
  timeWindow: 15 * 60 * 1000 // 15 minutes
})

// Add session to request context
fastify.decorateRequest('session', null)
fastify.decorateRequest('user', null)
fastify.decorateRequest('permissions', [])

// Auth routes
fastify.register(async function (fastify) {
  fastify.all('/api/auth/*', async (request, reply) => {
    return authInstance.handler(request.raw, reply.raw)
  })
})

// Session middleware hook
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/auth')) {
    return // Skip auth routes
  }
  
  try {
    const session = await authInstance.api.getSession({
      headers: request.headers
    })
    
    if (session) {
      request.session = session
      request.user = session.user
    }
  } catch (error) {
    fastify.log.error('Session middleware error:', error)
  }
})

export default fastify
```

## Advanced Middleware

### Authentication Middleware

```typescript path=/src/middleware/auth.ts start=null
import { authInstance, authz } from '@/lib/auth'
import type { Context, Next } from 'hono'
import type { Session, Permission } from '@repo/auth'

// Base authentication middleware
export async function requireAuth(c: Context, next: Next) {
  const session = c.get('session')
  
  if (!session) {
    return c.json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      message: 'You must be signed in to access this resource'
    }, 401)
  }
  
  // Check if user is banned
  if (session.user.banned) {
    const banMessage = session.user.banReason || 'Account is suspended'
    return c.json({
      error: 'Account suspended',
      code: 'ACCOUNT_BANNED',
      message: banMessage,
      banExpires: session.user.banExpires
    }, 403)
  }
  
  // Check email verification
  if (!session.user.emailVerified) {
    return c.json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before proceeding'
    }, 403)
  }
  
  await next()
}

// Admin-only middleware
export async function requireAdmin(c: Context, next: Next) {
  const session = c.get('session')
  
  if (session?.user.role !== 'admin') {
    return c.json({
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED',
      message: 'This resource requires administrator privileges'
    }, 403)
  }
  
  await next()
}

// Organization membership middleware
export async function requireOrganization(c: Context, next: Next) {
  const session = c.get('session')
  
  if (!session?.session.activeOrganizationId) {
    return c.json({
      error: 'Organization context required',
      code: 'NO_ACTIVE_ORG',
      message: 'You must be in an organization to access this resource',
      actions: ['create_organization', 'join_organization']
    }, 403)
  }
  
  await next()
}

// Role-based middleware factory
export function requireRole(role: string) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (!session?.session.activeOrganizationRole) {
      return c.json({
        error: 'Organization role required',
        code: 'NO_ORG_ROLE',
        required: role
      }, 403)
    }
    
    const userRole = session.session.activeOrganizationRole
    
    // Check exact role match
    if (userRole === role) {
      await next()
      return
    }
    
    // Check role hierarchy (owner > admin > member)
    const roleHierarchy = ['owner', 'admin', 'member']
    const requiredRoleIndex = roleHierarchy.indexOf(role)
    const userRoleIndex = roleHierarchy.indexOf(userRole)
    
    if (userRoleIndex < requiredRoleIndex) {
      await next()
      return
    }
    
    return c.json({
      error: 'Insufficient role privileges',
      code: 'INSUFFICIENT_ROLE',
      required: role,
      current: userRole
    }, 403)
  }
}
```

### Permission Middleware

```typescript path=/src/middleware/permissions.ts start=null
import { authz, PERMISSIONS } from '@repo/auth'
import type { Context, Next } from 'hono'

// Permission middleware factory
export function requirePermission(resource: string, action: string, context?: Record<string, any>) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (!session) {
      return c.json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, 401)
    }
    
    try {
      const hasPermission = await authz.hasPermission(
        session,
        resource,
        action,
        context
      )
      
      if (!hasPermission) {
        return c.json({
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
          required: { resource, action, context },
          message: `You don't have permission to ${action} on ${resource}`
        }, 403)
      }
      
      await next()
    } catch (error) {
      console.error('Permission check error:', error)
      return c.json({
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      }, 500)
    }
  }
}

// Multiple permissions middleware (requires ALL permissions)
export function requirePermissions(permissions: Array<{resource: string, action: string, context?: Record<string, any>}>) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (!session) {
      return c.json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, 401)
    }
    
    try {
      for (const perm of permissions) {
        const hasPermission = await authz.hasPermission(
          session,
          perm.resource,
          perm.action,
          perm.context
        )
        
        if (!hasPermission) {
          return c.json({
            error: 'Permission denied',
            code: 'PERMISSION_DENIED',
            required: perm,
            message: `Missing permission: ${perm.action} on ${perm.resource}`
          }, 403)
        }
      }
      
      await next()
    } catch (error) {
      console.error('Permissions check error:', error)
      return c.json({
        error: 'Permissions check failed',
        code: 'PERMISSIONS_CHECK_ERROR'
      }, 500)
    }
  }
}

// Any permission middleware (requires ANY permission)
export function requireAnyPermission(permissions: Array<{resource: string, action: string, context?: Record<string, any>}>) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (!session) {
      return c.json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, 401)
    }
    
    try {
      let hasAnyPermission = false
      
      for (const perm of permissions) {
        const hasPermission = await authz.hasPermission(
          session,
          perm.resource,
          perm.action,
          perm.context
        )
        
        if (hasPermission) {
          hasAnyPermission = true
          break
        }
      }
      
      if (!hasAnyPermission) {
        return c.json({
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
          required: permissions,
          message: 'You need at least one of the required permissions'
        }, 403)
      }
      
      await next()
    } catch (error) {
      console.error('Any permissions check error:', error)
      return c.json({
        error: 'Permissions check failed',
        code: 'PERMISSIONS_CHECK_ERROR'
      }, 500)
    }
  }
}

// Resource ownership middleware
export function requireOwnership(getResourceId: (c: Context) => string | Promise<string>) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (!session) {
      return c.json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, 401)
    }
    
    try {
      const resourceId = await getResourceId(c)
      
      const hasPermission = await authz.hasPermission(
        session,
        'resource',
        'access',
        { 
          ownerId: session.user.id,
          resourceId 
        }
      )
      
      if (!hasPermission) {
        return c.json({
          error: 'Resource access denied',
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'You can only access resources you own'
        }, 403)
      }
      
      await next()
    } catch (error) {
      console.error('Ownership check error:', error)
      return c.json({
        error: 'Ownership check failed',
        code: 'OWNERSHIP_CHECK_ERROR'
      }, 500)
    }
  }
}
```

## Session Management

### Advanced Session Utilities

```typescript path=/src/lib/session-utils.ts start=null
import { authInstance, authz, redis } from './auth'
import type { Session } from '@repo/auth'

export class SessionManager {
  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId: string): Promise<any[]> {
    try {
      // This would require custom session storage implementation
      const pattern = `auth:session:user:${userId}:*`
      const keys = await redis.keys(pattern)
      
      const sessions = []
      for (const key of keys) {
        const sessionData = await redis.get(key)
        if (sessionData) {
          sessions.push(JSON.parse(sessionData))
        }
      }
      
      return sessions
    } catch (error) {
      console.error('Failed to get active sessions:', error)
      return []
    }
  }
  
  /**
   * Revoke all sessions for a user (except current)
   */
  static async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    try {
      const sessions = await this.getActiveSessions(userId)
      
      for (const session of sessions) {
        if (session.id !== currentSessionId) {
          await this.revokeSession(session.id)
        }
      }
    } catch (error) {
      console.error('Failed to revoke sessions:', error)
      throw error
    }
  }
  
  /**
   * Revoke a specific session
   */
  static async revokeSession(sessionId: string): Promise<void> {
    try {
      await authInstance.api.signOut({
        sessionId
      })
      
      // Clean up Redis cache
      const pattern = `auth:session:*:${sessionId}`
      const keys = await redis.keys(pattern)
      
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      throw error
    }
  }
  
  /**
   * Get session metadata
   */
  static async getSessionMetadata(sessionId: string): Promise<any> {
    try {
      const metadataKey = `auth:session:meta:${sessionId}`
      const metadata = await redis.get(metadataKey)
      return metadata ? JSON.parse(metadata) : null
    } catch (error) {
      console.error('Failed to get session metadata:', error)
      return null
    }
  }
  
  /**
   * Update session metadata
   */
  static async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    try {
      const metadataKey = `auth:session:meta:${sessionId}`
      await redis.setex(metadataKey, 24 * 60 * 60, JSON.stringify(metadata)) // 24 hours TTL
    } catch (error) {
      console.error('Failed to update session metadata:', error)
      throw error
    }
  }
  
  /**
   * Track session activity
   */
  static async trackActivity(session: Session, activity: string, metadata?: any): Promise<void> {
    try {
      const activityData = {
        sessionId: session.session.id,
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId,
        activity,
        metadata,
        timestamp: new Date().toISOString(),
        ipAddress: session.session.ipAddress,
        userAgent: session.session.userAgent
      }
      
      // Store recent activity (keep last 100 activities)
      const activityKey = `auth:activity:${session.user.id}`
      await redis.lpush(activityKey, JSON.stringify(activityData))
      await redis.ltrim(activityKey, 0, 99)
      await redis.expire(activityKey, 30 * 24 * 60 * 60) // 30 days
    } catch (error) {
      console.error('Failed to track session activity:', error)
    }
  }
}
```

### Session Activity Middleware

```typescript path=/src/middleware/activity.ts start=null
import { SessionManager } from '@/lib/session-utils'
import type { Context, Next } from 'hono'

export async function trackActivity(activity: string, metadata?: any) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    if (session) {
      // Track before processing
      await SessionManager.trackActivity(session, `${activity}_start`, {
        ...metadata,
        route: c.req.path,
        method: c.req.method
      })
      
      try {
        await next()
        
        // Track successful completion
        await SessionManager.trackActivity(session, `${activity}_success`, {
          ...metadata,
          route: c.req.path,
          method: c.req.method
        })
      } catch (error) {
        // Track error
        await SessionManager.trackActivity(session, `${activity}_error`, {
          ...metadata,
          route: c.req.path,
          method: c.req.method,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    } else {
      await next()
    }
  }
}

// Activity tracking for specific actions
export const trackAuditAccess = trackActivity('audit_access')
export const trackReportGeneration = trackActivity('report_generation')
export const trackDataExport = trackActivity('data_export')
export const trackPermissionChange = trackActivity('permission_change')
```

## API Key Authentication

### API Key Middleware

```typescript path=/src/middleware/api-key.ts start=null
import { authInstance } from '@/lib/auth'
import type { Context, Next } from 'hono'

export async function requireApiKey(c: Context, next: Next) {
  const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')
  
  if (!apiKey) {
    return c.json({
      error: 'API key required',
      code: 'API_KEY_REQUIRED',
      message: 'Provide API key in x-api-key header or Authorization header'
    }, 401)
  }
  
  try {
    // Verify API key using Better Auth
    const session = await authInstance.api.verifyApiKey({
      apiKey
    })
    
    if (!session) {
      return c.json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      }, 401)
    }
    
    // Check if API key is enabled
    if (!session.enabled) {
      return c.json({
        error: 'API key disabled',
        code: 'API_KEY_DISABLED'
      }, 403)
    }
    
    // Check if API key is expired
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return c.json({
        error: 'API key expired',
        code: 'API_KEY_EXPIRED',
        expiresAt: session.expiresAt
      }, 403)
    }
    
    // Set API key context
    c.set('apiKey', session)
    c.set('user', session.user)
    
    await next()
  } catch (error) {
    console.error('API key verification error:', error)
    return c.json({
      error: 'API key verification failed',
      code: 'API_KEY_VERIFICATION_ERROR'
    }, 500)
  }
}

// Rate limiting for API keys
export async function apiKeyRateLimit(c: Context, next: Next) {
  const apiKey = c.get('apiKey')
  
  if (!apiKey || !apiKey.rateLimitEnabled) {
    await next()
    return
  }
  
  try {
    // Check rate limit using Better Auth built-in rate limiting
    const remaining = apiKey.remaining || 0
    const maxRequests = apiKey.rateLimitMax || 1000
    
    if (remaining <= 0) {
      return c.json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: maxRequests,
        remaining: 0,
        resetTime: new Date(Date.now() + (apiKey.rateLimitTimeWindow || 86400000))
      }, 429)
    }
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString())
    c.header('X-RateLimit-Remaining', (remaining - 1).toString())
    c.header('X-RateLimit-Reset', new Date(Date.now() + (apiKey.rateLimitTimeWindow || 86400000)).toISOString())
    
    await next()
  } catch (error) {
    console.error('API key rate limit error:', error)
    await next()
  }
}
```

## Error Handling

### Comprehensive Error Handler

```typescript path=/src/middleware/error-handler.ts start=null
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export interface ApiError {
  code: string
  message: string
  details?: any
  statusCode: number
}

export class AuthError extends Error implements ApiError {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function errorHandler(err: Error | HTTPException, c: Context) {
  console.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers),
    timestamp: new Date().toISOString()
  })
  
  // Handle HTTPException from Hono
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      code: 'HTTP_EXCEPTION',
      statusCode: err.status
    }, err.status)
  }
  
  // Handle custom AuthError
  if (err instanceof AuthError) {
    return c.json({
      error: err.message,
      code: err.code,
      details: err.details,
      statusCode: err.statusCode
    }, err.statusCode)
  }
  
  // Handle known authentication errors
  if (err.message.includes('unauthorized')) {
    return c.json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: 401
    }, 401)
  }
  
  if (err.message.includes('forbidden')) {
    return c.json({
      error: 'Access forbidden',
      code: 'FORBIDDEN',
      statusCode: 403
    }, 403)
  }
  
  // Handle database errors
  if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
    return c.json({
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      statusCode: 409
    }, 409)
  }
  
  // Handle validation errors
  if (err.message.includes('validation')) {
    return c.json({
      error: 'Invalid input data',
      code: 'VALIDATION_ERROR',
      details: err.message,
      statusCode: 400
    }, 400)
  }
  
  // Generic server error
  return c.json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  }, 500)
}
```

## Example Routes Implementation

### Complete CRUD Example with Authentication

```typescript path=/src/routes/audit-events.ts start=null
import { Hono } from 'hono'
import { 
  requireAuth, 
  requireOrganization, 
  requirePermission,
  requireRole 
} from '@/middleware/auth'
import { trackActivity } from '@/middleware/activity'
import { PERMISSIONS } from '@repo/auth'
import { db } from '@/lib/auth'
import { events } from '@repo/auth'
import { eq, and, desc } from 'drizzle-orm'

const app = new Hono()

// List audit events
app.get('/',
  requireAuth,
  requireOrganization,
  requirePermission(
    PERMISSIONS.AUDIT.EVENTS.READ.resource,
    PERMISSIONS.AUDIT.EVENTS.READ.action
  ),
  trackActivity('audit_events_list'),
  async (c) => {
    const session = c.get('session')
    const organizationId = session.session.activeOrganizationId!
    
    // Parse query parameters
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = (page - 1) * limit
    
    try {
      const auditEvents = await db
        .select()
        .from(events)
        .where(eq(events.organizationId, organizationId))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset)
      
      const total = await db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(eq(events.organizationId, organizationId))
      
      return c.json({
        events: auditEvents,
        pagination: {
          page,
          limit,
          total: total[0].count,
          pages: Math.ceil(total[0].count / limit)
        }
      })
    } catch (error) {
      console.error('Failed to fetch audit events:', error)
      return c.json({
        error: 'Failed to fetch audit events',
        code: 'FETCH_EVENTS_ERROR'
      }, 500)
    }
  }
)

// Get specific audit event
app.get('/:id',
  requireAuth,
  requireOrganization,
  requirePermission(
    PERMISSIONS.AUDIT.EVENTS.READ.resource,
    PERMISSIONS.AUDIT.EVENTS.READ.action
  ),
  async (c) => {
    const id = c.req.param('id')
    const session = c.get('session')
    const organizationId = session.session.activeOrganizationId!
    
    try {
      const event = await db
        .select()
        .from(events)
        .where(
          and(
            eq(events.id, id),
            eq(events.organizationId, organizationId)
          )
        )
        .limit(1)
      
      if (event.length === 0) {
        return c.json({
          error: 'Audit event not found',
          code: 'EVENT_NOT_FOUND'
        }, 404)
      }
      
      return c.json({ event: event[0] })
    } catch (error) {
      console.error('Failed to fetch audit event:', error)
      return c.json({
        error: 'Failed to fetch audit event',
        code: 'FETCH_EVENT_ERROR'
      }, 500)
    }
  }
)

// Delete audit event (admin only)
app.delete('/:id',
  requireAuth,
  requireOrganization,
  requirePermission(
    PERMISSIONS.AUDIT.EVENTS.DELETE.resource,
    PERMISSIONS.AUDIT.EVENTS.DELETE.action
  ),
  trackActivity('audit_event_delete'),
  async (c) => {
    const id = c.req.param('id')
    const session = c.get('session')
    const organizationId = session.session.activeOrganizationId!
    
    try {
      const result = await db
        .delete(events)
        .where(
          and(
            eq(events.id, id),
            eq(events.organizationId, organizationId)
          )
        )
        .returning()
      
      if (result.length === 0) {
        return c.json({
          error: 'Audit event not found',
          code: 'EVENT_NOT_FOUND'
        }, 404)
      }
      
      return c.json({
        message: 'Audit event deleted successfully',
        event: result[0]
      })
    } catch (error) {
      console.error('Failed to delete audit event:', error)
      return c.json({
        error: 'Failed to delete audit event',
        code: 'DELETE_EVENT_ERROR'
      }, 500)
    }
  }
)

export default app
```

This comprehensive API integration tutorial provides technical users with advanced patterns for implementing authentication and authorization in their applications using the @repo/auth package. The examples cover multiple frameworks, sophisticated middleware patterns, and real-world use cases.