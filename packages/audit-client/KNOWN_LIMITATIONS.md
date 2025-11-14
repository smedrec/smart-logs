# Known Limitations

This document outlines known limitations, edge cases, and constraints of the `@smedrec/audit-client` package.

## Network and Connectivity

### 1. Network Failure Handling

**Limitation**: The client relies on the browser's/Node.js's `fetch` API for network requests. Some network failures may not be distinguishable from each other.

**Impact**:

- DNS resolution failures, connection resets, and timeouts may all appear as generic network errors
- The client cannot differentiate between temporary network issues and permanent connectivity problems

**Workaround**:

- Configure appropriate retry strategies with exponential backoff
- Implement custom error handlers to add application-specific logic
- Monitor network connectivity separately in your application

### 2. SSL/TLS Certificate Validation

**Limitation**: The client cannot bypass SSL/TLS certificate validation errors in browsers.

**Impact**:

- Self-signed certificates will cause requests to fail in browser environments
- Expired certificates cannot be ignored

**Workaround**:

- Use valid SSL certificates in production
- For development, configure your browser to trust self-signed certificates
- In Node.js environments, you can configure `NODE_TLS_REJECT_UNAUTHORIZED` (not recommended for production)

### 3. Request Timeout Precision

**Limitation**: Timeout precision depends on JavaScript's timer resolution and may not be exact.

**Impact**:

- Timeouts may trigger slightly before or after the configured duration
- Under heavy load, timeouts may be delayed

**Workaround**:

- Add buffer time to timeout configurations
- Don't rely on exact timeout timing for critical operations

## Data Handling

### 4. Large Payload Size

**Limitation**: Very large payloads (>10MB) may cause performance issues or memory problems.

**Impact**:

- Large requests may timeout
- Memory usage may spike during serialization/deserialization
- Browser tabs may become unresponsive

**Workaround**:

- Paginate large data sets
- Use streaming for large file uploads
- Consider server-side processing for bulk operations
- Implement request size limits in your application

### 5. Circular References

**Limitation**: Objects with circular references cannot be serialized to JSON.

**Impact**:

- Attempting to send objects with circular references will throw an error
- The error may not be caught until serialization time

**Workaround**:

- Avoid circular references in request data
- Use a custom serializer that handles circular references
- Validate data structure before sending

### 6. Deep Object Nesting

**Limitation**: Extremely deep object nesting (>100 levels) may cause stack overflow errors.

**Impact**:

- JSON serialization/deserialization may fail
- Performance degradation with deeply nested structures

**Workaround**:

- Flatten data structures where possible
- Limit nesting depth in your data models
- Consider alternative data representations

### 7. Special Characters and Encoding

**Limitation**: Some special characters may require special handling depending on the server implementation.

**Impact**:

- Unicode characters may not be preserved correctly
- Control characters may cause parsing issues
- Null bytes may truncate strings

**Workaround**:

- Use UTF-8 encoding consistently
- Sanitize input data before sending
- Test with your specific character sets

## Browser Compatibility

### 8. localStorage Availability

**Limitation**: localStorage may be unavailable in private browsing mode or when disabled by user settings.

**Impact**:

- Cache persistence will fail
- Circuit breaker state cannot be persisted
- Falls back to memory storage (data lost on page refresh)

**Workaround**:

- The client automatically falls back to memory storage
- Implement server-side caching for critical data
- Detect localStorage availability and inform users

### 9. localStorage Quota

**Limitation**: localStorage has a size limit (typically 5-10MB per origin).

**Impact**:

- Cache may fail to store large responses
- QuotaExceededError may be thrown
- Older cache entries may need to be evicted

**Workaround**:

- Configure appropriate cache size limits
- Implement LRU eviction strategy (already included)
- Monitor cache usage and clear when necessary
- Use IndexedDB for larger storage needs

### 10. Cookie Restrictions

**Limitation**: Cookies may be disabled or restricted by browser settings or privacy extensions.

**Impact**:

- Cookie-based authentication will fail
- Session management may not work
- Cross-site requests may be blocked

**Workaround**:

- Provide alternative authentication methods (API keys, tokens)
- Detect cookie availability and show appropriate messages
- Use SameSite=None with Secure flag for cross-site cookies

### 11. CORS Restrictions

**Limitation**: Cross-origin requests are subject to CORS policies.

**Impact**:

- Requests to different domains may be blocked
- Custom headers may trigger preflight requests
- Credentials may not be sent cross-origin

**Workaround**:

- Configure CORS headers on the server
- Use a proxy for development
- Ensure proper CORS configuration in production

## Concurrency and Performance

### 12. Concurrent Request Limits

**Limitation**: Browsers limit concurrent connections per domain (typically 6-8).

**Impact**:

- Excessive concurrent requests may queue
- Performance may degrade with many parallel requests
- Timeouts may occur for queued requests

**Workaround**:

- Configure `maxConcurrentRequests` appropriately
- Implement request queuing in your application
- Use request batching where possible

### 13. Race Conditions in Cache

**Limitation**: Concurrent cache access may lead to race conditions.

**Impact**:

- Multiple requests may bypass cache simultaneously
- Cache may be populated multiple times with same data
- Stale data may be served briefly

**Workaround**:

- The client implements request deduplication
- Configure appropriate cache TTL
- Use cache tags for fine-grained invalidation

### 14. Authentication Token Refresh

**Limitation**: Concurrent requests during token refresh may fail.

**Impact**:

