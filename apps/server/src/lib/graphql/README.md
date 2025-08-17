# GraphQL API Implementation

This directory contains the complete GraphQL API implementation for the audit system server.

## Overview

The GraphQL API provides flexible querying capabilities for audit operations, compliance reporting, and system monitoring. It supports:

- **Queries**: Retrieve audit events, compliance reports, system metrics, and more
- **Mutations**: Create audit events, manage scheduled reports, and handle alerts
- **Subscriptions**: Real-time updates for audit events, alerts, and system metrics
- **Authentication**: Session-based authentication with organization isolation
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Architecture

### Files Structure

```
src/lib/graphql/
├── types.ts              # TypeScript type definitions
├── schema.ts             # GraphQL schema definition (SDL)
├── server.ts             # GraphQL Yoga server setup
├── index.ts              # Module exports
├── resolvers/
│   ├── index.ts          # Combined resolvers
│   ├── audit-events.ts   # Audit event operations
│   ├── health.ts         # Health check queries
│   ├── metrics.ts        # System and audit metrics
│   ├── compliance.ts     # Compliance reporting
│   ├── scheduled-reports.ts # Scheduled report management
│   ├── audit-presets.ts  # Audit preset management
│   ├── alerts.ts         # Alert management
│   └── subscriptions.ts  # Real-time subscriptions
└── __tests__/
    ├── integration.test.ts
    ├── debug-schema.test.ts
    └── graphql-server.test.ts
```

## Features Implemented

### 1. Schema-First Approach (Requirement 3.1)

- Comprehensive GraphQL schema defined in `schema.ts`
- Type-safe resolvers with full TypeScript support
- Custom scalar types for DateTime and JSON

### 2. Comprehensive Audit Operations (Requirement 3.2)

- Query audit events with flexible filtering and pagination
- Create audit events with validation
- Verify audit event integrity
- Generate compliance reports (HIPAA, GDPR, Integrity, Custom)
- Manage scheduled reports and audit presets

### 3. Real-time Subscriptions (Requirement 3.3)

- Audit event creation notifications
- Alert notifications with severity filtering
- System metrics updates
- Report execution status updates

### 4. Flexible Querying (Requirement 3.4)

- Connection-based pagination with cursors
- Advanced filtering options
- Sorting capabilities
- Field selection optimization

### 5. Authentication Integration (Requirement 3.5)

- Session-based authentication
- Organization-level access control
- Protected queries and mutations
- WebSocket authentication for subscriptions

## Usage Examples

### Basic Health Check Query

```graphql
query {
	health {
		status
		timestamp
		checks {
			name
			status
			message
		}
	}
}
```

### Query Audit Events with Filtering

```graphql
query GetAuditEvents($filter: AuditEventFilter, $pagination: PaginationInput) {
	auditEvents(filter: $filter, pagination: $pagination) {
		edges {
			node {
				id
				timestamp
				action
				status
				principalId
				organizationId
			}
			cursor
		}
		pageInfo {
			hasNextPage
			hasPreviousPage
			startCursor
			endCursor
		}
		totalCount
	}
}
```

### Create Audit Event

```graphql
mutation CreateAuditEvent($input: CreateAuditEventInput!) {
	createAuditEvent(input: $input) {
		id
		timestamp
		action
		status
		integrityStatus
	}
}
```

### Generate Compliance Report

```graphql
query GenerateHIPAAReport($criteria: ReportCriteriaInput!) {
	complianceReports(type: HIPAA, criteria: $criteria) {
		id
		type
		generatedAt
		status
		summary {
			totalEvents
			verifiedEvents
			failedVerifications
			complianceScore
		}
	}
}
```

### Real-time Audit Event Subscription

```graphql
subscription AuditEventUpdates($filter: AuditEventFilter) {
	auditEventCreated(filter: $filter) {
		id
		timestamp
		action
		status
		organizationId
	}
}
```

## Configuration

The GraphQL API is configured in the main server configuration:

```typescript
api: {
  enableGraphql: true,
  graphqlPath: '/graphql',
}
```

## Development

### GraphQL Playground

In development mode, GraphQL Playground is available at `/graphql` for interactive query testing.

### Introspection

Schema introspection is enabled in development and disabled in production for security.

### Error Handling

- Structured error responses with proper error codes
- Error masking in production
- Comprehensive logging with request correlation

### Testing

Run GraphQL tests:

```bash
pnpm vitest src/lib/graphql/__tests__/ --run
```

## Security Features

- Authentication required for protected operations
- Organization-level data isolation
- Input validation using Zod schemas
- Rate limiting (handled by server middleware)
- Error masking in production
- Query depth limiting (configurable)

## Performance Optimizations

- Efficient database queries with proper indexing
- Connection pooling
- Caching strategies (when implemented)
- Pagination to handle large datasets
- Field selection optimization

## Integration with Existing Services

The GraphQL API integrates seamlessly with:

- TRPC API (shared service layer)
- REST API (shared authentication)
- Audit service packages
- Database layer
- Redis for subscriptions
- Better Auth for authentication

## Monitoring and Observability

- Request logging with correlation IDs
- Error tracking and reporting
- Performance metrics collection
- Health check endpoints
- Real-time system metrics
