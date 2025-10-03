# Alert Management Setup Guide

## Overview

This guide covers the installation, configuration, and setup procedures for the Alert Management System in the apps/app application. It's intended for developers and system administrators who need to deploy or maintain the alert system.

## Prerequisites

### System Requirements

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher (package manager)
- **TypeScript** 5.0.0 or higher
- **React** 18.0.0 or higher

### Dependencies

The alert system relies on these key dependencies:

```json
{
	"@tanstack/react-query": "^5.0.0",
	"@tanstack/react-router": "^1.0.0",
	"@tanstack/react-db": "^0.0.1-alpha",
	"@smedrec/audit-client": "workspace:*",
	"react": "^18.0.0",
	"typescript": "^5.0.0"
}
```

### Environment Setup

Ensure you have the following environment variables configured:

```bash
# API Configuration
VITE_API_BASE_URL=https://api.example.com
VITE_API_KEY=your-api-key-here

# WebSocket Configuration
VITE_WS_URL=wss://ws.example.com

# Authentication
VITE_AUTH_PROVIDER=your-auth-provider
VITE_AUTH_CLIENT_ID=your-client-id

# Feature Flags
VITE_ENABLE_REAL_TIME_UPDATES=true
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_STATISTICS=true
```

## Installation

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone <repository-url>
cd <repository-name>

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### 2. Navigate to App Directory

```bash
cd apps/app
```

### 3. Install App Dependencies

```bash
# Install app-specific dependencies
pnpm install

# Verify alert components are available
ls src/components/alerts/
```

### 4. Environment Configuration

Create environment files:

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Required environment variables:

```bash
# .env file
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
VITE_AUTH_PROVIDER=local
VITE_ENABLE_REAL_TIME_UPDATES=true
```

## Configuration

### 1. Audit Client Configuration

Configure the Audit Client in `src/lib/audit-client.ts`:

```typescript
import { AuditClient } from '@smedrec/audit-client'

export const auditClient = new AuditClient({
	baseUrl: import.meta.env.VITE_API_BASE_URL,
	apiKey: import.meta.env.VITE_API_KEY,
	timeout: 30000,
	retries: 3,
	retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
})

// Configure alert-specific endpoints
auditClient.configure({
	endpoints: {
		alerts: '/alerts',
		alertStatistics: '/alerts/statistics',
		alertMetrics: '/alerts/metrics',
	},
})
```

### 2. Router Configuration

Update the router configuration in `src/main.tsx`:

```typescript
import { createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

// Create router with alert routes
const router = createRouter({
	routeTree,
	context: {
		// Add alert-specific context
		alertsEnabled: import.meta.env.VITE_ENABLE_ALERTS === 'true',
	},
})
```

### 3. Alert Route Setup

Ensure alert routes are properly configured in `src/routes/_authenticated/alerts/`:

```typescript
// src/routes/_authenticated/alerts/index.tsx
import { AlertDashboard } from '@/components/alerts/core/AlertDashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/alerts/')({
	component: AlertDashboard,
})
```

### 4. Context Provider Setup

Configure the alert context in your app root:

```typescript
// src/main.tsx or App.tsx
import { AlertProvider } from '@/contexts/alert-context'
import { AuditProvider } from '@/contexts/audit-provider'

function App() {
  return (
    <AuditProvider>
      <AlertProvider>
        {/* Your app content */}
      </AlertProvider>
    </AuditProvider>
  )
}
```

## Database Setup

### 1. Alert Collections

The alert system uses TanStack DB collections. Ensure these are configured:

```typescript
// src/lib/collections.ts
import { createCollection } from '@tanstack/react-db'

export const alertsCollection = createCollection({
	name: 'alerts',
	primaryKey: 'id',
	indexes: ['severity', 'status', 'type', 'source', 'created_at'],
})

export const notificationsCollection = createCollection({
	name: 'notifications',
	primaryKey: 'id',
	indexes: ['alert_id', 'read', 'created_at'],
})
```

### 2. Database Initialization

Initialize collections in your app startup:

```typescript
// src/lib/db.ts
import { createDB } from '@tanstack/react-db'

import { alertsCollection, notificationsCollection } from './collections'

export const db = createDB({
	collections: [alertsCollection, notificationsCollection],
})
```

