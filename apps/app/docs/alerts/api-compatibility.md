# API Compatibility Documentation

## Overview

This document describes the integration between the Alert Management UI and the backend APIs, including the Audit Client, Server APIs, and Client package. It provides comprehensive information about API endpoints, data models, authentication, and migration from the existing test implementation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Alert Management UI                           │
├─────────────────────────────────────────────────────────────┤
│                   Integration Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Audit     │  │   Server    │  │    Client           │  │
│  │   Client    │  │    APIs     │  │   Package           │  │
│  │             │  │             │  │                     │  │
│  │ • REST APIs │  │ • Hono      │  │ • Utilities         │  │
│  │ • WebSocket │  │ • tRPC      │  │ • Helpers           │  │
│  │ • Auth      │  │ • GraphQL   │  │ • Types             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Audit Client Integration

### Package Information

- **Package**: `@smedrec/audit-client`
- **Version**: 1.0.0
- **Type**: Enhanced TypeScript SDK
- **Features**: Retry mechanisms, caching, authentication, type safety

### Core Services Used

The alert system primarily uses these Audit Client services:

#### 1. MetricsService

The `MetricsService` provides alert-related functionality:

```typescript
import { MetricsService } from '@smedrec/audit-client'

// Alert types and interfaces
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertType = 'system' | 'security' | 'performance' | 'compliance' | 'custom'

export interface Alert {
	id: string
	title: string
	description: string
	severity: AlertSeverity
	type: AlertType
	status: 'active' | 'acknowledged' | 'resolved' | 'dismissed'
	source: string
	timestamp: Date
	acknowledgedAt?: Date
	acknowledgedBy?: string
	resolvedAt?: Date
	resolvedBy?: string
	resolutionNotes?: string
	metadata: Record<string, any>
	tags: string[]
}

// Alert operations
export interface AlertsParams {
	severity?: AlertSeverity[]
	type?: AlertType[]
	status?: string[]
	source?: string[]
	dateRange?: {
		start: Date
		end: Date
	}
	search?: string
	tags?: string[]
	page?: number
	pageSize?: number
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
}

export interface PaginatedAlerts {
	alerts: Alert[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
}
```

#### 2. EventsService

Used for audit trail and alert history:

```typescript
import { EventsService } from '@smedrec/audit-client'

// Alert-related audit events
export interface AlertAuditEvent {
	id: string
	alertId: string
	action: 'created' | 'acknowledged' | 'resolved' | 'dismissed'
	userId: string
	timestamp: Date
	metadata: {
		previousStatus?: string
		newStatus: string
		notes?: string
	}
}
```

### API Client Configuration

```typescript
// src/lib/audit-client.ts
import { AuditClient } from '@smedrec/audit-client'

export const auditClient = new AuditClient({
	baseUrl: import.meta.env.VITE_API_BASE_URL,
	apiKey: import.meta.env.VITE_API_KEY,
	timeout: 30000,
	retries: 3,
	retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),

	// Authentication configuration
	authentication: {
		type: 'bearer',
		tokenProvider: () => getAuthToken(),
		refreshTokenProvider: () => refreshAuthToken(),
	},

	// Caching configuration
	cache: {
		enabled: true,
		ttl: 300000, // 5 minutes
		maxSize: 100,
	},

	// Error handling
	errorHandling: {
		retryableErrors: [408, 429, 500, 502, 503, 504],
		nonRetryableErrors: [400, 401, 403, 404],
	},
})

// Alert-specific service instance
export const alertService = auditClient.metrics
```

## Server API Integration

### Server Architecture

The server uses multiple frameworks and technologies:

- **Hono** - Primary web framework
- **tRPC** - Type-safe API procedures
- **GraphQL** - Query language for complex data fetching
- **WebSocket** - Real-time updates

### Alert API Endpoints

#### REST API Endpoints (Hono)

