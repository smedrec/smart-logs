# Framework Integration Guide

This guide provides comprehensive instructions for integrating the `@smedrec/audit-client` library with various frameworks and platforms.

## Table of Contents

1. [Web Frameworks](#web-frameworks)
2. [Backend/Server](#backendserver)
3. [Mobile](#mobile)
4. [Desktop](#desktop)
5. [Common Patterns](#common-patterns)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Web Frameworks

### React Integration

**Key Features:**

- Context Provider for global audit client management
- Custom hooks for reactive audit operations
- Error boundaries for robust error handling
- TypeScript support with full type safety

**Quick Start:**

```tsx
import { useCreateAuditEvent } from './hooks/useAudit'
import { AuditProvider } from './providers/AuditProvider'

function App() {
	return (
		<AuditProvider>
			<MyComponent />
		</AuditProvider>
	)
}

function MyComponent() {
	const { createEvent, creating, error } = useCreateAuditEvent()

	const handleAction = async () => {
		await createEvent({
			action: 'user.button_click',
			targetResourceType: 'button',
			principalId: 'current-user',
			organizationId: 'current-org',
			status: 'success',
			dataClassification: 'INTERNAL',
		})
	}
}
```

### Vue 3 Integration

**Key Features:**

- Pinia store for centralized state management
- Composition API composables
- Reactive data with Vue's reactivity system
- TypeScript support

**Quick Start:**

```vue
<template>
  <div>
    <button @click="handleClick" :disabled="creating">
      {{ creating ? 'Logging...' : 'Click Me' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCreateAuditEvent } from './composables/useAudit'

const { createEvent, creating } = useCreateAuditEvent()

const handleClick = async () => {
  await createEvent({
    action: 'user.button_click',
    targetResourceType: 'button',
    principalId: 'current-user',
    organizationId: 'current-org',
    status: 'success',
    dataClassification: 'INTERNAL',
  })
}
</script>
```

### Angular Integration

**Key Features:**

- Service-based architecture with dependency injection
- RxJS observables for reactive data handling
- Interceptors for global error handling
- Route guards for connection management

**Quick Start:**

```typescript
import { Injectable } from '@angular/core'
import { AuditService } from './services/audit.service'

@Component({
	selector: 'app-my-component',
	template: `
		<button (click)="handleClick()" [disabled]="creating$ | async">
			{{ (creating$ | async) ? 'Logging...' : 'Click Me' }}
		</button>
	`,
})
export class MyComponent {
	creating$ = this.auditService.isLoading$

	constructor(private auditService: AuditService) {}

	async handleClick() {
		this.auditService
			.createEvent({
				action: 'user.button_click',
				targetResourceType: 'button',
				principalId: 'current-user',
				organizationId: 'current-org',
				status: 'success',
				dataClassification: 'INTERNAL',
			})
			.subscribe()
	}
}
```

## Backend/Server

### Node.js with Express

**Key Features:**

- Middleware for automatic request auditing
- Service layer integration
- Environment-based configuration
- Performance optimization for high throughput

**Quick Start:**

```typescript
import express from 'express'

import { auditMiddleware } from './middleware/audit'
import { AuditService } from './services/audit-service'

const app = express()
const auditService = new AuditService()

// Global audit middleware
app.use(auditMiddleware(auditService))

// Route-specific auditing
app.post('/api/users', async (req, res) => {
	const user = await createUser(req.body)

	await auditService.logEvent({
		action: 'user.create',
		targetResourceType: 'user',
		targetResourceId: user.id,
		principalId: req.user?.id || 'anonymous',
		organizationId: req.organization?.id || 'default',
		status: 'success',
		dataClassification: 'INTERNAL',
	})

	res.json(user)
})
```

### Fastify Integration

**Quick Start:**

```typescript
import Fastify from 'fastify'

import { auditPlugin } from './plugins/audit'

const fastify = Fastify()

// Register audit plugin
await fastify.register(auditPlugin, {
	baseUrl: process.env.AUDIT_API_URL,
	apiKey: process.env.AUDIT_API_KEY,
})

fastify.post('/api/users', async (request, reply) => {
	const user = await createUser(request.body)

	await request.auditService.logEvent({
		action: 'user.create',
		targetResourceType: 'user',
		targetResourceId: user.id,
		principalId: request.user?.id || 'anonymous',
		organizationId: request.organization?.id || 'default',
		status: 'success',
		dataClassification: 'INTERNAL',
	})

	return user
})
```

## Mobile

### React Native Integration

**Key Features:**

- Offline support with local storage queue
- Network state awareness
- Device information logging
- Battery-optimized batching

**Quick Start:**

```tsx
import { useAuditMobile } from './hooks/useAudit'
import { AuditProvider } from './providers/AuditProvider'

export default function App() {
	return (
		<AuditProvider>
			<MyScreen />
		</AuditProvider>
	)
}

function MyScreen() {
	const { logScreenView, logUserAction } = useAuditMobile()

	useEffect(() => {
		logScreenView('UserProfile')
	}, [])

	const handlePress = () => {
		logUserAction('button_press', { button: 'save' })
	}

	return (
		<TouchableOpacity onPress={handlePress}>
			<Text>Save</Text>
		</TouchableOpacity>
	)
}
```

### Expo Integration

**Quick Start:**

```tsx
import * as Notifications from 'expo-notifications'

import { useAuditExpo } from './hooks/useAuditExpo'

function MyComponent() {
	const { logNotificationEvent } = useAuditExpo()

	useEffect(() => {
		const subscription = Notifications.addNotificationReceivedListener((notification) => {
			logNotificationEvent('notification.received', {
				title: notification.request.content.title,
				body: notification.request.content.body,
			})
		})

		return () => subscription.remove()
	}, [])
}
```

## Desktop

### Electron Integration

**Key Features:**

- Main and renderer process integration
- System-level event auditing
- Secure IPC communication
- Auto-updater integration

**Quick Start:**

```typescript
// Main process

// Renderer process
import { useElectronAudit } from './hooks/useElectronAudit'
import { ElectronAuditService } from './services/audit-service'

const auditService = new ElectronAuditService()
await auditService.initialize()

function MyComponent() {
	const { logUserAction } = useElectronAudit()

	const handleFileOpen = async () => {
		const result = await window.electronAPI.openFile()
		await logUserAction('file.open', { path: result.path })
	}
}
```

### Tauri Integration

**Quick Start:**

```typescript
import { invoke } from '@tauri-apps/api/tauri'

import { useTauriAudit } from './hooks/useTauriAudit'

function MyComponent() {
	const { logSystemEvent } = useTauriAudit()

	const handleSystemCall = async () => {
		const result = await invoke('system_command')
		await logSystemEvent('system.command_executed', { result })
	}
}
```

## Common Patterns

### Configuration Management

```typescript
// Environment-based configuration
const getAuditConfig = (): AuditClientConfig => ({
	baseUrl: process.env.AUDIT_API_URL || 'http://localhost:3001',
	authentication: {
		type: 'apiKey',
		apiKey: process.env.AUDIT_API_KEY,
	},
	retry: {
		enabled: true,
		maxAttempts: process.env.NODE_ENV === 'production' ? 5 : 3,
	},
	cache: {
		enabled: true,
		storage: process.env.NODE_ENV === 'production' ? 'localStorage' : 'memory',
	},
	logging: {
		enabled: process.env.NODE_ENV === 'development',
		level: process.env.AUDIT_LOG_LEVEL || 'info',
	},
})
```

### Error Handling

```typescript
// Global error handler
const handleAuditError = (error: AuditClientError, context: any) => {
	console.error('Audit error:', error.message, context)

	// Log to external monitoring service
	if (process.env.NODE_ENV === 'production') {
		monitoringService.captureException(error, { context })
	}

	// Fallback to local logging
	localLogger.error('Audit failed', { error: error.message, context })
}
```

### Performance Optimization

```typescript
// Batching configuration for high-throughput scenarios
const highThroughputConfig = {
	batching: {
		enabled: true,
		maxBatchSize: 50,
		batchTimeoutMs: 2000,
	},
	performance: {
		maxConcurrentRequests: 10,
		requestDeduplication: true,
	},
	cache: {
		enabled: true,
		maxSize: 1000,
		compressionEnabled: true,
	},
}
```

## Best Practices

### 1. Security

- **Never log sensitive data**: Always sanitize request/response bodies
- **Use secure storage**: Store API keys and tokens securely
- **Validate inputs**: Always validate audit event data before sending
- **Implement rate limiting**: Prevent audit log flooding

```typescript
const sanitizeData = (data: any) => {
	const sensitive = ['password', 'token', 'ssn', 'creditCard']
	const sanitized = { ...data }

	sensitive.forEach((field) => {
		if (sanitized[field]) {
			sanitized[field] = '[REDACTED]'
		}
	})

	return sanitized
}
```

### 2. Performance

- **Use batching**: Enable batching for high-volume scenarios
- **Implement caching**: Cache frequently accessed data
- **Optimize for platform**: Use platform-specific optimizations
- **Monitor performance**: Track audit system performance

### 3. Reliability

- **Handle offline scenarios**: Implement offline queuing
- **Retry failed requests**: Use exponential backoff
- **Implement circuit breakers**: Prevent cascade failures
- **Monitor health**: Regular health checks

### 4. Compliance

- **Follow data classification**: Properly classify audit data
- **Implement retention policies**: Manage audit data lifecycle
- **Ensure completeness**: Audit all relevant operations
- **Maintain integrity**: Verify audit log integrity

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check network connectivity
   - Verify API endpoint and credentials
   - Review firewall and proxy settings

2. **Performance Issues**
   - Enable batching and caching
   - Reduce audit event frequency
   - Optimize network requests

3. **Memory Issues**
   - Limit cache size
   - Clear old audit data
   - Monitor memory usage

4. **Authentication Errors**
   - Verify API key validity
   - Check token expiration
   - Review authentication configuration

### Debug Mode

```typescript
// Enable debug logging
const debugConfig = {
	logging: {
		enabled: true,
		level: 'debug',
		includeRequestBody: true,
		includeResponseBody: true,
	},
}
```

### Health Monitoring

```typescript
// Regular health checks
setInterval(async () => {
	try {
		const health = await auditClient.health.check()
		console.log('Audit system health:', health)
	} catch (error) {
		console.error('Health check failed:', error)
	}
}, 60000) // Check every minute
```

## Support

For additional support and examples:

1. Check the specific framework example directories
2. Review the API documentation
3. Run the test suites for integration patterns
4. Consult the troubleshooting guides

Each framework example includes:

- Complete working code
- TypeScript configurations
- Testing examples
- Deployment guides
- Performance optimizations
