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

		let lastError: Error | null = null
		let delay = backoffMs

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/kms/keys${path}`, {
					method: 'POST',
					headers: {
						...headers,
						...options.headers,
					},
					body: options.body ? JSON.stringify(options.body) : undefined,
				})

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

				// Only if the request was successful, we parse and return the JSON
				return (await response.json()) as T
			} catch (error) {
				lastError = error as Error
				if (attempt < retries) {
					await new Promise((resolve) => setTimeout(resolve, delay))
					delay = Math.min(delay * 2, maxBackoffMs)
				} else {
					// After all retries, throw a KmsError that wraps the last error
					throw new KmsApiError(
						`Request failed after ${retries} retries: ${lastError.message}`,
					)
				}
			}
		}

		// This part should not be reachable if the loop always throws on the last attempt
		throw new KmsError('Request failed unexpectedly after all retries')
	}
}