```typescript
// GET /api/v1/alerts
interface GetAlertsEndpoint {
	method: 'GET'
	path: '/api/v1/alerts'
	query: AlertsParams
	response: PaginatedAlerts
	headers: {
		Authorization: 'Bearer <token>'
		'X-API-Key': string
	}
}

// GET /api/v1/alerts/:id
interface GetAlertEndpoint {
	method: 'GET'
	path: '/api/v1/alerts/:id'
	params: { id: string }
	response: {
		alert: Alert
		history: AlertAuditEvent[]
		relatedAlerts: Alert[]
	}
}

// PATCH /api/v1/alerts/:id/acknowledge
interface AcknowledgeAlertEndpoint {
	method: 'PATCH'
	path: '/api/v1/alerts/:id/acknowledge'
	params: { id: string }
	body: {
		notes?: string
	}
	response: Alert
}

// PATCH /api/v1/alerts/:id/resolve
interface ResolveAlertEndpoint {
	method: 'PATCH'
	path: '/api/v1/alerts/:id/resolve'
	params: { id: string }
	body: {
		notes: string
		resolution?: string
	}
	response: Alert
}

// DELETE /api/v1/alerts/:id
interface DismissAlertEndpoint {
	method: 'DELETE'
	path: '/api/v1/alerts/:id'
	params: { id: string }
	response: void
}

// POST /api/v1/alerts/bulk-action
interface BulkActionEndpoint {
	method: 'POST'
	path: '/api/v1/alerts/bulk-action'
	body: {
		alertIds: string[]
		action: 'acknowledge' | 'resolve' | 'dismiss'
		notes?: string
	}
	response: {
		successful: string[]
		failed: Array<{
			alertId: string
			error: string
		}>
	}
}
```

#### tRPC Procedures

```typescript
// Alert tRPC router
export const alertRouter = t.router({
	// Get alerts with filtering
	getAlerts: t.procedure.input(AlertsParamsSchema).query(async ({ input }) => {
		return await alertService.getAlerts(input)
	}),

	// Get single alert
	getAlert: t.procedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
		return await alertService.getAlert(input.id)
	}),

	// Acknowledge alert
	acknowledgeAlert: t.procedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			return await alertService.acknowledgeAlert(input.id, input.notes)
		}),

	// Resolve alert
	resolveAlert: t.procedure
		.input(
			z.object({
				id: z.string(),
				notes: z.string(),
				resolution: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			return await alertService.resolveAlert(input.id, input.notes, input.resolution)
		}),

	// Subscribe to real-time updates
	subscribeToAlerts: t.procedure
		.input(
			z.object({
				filters: AlertsParamsSchema.optional(),
			})
		)
		.subscription(async function* ({ input }) {
			// WebSocket subscription implementation
			yield* alertService.subscribeToUpdates(input.filters)
		}),
})
```

#### GraphQL Schema

```graphql
type Alert {
	id: ID!
	title: String!
	description: String!
	severity: AlertSeverity!
	type: AlertType!
	status: AlertStatus!
	source: String!
	timestamp: DateTime!
	acknowledgedAt: DateTime
	acknowledgedBy: String
	resolvedAt: DateTime
	resolvedBy: String
	resolutionNotes: String
	metadata: JSON!
	tags: [String!]!
}

enum AlertSeverity {
	CRITICAL
	HIGH
	MEDIUM
	LOW
	INFO
}

enum AlertType {
	SYSTEM
	SECURITY
	PERFORMANCE
	COMPLIANCE
	CUSTOM
}

enum AlertStatus {
	ACTIVE
	ACKNOWLEDGED
	RESOLVED
	DISMISSED
}

type Query {
	alerts(
		severity: [AlertSeverity!]
		type: [AlertType!]
		status: [AlertStatus!]
		source: [String!]
		dateRange: DateRangeInput
		search: String
		tags: [String!]
		page: Int = 1
		pageSize: Int = 25
		sortBy: String = "timestamp"
		sortOrder: SortOrder = DESC
	): PaginatedAlerts!

	alert(id: ID!): AlertDetails
}

type Mutation {
	acknowledgeAlert(id: ID!, notes: String): Alert!
	resolveAlert(id: ID!, notes: String!, resolution: String): Alert!
	dismissAlert(id: ID!): Boolean!
	bulkAlertAction(alertIds: [ID!]!, action: AlertAction!, notes: String): BulkActionResult!
}

type Subscription {
	alertUpdates(filters: AlertFiltersInput): Alert!
	alertStatistics: AlertStatistics!
}
```

