export interface InfisicalKmsClientConfig {
	/** Infisical Base Url */
	baseUrl: string
	/** KMS key ID */
	keyId: string
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