- Some requests may receive 401 errors during refresh
- Token refresh may be triggered multiple times

**Workaround**:

- The client implements token refresh deduplication
- Configure appropriate token expiry buffer
- Implement retry logic for 401 errors

## Response Handling

### 15. Malformed JSON Responses

**Limitation**: The client expects valid JSON responses for most endpoints.

**Impact**:

- Invalid JSON will cause parsing errors
- Truncated responses will fail
- Non-JSON responses may not be handled correctly

**Workaround**:

- Ensure server returns valid JSON
- Implement custom response parsers for non-JSON endpoints
- Add error handling for parsing failures

### 16. Missing Content-Type Headers

**Limitation**: The client relies on Content-Type headers to determine response format.

**Impact**:

- Responses without Content-Type may be parsed incorrectly
- Binary data may be treated as text
- Text may be treated as JSON

**Workaround**:

- Ensure server sends correct Content-Type headers
- Implement custom response type detection
- Configure default response types per endpoint

### 17. Streaming Response Support

**Limitation**: Streaming responses have limited support in browsers.

**Impact**:

- Large streaming responses may buffer in memory
- Progress tracking may not be available
- Cancellation may not work correctly

**Workaround**:

- Use chunked responses where supported
- Implement pagination for large data sets
- Monitor memory usage during streaming

## Error Handling

### 18. Error Recovery Limitations

**Limitation**: Not all errors can be automatically recovered.

**Impact**:

- Some errors require manual intervention
- Recovery strategies may not work in all scenarios
- Cascading failures may occur

**Workaround**:

- Implement circuit breakers (already included)
- Add custom recovery strategies for your use cases
- Monitor error rates and alert on anomalies

### 19. Error Context Preservation

**Limitation**: Error context may be lost across async boundaries.

**Impact**:

- Stack traces may not show original call site
- Correlation IDs may not propagate correctly
- Debugging may be more difficult

**Workaround**:

- Use correlation IDs consistently
- Implement structured logging
- Add custom error context in your application

## Testing and Development

### 20. Mock Limitations

**Limitation**: Some browser APIs cannot be fully mocked in tests.

**Impact**:

- Tests may not catch all browser-specific issues
- Integration tests may require real browser environment
- Some edge cases may only appear in production

**Workaround**:

- Use real browser testing (Playwright, Cypress)
- Test in multiple browsers
- Implement feature detection in your code

### 21. Memory Leak Detection

**Limitation**: Memory leak detection in tests may produce false positives.

**Impact**:

- Tests may fail intermittently
- Small leaks may not be detected
- Garbage collection timing affects results

**Workaround**:

- Run leak detection tests multiple times
- Use realistic test scenarios
- Monitor memory usage in production

## Configuration

### 22. Configuration Validation

**Limitation**: Some configuration errors may not be caught until runtime.

**Impact**:

- Invalid URLs may cause requests to fail
- Incorrect authentication may not be detected early
- Performance issues may arise from misconfiguration

**Workaround**:

- Use TypeScript for type checking
- Validate configuration at initialization
- Implement configuration tests

### 23. Dynamic Configuration Updates

**Limitation**: Some configuration changes require client restart.

**Impact**:

- Authentication changes may not take effect immediately
- Cache configuration changes may not apply to existing cache
- Retry configuration may not affect in-flight requests

**Workaround**:

- Plan configuration changes carefully
- Implement graceful client restart
- Document which settings can be changed dynamically

## Security

### 24. Client-Side Security

**Limitation**: Client-side code is visible and can be manipulated.

**Impact**:

- API keys in client code are not secure
- Authentication tokens can be extracted
- Request/response data can be intercepted

**Workaround**:

- Use server-side authentication where possible
- Implement token rotation
- Use short-lived tokens
- Never store sensitive data client-side

### 25. XSS and Injection Attacks

**Limitation**: The client does not sanitize all input by default.

**Impact**:

- Malicious input may be sent to server
- XSS attacks may occur if data is rendered without sanitization
- SQL injection may occur if server doesn't validate

**Workaround**:

- Sanitize input in your application
- Validate data on the server
- Use parameterized queries on the server
- Implement Content Security Policy

## Performance

### 26. Bundle Size

**Limitation**: The full client bundle is ~140KB gzipped.

**Impact**:

- Initial page load may be slower
- Mobile users may experience delays
- Bandwidth costs may increase

**Workaround**:

- Use lazy loading for plugins
- Implement code splitting
- Use tree shaking to remove unused code
- Consider using a CDN

### 27. Memory Usage

**Limitation**: Cache and subscriptions consume memory.

**Impact**:

- Long-running applications may accumulate memory
- Multiple client instances multiply memory usage
- Memory leaks may occur if not properly cleaned up

**Workaround**:

- Configure appropriate cache limits
- Clean up subscriptions when done
- Call `client.destroy()` when client is no longer needed
- Monitor memory usage in production

## Reporting Issues

If you encounter limitations not listed here, please:

1. Check the [GitHub Issues](https://github.com/smedrec/smart-logs/issues)
2. Review the [documentation](./README.md)
3. Open a new issue with:
   - Clear description of the limitation
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (browser, Node.js version, etc.)
   - Workarounds you've tried

## Future Improvements

We're actively working on addressing these limitations. Planned improvements include:

- Better streaming support
- Enhanced error recovery
- Improved browser compatibility detection
- More granular configuration options
- Better memory management
- Enhanced security features

See our [roadmap](./ROADMAP.md) for more details.