### WebSocket Integration

#### Connection Setup

```typescript
// WebSocket endpoint: /ws/alerts
interface AlertWebSocketMessage {
	type: 'alert_created' | 'alert_updated' | 'alert_deleted' | 'bulk_update'
	data: Alert | Alert[] | { alertId: string }
	timestamp: string
	userId?: string
}

// Connection authentication
const wsUrl = `${WS_BASE_URL}/ws/alerts?token=${authToken}`
```

#### Message Types

```typescript
// Incoming messages from server
interface IncomingMessage {
	type: 'alert_created'
	data: Alert
	timestamp: string
}

interface IncomingMessage {
	type: 'alert_updated'
	data: Alert
	timestamp: string
}

interface IncomingMessage {
	type: 'alert_deleted'
	data: { alertId: string }
	timestamp: string
}

// Outgoing messages to server
interface OutgoingMessage {
	type: 'subscribe'
	data: {
		filters?: AlertsParams
		userId: string
	}
}

interface OutgoingMessage {
	type: 'unsubscribe'
	data: {
		subscriptionId: string
	}
}
```

## Client Package Integration

### Package Structure

The client package provides utilities and helpers:

```typescript
// @repo/hono-helpers
export { cors, logger, errorHandler } from './middleware'
export { validateRequest, sanitizeInput } from './validation'
export { formatResponse, handleError } from './response'

// @repo/auth
export { authMiddleware, requireAuth } from './middleware'
export { generateToken, verifyToken } from './jwt'
export { hashPassword, comparePassword } from './crypto'

// @repo/redis-client
export { RedisClient, createRedisConnection } from './client'
export { cacheMiddleware, invalidateCache } from './cache'

// @repo/logs
export { Logger, createLogger } from './logger'
export { auditLog, securityLog } from './audit'
```

### Shared Types

```typescript
// Shared type definitions across packages
export interface BaseEntity {
	id: string
	createdAt: Date
	updatedAt: Date
	createdBy?: string
	updatedBy?: string
}

export interface PaginationParams {
	page: number
	pageSize: number
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
	data: T[]
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
		hasNext: boolean
		hasPrev: boolean
	}
}

export interface ApiResponse<T> {
	success: boolean
	data?: T
	error?: {
		code: string
		message: string
		details?: any
	}
	metadata?: {
		timestamp: string
		requestId: string
		version: string
	}
}
```

## Authentication and Authorization

### Authentication Flow

```typescript
// Authentication configuration
interface AuthConfig {
	provider: 'jwt' | 'oauth2' | 'saml'
	tokenEndpoint: string
	refreshEndpoint: string
	userInfoEndpoint: string
}

// JWT Token structure
interface JWTPayload {
	sub: string // User ID
	email: string
	name: string
	roles: string[]
	permissions: string[]
	organizationId: string
	exp: number
	iat: number
}

// API Key authentication
interface ApiKeyAuth {
	keyId: string
	secret: string
	scopes: string[]
}
```

### Authorization Middleware

```typescript
// Role-based access control
export const requireRole = (roles: string[]) => {
	return async (c: Context, next: Next) => {
		const user = c.get('user')
		if (!user || !roles.some((role) => user.roles.includes(role))) {
			return c.json({ error: 'Insufficient permissions' }, 403)
		}
		await next()
	}
}

// Permission-based access control
export const requirePermission = (permission: string) => {
	return async (c: Context, next: Next) => {
		const user = c.get('user')
		if (!user || !user.permissions.includes(permission)) {
			return c.json({ error: 'Access denied' }, 403)
		}
		await next()
	}
}
```

## Data Models and Schemas

### Zod Validation Schemas

