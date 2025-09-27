# Cookie Authentication Implementation

This document summarizes the cookie authentication feature added to the Audit Client to support Better Auth and other cookie-based authentication systems.

## Overview

The audit client now supports cookie-based authentication, which is essential for integrating with Better Auth and other modern authentication systems that rely on HTTP cookies for session management.

## Features Added

### 1. Cookie Authentication Type

Added a new `cookie` authentication type to the `AuthenticationConfig`:

```typescript
type AuthenticationType = 'apiKey' | 'session' | 'bearer' | 'custom' | 'cookie'

interface AuthenticationConfig {
	type: AuthenticationType
	// ... existing fields
	cookies?: Record<string, string>
	includeBrowserCookies?: boolean
}
```

### 2. Configuration Options

- **`cookies`**: Explicit cookies to send with requests
- **`includeBrowserCookies`**: Automatically include all browser cookies (default: false)

### 3. Implementation Details

#### AuthManager Updates

- Added `getCookieHeaders()` method to handle cookie authentication
- Added `getBrowserCookies()` method to extract browser cookies
- Updated validation logic to support cookie authentication
- Enhanced error handling for missing cookies

#### Base Resource Integration

The existing `credentials: 'include'` setting in the base resource ensures that browser cookies are automatically sent with requests, making the integration seamless.

## Usage Examples

### Basic Browser Cookie Authentication

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'cookie',
		includeBrowserCookies: true,
	},
})
```

### Explicit Cookie Authentication

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'cookie',
		cookies: {
			'better-auth.session_token': 'session-value',
			'better-auth.csrf_token': 'csrf-value',
		},
	},
})
```

### Combined Cookie Authentication

```typescript
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'cookie',
		includeBrowserCookies: true,
		cookies: {
			'custom-header': 'custom-value',
		},
	},
})
```

## Better Auth Integration

### Client-Side (React/Next.js)

```typescript
import { createBetterAuthAuditClient } from '@smedrec/audit-client/examples/better-auth-integration'

const client = createBetterAuthAuditClient('https://api.example.com')
```

### Server-Side (API Routes)

```typescript
import { createServerSideAuditClient } from '@smedrec/audit-client/examples/better-auth-integration'

export async function POST(request: Request) {
	const client = createServerSideAuditClient('https://api.example.com', request)
	// Use client for audit logging
}
```

## Files Modified

### Core Implementation

- `packages/audit-client/src/core/config.ts` - Added cookie auth config
- `packages/audit-client/src/infrastructure/auth.ts` - Added cookie auth logic

### Examples and Documentation

- `packages/audit-client/src/examples/cookie-auth-example.ts` - Cookie auth examples
- `packages/audit-client/src/examples/better-auth-integration.ts` - Better Auth integration
- `packages/audit-client/README.md` - Updated documentation

### Tests

- `packages/audit-client/src/infrastructure/__tests__/auth-cookie.test.ts` - Comprehensive tests

### App Integration

- `apps/app/src/contexts/audit-provider.tsx` - Updated to use cookie auth by default

## Environment Variables

The audit provider now supports both cookie and API key authentication:

- Default: Cookie authentication with `includeBrowserCookies: true`
- Fallback: Set `VITE_USE_API_KEY=true` to use API key authentication

## Validation

The implementation includes comprehensive validation:

- Ensures either explicit cookies or browser cookies are available
- Validates configuration at runtime
- Provides clear error messages for misconfiguration

## Testing

Added comprehensive test suite covering:

- Explicit cookie handling
- Browser cookie integration
- Combined cookie scenarios
- Error handling
- Better Auth specific scenarios
- Configuration validation

## Benefits

1. **Better Auth Compatibility**: Seamless integration with Better Auth's cookie-based sessions
2. **Flexible Configuration**: Support for both explicit and browser cookies
3. **Server-Side Support**: Works in both client and server environments
4. **Backward Compatibility**: Existing authentication methods remain unchanged
5. **Type Safety**: Full TypeScript support with proper type definitions

## Migration Guide

### From API Key to Cookie Authentication

```typescript
// Before
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})

// After (for Better Auth)
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'cookie',
		includeBrowserCookies: true,
	},
})
```

### Environment Variable Migration

```bash
# Before
VITE_API_KEY=your-api-key

# After (optional, for fallback)
VITE_USE_API_KEY=true  # Only if you want to keep using API keys
VITE_API_KEY=your-api-key
```

## Security Considerations

1. **HTTPS Only**: Ensure cookies are only sent over HTTPS in production
2. **SameSite Policy**: Better Auth handles cookie security policies
3. **CSRF Protection**: Better Auth includes CSRF token handling
4. **Cookie Expiration**: Session cookies are managed by Better Auth

## Future Enhancements

Potential future improvements:

1. **Cookie Refresh**: Automatic cookie refresh for expired sessions
2. **Cookie Filtering**: Option to filter which browser cookies to include
3. **Cookie Encryption**: Support for encrypted cookie values
4. **Session Validation**: Built-in session validation endpoints
