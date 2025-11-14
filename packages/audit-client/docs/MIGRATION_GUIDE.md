# Migration Guide: v0.x to v1.0

This guide helps you migrate from version 0.x to version 1.0 of `@smedrec/audit-client`. Version 1.0 includes significant improvements in performance, reliability, and developer experience while maintaining backward compatibility for most use cases.

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [New Features](#new-features)
- [Deprecated Features](#deprecated-features)
- [Configuration Changes](#configuration-changes)
- [API Changes](#api-changes)
- [Migration Steps](#migration-steps)
- [Troubleshooting](#troubleshooting)

## Overview

Version 1.0 brings:

- **30-40% smaller bundle size** through lazy loading
- **Improved memory management** with automatic cleanup
- **Enhanced error handling** with actionable messages
- **Performance monitoring** built-in
- **Circuit breaker** for better resilience
- **Comprehensive TypeScript types** for better DX

**Good News**: Most applications can upgrade without code changes! The API remains backward compatible.

## Breaking Changes

### None for Public API

Version 1.0 maintains full backward compatibility for all public APIs. All breaking changes are internal refactoring that don't affect your code.

### Internal Changes (Non-Breaking)

These changes only affect you if you're extending internal classes:

1. **BaseResource Refactoring**: Internal HTTP logic moved to `HttpClient`
2. **Plugin Loading**: Changed from eager to lazy loading
3. **Cache Eviction**: Now uses LRU (Least Recently Used) strategy

If you're only using the public API (recommended), no changes are needed.

## New Features

### 1. Performance Monitoring

Track request performance and enforce budgets:

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	performance: {
		enabled: true,
		budget: {
			maxRequestTime: 1000, // 1 second
			maxMemoryUsage: 50 * 1024 * 1024, // 50MB
		},
	},
})

// Get metrics
const metrics = client.getPerformanceMetrics()
console.log('P95 request time:', metrics.p95RequestTime, 'ms')
console.log('Cache hit rate:', metrics.cacheHitRate, '%')

// Check budget violations
const violations = client.checkPerformanceBudget()
if (violations.length > 0) {
	console.warn('Budget violations:', violations)
}
```

### 2. Circuit Breaker

Prevent cascading failures with automatic circuit breaking:

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	retry: {
		enabled: true,
		circuitBreaker: {
			enabled: true,
			failureThreshold: 5, // Open after 5 failures
			resetTimeout: 60000, // Try again after 1 minute
		},
	},
})
```

### 3. Enhanced Cache Management

Better cache control with LRU eviction:

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	cache: {
		enabled: true,
		maxSize: 100, // Maximum 100 cached entries
		defaultTtlMs: 300000, // 5 minutes
	},
})

// Cache is automatically managed with LRU eviction
// No manual cleanup needed!
```

### 4. Lazy Loading Plugins

Plugins are now loaded on-demand, reducing initial bundle size:

```typescript
// Before v1.0: All plugins loaded upfront (~200KB)
// After v1.0: Plugins loaded on-demand (~140KB initial, rest loaded as needed)

const client = new AuditClient({
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	plugins: {
		lazyLoad: true, // Default: true
	},
})
```

### 5. Enhanced Error Messages

Errors now include actionable advice:

```typescript
try {
	await client.events.create({
		/* ... */
	})
} catch (error) {
	if (error instanceof HttpError) {
		console.error('Error:', error.getUserMessage())
		console.log('Advice:', error.getActionableAdvice())

		// For 429 errors, get retry timing
		if (error.status === 429) {
			console.log('Retry after:', error.getRetryAfter())
		}
	}
}
```

### 6. Input Sanitization

Automatic protection against injection attacks:

```typescript
// Input is automatically sanitized before sending
await client.events.create({
	action: 'user.login',
	details: {
		// Malicious content is automatically removed
		comment: '<script>alert("xss")</script>Safe content',
	},
})
// Result: { comment: 'Safe content' }
```

## Deprecated Features

No features are deprecated in v1.0. All existing APIs continue to work as before.

## Configuration Changes

### Optional New Configuration

You can optionally add these new configuration options:

```typescript
// v0.x configuration (still works in v1.0)
const oldConfig = {
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },
	retry: { enabled: true, maxAttempts: 3 },
	cache: { enabled: true, defaultTtlMs: 60000 },
	logging: { enabled: true, level: 'info' },
}

// v1.0 configuration (with new options)
const newConfig = {
	...oldConfig,
	// New: Performance monitoring
	performance: {
		enabled: true,
		budget: {
			maxRequestTime: 1000,
			maxMemoryUsage: 50 * 1024 * 1024,
		},
	},
	// Enhanced: Circuit breaker
	retry: {
		...oldConfig.retry,
		circuitBreaker: {
			enabled: true,
			failureThreshold: 5,
			resetTimeout: 60000,
		},
	},
	// Enhanced: Cache size limit
	cache: {
		...oldConfig.cache,
		maxSize: 100, // New: Prevent unbounded growth
	},
}
```

## API Changes

### No Breaking API Changes

All public APIs remain unchanged. Your existing code will work without modifications.

### New Methods

```typescript
// Performance monitoring
client.getPerformanceMetrics(): PerformanceMetrics
client.checkPerformanceBudget(): BudgetViolation[]
client.getPerformanceReport(): PerformanceReport

// Enhanced error handling
error.getUserMessage(): string
error.getActionableAdvice(): string
error.getRetryAfter(): string // For 429 errors
```

## Migration Steps

### Step 1: Update Package

```bash
# With pnpm
pnpm update @smedrec/audit-client

# With npm
npm update @smedrec/audit-client

# With yarn
yarn upgrade @smedrec/audit-client
```

### Step 2: Test Your Application

Run your existing tests. They should all pass without changes:

```bash
npm test
```

### Step 3: (Optional) Enable New Features

Add new configuration options to take advantage of v1.0 features:

```typescript
const client = new AuditClient({
	// Your existing config
	baseUrl: 'https://api.smartlogs.com',
	authentication: { type: 'apiKey', apiKey: 'YOUR_API_KEY' },

	// Add new features
	performance: { enabled: true },
	retry: {
		enabled: true,
		circuitBreaker: { enabled: true },
	},
	cache: {
		enabled: true,
		maxSize: 100,
	},
})
```

### Step 4: (Optional) Add Performance Monitoring

Monitor your application's performance:

```typescript
// Log metrics periodically
setInterval(() => {
	const metrics = client.getPerformanceMetrics()
	console.log('Performance:', {
		avgRequestTime: metrics.avgRequestTime,
		p95RequestTime: metrics.p95RequestTime,
		cacheHitRate: metrics.cacheHitRate,
		errorRate: metrics.errorRate,
	})
}, 60000) // Every minute
```

### Step 5: (Optional) Improve Error Handling

Use enhanced error messages:

```typescript
try {
	await client.events.create({
		/* ... */
	})
} catch (error) {
	if (error instanceof HttpError) {
		// v1.0: User-friendly messages
		console.error(error.getUserMessage())
		console.log('Suggestion:', error.getActionableAdvice())
	} else {
		// Fallback for other errors
		console.error(error.message)
	}
}
```

## Troubleshooting

### Bundle Size Increased

**Issue**: Bundle size is larger than expected.

**Solution**: Ensure lazy loading is enabled (it's on by default):

```typescript
const client = new AuditClient({
	// ...
	plugins: {
		lazyLoad: true, // Should be true (default)
	},
})
```

### TypeScript Errors

**Issue**: TypeScript compilation errors after upgrade.

**Solution**: Update your TypeScript version to 4.9 or higher:

```bash
npm install -D typescript@latest
```

### Performance Warnings

**Issue**: Seeing performance budget violations.

**Solution**: Adjust budgets to match your requirements:

```typescript
const client = new AuditClient({
	// ...
	performance: {
		enabled: true,
		budget: {
			maxRequestTime: 2000, // Increase if needed
			maxMemoryUsage: 100 * 1024 * 1024, // Increase if needed
		},
	},
})
```

### Circuit Breaker Opening Unexpectedly

**Issue**: Circuit breaker opens too frequently.

**Solution**: Adjust thresholds:

```typescript
const client = new AuditClient({
	// ...
	retry: {
		enabled: true,
		circuitBreaker: {
			enabled: true,
			failureThreshold: 10, // Increase threshold
			resetTimeout: 30000, // Decrease timeout
		},
	},
})
```

### Memory Usage Concerns

**Issue**: Memory usage seems high.

**Solution**: Reduce cache size:

```typescript
const client = new AuditClient({
	// ...
	cache: {
		enabled: true,
		maxSize: 50, // Reduce from default 100
		defaultTtlMs: 60000, // Reduce TTL
	},
})
```

## Getting Help

If you encounter issues during migration:

1. **Check the FAQ**: See [TROUBLESHOOTING_AND_FAQ.md](./TROUBLESHOOTING_AND_FAQ.md)
2. **Review Examples**: See [CODE_EXAMPLES.md](./CODE_EXAMPLES.md)
3. **Open an Issue**: [GitHub Issues](https://github.com/smedrec/smart-logs/issues)
4. **Contact Support**: support@smartlogs.com

## Summary

Version 1.0 is a drop-in replacement for v0.x with significant improvements:

- ✅ **No breaking changes** to public API
- ✅ **30-40% smaller** initial bundle size
- ✅ **Better performance** with monitoring
- ✅ **More reliable** with circuit breaker
- ✅ **Improved DX** with better error messages

Simply update the package and optionally enable new features. Your existing code will continue to work!
