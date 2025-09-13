export interface InfisicalKmsClientConfig {
	/** Infisical Base Url */
	baseUrl: string
	/** KMS encryption key ID */
	encryptionKey: string
	/** KMS signing key ID */
	signingKey: string
	/** Access Token */
	accessToken: string
	/** Number of retry attempts for failed requests */
	retries?: number
	/** Initial backoff time in milliseconds between retries */
	backoffMs?: number
	/** Maximum backoff time in milliseconds between retries */
	maxBackoffMs?: number
	/** Custom headers to include with requests */
	headers?: Record<string, string>
}

export interface RequestOptions {
	method?: string
	headers?: Record<string, string>
	body?: any
	credentials?: string
	stream?: boolean
	signal?: AbortSignal
}

export interface EncryptResponse {
	ciphertext: string
}

export interface DecryptResponse {
	plaintext: string
}

export interface SignResponse {
	signature: string
	keyId: string
	signingAlgorithm: string
}

export interface VerifyResponse {
	signatureValid: boolean
	keyId: string
	signingAlgorithm: string
}

export type SigningAlgorithm = 'RSASSA_PSS_SHA_256' | 'RSASSA_PSS_SHA_384' | 'RSASSA_PSS_SHA_512' | 'RSASSA_PKCS1_V1_5_SHA_256' | 'RSASSA_PKCS1_V1_5_SHA_384' | 'RSASSA_PKCS1_V1_5_SHA_512'