import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseResource, KmsApiError, KmsError } from '../../base'

import type { InfisicalKmsClientConfig } from '../../types'

const mockConfig: InfisicalKmsClientConfig = {
	baseUrl: 'https://kms.example.com',
	accessToken: 'test-token',
	encryptionKey: 'key-encryption-123',
	signingKey: 'key-signing-456',
}

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

class TestResource extends BaseResource {}

describe('BaseResource', () => {
	let resource: TestResource

	beforeEach(() => {
		resource = new TestResource(mockConfig)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('request', () => {
		it('should make a successful request', async () => {
			const mockData = { success: true }
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockData,
			})

			const result = await resource.request('/test-path')

			expect(result).toEqual(mockData)
			expect(mockFetch).toHaveBeenCalledWith(
				`${mockConfig.baseUrl}/api/v1/kms/keys/test-path`,
				expect.any(Object)
			)
		})

		it('should throw KmsApiError on non-ok response', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				text: async () => '{"error":"Not found"}',
			})

			await expect(resource.request('/not-found')).rejects.toThrow(KmsApiError)
		})

		it('should retry on failure', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true }),
			})

			const result = await resource.request('/retry-path', {})

			expect(result).toEqual({ success: true })
			expect(mockFetch).toHaveBeenCalledTimes(2)
		})

		it('should throw KmsError after all retries fail', async () => {
			mockFetch.mockRejectedValue(new Error('Persistent network error'))

			await expect(resource.request('/fail-path')).rejects.toThrow(KmsError)
			expect(mockFetch).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
		})
	})
})

describe('KmsError', () => {
	it('should create an instance of KmsError', () => {
		const error = new KmsError('Custom error message')
		expect(error).toBeInstanceOf(KmsError)
		expect(error.message).toBe('Custom error message')
		expect(error.name).toBe('KmsError')
	})
})

describe('KmsApiError', () => {
	it('should create an instance of KmsApiError with status', () => {
		const error = new KmsApiError('API error', 404, 'Not Found')
		expect(error).toBeInstanceOf(KmsApiError)
		expect(error.message).toBe('API error (Status: 404 Not Found)')
		expect(error.status).toBe(404)
		expect(error.statusText).toBe('Not Found')
	})
})
