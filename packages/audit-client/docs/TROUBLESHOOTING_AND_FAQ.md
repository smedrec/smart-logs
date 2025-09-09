# Troubleshooting and FAQ

This guide helps you solve common problems and answers frequently asked questions about the `@smart-logs/audit-client`.

---

## Troubleshooting

### Issue: "Invalid configuration provided"

This error occurs during client initialization if the configuration object is missing required fields or contains invalid values.

**Solution:**

1.  **Check Required Fields**: Ensure you have provided `baseUrl` and a valid `authentication` object.
2.  **Validate Data Types**: Make sure all values match the expected types (e.g., `timeout` should be a number, `baseUrl` should be a valid URL string).
3.  **Use Static Validation**: You can validate a configuration object without creating a full client instance:

    ```typescript
    import { AuditClient } from '@smart-logs/audit-client';

    const result = AuditClient.validateConfig(myConfig);

    if (!result.isValid) {
      console.error('Configuration errors:', result.errors.errors);
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
    });
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
});
```