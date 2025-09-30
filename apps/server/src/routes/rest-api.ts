/**
 * @fileoverview Main REST API Router with OpenAPI Documentation
 *
 * Combines all REST API endpoints with comprehensive OpenAPI/Swagger documentation:
 * - Audit Events API
 * - Compliance API
 * - Metrics API
 * - OpenAPI documentation generation
 * - Swagger UI integration
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { apiVersion } from '@/lib/middleware/api-version'
import {
	requireAuth,
	requireAuthOrApiKey,
	requireOrganizationAccess,
	requireRole,
} from '@/lib/middleware/auth'
import { errorHandler, notFoundHandler } from '@/lib/middleware/error-handler'
import { adaptiveRateLimit, rateLimit } from '@/lib/middleware/rate-limit'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono, z } from '@hono/zod-openapi'

import { createAuditAPI } from './audit-api'
import { createComplianceAPI } from './compliance-api'
import { createFunctionsAPI } from './functions-api'
import { createHealthAPI } from './health-api'
import { createMetricsAPI } from './metrics-api'
import { createObservabilityAPI } from './observability-api'
import { createOrganizationAPI } from './organization-api'
import { createPerformanceAPI } from './performance-api'

import type { HonoEnv } from '@/lib/hono/context'

/**
 * Create the main REST API router with OpenAPI documentation
 */
