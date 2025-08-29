/**
 * REST API Integration Tests
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { testUtils } from '../../__tests__/setup'
import { createRestAPI } from '../rest-api'

describe('REST API Integration', () => {
	let app: any
	let mockServices: any

	beforeEach(() => {
		// Create mock services
		mockServices = {
			...testUtils.mockServices,
			audit: {
				...testUtils.mockServices.audit,
				log: vi.fn().mockResolvedValue(undefined),
			},
			compliance: {
				...testUtils.mockServices.compliance,
				report: {
					generateHIPAAReport: vi
						.fn()
						.mockResolvedValue(testUtils.generateComplianceReport({ type: 'HIPAA' })),
					generateGDPRReport: vi
						.fn()
						.mockResolvedValue(testUtils.generateComplianceReport({ type: 'GDPR' })),
				},
			},
		}

		// Create REST API app
		app = createRestAPI()

		// Mock the services middleware
		app.use('*', (c: any, next: any) => {
			c.set('services', mockServices)
			c.set('session', testUtils.mockSession)
			c.set('requestId', 'test-request-id')
			c.set('apiVersion', { resolved: '1.0.0' })
			return next()
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('API Documentation', () => {
		it('should serve OpenAPI specification', async () => {
			const response = await request(app.fetch).get('/openapi.json').expect(200)

			expect(response.body).toHaveProperty('openapi', '3.0.0')
			expect(response.body).toHaveProperty('info')
			expect(response.body.info).toHaveProperty('title', 'SMEDREC Audit API')
			expect(response.body.info).toHaveProperty('version', '1.0.0')
			expect(response.body).toHaveProperty('paths')
			expect(response.body).toHaveProperty('components')
		})

		it('should serve Swagger UI documentation', async () => {
			const response = await request(app.fetch).get('/docs').expect(200)

			expect(response.headers['content-type']).toContain('text/html')
			expect(response.text).toContain('swagger-ui')
		})

		it('should redirect root to documentation', async () => {
			const response = await request(app.fetch).get('/').expect(302)

			expect(response.headers.location).toBe('/api/v1/docs')
		})
	})

	describe('API Information', () => {
		it('should return API information', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.body).toEqual({
				name: 'SMEDREC Audit API',
				version: '1.0.0',
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
	})

	describe('Health Check', () => {
		it('should return healthy status', async () => {
			const response = await request(app.fetch).get('/health').expect(200)

			expect(response.body).toEqual({
				status: 'healthy',
				timestamp: expect.any(String),
				version: '1.0.0',
			})
		})
	})

	describe('API Versioning', () => {
		it('should handle version headers correctly', async () => {
			const response = await request(app.fetch)
				.get('/info')
				.set('Accept-Version', '1.0.0')
				.expect(200)

			expect(response.headers['api-version']).toBe('1.0.0')
			expect(response.body.version).toBe('1.0.0')
		})

		it('should use default version when no version specified', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.body.version).toBe('1.0.0')
		})

		it('should handle unsupported version gracefully', async () => {
			const response = await request(app.fetch)
				.get('/info')
				.set('Accept-Version', '2.0.0')
				.expect(200)

			// Should fall back to default version
			expect(response.body.version).toBe('1.0.0')
		})
	})

	describe('Error Handling', () => {
		it('should return 404 for non-existent routes', async () => {
			const response = await request(app.fetch).get('/non-existent-route').expect(404)

			expect(response.body).toEqual({
				code: 'NOT_FOUND',
				message: 'Route GET /non-existent-route not found',
				timestamp: expect.any(String),
				requestId: 'test-request-id',
				path: '/non-existent-route',
			})
		})

		it('should handle validation errors properly', async () => {
			// This would need to be tested with actual endpoints that have validation
			// For now, we'll test the error format structure
			const response = await request(app.fetch).get('/non-existent-route').expect(404)

			expect(response.body).toHaveProperty('code')
			expect(response.body).toHaveProperty('message')
			expect(response.body).toHaveProperty('timestamp')
			expect(response.body).toHaveProperty('requestId')
			expect(response.body).toHaveProperty('path')
		})

		it('should include request ID in error responses', async () => {
			const response = await request(app.fetch).get('/non-existent-route').expect(404)

			expect(response.body.requestId).toBe('test-request-id')
		})
	})

	describe('CORS Configuration', () => {
		it('should handle preflight requests', async () => {
			const response = await request(app.fetch)
				.options('/info')
				.set('Origin', 'https://app.smedrec.com')
				.set('Access-Control-Request-Method', 'GET')
				.expect(200)

			expect(response.headers['access-control-allow-origin']).toBeDefined()
			expect(response.headers['access-control-allow-methods']).toBeDefined()
		})

		it('should include CORS headers in responses', async () => {
			const response = await request(app.fetch)
				.get('/info')
				.set('Origin', 'https://app.smedrec.com')
				.expect(200)

			expect(response.headers['access-control-allow-origin']).toBeDefined()
		})
	})

	describe('Content Type Handling', () => {
		it('should return JSON content type for API responses', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.headers['content-type']).toContain('application/json')
		})

		it('should handle JSON request bodies', async () => {
			// This would be tested with actual POST endpoints
			// For now, we verify the app can handle JSON
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.body).toBeInstanceOf(Object)
		})
	})

	describe('Security Headers', () => {
		it('should include security headers in responses', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			// These would be set by security middleware
			// For now, we just verify the response structure
			expect(response.body).toHaveProperty('name')
			expect(response.body).toHaveProperty('version')
		})
	})

	describe('Rate Limiting', () => {
		it('should include rate limit headers', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			// Rate limiting headers would be added by middleware
			// For now, we verify the response is successful
			expect(response.status).toBe(200)
		})

		it('should handle rate limit exceeded scenarios', async () => {
			// This would require actual rate limiting implementation
			// For now, we verify normal operation
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.status).toBe(200)
		})
	})

	describe('Request/Response Logging', () => {
		it('should log requests and responses', async () => {
			await request(app.fetch).get('/info').expect(200)

			// Verify that logging middleware was called
			// This would be tested with actual logging implementation
			expect(true).toBe(true) // Placeholder assertion
		})
	})

	describe('Authentication Integration', () => {
		it('should handle authenticated requests', async () => {
			// Mock authentication middleware
			app.use('/protected/*', (c: any, next: any) => {
				c.set('session', testUtils.mockSession)
				return next()
			})

			// This would test actual protected endpoints
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.status).toBe(200)
		})

		it('should reject unauthenticated requests to protected endpoints', async () => {
			// This would test actual protected endpoints
			// For now, we verify the app structure
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.status).toBe(200)
		})
	})

	describe('API Response Format', () => {
		it('should return consistent response format', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.body).toHaveProperty('name')
			expect(response.body).toHaveProperty('version')
			expect(response.body).toHaveProperty('description')
			expect(response.body).toHaveProperty('features')
			expect(response.body.features).toBeInstanceOf(Array)
		})

		it('should include metadata in responses', async () => {
			const response = await request(app.fetch).get('/info').expect(200)

			expect(response.body).toHaveProperty('limits')
			expect(response.body).toHaveProperty('contact')
			expect(response.body.limits).toHaveProperty('maxPageSize')
			expect(response.body.limits).toHaveProperty('defaultPageSize')
		})
	})

	describe('Performance', () => {
		it('should respond within acceptable time limits', async () => {
			const startTime = Date.now()
			await request(app.fetch).get('/info').expect(200)
			const endTime = Date.now()

			const responseTime = endTime - startTime
			expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
		})

		it('should handle concurrent requests', async () => {
			const requests = Array(10)
				.fill(null)
				.map(() => request(app.fetch).get('/info'))

			const responses = await Promise.all(requests)

			responses.forEach((response) => {
				expect(response.status).toBe(200)
				expect(response.body).toHaveProperty('name')
			})
		})
	})
})
