# Design Document

## Overview

The production server application serves as the central API gateway for the SMEDREC healthcare platform, providing comprehensive access to all audit services through three distinct API paradigms: TRPC (type-safe RPC), REST (standard HTTP), and GraphQL (flexible querying). The server is built on Hono.js for high performance, integrates with Better Auth for authentication, and is designed for containerized deployment in production environments.

The server architecture follows a layered approach with clear separation of concerns:

- **API Layer**: TRPC, REST, and GraphQL endpoints
- **Service Layer**: Business logic and audit service integration
- **Data Layer**: Database and Redis connections
- **Infrastructure Layer**: Authentication, monitoring, logging, and error handling

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web App<br/>TRPC Client]
        MOBILE[Mobile App<br/>GraphQL Client]
        THIRD_PARTY[Third Party<br/>REST API]
    end

    subgraph "API Gateway Layer"
        TRPC_EP[TRPC Endpoints<br/>/trpc/*]
        REST_EP[REST Endpoints<br/>/api/*]
        GRAPHQL_EP[GraphQL Endpoint<br/>/graphql]
    end

    subgraph "Server Application"
        HONO[Hono.js Server]
        AUTH_MW[Auth Middleware]
        CORS_MW[CORS Middleware]
        RATE_MW[Rate Limiting]
        LOG_MW[Logging Middleware]
    end

    subgraph "Service Layer"
        AUDIT_SVC[Audit Service]
        COMPLIANCE_SVC[Compliance Service]
        HEALTH_SVC[Health Service]
        MONITOR_SVC[Monitoring Service]
        ERROR_SVC[Error Service]
    end

    subgraph "Data Layer"
        POSTGRES[(PostgreSQL<br/>Audit DB)]
        REDIS[(Redis<br/>Queue & Cache)]
        AUTH_DB[(Auth Database)]
    end

    subgraph "Infrastructure"
        DOCKER[Docker Container]
        METRICS[Metrics Collection]
        LOGS[Structured Logging]
        ALERTS[Alert System]
    end

    WEB --> TRPC_EP
    MOBILE --> GRAPHQL_EP
    THIRD_PARTY --> REST_EP

    TRPC_EP --> HONO
    REST_EP --> HONO
    GRAPHQL_EP --> HONO

    HONO --> AUTH_MW
    AUTH_MW --> CORS_MW
    CORS_MW --> RATE_MW
    RATE_MW --> LOG_MW

    LOG_MW --> AUDIT_SVC
    LOG_MW --> COMPLIANCE_SVC
    LOG_MW --> HEALTH_SVC
    LOG_MW --> MONITOR_SVC
    LOG_MW --> ERROR_SVC

    AUDIT_SVC --> POSTGRES
    AUDIT_SVC --> REDIS
    COMPLIANCE_SVC --> POSTGRES
    HEALTH_SVC --> POSTGRES
    HEALTH_SVC --> REDIS
    HEALTH_SVC --> AUTH_DB

    DOCKER --> HONO
    HONO --> METRICS
    HONO --> LOGS
    MONITOR_SVC --> ALERTS
```

### Container Architecture

```mermaid
graph TB
    subgraph "Docker Container"
        subgraph "Application Layer"
            APP[Node.js Application]
            ENV[Environment Config]
        end

        subgraph "Runtime Dependencies"
            NODE[Node.js Runtime]
            DEPS[NPM Dependencies]
        end

        subgraph "Health & Monitoring"
            HEALTH[Health Checks]
            METRICS_EP[Metrics Endpoint]
        end
    end

    subgraph "External Services"
        DB[PostgreSQL]
        REDIS_EXT[Redis]
        AUTH_EXT[Auth Service]
    end

    APP --> NODE
    APP --> DEPS
    APP --> ENV
    APP --> HEALTH
    APP --> METRICS_EP

    APP --> DB
    APP --> REDIS_EXT
    APP --> AUTH_EXT
```

## Components and Interfaces

### 1. Enhanced Server Configuration

```typescript
interface ServerConfig {
	// Server settings
	port: number
	host: string
	environment: 'development' | 'staging' | 'production'

	// API configuration
	cors: {
		origin: string | string[]
		credentials: boolean
		allowedMethods: string[]
		allowedHeaders: string[]
	}

	// Rate limiting
	rateLimit: {
		windowMs: number
		maxRequests: number
		skipSuccessfulRequests: boolean
	}

	// Database connections
	database: {
		url: string
		poolSize: number
		connectionTimeout: number
		idleTimeout: number
	}

	// Redis configuration
	redis: {
		url: string
		maxRetriesPerRequest: number
		retryDelayOnFailover: number
	}

	// Authentication
	auth: {
		sessionSecret: string
		sessionMaxAge: number
		trustedOrigins: string[]
	}

	// Monitoring
	monitoring: {
		enableMetrics: boolean
		metricsPath: string
		healthCheckPath: string
		logLevel: 'debug' | 'info' | 'warn' | 'error'
	}
}
```

### 2. TRPC Router Structure

```typescript
// Enhanced TRPC router with comprehensive audit operations
interface AuditTRPCRouter {
	// Health and monitoring
	health: {
		check: () => Promise<HealthStatus>
		detailed: () => Promise<DetailedHealthStatus>
	}

	// Audit events
	events: {
		create: (input: CreateAuditEventInput) => Promise<AuditEvent>
		query: (input: QueryAuditEventsInput) => Promise<PaginatedAuditEvents>
		getById: (input: { id: string }) => Promise<AuditEvent | null>
		verify: (input: { id: string }) => Promise<IntegrityVerificationResult>
	}

	// Compliance reporting
	reports: {
		hipaa: (input: ReportCriteriaInput) => Promise<HIPAAReport>
		gdpr: (input: ReportCriteriaInput) => Promise<GDPRReport>
		integrity: (input: IntegrityReportInput) => Promise<IntegrityReport>
		custom: (input: CustomReportInput) => Promise<CustomReport>
	}

	// Data export
	export: {
		events: (input: ExportEventsInput) => Promise<ExportResult>
		report: (input: ExportReportInput) => Promise<ExportResult>
	}

	// Scheduled reports
	scheduled: {
		list: () => Promise<ScheduledReport[]>
		create: (input: CreateScheduledReportInput) => Promise<ScheduledReport>
		update: (input: UpdateScheduledReportInput) => Promise<ScheduledReport>
		delete: (input: { id: string }) => Promise<void>
		execute: (input: { id: string }) => Promise<ReportExecution>
	}

	// Audit presets
	presets: {
		list: () => Promise<AuditPreset[]>
		get: (input: { name: string }) => Promise<AuditPreset | null>
		create: (input: CreatePresetInput) => Promise<AuditPreset>
		update: (input: UpdatePresetInput) => Promise<AuditPreset>
		delete: (input: { name: string }) => Promise<void>
	}

	// Metrics and monitoring
	metrics: {
		system: () => Promise<SystemMetrics>
		audit: (input: MetricsQueryInput) => Promise<AuditMetrics>
		performance: () => Promise<PerformanceMetrics>
	}

	// Alerts
	alerts: {
		list: (input: AlertQueryInput) => Promise<Alert[]>
		acknowledge: (input: { id: string }) => Promise<void>
		resolve: (input: { id: string; resolution: string }) => Promise<void>
	}
}
```

### 3. REST API Structure

```typescript
// REST API endpoints with OpenAPI documentation
interface RESTAPIEndpoints {
	// Health endpoints
	'GET /health': () => HealthStatus
	'GET /health/detailed': () => DetailedHealthStatus
	'GET /ready': () => ReadinessStatus

	// Audit events
	'POST /api/v1/audit/events': (body: CreateAuditEventRequest) => AuditEvent
	'GET /api/v1/audit/events': (query: QueryAuditEventsQuery) => PaginatedAuditEvents
	'GET /api/v1/audit/events/:id': (params: { id: string }) => AuditEvent
	'POST /api/v1/audit/events/:id/verify': (params: { id: string }) => IntegrityVerificationResult

	// Compliance reports
	'POST /api/v1/compliance/reports/hipaa': (body: ReportCriteriaRequest) => HIPAAReport
	'POST /api/v1/compliance/reports/gdpr': (body: ReportCriteriaRequest) => GDPRReport
	'POST /api/v1/compliance/reports/integrity': (body: IntegrityReportRequest) => IntegrityReport

	// Data export
	'POST /api/v1/export/events': (body: ExportEventsRequest) => Buffer
	'POST /api/v1/export/report': (body: ExportReportRequest) => Buffer

	// Scheduled reports
	'GET /api/v1/scheduled-reports': () => ScheduledReport[]
	'POST /api/v1/scheduled-reports': (body: CreateScheduledReportRequest) => ScheduledReport
	'PUT /api/v1/scheduled-reports/:id': (
		params: { id: string },
		body: UpdateScheduledReportRequest
	) => ScheduledReport
	'DELETE /api/v1/scheduled-reports/:id': (params: { id: string }) => void
	'POST /api/v1/scheduled-reports/:id/execute': (params: { id: string }) => ReportExecution

	// Audit presets
	'GET /api/v1/audit-presets': () => AuditPreset[]
	'GET /api/v1/audit-presets/:name': (params: { name: string }) => AuditPreset
	'POST /api/v1/audit-presets': (body: CreatePresetRequest) => AuditPreset
	'PUT /api/v1/audit-presets/:name': (
		params: { name: string },
		body: UpdatePresetRequest
	) => AuditPreset
	'DELETE /api/v1/audit-presets/:name': (params: { name: string }) => void

	// Metrics
	'GET /api/v1/metrics': () => SystemMetrics
	'GET /api/v1/metrics/audit': (query: MetricsQuery) => AuditMetrics

	// OpenAPI documentation
	'GET /api/docs': () => OpenAPISpec
	'GET /api/docs/swagger': () => SwaggerUI
}
```

### 4. GraphQL Schema

```graphql
# GraphQL schema for flexible audit data querying
type Query {
	# Health and system status
	health: HealthStatus!
	systemMetrics: SystemMetrics!

	# Audit events with flexible filtering
	auditEvents(
		filter: AuditEventFilter
		pagination: PaginationInput
		sort: SortInput
	): AuditEventConnection!

	auditEvent(id: ID!): AuditEvent

	# Compliance reports
	complianceReports(type: ComplianceReportType!, criteria: ReportCriteria!): ComplianceReport!

	# Scheduled reports
	scheduledReports: [ScheduledReport!]!
	scheduledReport(id: ID!): ScheduledReport

	# Audit presets
	auditPresets: [AuditPreset!]!
	auditPreset(name: String!): AuditPreset

	# Metrics and analytics
	auditMetrics(timeRange: TimeRangeInput!, groupBy: MetricsGroupBy): AuditMetrics!

	# Alerts
	alerts(filter: AlertFilter, pagination: PaginationInput): AlertConnection!
}

type Mutation {
	# Audit event operations
	createAuditEvent(input: CreateAuditEventInput!): AuditEvent!
	verifyAuditEvent(id: ID!): IntegrityVerificationResult!

	# Scheduled report operations
	createScheduledReport(input: CreateScheduledReportInput!): ScheduledReport!
	updateScheduledReport(id: ID!, input: UpdateScheduledReportInput!): ScheduledReport!
	deleteScheduledReport(id: ID!): Boolean!
	executeScheduledReport(id: ID!): ReportExecution!

	# Audit preset operations
	createAuditPreset(input: CreateAuditPresetInput!): AuditPreset!
	updateAuditPreset(name: String!, input: UpdateAuditPresetInput!): AuditPreset!
	deleteAuditPreset(name: String!): Boolean!

	# Alert operations
	acknowledgeAlert(id: ID!): Alert!
	resolveAlert(id: ID!, resolution: String!): Alert!
}

type Subscription {
	# Real-time audit events
	auditEventCreated(filter: AuditEventFilter): AuditEvent!

	# Real-time alerts
	alertCreated(severity: AlertSeverity): Alert!

	# System metrics updates
	systemMetricsUpdated: SystemMetrics!

	# Report execution status
	reportExecutionUpdated(reportId: ID!): ReportExecution!
}
```

### 5. Authentication and Authorization

```typescript
interface AuthenticationService {
	// Session management
	validateSession(sessionToken: string): Promise<Session | null>
	refreshSession(sessionToken: string): Promise<Session>

	// Authorization
	checkPermission(userId: string, resource: string, action: string): Promise<boolean>
	getUserRoles(userId: string): Promise<Role[]>

	// Organization context
	validateOrganizationAccess(userId: string, organizationId: string): Promise<boolean>
}

interface AuthorizationMiddleware {
	// RBAC enforcement
	requireRole(roles: string[]): MiddlewareHandler
	requirePermission(resource: string, action: string): MiddlewareHandler
	requireOrganizationAccess(): MiddlewareHandler

	// API key authentication for third-party access
	validateApiKey(): MiddlewareHandler
}
```

## Data Models

### 1. Enhanced Request/Response Models

```typescript
// TRPC Input/Output types
interface CreateAuditEventInput {
	action: string
	targetResourceType: string
	targetResourceId?: string
	principalId: string
	organizationId: string
	status: 'attempt' | 'success' | 'failure'
	outcomeDescription?: string
	dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
	sessionContext?: SessionContext
	metadata?: Record<string, any>
}

interface QueryAuditEventsInput {
	filter: {
		dateRange?: { startDate: string; endDate: string }
		principalIds?: string[]
		organizationIds?: string[]
		actions?: string[]
		statuses?: ('attempt' | 'success' | 'failure')[]
		dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
		resourceTypes?: string[]
		verifiedOnly?: boolean
	}
	pagination: {
		limit: number
		offset: number
	}
	sort?: {
		field: 'timestamp' | 'status' | 'action'
		direction: 'asc' | 'desc'
	}
}

interface PaginatedAuditEvents {
	events: AuditEvent[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
}
```

### 2. GraphQL Types

```typescript
// GraphQL type definitions
interface AuditEventConnection {
	edges: AuditEventEdge[]
	pageInfo: PageInfo
	totalCount: number
}

interface AuditEventEdge {
	node: AuditEvent
	cursor: string
}

interface PageInfo {
	hasNextPage: boolean
	hasPreviousPage: boolean
	startCursor?: string
	endCursor?: string
}
```

### 3. Monitoring and Metrics Models

```typescript
interface SystemMetrics {
	timestamp: string
	server: {
		uptime: number
		memoryUsage: {
			used: number
			total: number
			percentage: number
		}
		cpuUsage: {
			percentage: number
			loadAverage: number[]
		}
	}
	database: {
		connectionCount: number
		activeQueries: number
		averageQueryTime: number
	}
	redis: {
		connectionCount: number
		memoryUsage: number
		keyCount: number
	}
	api: {
		requestsPerSecond: number
		averageResponseTime: number
		errorRate: number
	}
}

interface AuditMetrics {
	timestamp: string
	eventsProcessed: number
	processingLatency: {
		average: number
		p95: number
		p99: number
	}
	integrityVerifications: {
		total: number
		passed: number
		failed: number
	}
	complianceReports: {
		generated: number
		scheduled: number
		failed: number
	}
}
```

## Error Handling

### 1. Unified Error Response Format

```typescript
interface APIError {
	code: string
	message: string
	details?: Record<string, any>
	timestamp: string
	requestId: string
	path?: string
}

// TRPC Error Handling
class TRPCErrorHandler {
	static handleError(error: Error, context: TRPCContext): TRPCError {
		const { error: errorService, logger } = context.services

		// Log error with context
		errorService.handleError(
			error,
			{
				requestId: context.requestId,
				userId: context.session?.session.userId,
				metadata: { path: context.path },
			},
			'trpc-api',
			context.procedure
		)

		// Return appropriate TRPC error
		if (error instanceof ValidationError) {
			return new TRPCError({
				code: 'BAD_REQUEST',
				message: error.message,
				cause: error.details,
			})
		}

		return new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'An unexpected error occurred',
		})
	}
}

// REST Error Handling
class RESTErrorHandler {
	static handleError(error: Error, c: Context): Response {
		const { error: errorService, logger } = c.get('services')

		errorService.handleError(
			error,
			{
				requestId: c.get('requestId'),
				metadata: {
					method: c.req.method,
					path: c.req.path,
					userAgent: c.req.header('user-agent'),
				},
			},
			'rest-api',
			c.req.path
		)

		if (error instanceof ValidationError) {
			return c.json(
				{
					code: 'VALIDATION_ERROR',
					message: error.message,
					details: error.details,
					timestamp: new Date().toISOString(),
					requestId: c.get('requestId'),
				},
				400
			)
		}

		return c.json(
			{
				code: 'INTERNAL_SERVER_ERROR',
				message: 'An unexpected error occurred',
				timestamp: new Date().toISOString(),
				requestId: c.get('requestId'),
			},
			500
		)
	}
}

// GraphQL Error Handling
class GraphQLErrorHandler {
	static formatError(error: GraphQLError): GraphQLFormattedError {
		// Log error with GraphQL context
		const extensions = error.extensions || {}

		return {
			message: error.message,
			locations: error.locations,
			path: error.path,
			extensions: {
				code: extensions.code || 'INTERNAL_ERROR',
				timestamp: new Date().toISOString(),
				requestId: extensions.requestId,
			},
		}
	}
}
```

### 2. Circuit Breaker Implementation

```typescript
interface CircuitBreakerConfig {
	failureThreshold: number
	recoveryTimeout: number
	monitoringPeriod: number
}

class CircuitBreaker {
	private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
	private failureCount = 0
	private lastFailureTime?: number

	constructor(private config: CircuitBreakerConfig) {}

	async execute<T>(operation: () => Promise<T>): Promise<T> {
		if (this.state === 'OPEN') {
			if (this.shouldAttemptReset()) {
				this.state = 'HALF_OPEN'
			} else {
				throw new Error('Circuit breaker is OPEN')
			}
		}

		try {
			const result = await operation()
			this.onSuccess()
			return result
		} catch (error) {
			this.onFailure()
			throw error
		}
	}

	private onSuccess(): void {
		this.failureCount = 0
		this.state = 'CLOSED'
	}

	private onFailure(): void {
		this.failureCount++
		this.lastFailureTime = Date.now()

		if (this.failureCount >= this.config.failureThreshold) {
			this.state = 'OPEN'
		}
	}

	private shouldAttemptReset(): boolean {
		return (
			this.lastFailureTime !== undefined &&
			Date.now() - this.lastFailureTime >= this.config.recoveryTimeout
		)
	}
}
```

## Testing Strategy

### 1. Unit Testing

```typescript
// TRPC procedure testing
describe('TRPC Audit Procedures', () => {
	test('should create audit event with valid input', async () => {
		const caller = appRouter.createCaller(mockContext)
		const result = await caller.events.create({
			action: 'data.read',
			targetResourceType: 'patient',
			principalId: 'user-123',
			organizationId: 'org-456',
			status: 'success',
			dataClassification: 'PHI',
		})

		expect(result).toMatchObject({
			action: 'data.read',
			status: 'success',
		})
	})
})

// REST API testing
describe('REST Compliance API', () => {
	test('should generate HIPAA report', async () => {
		const response = await request(app)
			.post('/api/v1/compliance/reports/hipaa')
			.send({
				criteria: {
					dateRange: {
						startDate: '2024-01-01',
						endDate: '2024-01-31',
					},
				},
			})
			.expect(200)

		expect(response.body).toHaveProperty('reportId')
		expect(response.body.reportType).toBe('HIPAA')
	})
})

// GraphQL testing
describe('GraphQL Audit Schema', () => {
	test('should query audit events with filters', async () => {
		const query = `
      query GetAuditEvents($filter: AuditEventFilter!) {
        auditEvents(filter: $filter) {
          edges {
            node {
              id
              action
              timestamp
            }
          }
        }
      }
    `

		const result = await graphql(schema, query, null, mockContext, {
			filter: { actions: ['data.read'] },
		})

		expect(result.errors).toBeUndefined()
		expect(result.data?.auditEvents.edges).toHaveLength(1)
	})
})
```

### 2. Integration Testing

```typescript
// End-to-end API testing
describe('API Integration Tests', () => {
	beforeAll(async () => {
		await setupTestDatabase()
		await setupTestRedis()
	})

	test('should handle complete audit workflow', async () => {
		// Create audit event via TRPC
		const trpcCaller = appRouter.createCaller(authenticatedContext)
		const event = await trpcCaller.events.create(validEventInput)

		// Query event via REST API
		const restResponse = await request(app)
			.get(`/api/v1/audit/events/${event.id}`)
			.set('Authorization', `Bearer ${authToken}`)
			.expect(200)

		// Query event via GraphQL
		const graphqlResult = await graphql(schema, auditEventQuery, null, authenticatedContext, {
			id: event.id,
		})

		// Verify consistency across all APIs
		expect(restResponse.body.id).toBe(event.id)
		expect(graphqlResult.data?.auditEvent.id).toBe(event.id)
	})
})
```

### 3. Performance Testing

```typescript
// Load testing configuration
describe('Performance Tests', () => {
	test('should handle high-throughput audit event creation', async () => {
		const concurrentRequests = 100
		const promises = Array.from({ length: concurrentRequests }, () =>
			request(app)
				.post('/api/v1/audit/events')
				.send(validEventData)
				.set('Authorization', `Bearer ${authToken}`)
		)

		const startTime = Date.now()
		const results = await Promise.all(promises)
		const endTime = Date.now()

		const successfulRequests = results.filter((r) => r.status === 201).length
		const averageResponseTime = (endTime - startTime) / concurrentRequests

		expect(successfulRequests).toBe(concurrentRequests)
		expect(averageResponseTime).toBeLessThan(100) // 100ms average
	})
})
```

### 4. Container Testing

```typescript
// Docker container testing
describe('Container Tests', () => {
	test('should start successfully with environment variables', async () => {
		const container = await docker.createContainer({
			Image: 'audit-server:test',
			Env: [
				'NODE_ENV=test',
				'DATABASE_URL=postgresql://test:test@localhost:5432/test',
				'REDIS_URL=redis://localhost:6379',
			],
			ExposedPorts: { '3000/tcp': {} },
		})

		await container.start()

		// Wait for health check
		await waitForHealthCheck('http://localhost:3000/health')

		const healthResponse = await fetch('http://localhost:3000/health')
		expect(healthResponse.status).toBe(200)

		await container.stop()
		await container.remove()
	})
})
```
