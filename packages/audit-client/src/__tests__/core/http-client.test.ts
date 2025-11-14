import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpClient } from '../../core/http-client'

import type { AuditClientConfig } from '../../core/config'
import type { AuthManager } from '../../infrastructure/auth'
import type { Logger } from '../../infrastructure/logger'

describe('HttpClient', () => {
	let httpClient: HttpClient
	let mockConfig: AuditClientConfig
	let mockAuthManager: AuthManager
	let mockLogger: Logger
	let mockFetch: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Mock logger
		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}

		// Mock auth manager
		mockAuthManager = {
			getAuthHeaders: vi.fn().mockResolvedValue({ 'X-API-Key': 'test-key' }),
		} as any

		// Mock config
		mockConfig = {
			baseUrl: 'https://api.example.com',
			apiVersion: 'v1',
			timeout: 30000,
			authentication: {
				type: 'apiKey',
				apiKey: 'test-key',
				autoRefresh: false,
			},
			customHeaders: {
				'X-Custom-Header': 'custom-value',
			},
			logging: {
				enabled: true,
				level: 'info',
				format: 'text',
				includeRequestBody: false,
				includeResponseBody: false,
				maskSensitiveData: true,
				sensitiveFields: [],
				maxLogSize: 10000,
				enableConsole: true,
				enableBuffer: false,
				bufferSize: 1000,
			},
		} as AuditClientConfig

		// Mock fetch
		mockFetch = vi.fn()
		global.fetch = mockFetch

		httpClient = new HttpClient(mockConfig, mockAuthManager, mockLogger)
	})

	describe('request method', () => {
		it('should make a successful GET request', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'application/json' }),
				json: vi.fn().mockResolvedValue({ data: 'test' }),
				text: vi.fn().mockResolvedValue('{"data":"test"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test', {
				method: 'GET',
			})

			expect(response.status).toBe(200)
			expect(response.data).toEqual({ data: 'test' })
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/test',
				expect.objectContaining({
					method: 'GET',
					credentials: 'include',
				})
			)
		})

		it('should make a successful POST request', async () => {
			const mockResponse = {
				ok: true,
				status: 201,
				statusText: 'Created',
				headers: new Headers({ 'content-type': 'application/json' }),
				json: vi.fn().mockResolvedValue({ id: '123' }),
				text: vi.fn().mockResolvedValue('{"id":"123"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const requestBody = { name: 'test' }
			const response = await httpClient.request('https://api.example.com/test', {
				method: 'POST',
				body: requestBody,
			})

			expect(response.status).toBe(201)
			expect(response.data).toEqual({ id: '123' })
			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/test',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify(requestBody),
				})
			)
		})

		it('should make a successful PUT request', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'application/json' }),
				json: vi.fn().mockResolvedValue({ updated: true }),
				text: vi.fn().mockResolvedValue('{"updated":true}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test/123', {
				method: 'PUT',
				body: { name: 'updated' },
			})

			expect(response.status).toBe(200)
			expect(response.data).toEqual({ updated: true })
		})

		it('should make a successful DELETE request', async () => {
			const mockResponse = {
				ok: true,
				status: 204,
				statusText: 'No Content',
				headers: new Headers({ 'content-length': '0' }),
				json: vi.fn(),
				text: vi.fn().mockResolvedValue(''),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test/123', {
				method: 'DELETE',
			})

			expect(response.status).toBe(204)
			expect(response.data).toEqual({})
		})
	})

	describe('buildHeaders', () => {
		it('should include auth headers', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await httpClient.request('https://api.example.com/test')

			const callArgs = mockFetch.mock.calls[0][1]
			const headers = callArgs.headers as Headers
			expect(headers.get('X-API-Key')).toBe('test-key')
		})

		it('should include custom headers from config', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await httpClient.request('https://api.example.com/test')

			const callArgs = mockFetch.mock.calls[0][1]
			const headers = callArgs.headers as Headers
			expect(headers.get('X-Custom-Header')).toBe('custom-value')
		})

		it('should include request-specific custom headers', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await httpClient.request('https://api.example.com/test', {
				headers: { 'X-Request-Header': 'request-value' },
			})

			const callArgs = mockFetch.mock.calls[0][1]
			const headers = callArgs.headers as Headers
			expect(headers.get('X-Request-Header')).toBe('request-value')
		})

		it('should include request ID header when provided', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await httpClient.request('https://api.example.com/test', {
				requestId: 'test-request-id',
			})

			const callArgs = mockFetch.mock.calls[0][1]
			const headers = callArgs.headers as Headers
			expect(headers.get('X-Request-ID')).toBe('test-request-id')
		})

		it('should include API version header', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await httpClient.request('https://api.example.com/test')

			const callArgs = mockFetch.mock.calls[0][1]
			const headers = callArgs.headers as Headers
			expect(headers.get('Accept-Version')).toBe('v1')
		})
	})

	describe('buildBody', () => {
		it('should serialize JSON body', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const body = { name: 'test', value: 123 }
			await httpClient.request('https://api.example.com/test', {
				method: 'POST',
				body,
			})

			const callArgs = mockFetch.mock.calls[0][1]
			expect(callArgs.body).toBe(JSON.stringify(body))
		})

		it('should handle FormData body', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const formData = new FormData()
			formData.append('key', 'value')

			await httpClient.request('https://api.example.com/test', {
				method: 'POST',
				body: formData,
			})

			const callArgs = mockFetch.mock.calls[0][1]
			expect(callArgs.body).toBe(formData)
		})

		it('should handle Blob body', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const blob = new Blob(['test'], { type: 'text/plain' })

			await httpClient.request('https://api.example.com/test', {
				method: 'POST',
				body: blob,
			})

			const callArgs = mockFetch.mock.calls[0][1]
			expect(callArgs.body).toBe(blob)
		})

		it('should handle string body', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				json: vi.fn().mockResolvedValue({}),
				text: vi.fn().mockResolvedValue('{}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const body = 'plain text body'

			await httpClient.request('https://api.example.com/test', {
				method: 'POST',
				body,
			})

			const callArgs = mockFetch.mock.calls[0][1]
			expect(callArgs.body).toBe(body)
		})
	})

	describe('parseResponse', () => {
		it('should parse JSON response', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'application/json' }),
				json: vi.fn().mockResolvedValue({ data: 'test' }),
				text: vi.fn().mockResolvedValue('{"data":"test"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test', {
				responseType: 'json',
			})

			expect(response.data).toEqual({ data: 'test' })
		})

		it('should parse text response', async () => {
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'text/plain' }),
				text: vi.fn().mockResolvedValue('plain text'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test', {
				responseType: 'text',
			})

			expect(response.data).toBe('plain text')
		})

		it('should parse blob response', async () => {
			const mockBlob = new Blob(['test'], { type: 'application/octet-stream' })
			const mockResponse = {
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'content-type': 'application/octet-stream' }),
				blob: vi.fn().mockResolvedValue(mockBlob),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test', {
				responseType: 'blob',
			})

			expect(response.data).toBe(mockBlob)
		})

		it('should handle empty response', async () => {
			const mockResponse = {
				ok: true,
				status: 204,
				statusText: 'No Content',
				headers: new Headers({ 'content-length': '0' }),
				text: vi.fn().mockResolvedValue(''),
			}
			mockFetch.mockResolvedValue(mockResponse)

			const response = await httpClient.request('https://api.example.com/test')

			expect(response.data).toEqual({})
		})
	})

	describe('createHttpError', () => {
		it('should create HttpError on 400 response', async () => {
			const mockResponse = {
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				headers: new Headers(),
				clone: vi.fn().mockReturnThis(),
				json: vi.fn().mockResolvedValue({ error: 'Invalid input' }),
				text: vi.fn().mockResolvedValue('{"error":"Invalid input"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await expect(httpClient.request('https://api.example.com/test')).rejects.toThrow()
		})

		it('should create HttpError on 401 response', async () => {
			const mockResponse = {
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				headers: new Headers(),
				clone: vi.fn().mockReturnThis(),
				json: vi.fn().mockResolvedValue({ error: 'Unauthorized' }),
				text: vi.fn().mockResolvedValue('{"error":"Unauthorized"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await expect(httpClient.request('https://api.example.com/test')).rejects.toThrow()
		})

		it('should create HttpError on 404 response', async () => {
			const mockResponse = {
				ok: false,
				status: 404,
				statusText: 'Not Found',
				headers: new Headers(),
				clone: vi.fn().mockReturnThis(),
				json: vi.fn().mockResolvedValue({ error: 'Not found' }),
				text: vi.fn().mockResolvedValue('{"error":"Not found"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await expect(httpClient.request('https://api.example.com/test')).rejects.toThrow()
		})

		it('should create HttpError on 500 response', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				headers: new Headers(),
				clone: vi.fn().mockReturnThis(),
				json: vi.fn().mockResolvedValue({ error: 'Server error' }),
				text: vi.fn().mockResolvedValue('{"error":"Server error"}'),
			}
			mockFetch.mockResolvedValue(mockResponse)

			await expect(httpClient.request('https://api.example.com/test')).rejects.toThrow()
		})
	})
})
