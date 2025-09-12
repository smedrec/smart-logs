import { BaseResource, KmsApiError, KmsError } from './base.js'

import type { DecryptResponse, EncryptResponse, InfisicalKmsClientConfig } from './types.js'

/**
 * InfisicalKmsClient provides methods to interact with the Infisical KMS API
 * for encrypting and decrypting data.
 */
export class InfisicalKmsClient extends BaseResource {
	/**
	 * Creates an instance of InfisicalKmsClient.
	 * @param {InfisicalKmsClientConfig} config - Configuration for the client,
	 * including baseUrl, keyId, and accessToken.
	 */
	constructor(config: InfisicalKmsClientConfig) {
		super(config)
	}

	/**
	 * Encrypts a plaintext string using the configured Infisical KMS key.
	 * The plaintext is first base64 encoded before sending to the API.
	 * @param {string} plaintext - The plaintext string to encrypt.
	 * @returns {Promise<EncryptResponse>} A promise that resolves with the ciphertext.
	 * @throws {KmsEncryptionError} If the encryption request fails due to network issues or an unsuccessful API response.
	 */
	public async encrypt(plaintext: string): Promise<EncryptResponse> {
		// Base64 encode the plaintext as required by the API.
		const b64 = btoa(plaintext)

		try {
			const data = await this.request<EncryptResponse>(`/encrypt`, { body: { plaintext: b64 } })
			return data
		} catch (error) {
			if (error instanceof KmsApiError) {
				throw error
			}
			// Catch network errors or other unexpected errors during fetch or JSON parsing.
			throw new KmsError(
				`Encryption request failed: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Decrypts a ciphertext string using the configured Infisical KMS key.
	 * The API is expected to return a base64 encoded plaintext, which is then decoded.
	 * @param {string} ciphertext - The ciphertext string to decrypt.
	 * @returns {Promise<DecryptResponse>} A promise that resolves with the decrypted plaintext.
	 * @throws {KmsDecryptionError} If the decryption request fails due to network issues or an unsuccessful API response.
	 */
	public async decrypt(ciphertext: string): Promise<DecryptResponse> {
		let response: Response
		try {
			const data = await this.request<DecryptResponse>(`/decrypt`, {
				body: { ciphertext: ciphertext },
			})

			// Decode the base64 plaintext received from the API.
			const str = atob(data.plaintext)
			return {
				plaintext: str,
			}
		} catch (error) {
			if (error instanceof KmsApiError) {
				throw error
			}
			// Catch network errors or other unexpected errors during fetch, JSON parsing, or atob.
			throw new KmsError(
				`Decryption request failed: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}
}
