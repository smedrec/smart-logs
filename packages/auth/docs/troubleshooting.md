# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using the @repo/auth package. It covers database problems, authentication failures, permission issues, Redis connectivity, and performance optimization.

## Table of Contents

1. [Database Issues](#database-issues)
2. [Authentication Problems](#authentication-problems)
3. [Permission & Authorization Issues](#permission--authorization-issues)
4. [Redis Connection Problems](#redis-connection-problems)
5. [Email Service Issues](#email-service-issues)
6. [Session Management Problems](#session-management-problems)
7. [Performance Issues](#performance-issues)
8. [Development Environment Setup](#development-environment-setup)
9. [Production Deployment Issues](#production-deployment-issues)
10. [Debug Tools & Logging](#debug-tools--logging)

## Database Issues

### Problem: Database Connection Failures

**Symptoms:**
- Error: "Connection refused" or "Connection timeout"
- Application fails to start
- Database queries timeout

**Common Causes & Solutions:**

```typescript path=/src/debug/database.ts start=null
// Test database connectivity
import { db } from '@repo/auth'

export async function testDatabaseConnection() {
  try {
    // Test basic connectivity
    const result = await db.execute(sql`SELECT NOW() as current_time`)
    console.log('✅ Database connected successfully:', result)
    
    // Test auth tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user', 'session', 'organization', 'member')
    `)
    
    console.log('✅ Required tables found:', tables.rows.length)
    
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}
```

**Resolution Steps:**

1. **Check Environment Variables:**
   ```bash
   echo $DATABASE_URL
   # Should output: postgresql://user:pass@host:port/database
   ```

2. **Verify Database is Running:**
   ```bash
   # Using Docker
   docker ps | grep postgres
   
   # Or check if service is running
   pg_isready -h localhost -p 5432
   ```

3. **Test Manual Connection:**
   ```bash
   psql $DATABASE_URL
   ```

4. **Check Firewall/Network:**
   ```bash
   telnet your-db-host 5432
   ```

### Problem: Migration Failures

**Symptoms:**
- Error: "Migration failed"
- Tables don't exist
- Schema out of sync

**Solutions:**

```bash
# Reset migrations (DANGEROUS - only for development)
cd packages/auth
pnpm db:down  # Stop database
pnpm db:start # Start fresh database
pnpm db:generate # Generate migrations
pnpm db:migrate  # Apply migrations

# For production, run migrations manually
pnpm db:migrate
```

**Check Migration Status:**
```typescript path=/src/debug/migrations.ts start=null
import { db } from '@repo/auth'

export async function checkMigrationStatus() {
  try {
    // Check if drizzle migrations table exists
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = '__drizzle_migrations'
    `)
    
    if (result.rows[0].count === '0') {
      console.warn('⚠️  Migrations table not found. Run: pnpm db:migrate')
      return false
    }
    
    // Get migration history
    const migrations = await db.execute(sql`
      SELECT * FROM __drizzle_migrations 
      ORDER BY created_at DESC 
      LIMIT 5
    `)
    
    console.log('📊 Recent migrations:', migrations.rows)
    return true
  } catch (error) {
    console.error('❌ Migration check failed:', error)
    return false
  }
}
```

### Problem: Better Auth Schema Generation Issues

**Symptoms:**
- Error: "Schema generation failed"
- Missing tables after generation

**Solution:**

```bash
# Regenerate Better Auth schema
cd packages/auth
pnpm better-auth:generate

# If that fails, check your auth.ts configuration
node -e "console.log(require('./src/auth.ts'))"
```

## Authentication Problems

### Problem: Sign-in Failures

**Symptoms:**
- "Invalid credentials" errors
- Users can't sign in with correct password
- Email verification not working

**Debug Authentication:**

```typescript path=/src/debug/auth.ts start=null
import { authInstance } from '@/lib/auth'

export async function debugAuthFlow(email: string, password: string) {
  try {
    // Test user exists
    const user = await db.query.user.findFirst({
      where: eq(user.email, email)
    })
    
    if (!user) {
      console.log('❌ User not found:', email)
      return
    }
    
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      banned: user.banned
    })
    
    // Check if user is banned
    if (user.banned) {
      console.log('❌ User is banned:', user.banReason)
      return
    }
    
    // Check email verification
    if (!user.emailVerified) {
      console.log('⚠️  Email not verified')
    }
    
    // Test password (this would be done internally by Better Auth)
    console.log('🔍 Debug info collected')
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}
```

**Common Solutions:**

1. **Check Email Verification:**
   ```sql
   SELECT id, email, email_verified FROM "user" WHERE email = 'user@example.com';
   ```

2. **Reset Password for Testing:**
   ```typescript
   // Trigger password reset
   await authInstance.api.forgetPassword({
     email: 'user@example.com',
     redirectTo: '/reset-password'
   })
   ```

3. **Check Session Configuration:**
   ```typescript
   // Verify session secret is set
   console.log('Session secret length:', process.env.SESSION_SECRET?.length)
   // Should be at least 32 characters
   ```

### Problem: Session Not Persisting

**Symptoms:**
- User gets logged out immediately
- Session doesn't survive page refresh
- "Unauthorized" errors on protected routes

**Debug Sessions:**

```typescript path=/src/debug/session.ts start=null
export async function debugSessionIssues(request: Request) {
  try {
    // Check cookies
    const cookies = request.headers.get('cookie')
    console.log('🍪 Cookies received:', cookies)
    
    // Check session in Better Auth
    const session = await authInstance.api.getSession({
      headers: request.headers
    })
    
    if (session) {
      console.log('✅ Session found:', {
        userId: session.user.id,
        sessionId: session.session.id,
        expiresAt: session.session.expiresAt
      })
    } else {
      console.log('❌ No session found')
    }
    
    // Check Redis storage
    const redisKeys = await redis.keys('auth:*')
    console.log('🔄 Redis keys found:', redisKeys.length)
    
  } catch (error) {
    console.error('❌ Session debug failed:', error)
  }
}
```

**Solutions:**

1. **Check CORS Configuration:**
   ```typescript
   app.use('*', cors({
     origin: [process.env.APP_PUBLIC_URL!],
     credentials: true // This is crucial for cookies
   }))
   ```

2. **Verify Domain Configuration:**
   ```typescript
   // Make sure your domains match
   console.log('BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL)
   console.log('APP_PUBLIC_URL:', process.env.APP_PUBLIC_URL)
   ```

3. **Check Cookie Settings:**
   - Ensure HTTPS in production
   - Verify SameSite settings
   - Check domain/subdomain configuration

## Permission & Authorization Issues

### Problem: Permission Checks Failing

**Symptoms:**
- Users can't access resources they should have access to
- "Permission denied" errors
- Inconsistent permission behavior

**Debug Permissions:**

```typescript path=/src/debug/permissions.ts start=null
import { authz, PERMISSIONS } from '@repo/auth'
import type { Session } from '@repo/auth'

export async function debugPermissions(
  session: Session,
  resource: string,
  action: string
) {
  try {
    console.log('🔍 Debugging permissions for:', {
      userId: session.user.id,
      userRole: session.user.role,
      orgId: session.session.activeOrganizationId,
      orgRole: session.session.activeOrganizationRole,
      resource,
      action
    })
    
    // Check system role permissions
    const systemRole = await authz.getRole(session.user.role)
    console.log('👤 System role:', systemRole)
    
    // Check organization role permissions
    if (session.session.activeOrganizationRole) {
      const orgRole = await authz.getRole(`org:${session.session.activeOrganizationRole}`)
      console.log('🏢 Organization role:', orgRole)
    }
    
    // Get all user permissions
    const userPermissions = await authz.getUserPermissions(session)
    console.log('🔑 All user permissions:', userPermissions)
    
    // Test the specific permission
    const hasPermission = await authz.hasPermission(session, resource, action)
    console.log(`${hasPermission ? '✅' : '❌'} Permission check result:`, hasPermission)
    
    return hasPermission
  } catch (error) {
    console.error('❌ Permission debug failed:', error)
    return false
  }
}
```

**Common Solutions:**

1. **Clear Permission Cache:**
   ```typescript
   // Clear cache for specific user
   await authz.clearUserCache(userId)
   
   // Clear all permission cache
   await authz.clearCache()
   ```

2. **Check Role Definitions:**
   ```typescript
   // List all roles
   const allRoles = await authz.getAllRoles()
   console.log('Available roles:', allRoles)
   ```

3. **Verify Organization Membership:**
   ```sql
   SELECT m.*, o.name as org_name 
   FROM member m 
   JOIN organization o ON m.organization_id = o.id 
   WHERE m.user_id = 'user-id-here';
   ```

### Problem: Organization Context Missing

**Symptoms:**
- "Organization context required" errors
- Users can't access organization resources
- Active organization not set

**Debug Organization Context:**

```typescript path=/src/debug/organization.ts start=null
export async function debugOrganizationContext(userId: string) {
  try {
    // Check user memberships
    const memberships = await db.query.member.findMany({
      where: eq(member.userId, userId),
      with: {
        organization: true
      }
    })
    
    console.log('🏢 User memberships:', memberships.map(m => ({
      orgId: m.organizationId,
      orgName: m.organization.name,
      role: m.role
    })))
    
    // Check active organization
    const activeOrg = await db.query.activeOrganization.findFirst({
      where: eq(activeOrganization.userId, userId)
    })
    
    if (activeOrg) {
      console.log('✅ Active organization:', activeOrg)
    } else {
      console.log('❌ No active organization set')
    }
    
    return { memberships, activeOrg }
  } catch (error) {
    console.error('❌ Organization debug failed:', error)
    return null
  }
}
```

**Solutions:**

1. **Set Active Organization:**
   ```typescript
   import { ActiveOrganizationManager } from '@/lib/organization'
   
   await ActiveOrganizationManager.switchOrganization(userId, organizationId)
   ```

2. **Create Organization for User:**
   ```typescript
   import { createOrganization } from '@/lib/organization'
   
   const org = await createOrganization(session, {
     name: 'My Organization',
     slug: 'my-org'
   })
   ```

## Redis Connection Problems

### Problem: Redis Connection Failures

**Symptoms:**
- "Redis connection refused"
- Permission cache not working
- Slow performance

**Debug Redis:**

```typescript path=/src/debug/redis.ts start=null
import { redis } from '@/lib/auth'

export async function debugRedisConnection() {
  try {
    // Test basic connectivity
    const pong = await redis.ping()
    console.log('✅ Redis ping successful:', pong)
    
    // Test write/read
    await redis.set('test:key', 'test-value', 'EX', 10)
    const value = await redis.get('test:key')
    console.log('✅ Redis read/write test:', value === 'test-value')
    
    // Check auth keys
    const authKeys = await redis.keys('auth:*')
    console.log('🔑 Auth keys count:', authKeys.length)
    
    // Check memory usage
    const memory = await redis.memory('usage')
    console.log('💾 Redis memory usage:', memory)
    
    return true
  } catch (error) {
    console.error('❌ Redis debug failed:', error)
    return false
  }
}
```

**Solutions:**

1. **Check Redis URL:**
   ```bash
   echo $REDIS_URL
   redis-cli -u $REDIS_URL ping
   ```

2. **Verify Redis is Running:**
   ```bash
   docker ps | grep redis
   redis-cli ping
   ```

3. **Test Connection Manually:**
   ```bash
   redis-cli -h your-redis-host -p 6379
   ```

## Email Service Issues

### Problem: Emails Not Sending

**Symptoms:**
- Verification emails not received
- Password reset emails missing
- Invitation emails not delivered

**Debug Email Service:**

```typescript path=/src/debug/email.ts start=null
export async function debugEmailService() {
  try {
    console.log('📧 Email configuration:')
    console.log('- Inngest configured:', !!inngest)
    console.log('- APP_PUBLIC_URL:', process.env.APP_PUBLIC_URL)
    
    // Test email sending manually
    await inngest.send({
      name: 'email/send',
      data: {
        principalId: 'test-user-id',
        organizationId: 'test-org-id',
        service: 'smart-logs',
        action: 'test',
        emailDetails: {
          from: 'test@example.com',
          to: 'user@example.com',
          subject: 'Test Email',
          html: '<p>Test email content</p>'
        }
      }
    })
    
    console.log('✅ Test email sent')
  } catch (error) {
    console.error('❌ Email debug failed:', error)
  }
}
```

**Common Solutions:**

1. **Check Email Provider Configuration:**
   - Verify SMTP settings
   - Check API keys
   - Validate sender domains

2. **Check Spam Filters:**
   - Look in spam/junk folders
   - Verify sender reputation
   - Check email content

3. **Verify Inngest Configuration:**
   ```typescript
   // Make sure Inngest is properly configured
   const inngest = new Inngest({ 
     id: 'your-app-id',
     name: 'Your App Name'
   })
   ```

## Performance Issues

### Problem: Slow Permission Checks

**Symptoms:**
- API responses are slow
- Permission checks timeout
- High database load

**Debug Performance:**

```typescript path=/src/debug/performance.ts start=null
export async function debugPermissionPerformance(session: Session) {
  const startTime = Date.now()
  
  try {
    // Test permission check speed
    const hasPermission = await authz.hasPermission(
      session,
      PERMISSIONS.AUDIT.EVENTS.READ.resource,
      PERMISSIONS.AUDIT.EVENTS.READ.action
    )
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`⏱️  Permission check took: ${duration}ms`)
    
    if (duration > 1000) {
      console.warn('⚠️  Slow permission check detected')
    }
    
    // Check cache hit
    const cacheKey = `authz:permissions:${session.session.userId}`
    const cached = await redis.keys(`${cacheKey}*`)
    console.log('🔄 Cached permissions:', cached.length)
    
    return { duration, hasPermission, cacheHits: cached.length }
  } catch (error) {
    console.error('❌ Performance debug failed:', error)
    return null
  }
}
```

**Optimization Solutions:**

1. **Enable Permission Caching:**
   ```typescript
   // Already enabled by default, check cache TTL
   const cacheTtl = 5 * 60 // 5 minutes
   ```

2. **Optimize Database Queries:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_member_user_org ON member(user_id, organization_id);
   CREATE INDEX idx_active_org_user ON active_organization(user_id);
   ```

3. **Adjust Connection Pool:**
   ```typescript
   const { db } = initDrizzle(dbUrl, 20) // Increase pool size
   ```

## Debug Tools & Logging

### Comprehensive Debug Utility

```typescript path=/src/debug/index.ts start=null
import { debugDatabaseConnection, checkMigrationStatus } from './database'
import { debugRedisConnection } from './redis'
import { debugAuthFlow, debugSessionIssues } from './auth'
import { debugPermissions } from './permissions'
import { debugOrganizationContext } from './organization'

export class AuthDebugger {
  static async runFullDiagnostic() {
    console.log('🔍 Running @repo/auth diagnostic...\n')
    
    const results = {
      database: await debugDatabaseConnection(),
      migrations: await checkMigrationStatus(),
      redis: await debugRedisConnection(),
    }
    
    console.log('\n📊 Diagnostic Results:')
    console.table(results)
    
    return results
  }
  
  static async debugUser(userId: string) {
    console.log(`🔍 Debugging user: ${userId}\n`)
    
    // Get user info
    const user = await db.query.user.findFirst({
      where: eq(user.id, userId)
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    console.log('👤 User info:', user)
    
    // Check organizations
    const orgContext = await debugOrganizationContext(userId)
    
    // Check active sessions
    const sessions = await SessionManager.getActiveSessions(userId)
    console.log('🔐 Active sessions:', sessions.length)
    
    return { user, organizations: orgContext, sessions }
  }
}
```

### Environment Verification Script

```typescript path=/src/debug/env-check.ts start=null
export function verifyEnvironment() {
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'SESSION_SECRET',
    'BETTER_AUTH_URL',
    'APP_PUBLIC_URL'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing)
    return false
  }
  
  // Check session secret strength
  const sessionSecret = process.env.SESSION_SECRET!
  if (sessionSecret.length < 32) {
    console.warn('⚠️  SESSION_SECRET should be at least 32 characters')
  }
  
  // Verify URLs
  try {
    new URL(process.env.BETTER_AUTH_URL!)
    new URL(process.env.APP_PUBLIC_URL!)
  } catch (error) {
    console.error('❌ Invalid URL format in environment variables')
    return false
  }
  
  console.log('✅ Environment variables verified')
  return true
}
```

## Common Error Messages & Solutions

### "Cannot find module '@repo/auth'"

**Solution:**
```bash
# Make sure you're in the monorepo root
pnpm install

# Check if package builds correctly
cd packages/auth
pnpm build
```

### "Database connection string is invalid"

**Solution:**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:pass@host:port/database

# Test connection manually
psql $DATABASE_URL -c "SELECT NOW();"
```

### "Redis connection failed"

**Solution:**
```bash
# Check Redis URL
echo $REDIS_URL
# Should be: redis://host:port or redis://user:pass@host:port

# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### "Permission denied for resource"

**Solution:**
```typescript
// Debug the specific permission
await debugPermissions(session, resource, action)

// Clear cache and retry
await authz.clearUserCache(session.user.id)
```

### "Organization context required"

**Solution:**
```typescript
// Check user memberships
await debugOrganizationContext(session.user.id)

// Set active organization
await ActiveOrganizationManager.switchOrganization(
  session.user.id, 
  organizationId
)
```

## Getting Help

If you're still experiencing issues after following this troubleshooting guide:

1. **Enable Debug Logging:**
   ```typescript
   // Set environment variable
   process.env.DEBUG_AUTH = 'true'
   ```

2. **Collect Diagnostic Information:**
   ```typescript
   const diagnostic = await AuthDebugger.runFullDiagnostic()
   console.log('Diagnostic results:', diagnostic)
   ```

3. **Check Package Versions:**
   ```bash
   cd packages/auth
   pnpm list
   ```

4. **Review Logs:**
   - Application logs
   - Database logs
   - Redis logs
   - Email service logs

5. **Contact Support:**
   - Include diagnostic results
   - Provide error messages
   - Share relevant configuration (without secrets)

---

This troubleshooting guide should help you identify and resolve most common issues with the @repo/auth package. Keep it updated as you encounter new problems and solutions.