# Troubleshooting and FAQ

This guide helps you solve common problems and answers frequently asked questions about the `@smedrec/audit-client`.

---

## Troubleshooting

### Issue: "Invalid configuration provided"

This error occurs during client initialization if the configuration object is missing required fields or contains invalid values.

**Solution:**

1.  **Check Required Fields**: Ensure you have provided `baseUrl` and a valid `authentication` object.
2.  **Validate Data Types**: Make sure all values match the expected types (e.g., `timeout` should be a number, `baseUrl` should be a valid URL string).
3.  **Use Static Validation**: You can validate a configuration object without creating a full client instance:

    ```typescript
    import { AuditClient } from '@smedrec/audit-client'

    const result = AuditClient.validateConfig(myConfig)

    if (!result.isValid) {
    	console.error('Configuration errors:', result.errors.errors)
    }
    ```

### Issue: Requests are failing with 401 Unauthorized

This indicates an authentication problem.

**Solution:**

1.  **Verify Your Credentials**: Double-check that your `apiKey`, `bearerToken`, or `sessionToken` is correct and has the necessary permissions.
2.  **Check Auth Type**: Ensure the `authentication.type` matches the credential you are providing.
3.  **Token Expiration**: If you are using bearer or session tokens, they may have expired. If your API supports it, enable the `autoRefresh` option in the `authentication` config.

### Issue: Requests are slow or timing out

This could be a network issue, a problem with the downstream API, or a client-side performance bottleneck.

**Solution:**

1.  **Increase Timeout**: Try increasing the `timeout` value in the client configuration.
2.  **Enable Caching**: For frequently repeated `GET` requests, enabling the `cache` can significantly improve performance.
    ```typescript
    const client = new AuditClient({
    	// ...
    	cache: { enabled: true, defaultTtlMs: 60000 },
    })
    ```
3.  **Check Network**: Ensure your server has a stable connection to the `baseUrl`.
4.  **Enable Debug Logging**: Set `logging: { level: 'debug' }` to get detailed timing information for each stage of the request lifecycle.

### Issue: "RetryExhaustedError: Request failed after X retries"

This error means the request failed even after all configured retry attempts.

**Solution:**

1.  **Check API Status**: The Smart Logs API might be temporarily unavailable. Check its status page if one is available.
2.  **Review Error Cause**: The `RetryExhaustedError` contains a `cause` property with the original error that triggered the retries. This can provide more insight into the underlying problem (e.g., `ECONNRESET`, `503 Service Unavailable`).
3.  **Adjust Retry Strategy**: You might need to adjust the `retry` configuration, such as increasing `maxAttempts` or changing the `backoffMultiplier`.

---

## Frequently Asked Questions (FAQ)

**Q: Is the client safe to use in a browser?**

A: Yes, but with caution. You should never expose sensitive credentials like a master `apiKey` in a frontend application. For browser-based scenarios, it's best to use short-lived `sessionToken` or `bearerToken` that are fetched from your backend.

**Q: How do I handle rate limiting?**

A: The client handles rate limiting automatically. By default, it will retry requests that fail with a `429 Too Many Requests` status code, using an exponential backoff strategy to respect the rate limits.

**Q: What is the difference between `client.destroy()` and just letting the object be garbage collected?**

A: `client.destroy()` is important for a graceful shutdown. It clears any pending timeouts for batching or retries, flushes any buffered logs, and cleans up persistent connections if applicable. In a long-running application, failing to call `destroy()` before exiting could lead to the process hanging or losing buffered data.

**Q: Can I use a single client instance for my entire application?**

A: Yes, this is the recommended approach. The client is designed to be a long-lived object. Creating a new client for every request is inefficient and will prevent features like caching, batching, and connection pooling from working correctly.

**Q: How can I see the raw HTTP request and response?**

A: Set the logging level to `debug`.

```typescript
const client = new AuditClient({
	// ...
	logging: {
		enabled: true,
		level: 'debug',
		includeRequestBody: true, // Optional: to see request bodies
		includeResponseBody: true, // Optional: to see response bodies
	},
})
```

### Issue: Performance budget violations

You're seeing warnings about performance budget violations.

**Solution:**

1. **Review Current Metrics**: Check what's causing the violations:

   ```typescript
   const metrics = client.getPerformanceMetrics()
   const violations = client.checkPerformanceBudget()

   violations.forEach((v) => {
   	console.log(`${v.metric}: ${v.actual} exceeds budget of ${v.budget}`)
   })
   ```

2. **Adjust Budgets**: If the violations are expected for your use case, adjust the budgets:

   ```typescript
   const client = new AuditClient({
   	// ...
   	performance: {
   		enabled: true,
   		budget: {
   			maxRequestTime: 2000, // Increase from 1000ms
   			maxMemoryUsage: 100 * 1024 * 1024, // Increase from 50MB
   		},
   	},
   })
   ```

3. **Optimize Performance**: If violations are unexpected, optimize:
   - Enable caching to reduce request times
   - Reduce cache size to lower memory usage
   - Enable lazy loading to reduce bundle size

### Issue: Circuit breaker is open

Requests are failing immediately with "Circuit breaker is open" errors.

**Solution:**

1. **Check Service Health**: The circuit breaker opens when too many requests fail. Check if the API is healthy.

2. **Review Circuit Breaker Stats**:

   ```typescript
   const retryManager = client.getRetryManager()
   const stats = retryManager.getCircuitBreakerStats()

   console.log('Circuit state:', stats.state)
   console.log('Failure count:', stats.failureCount)
   console.log('Next attempt:', new Date(stats.nextAttemptTime))
   ```