export function createRestAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>({
		defaultHook: (result, c) => {
			if (!result.success) {
				return c.json(
					{
						code: 'VALIDATION_ERROR',
						message: 'Request validation failed',
						details: {
							issues: result.error.issues.map((issue) => ({
								path: issue.path.join('.'),
								message: issue.message,
								code: issue.code,
							})),
						},
						timestamp: new Date().toISOString(),
						requestId: c.get('requestId') || 'unknown',
						path: c.req.path,
					},
					400
				)
			}
		},
	})

	// Configure OpenAPI documentation
	app.doc('/openapi.json', (c) => ({
		openapi: '3.0.0',
		info: {
			title: 'SMEDREC Audit API',
			version: '1.0.0',
			description: `
# SMEDREC Audit System REST API

This API provides comprehensive access to the SMEDREC healthcare audit system through RESTful endpoints.

## Features

- **Audit Events**: Create, query, and verify audit events
- **Compliance Reports**: Generate HIPAA, GDPR, and custom compliance reports
- **Metrics & Monitoring**: System health, performance metrics, and alerts
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **API Versioning**: Header-based versioning with backward compatibility
- **Authentication**: Session-based authentication with role-based access control

## Authentication

All API endpoints require authentication. Include your session token in the request:

\`\`\`
Authorization: Bearer <session-token>
\`\`\`

## API Versioning

Specify the API version using the Accept-Version header:

\`\`\`
Accept-Version: 1.0.0
\`\`\`

If no version is specified, the latest stable version will be used.

## Rate Limiting

API endpoints are rate limited to ensure fair usage:

- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Read operations**: 1000 requests per minute per user
- **Write operations**: 100 requests per minute per user
- **Public endpoints**: 60 requests per minute per IP

Rate limit information is included in response headers:

- \`X-RateLimit-Limit\`: Request limit for the current window
- \`X-RateLimit-Remaining\`: Remaining requests in the current window
- \`X-RateLimit-Reset\`: Time when the rate limit window resets

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {},
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_123456789",
  "path": "/api/v1/events"
}
\`\`\`

## Pagination

List endpoints support pagination using query parameters:

- \`limit\`: Number of items per page (default: 50, max: 100)
- \`offset\`: Number of items to skip (default: 0)

Pagination information is included in the response:

\`\`\`json
{
  "data": [...],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "hasNext": true,
    "hasPrevious": false
  }
}
\`\`\`
			`,
			contact: {
				name: 'SMEDREC Support',
				email: 'support@smedrec.com',
				url: 'https://smedrec.com/support',
			},
			license: {
				name: 'Proprietary',
				url: 'https://smedrec.com/license',
			},
		},
		servers: [
			{
				url: 'https://api.smedrec.com',
				description: 'Production server',
			},
			{
				url: 'https://staging-api.smedrec.com',
				description: 'Staging server',
			},
			{
				url: 'http://localhost:3000/api/v1',
				description: 'Development server',
			},
		],
		components: {
			securitySchemes: {
				cookieAuth: {
					type: 'apiKey',
					in: 'cookie',
					name: 'better-auth.session_token',
				},
				BearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
					description: 'Session token obtained from authentication',
				},
				ApiKeyAuth: {
					type: 'apiKey',
					in: 'header',
					name: 'X-API-Key',
					description: 'API key for third-party integrations',
				},
			},
		},
		security: [
			{
				cookieAuth: [],
				BearerAuth: [],
				ApiKeyAuth: [],
			},
		],
		tags: [
			{
				name: 'Audit Events',
				description: 'Operations for managing audit events',
			},
			{
				name: 'Compliance',
				description: 'Compliance reporting and data export operations',
			},
			{
				name: 'Metrics',
				description: 'System metrics and monitoring operations',
			},
			{
				name: 'Health',
				description: 'Health check and system status operations',
			},
			{
				name: 'Alerts',
				description: 'Alert management operations',
			},
			{
				name: 'Organization',
				description: 'Organization configuration API',
			},
		],
	}))

	app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
		type: 'http',
		scheme: 'bearer',
	})

	// Add global middleware
	app.use('*', errorHandler())

	// API versioning middleware
	app.use(
		'*',
		apiVersion({
			currentVersion: '1.0.0',
			supportedVersions: ['1.0.0'],
			deprecatedVersions: [],
			defaultVersion: '1.0.0',
			headerName: 'Accept-Version',
			responseHeaderName: 'API-Version',
			strictVersioning: false,
		})
	)

	// Rate limiting middleware
	app.use('*', adaptiveRateLimit())

	// Authentication middleware for protected routes
	app.use('/audit/*', requireAuthOrApiKey)
	app.use('/compliance/*', requireAuthOrApiKey)
	app.use('/metrics/*', requireAuthOrApiKey)
	app.use('/observability/*', requireAuthOrApiKey)
	app.use('/performance/*', requireAuthOrApiKey)
	app.use('/functions/*', requireAuthOrApiKey)
	app.use('/organization/*', requireAuthOrApiKey)

	// Organization access control for audit and compliance endpoints
	app.use('/audit/*', requireOrganizationAccess())
	app.use('/compliance/*', requireOrganizationAccess())
	app.use('/functions/*', requireOrganizationAccess())
	app.use('/organization/*', requireOrganizationAccess())

	// Admin-only access for system metrics and observability
	app.use('/metrics/system/*', requireRole(['admin']))
	app.use('/observability/*', requireRole(['admin']))
	app.use('/performance/*', requireRole(['admin']))

	// Mount API routes
	app.route('/audit', createAuditAPI())
	app.route('/compliance', createComplianceAPI())
	app.route('/health', createHealthAPI()) // Health check endpoints (no authentication required)
	app.route('/metrics', createMetricsAPI())
	app.route('/observability', createObservabilityAPI())
	app.route('/performance', createPerformanceAPI())
	app.route('/functions', createFunctionsAPI())
	app.route('/organization', createOrganizationAPI())

	// Swagger UI
	app.get(
		'/docs',
		swaggerUI({
			url: '/api/v1/openapi.json',
		})
	)

	// API documentation redirect
	app.get('/', (c) => {
		return c.redirect('/api/v1/docs')
	})

	// API information endpoint
	app.get('/info', (c) => {
		const versionInfo = c.get('apiVersion')

		return c.json({
			name: 'SMEDREC Audit API',
			version: versionInfo?.resolved || '1.0.0',
			description: 'REST API for the SMEDREC healthcare audit system',
			documentation: '/api/v1/docs',
			openapi: '/api/v1/openapi.json',
			features: [
				'audit-events',
				'compliance-reports',
				'metrics-monitoring',
				'rate-limiting',
				'api-versioning',
			],
			limits: {
				maxPageSize: 100,
				defaultPageSize: 50,
				maxQueryComplexity: 1000,
			},
			contact: {
				support: 'support@smedrec.com',
				documentation: 'https://docs.smedrec.com',
			},
		})
	})

	// Handle 404 for unmatched routes
	app.notFound((c) => {
		const requestId = c.get('requestId') || 'unknown'

		const errorResponse = {
			code: 'NOT_FOUND',
			message: `Route ${c.req.method} ${c.req.path} not found`,
			timestamp: new Date().toISOString(),
			requestId,
			path: c.req.path,
		}

		return c.json(errorResponse, 404)
	})

	return app
}