```typescript
import { z } from 'zod'

// Alert severity enum
export const AlertSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info'])

// Alert type enum
export const AlertTypeSchema = z.enum(['system', 'security', 'performance', 'compliance', 'custom'])

// Alert status enum
export const AlertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'dismissed'])

// Alert schema
export const AlertSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(255),
	description: z.string().min(1).max(2000),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	status: AlertStatusSchema,
	source: z.string().min(1).max(100),
	timestamp: z.date(),
	acknowledgedAt: z.date().optional(),
	acknowledgedBy: z.string().optional(),
	resolvedAt: z.date().optional(),
	resolvedBy: z.string().optional(),
	resolutionNotes: z.string().max(1000).optional(),
	metadata: z.record(z.any()),
	tags: z.array(z.string()).default([]),
})

// Alert filters schema
export const AlertFiltersSchema = z.object({
	severity: z.array(AlertSeveritySchema).optional(),
	type: z.array(AlertTypeSchema).optional(),
	status: z.array(AlertStatusSchema).optional(),
	source: z.array(z.string()).optional(),
	dateRange: z
		.object({
			start: z.date(),
			end: z.date(),
		})
		.optional(),
	search: z.string().optional(),
	tags: z.array(z.string()).optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(25),
	sortBy: z.string().default('timestamp'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Alert action schemas
export const AcknowledgeAlertSchema = z.object({
	notes: z.string().max(1000).optional(),
})

export const ResolveAlertSchema = z.object({
	notes: z.string().min(1).max(1000),
	resolution: z.string().max(500).optional(),
})

export const BulkActionSchema = z.object({
	alertIds: z.array(z.string().uuid()).min(1).max(100),
	action: z.enum(['acknowledge', 'resolve', 'dismiss']),
	notes: z.string().max(1000).optional(),
})
```

### Database Schema (Drizzle ORM)

```typescript
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const alerts = pgTable(
	'alerts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		title: varchar('title', { length: 255 }).notNull(),
		description: text('description').notNull(),
		severity: varchar('severity', { length: 20 }).notNull(),
		type: varchar('type', { length: 20 }).notNull(),
		status: varchar('status', { length: 20 }).notNull().default('active'),
		source: varchar('source', { length: 100 }).notNull(),
		timestamp: timestamp('timestamp').notNull().defaultNow(),
		acknowledgedAt: timestamp('acknowledged_at'),
		acknowledgedBy: uuid('acknowledged_by'),
		resolvedAt: timestamp('resolved_at'),
		resolvedBy: uuid('resolved_by'),
		resolutionNotes: text('resolution_notes'),
		metadata: jsonb('metadata').notNull().default('{}'),
		tags: jsonb('tags').notNull().default('[]'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => ({
		severityIdx: index('alerts_severity_idx').on(table.severity),
		statusIdx: index('alerts_status_idx').on(table.status),
		typeIdx: index('alerts_type_idx').on(table.type),
		sourceIdx: index('alerts_source_idx').on(table.source),
		timestampIdx: index('alerts_timestamp_idx').on(table.timestamp),
	})
)

export const alertHistory = pgTable(
	'alert_history',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		alertId: uuid('alert_id')
			.notNull()
			.references(() => alerts.id),
		action: varchar('action', { length: 20 }).notNull(),
		userId: uuid('user_id').notNull(),
		previousStatus: varchar('previous_status', { length: 20 }),
		newStatus: varchar('new_status', { length: 20 }).notNull(),
		notes: text('notes'),
		timestamp: timestamp('timestamp').notNull().defaultNow(),
		metadata: jsonb('metadata').notNull().default('{}'),
	},
	(table) => ({
		alertIdIdx: index('alert_history_alert_id_idx').on(table.alertId),
		timestampIdx: index('alert_history_timestamp_idx').on(table.timestamp),
	})
)
```

## Error Handling

### Error Response Format

