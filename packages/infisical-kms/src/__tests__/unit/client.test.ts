import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { InfisicalKmsClient, KmsApiError, KmsError } from '../../index'

import type { DecryptResponse, EncryptResponse, SignResponse, VerifyResponse } from '../../types'

const mockConfig = {
	baseUrl: 'https://kms.example.com',
	accessToken: 'test-token',
	encryptionKey: 'key-encryption-123',
	signingKey: 'key-signing-456',
}

// Mock the global fetch function
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('InfisicalKmsClient', () => {
	let client: InfisicalKmsClient

	beforeAll(() => {
		client = new InfisicalKmsClient(mockConfig)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('constructor', () => {
		it('should create an instance of InfisicalKmsClient', () => {
			expect(client).toBeInstanceOf(InfisicalKmsClient)
		})
	})

	describe('encrypt', () => {
		it('should encrypt plaintext successfully', async () => {
			const plaintext = 'my secret data'
			const mockResponse: EncryptResponse = {
				ciphertext: 'encrypted-data',
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await client.encrypt(plaintext)

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				`${mockConfig.baseUrl}/api/v1/kms/keys/${mockConfig.encryptionKey}/encrypt`,
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ plaintext: btoa(plaintext) }),
				})
			)
		})

		it('should throw KmsApiError on API error during encryption', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => '{"error":"something went wrong"}',
			})

			await expect(client.encrypt('test')).rejects.toThrow(KmsApiError)
		})

		it('should throw KmsError on network error during encryption', async () => {
			mockFetch.mockRejectedValue(new Error('Network failure'))

			await expect(client.encrypt('test')).rejects.toThrow(
				'Request failed after 3 retries: Network failure'
			)
		})
	})

	describe('decrypt', () => {
		it('should decrypt ciphertext successfully', async () => {
			const ciphertext = 'encrypted-data'
			const decryptedPlaintext = 'my secret data'
			const mockResponse = {
				plaintext: btoa(decryptedPlaintext),
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await client.decrypt(ciphertext)

			expect(result.plaintext).toBe(decryptedPlaintext)
			expect(mockFetch).toHaveBeenCalledWith(
				`${mockConfig.baseUrl}/api/v1/kms/keys/${mockConfig.encryptionKey}/decrypt`,
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ ciphertext }),
				})
			)
		})

		it('should throw KmsApiError on API error during decryption', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Server error',
			})

			await expect(client.decrypt('test')).rejects.toThrow(KmsApiError)
		})

		it('should throw KmsError on network error during decryption', async () => {
			mockFetch.mockRejectedValue(new Error('Network failure'))

			await expect(client.decrypt('test')).rejects.toThrow(
				'Request failed after 3 retries: Network failure'
			)
		})
	})

	describe('sign', () => {
		it('should sign data successfully', async () => {
			const dataToSign = 'data to be signed'
			const mockResponse: SignResponse = {
				signature: 'signed-data',
				keyId: mockConfig.signingKey,
				signingAlgorithm: 'RSA_4096',
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await client.sign(dataToSign)

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				`${mockConfig.baseUrl}/api/v1/kms/keys/${mockConfig.signingKey}/sign`,
				expect.objectContaining({
					body: JSON.stringify({ data: btoa(dataToSign), signingAlgorithm: 'RSA_4096' }),
				})
			)
		})

		it('should throw KmsApiError on API error during signing', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 400,
				statusText: 'Bad Request',
				text: async () => 'Invalid algorithm',
			})

			await expect(client.sign('test')).rejects.toThrow(KmsApiError)
		})
	})

	describe('verify', () => {
		it('should verify a signature successfully', async () => {
			const dataToVerify = 'data to be verified'
			const signature = 'valid-signature'
			const mockResponse: VerifyResponse = {
				signatureValid: true,
				keyId: mockConfig.signingKey,
				signingAlgorithm: 'RSA_4096',
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await client.verify(dataToVerify, signature)

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				`${mockConfig.baseUrl}/api/v1/kms/keys/${mockConfig.signingKey}/verify`,
				expect.objectContaining({
					body: JSON.stringify({
						data: btoa(dataToVerify),
						signature,
						signingAlgorithm: 'RSA_4096',
					}),
				})
			)
		})

		it('should return isValid: false for an invalid signature', async () => {
			const mockResponse: VerifyResponse = {
				signatureValid: false,
				keyId: mockConfig.signingKey,
				signingAlgorithm: 'RSA_4096',
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			})

			const result = await client.verify('data', 'invalid-signature')
			expect(result.signatureValid).toBe(false)
		})

		it('should throw KmsApiError on API error during verification', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				text: async () => 'Verification failed',
			})

			await expect(client.verify('data', 'signature')).rejects.toThrow(KmsApiError)
		})
	})
})
