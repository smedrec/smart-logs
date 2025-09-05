import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseResource } from '../../core/base-resource'
import { AuditLogger, LoggerFactory } from '../../infrastructure/logger'

import type { AuditClientConfig } from '../../core/config'
import type { CustomLogger, LogEntry } from '../../infrastructure/logger'

// Mock fetch for testing
global.fetch = vi.fn()

class TestResource extends BaseResource {
	constructor(config: AuditClientConfig) {
		super(config)
	}

	async testRequest(endpoint: string) {
		return this.request(endpoint, { method: 'GET' })
	}
}

describe('Logging Integration', () => {
	let mockCustomLogger: CustomLogger & { logs: LogEntry[] }
	let config: AuditClientConfig

	beforeEach(() => {
		mockCustomLogger = {
			logs: [],
			log: vi.fn().mockImplementation((entry: LogEntry) => {
				mockCustomLogger.logs.push(entry)
			}),
		}

		config = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
			},
			cache: {
				enabled: false,
				storage: 'memory',
			},
			retry: {
				enabled: false,
			},
			batching: {
				enabled: false,
			},
			performance: {},
			errorHandling: {},
			logging: {
				enabled: true,
				level: 'debug',
				format: 'json',
				includeRequestBody: true,
				includeResponseBody: true,
				maskSensitiveData: true,
				enableConsole: false,
				enableBuffer: false,
			},
		}

		// Reset fetch mock
		vi.mocked(fetch).mockReset()
	})

	it('should log HTTP requests and responses', async () => {
		// Mock successful response
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ success: true, data: 'test' }),
		} as any)

		const logger = LoggerFactory.create(config.logging, mockCustomLogger)
		const resource = new TestResource(config)

		// Replace the logger in the resource
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// Should have logged request and response
		expect(mockCustomLogger.logs.length).toBeGreaterThanOrEqual(2)

		// Check request log
		const requestLog = mockCustomLogger.logs.find(
			(log) => log.message.includes('HTTP GET') && log.message.includes('/test-endpoint')
		)
		expect(requestLog).toBeDefined()
		expect(requestLog?.metadata?.type).toBe('request')

		// Check response log
		const responseLog = mockCustomLogger.logs.find((log) => log.message.includes('HTTP 200 OK'))
		expect(responseLog).toBeDefined()
		expect(responseLog?.metadata?.type).toBe('response')
		expect(responseLog?.metadata?.status).toBe(200)
	})

	it('should mask sensitive data in logs', async () => {
		// Mock successful response
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([
				['content-type', 'application/json'],
				['authorization', 'Bearer secret-token'],
			]),
			json: async () => ({
				success: true,
				token: 'secret-response-token',
				data: 'normal-data',
			}),
		} as any)

		const logger = LoggerFactory.create(config.logging, mockCustomLogger)
		const resource = new TestResource(config)
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// Find response log
		const responseLog = mockCustomLogger.logs.find((log) => log.message.includes('HTTP 200 OK'))

		expect(responseLog).toBeDefined()

		// Check that sensitive data is masked
		if (responseLog?.metadata?.body) {
			expect(responseLog.metadata.body.token).toBe('*********************')
			expect(responseLog.metadata.body.data).toBe('normal-data')
		}

		if (responseLog?.metadata?.headers) {
			expect(responseLog.metadata.headers.authorization).toBe('********************')
		}
	})

	it('should log errors with context', async () => {
		// Mock error response
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ error: 'Database connection failed' }),
			clone: () => ({
				json: async () => ({ error: 'Database connection failed' }),
				text: async () => 'Database connection failed',
			}),
		} as any)

		const logger = LoggerFactory.create(config.logging, mockCustomLogger)
		const resource = new TestResource(config)
		;(resource as any).logger = logger

		try {
			await resource.testRequest('/test-endpoint')
		} catch (error) {
			// Expected to throw
		}

		// Should have logged the error response
		const errorLog = mockCustomLogger.logs.find((log) => log.message.includes('HTTP 500'))
		expect(errorLog).toBeDefined()
		expect(errorLog?.level).toBe('error')
		expect(errorLog?.metadata?.status).toBe(500)
	})

	it('should include request correlation IDs', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ success: true }),
		} as any)

		const logger = LoggerFactory.create(config.logging, mockCustomLogger)
		const resource = new TestResource(config)
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// All logs should have request IDs
		const logsWithRequestId = mockCustomLogger.logs.filter((log) => log.requestId)
		expect(logsWithRequestId.length).toBeGreaterThan(0)

		// All request IDs should be the same for this request
		const requestIds = logsWithRequestId.map((log) => log.requestId)
		const uniqueRequestIds = [...new Set(requestIds)]
		expect(uniqueRequestIds.length).toBe(1)
	})

	it('should respect log level configuration', async () => {
		// Configure logger to only log warnings and errors
		const warnConfig = {
			...config,
			logging: {
				...config.logging,
				level: 'warn' as const,
			},
		}

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ success: true }),
		} as any)

		const logger = LoggerFactory.create(warnConfig.logging, mockCustomLogger)
		const resource = new TestResource(warnConfig)
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// Should have fewer logs due to higher log level
		const infoLogs = mockCustomLogger.logs.filter((log) => log.level === 'info')
		const debugLogs = mockCustomLogger.logs.filter((log) => log.level === 'debug')

		expect(infoLogs.length).toBe(0)
		expect(debugLogs.length).toBe(0)
	})

	it('should work with disabled logging', async () => {
		const disabledConfig = {
			...config,
			logging: {
				...config.logging,
				enabled: false,
			},
		}

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ success: true }),
		} as any)

		const logger = LoggerFactory.create(disabledConfig.logging, mockCustomLogger)
		const resource = new TestResource(disabledConfig)
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// Should have no logs when logging is disabled
		expect(mockCustomLogger.logs.length).toBe(0)
	})

	it('should handle different log formats', async () => {
		const structuredConfig = {
			...config,
			logging: {
				...config.logging,
				format: 'structured' as const,
			},
		}

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['content-type', 'application/json']]),
			json: async () => ({ success: true }),
		} as any)

		const logger = LoggerFactory.create(structuredConfig.logging, mockCustomLogger)
		const resource = new TestResource(structuredConfig)
		;(resource as any).logger = logger

		await resource.testRequest('/test-endpoint')

		// Should have logs in the expected format
		expect(mockCustomLogger.logs.length).toBeGreaterThan(0)

		// All logs should have the expected structure
		mockCustomLogger.logs.forEach((log) => {
			expect(log).toHaveProperty('timestamp')
			expect(log).toHaveProperty('level')
			expect(log).toHaveProperty('message')
		})
	})
})
