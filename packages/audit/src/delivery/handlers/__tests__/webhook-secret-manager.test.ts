/**
 * Unit tests for webhook secret manager
 * Requirements 4.4, 4.5, 10.5: Webhook secret management testing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebhookSecretManager } from '../webhook-secret-manager.js'

import type { IWebhookSecretRepository } from '../../database-client.js'

// Mock secret repository
const mockSecretRepository: IWebhookSecretRepository = {
	create: vi.fn(),
	findByDestinationId: vi.fn(),
	findActiveByDestinationId: vi.fn(),
	rotate: vi.fn(),
	markInactive: vi.fn(),
	cleanup: vi.fn(),
}

describe('WebhookSecretManager', () => {
	let secretManager: WebhookSecretManager
	const testEncryptionKey = 'test-encryption-key-32-characters'

	beforeEach(() => {
		vi.clearAllMocks()
		secretManager = new WebhookSecretManager(mockSecretRepository, testEncryptionKey)
	})

	describe('Secret Creation', () => {
		it('should create new secret with generated key', async () => {
			const destinationId = 123
			const createdBy = 'test-user'

			// Mock empty existing secrets (this will be primary)
			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			const result = await secretManager.createSecret(destinationId, { createdBy })

			expect(result.destinationId).toBe(destinationId)
			expect(result.isPrimary).toBe(true)
			expect(result.isActive).toBe(true)
			expect(result.algorithm).toBe('HMAC-SHA256')
			expect(result.secretKey).toHaveLength(128) // 64 bytes = 128 hex characters
			expect(result.createdBy).toBe(createdBy)
			expect(result.expiresAt).toBeDefined()

			// Verify repository was called with encrypted secret
			expect(mockSecretRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					destinationId,
					isPrimary: true,
					createdBy,
				})
			)
		})

		it('should create secret with provided key', async () => {
			const destinationId = 123
			const customSecret = 'custom-secret-key-with-sufficient-length-for-security'

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			const result = await secretManager.createSecret(destinationId, {
				secretKey: customSecret,
			})

			expect(result.secretKey).toBe(customSecret)
		})

		it('should reject invalid secret format', async () => {
			const destinationId = 123
			const invalidSecret = 'short'

			await expect(
				secretManager.createSecret(destinationId, { secretKey: invalidSecret })
			).rejects.toThrow('Invalid secret')
		})

		it('should demote existing primary when creating new primary', async () => {
			const destinationId = 123
			const existingSecret = {
				id: 'existing-secret',
				isPrimary: true,
				isActive: true,
			}

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([existingSecret])
			vi.mocked(mockSecretRepository.create).mockResolvedValue()
			vi.mocked(mockSecretRepository.markInactive).mockResolvedValue()

			await secretManager.createSecret(destinationId, { isPrimary: true })

			// Should mark existing primary as inactive
			expect(mockSecretRepository.markInactive).toHaveBeenCalledWith('existing-secret')
		})
	})

	describe('Secret Retrieval', () => {
		it('should get active secrets with decryption', async () => {
			const destinationId = 123
			const originalSecret = 'test-secret-key-with-sufficient-length-for-testing'

			// Create a properly encrypted secret using the secret manager
			const encryptedSecret = (secretManager as any).encryptSecret(originalSecret)

			const encryptedSecrets = [
				{
					id: 'secret-1',
					destinationId,
					secretKey: encryptedSecret,
					algorithm: 'HMAC-SHA256',
					isActive: true,
					isPrimary: true,
				},
			]

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue(encryptedSecrets)

			const result = await secretManager.getActiveSecrets(destinationId)

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe('secret-1')
			expect(result[0].secretKey).toBe(originalSecret) // Should be decrypted back to original
		})

		it('should get primary secret', async () => {
			const destinationId = 123
			const secret1 = 'test-secret-1-with-sufficient-length-for-testing'
			const secret2 = 'test-secret-2-with-sufficient-length-for-testing'

			const secrets = [
				{
					id: 'secret-1',
					destinationId,
					secretKey: (secretManager as any).encryptSecret(secret1),
					isPrimary: false,
					isActive: true,
				},
				{
					id: 'secret-2',
					destinationId,
					secretKey: (secretManager as any).encryptSecret(secret2),
					isPrimary: true,
					isActive: true,
				},
			]

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue(secrets)

			const result = await secretManager.getPrimarySecret(destinationId)

			expect(result).toBeDefined()
			expect(result!.id).toBe('secret-2')
			expect(result!.isPrimary).toBe(true)
		})

		it('should return null when no primary secret exists', async () => {
			const destinationId = 123

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])

			const result = await secretManager.getPrimarySecret(destinationId)

			expect(result).toBeNull()
		})
	})

	describe('Secret Rotation', () => {
		it('should rotate secret successfully', async () => {
			const destinationId = 123
			const originalSecret = 'current-secret-key-with-sufficient-length'
			const currentPrimary = {
				id: 'current-primary',
				destinationId,
				secretKey: (secretManager as any).encryptSecret(originalSecret),
				isPrimary: true,
				isActive: true,
			}

			vi.mocked(mockSecretRepository.findActiveByDestinationId)
				.mockResolvedValueOnce([currentPrimary]) // For getPrimarySecret
				.mockResolvedValueOnce([]) // For createSecret (after marking inactive)

			vi.mocked(mockSecretRepository.markInactive).mockResolvedValue()
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			const result = await secretManager.rotateSecret(destinationId, {
				createdBy: 'test-user',
			})

			expect(result.oldSecret.id).toBe('current-primary')
			expect(result.newSecret.isPrimary).toBe(true)
			expect(result.newSecret.secretKey).not.toBe(originalSecret)

			// Verify old secret was marked inactive
			expect(mockSecretRepository.markInactive).toHaveBeenCalledWith('current-primary')
		})

		it('should fail rotation when no primary secret exists', async () => {
			const destinationId = 123

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])

			await expect(secretManager.rotateSecret(destinationId)).rejects.toThrow(
				'No primary secret found'
			)
		})
	})

	describe('BYOS Configuration', () => {
		it('should configure BYOS with valid secret', async () => {
			const destinationId = 123
			const byosConfig = {
				enabled: true,
				secretKey: 'customer-provided-secret-key-with-sufficient-length',
				rotationManaged: false,
			}

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			const result = await secretManager.configureBYOS(destinationId, byosConfig, 'customer')

			expect(result.secretKey).toBe(byosConfig.secretKey)
			expect(result.isPrimary).toBe(true)
			expect(result.createdBy).toBe('customer')
			// For customer-managed rotation, expiration should be null
			if (byosConfig.rotationManaged === false) {
				expect(result.expiresAt).toBeNull()
			}
		})

		it('should reject BYOS with invalid secret', async () => {
			const destinationId = 123
			const byosConfig = {
				enabled: true,
				secretKey: 'short', // Invalid
				rotationManaged: false,
			}

			await expect(secretManager.configureBYOS(destinationId, byosConfig)).rejects.toThrow(
				'Invalid BYOS secret'
			)
		})

		it('should deactivate existing secrets when enabling BYOS', async () => {
			const destinationId = 123
			const existingSecrets = [
				{ id: 'secret-1', isActive: true },
				{ id: 'secret-2', isActive: true },
			]
			const byosConfig = {
				enabled: true,
				secretKey: 'customer-provided-secret-key-with-sufficient-length',
				rotationManaged: false,
			}

			vi.mocked(mockSecretRepository.findActiveByDestinationId)
				.mockResolvedValueOnce(existingSecrets) // For deactivation
				.mockResolvedValueOnce([]) // For createSecret

			vi.mocked(mockSecretRepository.markInactive).mockResolvedValue()
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			await secretManager.configureBYOS(destinationId, byosConfig)

			// Should deactivate all existing secrets
			expect(mockSecretRepository.markInactive).toHaveBeenCalledWith('secret-1')
			expect(mockSecretRepository.markInactive).toHaveBeenCalledWith('secret-2')
		})
	})

	describe('Secret Validation', () => {
		it('should validate strong secrets', () => {
			const strongSecrets = [
				'abc123def456ghi789jkl012mno345pqr678stu901vwx234yzA567BCD890EFG123', // Mixed chars, 64+ length
				'1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_+=/',
			]

			strongSecrets.forEach((secret) => {
				const result = secretManager.validateSecret(secret)
				expect(result.isValid).toBe(true)
				expect(result.strength).toBe('strong')
			})
		})

		it('should identify medium strength secrets', () => {
			const mediumSecrets = [
				'abc123def456ghi789jkl012mno345pqr678', // Mixed chars but < 64 length
			]

			mediumSecrets.forEach((secret) => {
				const result = secretManager.validateSecret(secret)
				expect(result.isValid).toBe(true)
				expect(result.strength).toBe('medium')
				expect(result.warnings.length).toBeGreaterThan(0)
			})
		})

		it('should identify weak secrets', () => {
			const weakSecrets = [
				'1234567890123456789012345678901234567890', // Only numbers
				'abcdefghijklmnopqrstuvwxyzabcdefghijklmnop', // Only letters
				'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // Repeated characters
			]

			weakSecrets.forEach((secret) => {
				const result = secretManager.validateSecret(secret)
				expect(result.strength).toBe('weak')
				expect(result.warnings.length).toBeGreaterThan(0)
			})
		})

		it('should reject invalid secrets', () => {
			const invalidSecrets = [
				'', // Empty
				'short', // Too short
				'a'.repeat(300), // Too long
			]

			invalidSecrets.forEach((secret) => {
				const result = secretManager.validateSecret(secret)
				expect(result.isValid).toBe(false)
				expect(result.errors.length).toBeGreaterThan(0)
			})
		})
	})

	describe('Secret Cleanup', () => {
		it('should cleanup expired secrets', async () => {
			vi.mocked(mockSecretRepository.cleanup).mockResolvedValue()

			const result = await secretManager.cleanupExpiredSecrets()

			expect(result.cleaned).toBe(0) // Mock doesn't return count
			expect(result.errors).toHaveLength(0)
			expect(mockSecretRepository.cleanup).toHaveBeenCalled()
		})

		it('should handle cleanup errors', async () => {
			const error = new Error('Cleanup failed')
			vi.mocked(mockSecretRepository.cleanup).mockRejectedValue(error)

			const result = await secretManager.cleanupExpiredSecrets()

			expect(result.cleaned).toBe(0)
			expect(result.errors).toContain('Cleanup failed')
		})
	})

	describe('Encryption/Decryption', () => {
		it('should encrypt and decrypt secrets correctly', async () => {
			const destinationId = 123
			const originalSecret = 'test-secret-key-with-sufficient-length-for-testing'

			// Mock repository to capture encrypted value
			let encryptedValue: string
			vi.mocked(mockSecretRepository.create).mockImplementation(async (secret) => {
				encryptedValue = secret.secretKey
			})
			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockImplementation(async () => [
				{
					id: 'test-secret',
					destinationId,
					secretKey: encryptedValue,
					algorithm: 'HMAC-SHA256',
					isActive: true,
					isPrimary: true,
				},
			])

			// Create secret (encrypts)
			await secretManager.createSecret(destinationId, { secretKey: originalSecret })

			// Retrieve secret (decrypts)
			const retrieved = await secretManager.getActiveSecrets(destinationId)

			expect(retrieved[0].secretKey).toBe(originalSecret)
			expect(encryptedValue!).not.toBe(originalSecret) // Should be encrypted in storage
		})
	})

	describe('Secret Generation', () => {
		it('should generate cryptographically secure secrets', () => {
			// Access private method for testing
			const generateWebhookSecret = (
				secretManager as any
			).securityManager.generateWebhookSecret.bind((secretManager as any).securityManager)

			const secret1 = generateWebhookSecret(32)
			const secret2 = generateWebhookSecret(32)

			expect(secret1).toHaveLength(64) // 32 bytes = 64 hex characters
			expect(secret2).toHaveLength(64)
			expect(secret1).not.toBe(secret2)
			expect(secret1).toMatch(/^[a-f0-9]{64}$/)
		})
	})

	describe('Expiration Calculation', () => {
		it('should calculate expiration dates correctly', async () => {
			const destinationId = 123

			vi.mocked(mockSecretRepository.findActiveByDestinationId).mockResolvedValue([])
			vi.mocked(mockSecretRepository.create).mockResolvedValue()

			const result = await secretManager.createSecret(destinationId)

			expect(result.expiresAt).toBeDefined()

			const expirationDate = new Date(result.expiresAt!)
			const now = new Date()
			const daysDiff = Math.floor(
				(expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			)

			expect(daysDiff).toBeCloseTo(90, 1) // Default 90 days, allow 1 day tolerance
		})
	})
})
