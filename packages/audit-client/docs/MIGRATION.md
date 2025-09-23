# Migration Guide

This guide helps you migrate between different versions of @smedrec/audit-client.

## Migrating to v1.0.0

### From Pre-1.0 Development Versions

If you were using a development version (0.x.x), this guide will help you upgrade to the stable v1.0.0 release.

#### Breaking Changes

##### 1. Package Structure Changes

**Before (0.x.x):**

```typescript
// Old import structure
import { AuditClient } from '@smedrec/audit-client'
import { AuditEvent } from '@smedrec/audit-client/types'
```

**After (1.0.0):**

```typescript
// New import structure
import { AuditClient, AuditEvent } from '@smedrec/audit-client'
// or
import type { AuditEvent } from '@smedrec/audit-client'
```

##### 2. Configuration Changes

**Before (0.x.x):**

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	apiKey: 'your-api-key',
})
```

**After (1.0.0):**

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})
```

##### 3. Method Signature Changes

**Before (0.x.x):**

```typescript
// Old method signatures
await client.createEvent(eventData)
await client.getEvents({ limit: 10 })
```

**After (1.0.0):**

```typescript
// New method signatures with enhanced services
await client.events.create(eventData)
await client.events.query({ pagination: { limit: 10 } })
```

#### New Features in v1.0.0

##### 1. Service-Based Architecture

```typescript
const client = new AuditClient(config)

// Events service
await client.events.create(event)
await client.events.query(params)
await client.events.verify(id)

// Compliance service
await client.compliance.generateHipaaReport(criteria)
await client.compliance.generateGdprReport(criteria)

// Scheduled reports service
await client.scheduledReports.create(report)
await client.scheduledReports.list()

// Presets service
await client.presets.create(preset)
await client.presets.apply(name, context)

// Metrics service
await client.metrics.getSystemMetrics()
await client.metrics.getAuditMetrics(params)

// Health service
await client.health.check()
await client.health.detailed()
```

##### 2. Enhanced Configuration

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',

	// Authentication options
	authentication: {
		type: 'apiKey', // 'apiKey' | 'session' | 'bearer' | 'custom'
		apiKey: 'your-api-key',
		autoRefresh: true,
	},

	// Retry configuration
	retry: {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 1000,
		maxDelayMs: 10000,
		backoffMultiplier: 2,
	},

	// Caching configuration
	cache: {
		enabled: true,
		defaultTtlMs: 300000, // 5 minutes
		storage: 'memory', // 'memory' | 'localStorage' | 'sessionStorage'
	},

	// Logging configuration
	logging: {
		enabled: true,
		level: 'info',
		maskSensitiveData: true,
	},
})
```

##### 3. Enhanced Error Handling

```typescript
try {
	await client.events.create(event)
} catch (error) {
	if (error instanceof HttpError) {
		console.log('HTTP Error:', error.status, error.message)
		console.log('Request ID:', error.requestId)
	} else if (error instanceof ValidationError) {
		console.log('Validation Error:', error.fieldErrors)
	} else if (error instanceof RetryExhaustedError) {
		console.log('Retry Exhausted:', error.attempts)
	}
}
```

#### Migration Steps

##### Step 1: Update Package Version

```bash
# Update to v1.0.0
npm install @smedrec/audit-client@^1.0.0
# or
pnpm add @smedrec/audit-client@^1.0.0
```

##### Step 2: Update Imports

```typescript
// Before
import { AuditClient } from '@smedrec/audit-client'
import { AuditEvent } from '@smedrec/audit-client/types'

// After
import { AuditClient, AuditEvent } from '@smedrec/audit-client'
```

##### Step 3: Update Configuration

```typescript
// Before
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	apiKey: 'your-api-key',
	timeout: 5000,
})

// After
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	timeout: 5000,
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})
```

##### Step 4: Update Method Calls

```typescript
// Before
await client.createEvent(eventData)
await client.getEvents({ limit: 10 })
await client.getEvent(id)

// After
await client.events.create(eventData)
await client.events.query({ pagination: { limit: 10 } })
await client.events.getById(id)
```

##### Step 5: Update Error Handling

```typescript
// Before
try {
	await client.createEvent(event)
} catch (error) {
	console.log('Error:', error.message)
}

// After
try {
	await client.events.create(event)
} catch (error) {
	if (error instanceof HttpError) {
		console.log('HTTP Error:', error.status, error.message)
	} else {
		console.log('Error:', error.message)
	}
}
```

#### Compatibility Notes

##### TypeScript Support

- Minimum TypeScript version: 4.9.0
- Full type safety with strict mode
- Enhanced IntelliSense support

##### Node.js Support

- Minimum Node.js version: 18.0.0
- ESM and CommonJS support
- Native ES2020 features

##### Browser Support

- Modern browsers with ES2020 support
- No Internet Explorer support
- Web Workers compatible

##### React Native Support

- Metro bundler compatible
- No Node.js specific dependencies
- AsyncStorage integration available

#### Testing Your Migration

##### 1. Basic Functionality Test

```typescript
import { AuditClient } from '@smedrec/audit-client'

const client = new AuditClient({
	baseUrl: 'https://your-api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})

// Test basic functionality
async function testMigration() {
	try {
		// Test health check
		const health = await client.health.check()
		console.log('Health check:', health)

		// Test event creation
		const event = await client.events.create({
			action: 'test_migration',
			targetResourceType: 'migration',
			principalId: 'test-user',
			organizationId: 'test-org',
			status: 'success',
		})
		console.log('Event created:', event.id)

		console.log('✅ Migration successful!')
	} catch (error) {
		console.error('❌ Migration failed:', error)
	}
}

testMigration()
```

##### 2. Performance Test

```typescript
// Test with enhanced features
const client = new AuditClient({
	baseUrl: 'https://your-api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
	cache: {
		enabled: true,
		defaultTtlMs: 60000,
	},
	retry: {
		enabled: true,
		maxAttempts: 3,
	},
})

async function performanceTest() {
	const start = Date.now()

	// This should use caching on subsequent calls
	await client.events.query({ pagination: { limit: 10 } })
	await client.events.query({ pagination: { limit: 10 } }) // Cached

	const duration = Date.now() - start
	console.log(`Performance test completed in ${duration}ms`)
}
```

## Future Migrations

### Preparing for Future Updates

To make future migrations easier:

1. **Use TypeScript**: Leverage type checking to catch breaking changes
2. **Follow Semantic Versioning**: Understand the impact of different version changes
3. **Read Changelogs**: Always review CHANGELOG.md before upgrading
4. **Test Thoroughly**: Use comprehensive tests to validate functionality
5. **Pin Versions**: Use exact versions in production for stability

### Version Support Policy

- **Major versions**: Supported for 12 months after release
- **Minor versions**: Supported until next major version
- **Patch versions**: Supported until next minor/major version
- **Security updates**: Provided for all supported versions

### Getting Help

If you encounter issues during migration:

1. **Check the Documentation**: Review the updated API documentation
2. **Search Issues**: Look for similar migration issues on GitHub
3. **Create an Issue**: Report migration problems with detailed information
4. **Community Support**: Ask questions in discussions or community channels

### Migration Checklist

- [ ] Updated package version
- [ ] Updated imports
- [ ] Updated configuration
- [ ] Updated method calls
- [ ] Updated error handling
- [ ] Updated TypeScript types
- [ ] Tested basic functionality
- [ ] Tested enhanced features
- [ ] Updated documentation
- [ ] Deployed to staging
- [ ] Validated in production
