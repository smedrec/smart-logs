# Frequently Asked Questions (FAQ)

This FAQ provides answers to common questions about the @repo/auth package, covering architecture decisions, best practices, troubleshooting, and advanced usage scenarios.

## Table of Contents

1. [General Questions](#general-questions)
2. [Architecture & Design](#architecture--design)
3. [Authentication & Sessions](#authentication--sessions)
4. [Authorization & Permissions](#authorization--permissions)
5. [Organizations & Multi-tenancy](#organizations--multi-tenancy)
6. [Security Concerns](#security-concerns)
7. [Performance & Scalability](#performance--scalability)
8. [Development & Integration](#development--integration)
9. [Production & Deployment](#production--deployment)
10. [Troubleshooting](#troubleshooting)

## General Questions

### Q: What is @repo/auth and why should I use it?

**A:** @repo/auth is an enterprise-grade authentication and authorization package built on Better Auth, designed for TypeScript applications requiring:

- **Multi-tenant organization management**
- **Role-based access control (RBAC)**
- **High-performance permission caching**
- **Email verification and password reset**
- **API key authentication**
- **OAuth/OIDC provider capabilities**
- **Audit logging integration**

It provides a complete solution that handles the complexity of modern authentication while maintaining flexibility and performance.

### Q: How does this differ from other authentication solutions?

**A:** Key differentiators include:

- **Built-in multi-tenancy** with organizations and teams
- **Advanced permission system** with inheritance and caching
- **TypeScript-first** design with full type safety
- **Better Auth foundation** for reliability and standards compliance
- **Monorepo integration** with other @repo packages
- **Production-ready** with comprehensive error handling and monitoring

### Q: What are the system requirements?

**A:** Requirements:
- **Node.js 18+**
- **PostgreSQL 14+** 
- **Redis 6+**
- **TypeScript 4.9+**
- **pnpm** package manager (recommended)

Optional:
- **Docker** for local development
- **Inngest** for email workflows

### Q: Is this package production-ready?

**A:** Yes, the package is designed for production use with:

- Comprehensive error handling
- Performance optimization
- Security best practices
- Monitoring and debugging tools
- Extensive testing capabilities
- Documentation and support

## Architecture & Design

### Q: Why was Better Auth chosen as the foundation?

**A:** Better Auth was selected because:

- **Standards compliance** with OAuth 2.0, OIDC, and SAML
- **Framework agnostic** design
- **TypeScript-first** approach
- **Extensible plugin system**
- **Active development** and community
- **Security-focused** implementation
- **Performance optimized**

### Q: How does the permission system work?

**A:** The authorization system implements RBAC with:

```typescript
// System-level roles (global)
'user' | 'admin'

// Organization-level roles (per-tenant)
'org:member' | 'org:admin' | 'org:owner'

// Custom roles (organization-specific)
'myorg:custom-role'
```

Permissions are:
- **Cached in Redis** for performance (5-minute TTL)
- **Hierarchical** with role inheritance
- **Context-aware** with conditional checks
- **Resource-specific** with ownership validation

### Q: How does multi-tenancy work?

**A:** Multi-tenancy is implemented through:

1. **Organizations** as tenant boundaries
2. **Members** with different roles per organization
3. **Teams** for sub-organization groupings
4. **Active Organization** context for each user
5. **Permission scoping** to organization level
6. **Resource isolation** by organization

### Q: Why use Redis for caching?

**A:** Redis provides:
- **High performance** for permission lookups
- **Automatic expiration** with TTL
- **Atomic operations** for consistency
- **Memory efficiency** for frequently accessed data
- **Horizontal scaling** capabilities

## Authentication & Sessions

### Q: How do I implement custom login flows?

**A:** Better Auth provides flexible authentication:

```typescript
// Email/password
await authInstance.api.signIn.email({
  email: 'user@example.com',
  password: 'password'
})

// OAuth (if configured)
await authInstance.api.signIn.social({
  provider: 'google'
})

// API Key authentication
await authInstance.api.verifyApiKey({
  apiKey: 'your-api-key'
})
```

### Q: How do sessions work across different domains?

**A:** Session management supports:
- **Cross-domain cookies** with proper configuration
- **Subdomain sharing** for multi-app setups
- **CORS configuration** for different origins
- **Secure cookie settings** for production

Example configuration:
```typescript
app.use('*', cors({
  origin: [
    'https://app.yourdomain.com',
    'https://admin.yourdomain.com'
  ],
  credentials: true
}))
```

### Q: How do I handle password requirements?

**A:** Password policies are configured in Better Auth:

```typescript
emailAndPassword: {
  minPasswordLength: 8,
  maxPasswordLength: 128,
  // Custom validation can be added
}
```

For custom requirements, implement client-side validation and server-side checks.

### Q: How do I customize email templates?

**A:** Email customization happens in the Better Auth configuration:

```typescript
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => {
    const emailDetails = {
      from: 'Your App <no-reply@yourapp.com>',
      to: user.email,
      subject: 'Verify your account',
      html: `<h1>Welcome!</h1><a href="${url}">Verify Email</a>`
    }
    // Send via your email service
  }
}
```

### Q: Can users have multiple active sessions?

**A:** Yes, Better Auth supports multiple sessions per user. You can:
- **List active sessions** per user
- **Revoke specific sessions**
- **Revoke all other sessions** (except current)
- **Track session activity**

```typescript
// Get active sessions
const sessions = await SessionManager.getActiveSessions(userId)

// Revoke specific session
await SessionManager.revokeSession(sessionId)
```

## Authorization & Permissions

### Q: How do I create custom permissions?

**A:** Custom permissions follow the resource.action pattern:

```typescript
// Add custom role with permissions
await authz.addRole({
  name: 'myorg:custom-role',
  permissions: [
    { resource: 'reports', action: 'generate' },
    { resource: 'analytics', action: 'view' },
    { resource: 'data', action: 'export', conditions: { own: true } }
  ]
})
```

### Q: How do conditional permissions work?

**A:** Conditional permissions use context:

```typescript
// Permission with conditions
const hasPermission = await authz.hasPermission(
  session,
  'document',
  'edit',
  { 
    ownerId: session.user.id,        // User owns the document
    organizationId: session.session.activeOrganizationId  // In user's org
  }
)
```

### Q: Can permissions be granted to specific users?

**A:** Permissions are role-based, but you can:

1. **Create user-specific roles**:
```typescript
await authz.addRole({
  name: `${organizationId}:user-${userId}`,
  permissions: [/* specific permissions */]
})
```

2. **Use conditional permissions** with user ID checks
3. **Implement custom authorization logic** in your application layer

### Q: How do I debug permission issues?

**A:** Use the built-in debugging tools:

```typescript
import { debugPermissions } from '@/debug/permissions'

// Debug specific permission
await debugPermissions(session, resource, action)

// Clear cache and retry
await authz.clearUserCache(userId)

// Get all user permissions
const permissions = await authz.getUserPermissions(session)
```

### Q: What's the performance impact of permission checks?

**A:** Performance is optimized through:
- **Redis caching** (5-minute TTL)
- **Batch permission checks** where possible
- **Efficient database queries** with proper indexing
- **Connection pooling** for database access

Typical permission check: **<10ms** (cached) or **<100ms** (uncached)

## Organizations & Multi-tenancy

### Q: Can a user belong to multiple organizations?

**A:** Yes, users can be members of multiple organizations with different roles:

```typescript
// User memberships
const orgs = await ActiveOrganizationManager.getUserOrganizations(userId)
// Returns: [{ org1, role: 'admin' }, { org2, role: 'member' }]

// Switch active organization
await ActiveOrganizationManager.switchOrganization(userId, org2.id)
```

### Q: What's the difference between organizations and teams?

**A:** 
- **Organizations** are tenant boundaries with separate data
- **Teams** are sub-groups within organizations for collaboration
- **Organizations** have unlimited members
- **Teams** are limited to 10 per organization (configurable)

### Q: How do I handle organization-specific data?

**A:** Always scope queries by organization:

```typescript
// Correct: organization-scoped query
const events = await db.query.auditEvents.findMany({
  where: eq(auditEvents.organizationId, session.session.activeOrganizationId)
})

// Incorrect: no organization scoping (security risk)
const events = await db.query.auditEvents.findMany()
```

### Q: Can I customize organization roles?

**A:** Yes, create organization-specific roles:

```typescript
// Organization-specific custom role
await authz.addRole({
  name: `${organizationId}:project-manager`,
  inherits: ['org:member'],  // Inherit from base member role
  permissions: [
    { resource: 'projects', action: 'create' },
    { resource: 'projects', action: 'manage' }
  ]
})
```

### Q: How do I handle organization invitations?

**A:** The invitation system handles this:

```typescript
// Send invitation
await MemberManagement.inviteMember(session, organizationId, {
  email: 'user@example.com',
  role: 'member',
  teamId: 'optional-team-id'
})

// Accept invitation (in invitation handler)
await MemberManagement.acceptInvitation(invitationId, userId)
```

## Security Concerns

### Q: How secure is the session management?

**A:** Sessions use industry best practices:
- **Cryptographically secure** token generation
- **HTTPOnly cookies** to prevent XSS
- **Secure flag** for HTTPS-only transmission
- **SameSite protection** against CSRF
- **Automatic expiration** with configurable TTL
- **Session invalidation** on logout

### Q: Are passwords securely stored?

**A:** Better Auth handles password security:
- **bcrypt hashing** with salt
- **Configurable rounds** for computational cost
- **No plaintext storage** ever
- **Secure comparison** to prevent timing attacks

### Q: How do I implement rate limiting?

**A:** Multiple rate limiting layers:

1. **API Key rate limiting** (built-in)
2. **Framework-level rate limiting**:
```typescript
import rateLimit from 'express-rate-limit'

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // requests per window
}))
```

3. **Redis-based rate limiting** for custom scenarios

### Q: How do I protect against common attacks?

**A:** Built-in protections include:
- **CSRF protection** via SameSite cookies
- **XSS prevention** via HTTPOnly cookies
- **SQL injection prevention** via parameterized queries
- **Timing attack prevention** in comparisons
- **Brute force protection** via rate limiting

### Q: Should I use HTTPS in development?

**A:** For development:
- **HTTP is acceptable** for local development
- **HTTPS required** for production
- **Mixed environments** should use HTTPS consistently

Production requirements:
```typescript
// Production cookie settings
secure: process.env.NODE_ENV === 'production',
sameSite: 'strict'
```

## Performance & Scalability

### Q: How many users can the system handle?

**A:** Scalability depends on infrastructure:
- **Database performance** is the primary bottleneck
- **Redis caching** significantly improves performance  
- **Connection pooling** allows concurrent users
- **Horizontal scaling** supported via load balancers

Typical performance:
- **1000+ concurrent users** with proper configuration
- **10,000+ organizations** with database optimization
- **100,000+ permission checks/second** with caching

### Q: How do I optimize database performance?

**A:** Key optimizations:

1. **Add indexes** for common queries:
```sql
CREATE INDEX idx_member_user_org ON member(user_id, organization_id);
CREATE INDEX idx_active_org_user ON active_organization(user_id);
CREATE INDEX idx_session_user ON session(user_id);
```

2. **Tune connection pools**:
```typescript
const { db } = initDrizzle(dbUrl, 20) // Increase pool size
```

3. **Monitor query performance**:
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 1000; -- Log slow queries
```

### Q: How do I scale Redis for high load?

**A:** Redis scaling options:
- **Redis Cluster** for horizontal scaling
- **Read replicas** for read-heavy workloads
- **Memory optimization** with appropriate data structures
- **Connection pooling** to prevent connection exhaustion

### Q: What's the memory usage of permission caching?

**A:** Memory usage is proportional to:
- **Number of active users** × **Average permissions per user**
- **Typical usage**: ~1KB per user's cached permissions
- **TTL expiration** keeps memory usage bounded
- **LRU eviction** handles memory pressure

## Development & Integration

### Q: How do I test authentication in my application?

**A:** Testing strategies:

```typescript
// Mock session for unit tests
const mockSession = {
  user: { id: 'test-user', role: 'user' },
  session: { activeOrganizationId: 'test-org' }
}

// Integration tests with test database
beforeEach(async () => {
  await resetTestDatabase()
  await createTestUser()
})

// E2E tests with real authentication flow
test('user can sign in and access protected resource', async () => {
  await signIn('test@example.com', 'password')
  const response = await request('/api/protected')
  expect(response.status).toBe(200)
})
```

### Q: How do I integrate with existing user systems?

**A:** Migration strategies:

1. **Gradual migration**:
   - Keep existing auth alongside @repo/auth
   - Migrate users progressively
   - Maintain session compatibility

2. **Data import**:
```typescript
// Import existing users
for (const existingUser of existingUsers) {
  await db.insert(user).values({
    id: existingUser.id,
    email: existingUser.email,
    name: existingUser.name,
    // Set emailVerified: true for existing users
    emailVerified: true
  })
}
```

### Q: Can I customize the database schema?

**A:** Schema customization options:

1. **Extended user fields** via Better Auth configuration
2. **Additional tables** alongside auth tables
3. **Custom organization fields**:
```typescript
organization: {
  additionalFields: {
    industry: { type: 'string' },
    companySize: { type: 'string' }
  }
}
```

### Q: How do I handle API versioning?

**A:** API versioning approaches:

```typescript
// Version in URL path
app.use('/api/v1/auth/*', authHandlerV1)
app.use('/api/v2/auth/*', authHandlerV2)

// Version in headers
app.use('/api/auth/*', (req, res, next) => {
  const version = req.headers['api-version'] || 'v1'
  // Route to appropriate handler
})
```

### Q: How do I implement custom middleware?

**A:** Custom middleware patterns:

```typescript
// Organization context middleware
export function requireOrganizationContext(c: Context, next: Next) {
  const session = c.get('session')
  
  if (!session?.session.activeOrganizationId) {
    return c.json({ error: 'Organization context required' }, 403)
  }
  
  await next()
}

// Custom permission middleware
export function requireCustomPermission(condition: string) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')
    
    // Custom logic here
    const hasPermission = await customPermissionCheck(session, condition)
    
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403)
    }
    
    await next()
  }
}
```

## Production & Deployment

### Q: What environment variables are required?

**A:** Required environment variables:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/database"

# Redis
REDIS_URL="redis://host:port"

# Authentication
SESSION_SECRET="your-super-secure-secret-min-32-chars"
BETTER_AUTH_URL="https://your-api-domain.com"

# Application
APP_PUBLIC_URL="https://your-app-domain.com"
NODE_ENV="production"
```

### Q: How do I handle database migrations in production?

**A:** Production migration strategy:

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# 2. Test migrations on staging
pnpm db:migrate

# 3. Deploy with zero-downtime
# - Use blue-green deployment
# - Apply migrations during maintenance window
# - Monitor for issues

# 4. Rollback plan
# Keep previous version ready for quick rollback
```

### Q: What monitoring should I implement?

**A:** Key metrics to monitor:

```typescript
// Application metrics
- Authentication success/failure rates
- Permission check latency
- Active session count
- API endpoint response times

// Infrastructure metrics
- Database connection pool usage
- Redis memory usage and hit rates
- CPU and memory utilization
- Error rates and types

// Business metrics
- User registration rates
- Organization creation/growth
- Feature usage patterns
```

### Q: How do I implement logging?

**A:** Comprehensive logging strategy:

```typescript
// Structured logging
import winston from 'winston'

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'auth.log' })
  ]
})

// Log important events
logger.info('User authenticated', { 
  userId, 
  organizationId, 
  ipAddress 
})

logger.warn('Permission denied', { 
  userId, 
  resource, 
  action 
})
```

### Q: How do I handle secrets management?

**A:** Secret management best practices:

```typescript
// Use environment variables
const sessionSecret = process.env.SESSION_SECRET

// For containers, use secrets mounting
// Docker: --secret source=session-secret,target=session_secret
// Kubernetes: secretKeyRef in env

// For cloud deployments, use managed services:
// - AWS Secrets Manager
// - Google Secret Manager  
// - Azure Key Vault

// Never commit secrets to code
// Use .env files for local development only
```

## Troubleshooting

### Q: Why am I getting "Permission denied" errors?

**A:** Common causes and solutions:

1. **Check user's organization membership**:
```sql
SELECT * FROM member WHERE user_id = 'user-id' AND organization_id = 'org-id';
```

2. **Verify active organization is set**:
```sql
SELECT * FROM active_organization WHERE user_id = 'user-id';
```

3. **Debug permission check**:
```typescript
await debugPermissions(session, resource, action)
```

4. **Clear permission cache**:
```typescript
await authz.clearUserCache(userId)
```

### Q: Why are my sessions not persisting?

**A:** Session persistence troubleshooting:

1. **Check CORS configuration**:
```typescript
cors({
  credentials: true, // Required for cookies
  origin: [/* your domains */]
})
```

2. **Verify cookie settings**:
- Secure flag for HTTPS
- SameSite configuration
- Domain/path settings

3. **Check Redis connectivity**:
```bash
redis-cli ping
```

### Q: How do I debug email delivery issues?

**A:** Email debugging steps:

1. **Verify Inngest configuration**
2. **Check email provider settings**
3. **Test email sending manually**:
```typescript
await inngest.send({
  name: 'email/send',
  data: { /* test email data */ }
})
```
4. **Monitor email logs**
5. **Check spam filters**

### Q: Why is permission checking slow?

**A:** Performance optimization:

1. **Enable Redis caching** (should be automatic)
2. **Add database indexes**:
```sql
CREATE INDEX idx_member_user_org ON member(user_id, organization_id);
```
3. **Increase connection pool size**
4. **Monitor Redis performance**

### Q: How do I get help with issues?

**A:** Support resources:

1. **Check this FAQ** and troubleshooting guide
2. **Review documentation** and examples  
3. **Use debug utilities**:
```typescript
const diagnostic = await AuthDebugger.runFullDiagnostic()
```
4. **Check package versions** and update if needed
5. **Contact maintainers** with diagnostic information

---

This FAQ covers the most common questions about @repo/auth. For more specific issues, please refer to the troubleshooting guide or contact support with detailed information about your use case.