```typescript
interface ApiError {
	success: false
	error: {
		code: string
		message: string
		details?: any
		timestamp: string
		requestId: string
	}
}

// Common error codes
export const ErrorCodes = {
	// Authentication errors
	UNAUTHORIZED: 'UNAUTHORIZED',
	INVALID_TOKEN: 'INVALID_TOKEN',
	TOKEN_EXPIRED: 'TOKEN_EXPIRED',

	// Authorization errors
	FORBIDDEN: 'FORBIDDEN',
	INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

	// Validation errors
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	INVALID_INPUT: 'INVALID_INPUT',
	MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

	// Resource errors
	ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
	ALERT_ALREADY_RESOLVED: 'ALERT_ALREADY_RESOLVED',
	ALERT_ALREADY_DISMISSED: 'ALERT_ALREADY_DISMISSED',

	// System errors
	INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
	DATABASE_ERROR: 'DATABASE_ERROR',
	EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

	// Rate limiting
	RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
	TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
} as const
```

### Error Handling Middleware

```typescript
export const errorHandler = async (err: Error, c: Context) => {
	const requestId = c.get('requestId') || generateRequestId()

	// Log error
	logger.error('API Error', {
		error: err.message,
		stack: err.stack,
		requestId,
		path: c.req.path,
		method: c.req.method,
	})

	// Handle specific error types
	if (err instanceof ValidationError) {
		return c.json(
			{
				success: false,
				error: {
					code: ErrorCodes.VALIDATION_ERROR,
					message: err.message,
					details: err.details,
					timestamp: new Date().toISOString(),
					requestId,
				},
			},
			400
		)
	}

	if (err instanceof AuthenticationError) {
		return c.json(
			{
				success: false,
				error: {
					code: ErrorCodes.UNAUTHORIZED,
					message: 'Authentication required',
					timestamp: new Date().toISOString(),
					requestId,
				},
			},
			401
		)
	}

	// Default error response
	return c.json(
		{
			success: false,
			error: {
				code: ErrorCodes.INTERNAL_SERVER_ERROR,
				message: 'An unexpected error occurred',
				timestamp: new Date().toISOString(),
				requestId,
			},
		},
		500
	)
}
```

## Migration from Test Implementation

### Current Test Routes

The existing test implementation in `src/routes/_authenticated/alerts/` includes:

```
src/routes/_authenticated/alerts/
├── index.tsx          # Main alerts page
├── active.tsx         # Active alerts view
├── acknowledged.tsx   # Acknowledged alerts view
├── resolved.tsx       # Resolved alerts view
└── statistics.tsx     # Statistics view
```

### Migration Steps

#### 1. Replace Test Components

```typescript
// Before (test implementation)
export function AlertsPage() {
  return (
    <div>
      <h1>Test Alerts Page</h1>
      <p>This is a placeholder for the alerts interface</p>
    </div>
  )
}

// After (production implementation)
export function AlertsPage() {
  return (
    <AlertDashboard
      view="list"
      onViewChange={(view) => {
        // Handle view changes
      }}
    />
  )
}
```

#### 2. Update Route Definitions

```typescript
// Before
export const Route = createFileRoute('/_authenticated/alerts/')({
	component: TestAlertsPage,
})

// After
export const Route = createFileRoute('/_authenticated/alerts/')({
	component: AlertDashboard,
	validateSearch: (search): AlertSearchParams => ({
		severity: search.severity as AlertSeverity[],
		status: search.status as AlertStatus[],
		page: Number(search.page) || 1,
		pageSize: Number(search.pageSize) || 25,
	}),
	beforeLoad: ({ context }) => {
		// Ensure user has alert permissions
		if (!context.auth.user?.permissions.includes('alerts:read')) {
			throw redirect({ to: '/unauthorized' })
		}
	},
})
```

#### 3. Add API Integration

```typescript
// Replace mock data with real API calls
// Before
const mockAlerts = [
	{ id: '1', title: 'Test Alert', severity: 'high' },
	// ...
]

// After
const {
	data: alerts,
	isLoading,
	error,
} = useQuery({
	queryKey: ['alerts', filters],
	queryFn: () => auditClient.metrics.getAlerts(filters),
})
```

#### 4. Update Navigation