3. **Wait for Reset**: The circuit breaker will automatically try again after the `resetTimeout` period.

4. **Adjust Thresholds**: If the circuit breaker is too sensitive:
   ```typescript
   const client = new AuditClient({
   	// ...
   	retry: {
   		enabled: true,
   		circuitBreaker: {
   			enabled: true,
   			failureThreshold: 10, // Increase from 5
   			resetTimeout: 30000, // Decrease from 60000
   		},
   	},
   })
   ```

### Issue: Memory usage is high

The client is using more memory than expected.

**Solution:**

1. **Check Cache Size**: Large caches can consume significant memory:

   ```typescript
   const metrics = client.getPerformanceMetrics()
   console.log('Memory usage:', metrics.memoryUsage)
   console.log('Cache size:', metrics.cacheSize)
   ```

2. **Reduce Cache Size**:

   ```typescript
   const client = new AuditClient({
   	// ...
   	cache: {
   		enabled: true,
   		maxSize: 50, // Reduce from 100
   		defaultTtlMs: 60000, // Reduce TTL
   	},
   })
   ```

3. **Enable Streaming**: For large responses, enable streaming to avoid loading everything into memory:

   ```typescript
   const client = new AuditClient({
   	// ...
   	performance: {
   		enableStreaming: true,
   		streamingThreshold: 1024, // Stream responses > 1KB
   	},
   })
   ```

4. **Clean Up**: Ensure you're calling `client.destroy()` when done.

### Issue: Bundle size is too large

Your application bundle is larger than expected after adding the client.

**Solution:**

1. **Enable Lazy Loading**: Ensure lazy loading is enabled (it's on by default):

   ```typescript
   const client = new AuditClient({
   	// ...
   	plugins: {
   		lazyLoad: true, // Should be true
   	},
   })
   ```

2. **Check Bundle Analysis**: Use your bundler's analysis tools:

   ```bash
   # For webpack
   npm run build -- --analyze

   # For vite
   npm run build -- --mode analyze
   ```

3. **Tree Shaking**: Ensure your bundler supports tree shaking and is configured correctly.

4. **Import Only What You Need**: Use named imports instead of importing everything:

   ```typescript
   // Good
   import { AuditClient } from '@smedrec/audit-client'
   // Avoid
   import * as AuditClient from '@smedrec/audit-client'
   ```

---

## Additional FAQ

**Q: How do I monitor performance in production?**

A: Use the built-in performance monitoring:

```typescript
// Set up periodic monitoring
setInterval(() => {
	const metrics = client.getPerformanceMetrics()
	const report = client.getPerformanceReport()

	// Log to your monitoring service
	console.log('Performance metrics:', {
		avgRequestTime: metrics.avgRequestTime,
		p95RequestTime: metrics.p95RequestTime,
		cacheHitRate: metrics.cacheHitRate,
		errorRate: metrics.errorRate,
		memoryUsage: metrics.memoryUsage,
	})

	// Alert on violations
	if (!report.passed) {
		console.warn('Performance budget violations:', report.violations)
	}
}, 60000) // Every minute
```

**Q: What's the difference between lazy loading and code splitting?**

A: Lazy loading is a form of code splitting. The client uses dynamic imports to split plugins into separate chunks that are loaded on-demand. This reduces the initial bundle size from ~200KB to ~140KB, with the remaining ~60KB loaded only when needed.

**Q: Can I disable performance monitoring?**

A: Yes, set `performance.enabled` to `false`:

```typescript
const client = new AuditClient({
	// ...
	performance: {
		enabled: false, // Disable performance monitoring
	},
})
```

**Q: How do I migrate from v0.x to v1.0?**

A: See the [Migration Guide](./MIGRATION_GUIDE.md) for detailed instructions. In most cases, you can simply update the package without any code changes.

**Q: What happens when the circuit breaker opens?**

A: When the circuit breaker opens:

1. All requests fail immediately with a `CircuitBreakerError`
2. No actual HTTP requests are made
3. After the `resetTimeout` period, the circuit enters "half-open" state
4. A few test requests are allowed through
5. If they succeed, the circuit closes; if they fail, it opens again

**Q: How can I test my application with the circuit breaker?**

A: You can manually control the circuit breaker for testing:

```typescript
const retryManager = client.getRetryManager()

// Force circuit open for testing
retryManager.openCircuit()

// Reset circuit
retryManager.resetCircuit()

// Check state
const stats = retryManager.getCircuitBreakerStats()
console.log('Circuit state:', stats.state)
```

**Q: Are there any breaking changes in v1.0?**

A: No! Version 1.0 maintains full backward compatibility with v0.x. All breaking changes are internal refactoring that don't affect the public API. See the [Migration Guide](./MIGRATION_GUIDE.md) for details.

**Q: How do I report a bug or request a feature?**

A: Please open an issue on our [GitHub repository](https://github.com/smedrec/smart-logs/issues) with:

- A clear description of the issue or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (Node.js version, browser, etc.)
- Relevant code snippets or logs

---

## Getting More Help

If you can't find the answer to your question here:

1. **Check the Documentation**: Review the [API Reference](./API_REFERENCE.md) and [Getting Started Guide](./GETTING_STARTED.md)
2. **Review Examples**: See [CODE_EXAMPLES.md](./CODE_EXAMPLES.md) for practical examples
3. **Check GitHub Issues**: Search [existing issues](https://github.com/smedrec/smart-logs/issues) for similar problems
4. **Open an Issue**: Create a new issue with details about your problem
5. **Contact Support**: Email support@smartlogs.com for direct assistance
