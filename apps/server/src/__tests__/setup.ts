/**
 * Test Setup Configuration
 *
 * Global test setup for the server application test suite.
 * Configures test environment, mocks, and utilities.
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import 'dotenv/config'

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_audit'
process.env.REDIS_URL = 'redis://localhost:6379/1'
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.BETTER_AUTH_URL = 'http://localhost:3000'

// Global test configuration
beforeAll(async () => {
	// Setup global test environment
	console.log('🧪 Setting up test environment...')
})

afterAll(async () => {
	// Cleanup global test environment
	console.log('🧹 Cleaning up test environment...')
})

beforeEach(() => {
	// Reset mocks before each test
	vi.clearAllMocks()
})

afterEach(() => {
	// Cleanup after each test
	vi.restoreAllMocks()
})

// TRPC test caller helper
export const createTRPCCaller = (router: any, context: any) => {
	return router.createCaller(context)
}

// Global test utilities
export const testUtils = {
	// Mock session for authenticated tests
	mockSession: {
		session: {
			id: 'test-session-id',
			userId: 'test-user-id',
			activeOrganizationId: 'test-org-id',
			expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
		},
		user: {
			id: 'test-user-id',
			email: 'test@example.com',
			name: 'Test User',
		},
	},

	// Mock services for testing
	mockServices: {
		audit: {
			log: vi.fn().mockResolvedValue(undefined),
			logAuth: vi.fn().mockResolvedValue(undefined),
			verifyEventHash: vi.fn().mockReturnValue(true),
			generateEventHash: vi.fn().mockReturnValue('mock-hash'),
		},
		logger: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		},
		error: {
			handleError: vi.fn().mockResolvedValue(undefined),
		},
		client: {
			executeMonitoredQuery: vi.fn(),
			executeOptimizedQuery: vi.fn(),
			generateCacheKey: vi.fn().mockReturnValue('mock-cache-key'),
		},
		authorization: {
			hasPermission: vi.fn().mockImplementation(async () => true),
			getUserRoles: vi.fn().mockResolvedValue(['user', 'admin']),
			validateOrganizationAccess: vi.fn().mockResolvedValue(true),
		},
		compliance: {
			export: {
				exportAuditEvents: vi.fn().mockResolvedValue({
					exportId: 'test-export-id',
					recordCount: 10,
					dataSize: 1024,
					format: 'json',
					exportTimestamp: new Date().toISOString(),
					data: Buffer.from('test-data'),
				}),
			},
			gdpr: {
				exportUserData: vi.fn().mockResolvedValue({
					requestId: 'test-request-id',
					recordCount: 5,
					dataSize: 512,
					format: 'json',
					exportTimestamp: new Date().toISOString(),
					metadata: {},
					data: Buffer.from('test-gdpr-data'),
				}),
				pseudonymizeUserData: vi.fn().mockResolvedValue({
					pseudonymId: 'test-pseudonym-id',
					recordsAffected: 3,
					timestamp: new Date().toISOString(),
				}),
			},
		},
		db: {
			audit: {
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockResolvedValue(undefined),
				}),
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([]),
							offset: vi.fn().mockReturnValue({
								orderBy: vi.fn().mockResolvedValue([]),
							}),
						}),
					}),
				}),
			},
		},
	},

	// Mock TRPC context
	mockTRPCContext: {
		services: {} as any, // Will be populated with mockServices
		session: {} as any, // Will be populated with mockSession
		requestId: 'test-request-id',
		location: 'test-location',
		userAgent: 'test-user-agent',
	},

	// Mock Hono context
	mockHonoContext: {
		req: {
			method: 'GET',
			path: '/test',
			header: vi.fn().mockReturnValue('test-header'),
			json: vi.fn().mockResolvedValue({}),
		},
		json: vi.fn().mockReturnValue(new Response()),
		get: vi.fn().mockReturnValue(undefined),
		set: vi.fn(),
		redirect: vi.fn().mockReturnValue(new Response()),
	},

	// Test data generators
	generateAuditEvent: (overrides = {}) => ({
		id: 1,
		timestamp: new Date().toISOString(),
		action: 'test.action',
		targetResourceType: 'test-resource',
		targetResourceId: 'test-resource-id',
		principalId: 'test-user-id',
		organizationId: 'test-org-id',
		status: 'success' as const,
		outcomeDescription: 'Test audit event',
		dataClassification: 'INTERNAL' as const,
		correlationId: 'test-correlation-id',
		hash: 'test-hash',
		...overrides,
	}),

	generateComplianceReport: (overrides = {}) => ({
		id: 'test-report-id',
		type: 'HIPAA' as const,
		criteria: {
			dateRange: {
				startDate: new Date().toISOString(),
				endDate: new Date().toISOString(),
			},
			organizationIds: ['test-org-id'],
			includeMetadata: true,
			format: 'JSON' as const,
		},
		generatedAt: new Date().toISOString(),
		status: 'completed',
		summary: {
			totalEvents: 100,
			verifiedEvents: 95,
			failedVerifications: 5,
			complianceScore: 0.95,
		},
		downloadUrl: 'https://example.com/download/test-report-id',
		...overrides,
	}),

	generateAlert: (overrides = {}) => ({
		id: 'test-alert-id',
		type: 'SYSTEM' as const,
		severity: 'MEDIUM' as const,
		title: 'Test Alert',
		description: 'This is a test alert',
		createdAt: new Date().toISOString(),
		acknowledgedAt: null,
		resolvedAt: null,
		acknowledgedBy: null,
		resolvedBy: null,
		resolution: null,
		metadata: {},
		...overrides,
	}),
}

// Initialize mock services in context
testUtils.mockTRPCContext.services = testUtils.mockServices
testUtils.mockTRPCContext.session = testUtils.mockSession