## WebSocket Configuration

### 1. WebSocket Client Setup

Configure WebSocket client for real-time updates:

```typescript
// src/lib/websocket.ts
export class AlertWebSocketClient {
	private ws: WebSocket | null = null
	private reconnectAttempts = 0
	private maxReconnectAttempts = 5
	private reconnectDelay = 1000

	constructor(
		private url: string,
		private token: string
	) {}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(`${this.url}?token=${this.token}`)

				this.ws.onopen = () => {
					console.log('Alert WebSocket connected')
					this.reconnectAttempts = 0
					resolve()
				}

				this.ws.onerror = (error) => {
					console.error('Alert WebSocket error:', error)
					reject(error)
				}

				this.ws.onclose = () => {
					this.handleReconnect()
				}
			} catch (error) {
				reject(error)
			}
		})
	}

	private handleReconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			setTimeout(() => {
				this.reconnectAttempts++
				this.connect()
			}, this.reconnectDelay * this.reconnectAttempts)
		}
	}
}
```

### 2. WebSocket Integration

Integrate WebSocket with React components:

```typescript
// src/hooks/use-alert-websocket.ts
export function useAlertWebSocket() {
	const { token } = useAuth()
	const queryClient = useQueryClient()

	useEffect(() => {
		if (!token) return

		const wsClient = new AlertWebSocketClient(import.meta.env.VITE_WS_URL, token)

		wsClient.connect().then(() => {
			wsClient.onMessage((message) => {
				// Handle real-time alert updates
				handleAlertUpdate(message, queryClient)
			})
		})

		return () => wsClient.disconnect()
	}, [token, queryClient])
}
```

## Authentication Integration

### 1. Auth Context Setup

Ensure authentication context is properly configured:

```typescript
// src/contexts/auth-context.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Authentication logic

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### 2. Protected Routes

Configure route protection for alert pages:

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: '/login',
				search: {
					redirect: location.href,
				},
			})
		}
	},
})
```

## Development Environment

### 1. Development Server

Start the development server:

```bash
# From apps/app directory
pnpm dev

# Or from root directory
pnpm --filter app dev
```

### 2. Development Configuration

Create development-specific configuration:

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_LOG_LEVEL=debug
VITE_ENABLE_DEV_TOOLS=true
```

### 3. Mock Data Setup

For development without a backend, set up mock data:

```typescript
// src/lib/mock-data.ts
export const mockAlerts: Alert[] = [
	{
		id: '1',
		title: 'High CPU Usage',
		description: 'Server CPU usage above 90%',
		severity: 'high',
		status: 'active',
		type: 'system',
		source: 'monitoring-system',
		timestamp: new Date(),
		metadata: {},
		tags: ['performance', 'server'],
	},
	// More mock alerts...
]

// Mock API responses
export function setupMockApi() {
	// Mock implementation
}
```

## Production Deployment

### 1. Build Configuration

Configure production build:

```bash
# Build for production
pnpm build

# Verify build output
ls dist/
```

### 2. Environment Variables

Set production environment variables:

```bash
# .env.production
VITE_API_BASE_URL=https://api.production.com
VITE_WS_URL=wss://ws.production.com
VITE_LOG_LEVEL=error
VITE_ENABLE_DEV_TOOLS=false
```

### 3. Server Configuration

Configure your web server (nginx example):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://backend-server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. CDN Configuration

If using a CDN, configure appropriate headers:

```
Cache-Control: public, max-age=31536000, immutable  # For static assets
Cache-Control: no-cache                             # For index.html
```

## Testing Setup

### 1. Test Environment

Configure testing environment:

```bash
# Install test dependencies
pnpm add -D @testing-library/react @testing-library/jest-dom vitest jsdom

# Create test configuration
touch vitest.config.ts
```

### 2. Test Configuration

```typescript
// vitest.config.ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		globals: true,
	},
})
```

### 3. Test Setup File

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'

import { vi } from 'vitest'

// Mock WebSocket
global.WebSocket = vi.fn()

// Mock environment variables
vi.mock('import.meta', () => ({
	env: {
		VITE_API_BASE_URL: 'http://localhost:3000',
		VITE_WS_URL: 'ws://localhost:3000',
	},
}))
```