```typescript
// Update sidebar navigation
const navigationItems = [
	{
		title: 'Alerts',
		href: '/alerts',
		icon: AlertTriangle,
		children: [
			{ title: 'Active', href: '/alerts?status=active' },
			{ title: 'Acknowledged', href: '/alerts?status=acknowledged' },
			{ title: 'Resolved', href: '/alerts?status=resolved' },
			{ title: 'Statistics', href: '/alerts/statistics' },
		],
	},
]
```

### Backward Compatibility

To ensure smooth migration:

1. **URL Compatibility**: Maintain existing URL patterns
2. **Feature Parity**: Ensure all test features are implemented
3. **Gradual Migration**: Support both test and production routes during transition
4. **Fallback Handling**: Graceful degradation when APIs are unavailable

### Testing Migration

```typescript
// Test both old and new implementations
describe('Alert Migration', () => {
  it('maintains URL compatibility', () => {
    // Test that old URLs still work
    expect(router.resolve('/alerts')).toBeDefined()
    expect(router.resolve('/alerts/active')).toBeDefined()
  })

  it('provides feature parity', () => {
    // Test that all features from test implementation are available
    render(<AlertDashboard />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })

  it('handles API failures gracefully', () => {
    // Mock API failure
    mockApiCall.mockRejectedValue(new Error('API Error'))

    render(<AlertDashboard />)
    expect(screen.getByText('Failed to load alerts')).toBeInTheDocument()
  })
})
```

## Performance Considerations

### Caching Strategy

```typescript
// Query configuration for optimal performance
export const alertQueryConfig = {
	staleTime: 30000, // 30 seconds
	cacheTime: 300000, // 5 minutes
	refetchOnWindowFocus: true,
	refetchOnReconnect: true,
	retry: 3,
	retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
}

// Background refetching
export function useAlertBackgroundSync() {
	const queryClient = useQueryClient()

	useEffect(() => {
		const interval = setInterval(() => {
			queryClient.invalidateQueries(['alerts'])
		}, 60000) // Refresh every minute

		return () => clearInterval(interval)
	}, [queryClient])
}
```

### Request Optimization

```typescript
// Batch multiple requests
export function useBatchAlertOperations() {
	const [pendingOperations, setPendingOperations] = useState<AlertOperation[]>([])

	const batchOperation = useCallback((operation: AlertOperation) => {
		setPendingOperations((prev) => [...prev, operation])
	}, [])

	// Process batch every 100ms
	useEffect(() => {
		if (pendingOperations.length === 0) return

		const timeout = setTimeout(async () => {
			const operations = [...pendingOperations]
			setPendingOperations([])

			try {
				await auditClient.metrics.bulkAlertAction({
					operations,
				})
			} catch (error) {
				// Handle batch error
				console.error('Batch operation failed:', error)
			}
		}, 100)

		return () => clearTimeout(timeout)
	}, [pendingOperations])

	return { batchOperation }
}
```

## Security Considerations

### Input Validation

```typescript
// Validate all inputs on both client and server
export function validateAlertInput(input: unknown): Alert {
	try {
		return AlertSchema.parse(input)
	} catch (error) {
		throw new ValidationError('Invalid alert data', error)
	}
}

// Sanitize user inputs
export function sanitizeAlertNotes(notes: string): string {
	return notes
		.trim()
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
		.substring(0, 1000) // Limit length
}
```

### Rate Limiting

```typescript
// Client-side rate limiting
export function useRateLimit(limit: number, window: number) {
	const requests = useRef<number[]>([])

	const canMakeRequest = useCallback(() => {
		const now = Date.now()
		const windowStart = now - window

		// Remove old requests
		requests.current = requests.current.filter((time) => time > windowStart)

		if (requests.current.length >= limit) {
			return false
		}

		requests.current.push(now)
		return true
	}, [limit, window])

	return { canMakeRequest }
}
```

This comprehensive API compatibility documentation provides all the information needed to understand and work with the alert system's backend integration. It covers the complete integration stack from the UI layer down to the database, ensuring developers can effectively build, maintain, and extend the alert management functionality.
