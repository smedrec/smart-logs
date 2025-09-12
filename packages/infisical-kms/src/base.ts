import type { InfisicalKmsClientConfig, RequestOptions } from './types'

/**
 * Base error class for Infisical KMS client errors.
 */
export class KmsError extends Error {
	constructor(message: string) {
		super(message)
		this.name = this.constructor.name
	}
}

/**
 * Error class for network-related issues or unexpected responses from the KMS API.
 */
export class KmsApiError extends KmsError {
	public status?: number
	public statusText?: string

	constructor(message: string, status?: number, statusText?: string) {
		super(`${message}${status ? ` (Status: ${status} ${statusText})` : ''}`)
		this.status = status
		this.statusText = statusText
	}
}

export class BaseResource {
	readonly config: InfisicalKmsClientConfig

	constructor(config: InfisicalKmsClientConfig) {
		this.config = config
	}

	/**
	 * Makes an HTTP request to the API with retries and exponential backoff
	 * @param path - The API endpoint path
	 * @param options - Optional request configuration
	 * @returns Promise containing the response data
	 */
	public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		let lastError: KmsApiError | null = null
		const {
			baseUrl,
			retries = 3,
			backoffMs = 100,
			maxBackoffMs = 1000,
			headers = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.config.accessToken}`,
			},
		} = this.config

		let delay = backoffMs

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await fetch(
					`${baseUrl.replace(/\/$/, '')}/api/v1/kms/keys/${this.config.keyId}${path}`,
					{
						method: 'POST',
						headers: {
							...headers,
							...options.headers,
						},
						body: options.body ? JSON.stringify(options.body) : undefined,
					}
				)

				if (!response.ok) {
					const errorBody = await response.text()
					let errorMessage = `HTTP error!`
					try {
						const errorJson = JSON.parse(errorBody)
						errorMessage += ` - ${JSON.stringify(errorJson)}`
					} catch {
						if (errorBody) {
							errorMessage += ` - ${errorBody}`
						}
					}
					throw new KmsApiError(errorMessage, response.status, response.statusText)
				}

				const data = await response.json()
				return data as T
			} catch (error) {
				lastError = error as KmsApiError

				if (attempt === retries) {
					break
				}

				await new Promise((resolve) => setTimeout(resolve, delay))
				delay = Math.min(delay * 2, maxBackoffMs)
			}
		}

		throw lastError || new KmsError('Request failed')
	}
}