## Monitoring and Logging

### 1. Error Tracking

Set up error tracking:

```typescript
// src/lib/error-tracking.ts
export function initErrorTracking() {
	window.addEventListener('error', (event) => {
		console.error('Global error:', event.error)
		// Send to error tracking service
	})

	window.addEventListener('unhandledrejection', (event) => {
		console.error('Unhandled promise rejection:', event.reason)
		// Send to error tracking service
	})
}
```

### 2. Performance Monitoring

Configure performance monitoring:

```typescript
// src/lib/performance.ts
export function initPerformanceMonitoring() {
	// Monitor Core Web Vitals
	import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
		getCLS(console.log)
		getFID(console.log)
		getFCP(console.log)
		getLCP(console.log)
		getTTFB(console.log)
	})
}
```

### 3. Logging Configuration

Set up structured logging:

```typescript
// src/lib/logger.ts
export const logger = {
	debug: (message: string, data?: any) => {
		if (import.meta.env.VITE_LOG_LEVEL === 'debug') {
			console.debug(`[ALERT] ${message}`, data)
		}
	},
	info: (message: string, data?: any) => {
		console.info(`[ALERT] ${message}`, data)
	},
	error: (message: string, error?: any) => {
		console.error(`[ALERT] ${message}`, error)
		// Send to error tracking service
	},
}
```

## Security Configuration

### 1. Content Security Policy

Configure CSP headers:

```html
<meta
	http-equiv="Content-Security-Policy"
	content="default-src 'self'; 
               connect-src 'self' wss://ws.example.com https://api.example.com; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline';"
/>
```

### 2. API Security

Secure API communications:

```typescript
// src/lib/api-security.ts
export function configureApiSecurity() {
	// Add request interceptors
	auditClient.interceptors.request.use((config) => {
		// Add security headers
		config.headers['X-Requested-With'] = 'XMLHttpRequest'
		config.headers['X-Client-Version'] = import.meta.env.VITE_APP_VERSION
		return config
	})

	// Add response interceptors
	auditClient.interceptors.response.use(
		(response) => response,
		(error) => {
			if (error.response?.status === 401) {
				// Handle unauthorized access
				window.location.href = '/login'
			}
			return Promise.reject(error)
		}
	)
}
```

## Troubleshooting Common Setup Issues

### 1. Build Errors

**Problem:** TypeScript compilation errors

```bash
# Solution: Check TypeScript configuration
npx tsc --noEmit
```

**Problem:** Missing dependencies

```bash
# Solution: Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 2. Runtime Errors

**Problem:** WebSocket connection fails

```typescript
// Check WebSocket URL and authentication
console.log('WebSocket URL:', import.meta.env.VITE_WS_URL)
```

**Problem:** API calls fail

```typescript
// Verify API configuration
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL)
```

### 3. Performance Issues

**Problem:** Slow initial load

```bash
# Analyze bundle size
pnpm build
npx vite-bundle-analyzer dist/
```

**Problem:** Memory leaks

```typescript
// Check for proper cleanup in useEffect
useEffect(() => {
	const subscription = subscribe()
	return () => subscription.unsubscribe() // Important!
}, [])
```

## Maintenance

### 1. Regular Updates

Keep dependencies updated:

```bash
# Check for updates
pnpm outdated

# Update dependencies
pnpm update

# Update major versions carefully
pnpm add @tanstack/react-query@latest
```

### 2. Performance Monitoring

Monitor application performance:

```bash
# Analyze bundle size
pnpm build
npx bundlesize

# Check for unused dependencies
npx depcheck
```

### 3. Security Audits

Regular security checks:

```bash
# Audit dependencies
pnpm audit

# Fix vulnerabilities
pnpm audit --fix
```

## Support and Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TanStack Query](https://tanstack.com/query)
- [TanStack Router](https://tanstack.com/router)
- [Vite Documentation](https://vitejs.dev/)

### Community

- [GitHub Issues](https://github.com/your-org/your-repo/issues)
- [Discord Community](https://discord.gg/your-server)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/your-tag)

### Getting Help

1. Check this documentation first
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Contact the development team

This setup guide should help you get the Alert Management System running in your environment. For specific deployment scenarios or advanced configurations, consult with your development team or system administrator.
