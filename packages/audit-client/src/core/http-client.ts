import { ErrorHandler } from '../infrastructure/error'

import type { AuthManager } from '../infrastructure/auth'
import type { Logger } from '../infrastructure/logger'
import type { AuditClientConfig } from './config'

/**
 * HTTP request options interface
 */
export interface HttpRequestOptions {
	method?: string
	headers?: Record<string, string>
	body?: any
	signal?: AbortSignal
	requestId?: string
	responseType?: 'json' | 'text' | 'blob' | 'stream'
}

/**
 * HTTP response interface
 */
export interface HttpResponse<T> {
	status: number
	statusText: string
	headers: Record<string, string>
	data: T
}

/**
 * HttpClient handles all HTTP request/response operations
 *
 * Responsibilities:
 * - Build request headers (auth, correlation IDs, user agent)
 * - Serialize request bodies (JSON, FormData, Blob)
 * - Parse responses based on content type
 * - Create detailed HttpError instances
 * - Handle response streaming
 */
export class HttpClient {
	constructor(
		private config: AuditClientConfig,
		private authManager: AuthManager,
		private logger: Logger
	) {}

	/**
	 * Execute HTTP request with comprehensive handling
	 */
	async request<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		const headers = await this.buildHeaders(options.headers, options.requestId)
		const body = this.buildBody(options.body)

		const fetchOptions: RequestInit = {
			method: options.method || 'GET',
			headers,
			body,
			...(options.signal && { signal: options.signal }),
			credentials: 'include',
		}

		// Log the outgoing request
		this.logHttpRequest(
			options.method || 'GET',
			url,
			this.headersToObject(headers),
			options.body,
			options.requestId
		)

		const response = await fetch(url, fetchOptions)

		// Parse response headers
		const responseHeaders = this.parseHeaders(response.headers)

		if (!response.ok) {
			// Log error response
			let errorBody: any
			try {
				errorBody = await response.clone().json()
			} catch {
				errorBody = await response.clone().text()
			}

			this.logHttpResponse(
				response.status,
				response.statusText,
				responseHeaders,
				errorBody,
				options.requestId
			)

			const httpError = await this.createHttpError(response, options.requestId, {
				url,
				method: options.method || 'GET',
				headers: this.headersToObject(headers),
			})
			throw httpError
		}

		// Parse response data
		const data = await this.parseResponse<T>(response, options.responseType)

		// Log successful response
		this.logHttpResponse(
			response.status,
			response.statusText,
			responseHeaders,
			this.config.logging.includeResponseBody ? data : undefined,
			options.requestId
		)

		return {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
			data,
		}
	}

	/**
	 * Build request headers with authentication and metadata
	 */
	private async buildHeaders(
		customHeaders: Record<string, string> = {},
		requestId?: string
	): Promise<Headers> {
		const headers = new Headers()

		// Set default headers
		headers.set('Accept', 'application/json')
		headers.set('Content-Type', 'application/json')
		headers.set('User-Agent', this.getUserAgent())

		// Add request ID if provided
		if (requestId) {
			headers.set('X-Request-ID', requestId)
		}

		// Add API version header
		if (this.config.apiVersion) {
			headers.set('Accept-Version', this.config.apiVersion)
		}

		// Add custom headers from config
		Object.entries(this.config.customHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		// Add authentication headers
		const authHeaders = await this.authManager.getAuthHeaders()
		Object.entries(authHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		// Add request-specific custom headers (these take precedence)
		Object.entries(customHeaders).forEach(([key, value]) => {
			headers.set(key, value)
		})

		return headers
	}

	/**
	 * Build request body with proper serialization
	 */
	private buildBody(body?: any): string | FormData | Blob | null {
		if (!body) {
			return null
		}

		// Handle different body types
		if (body instanceof FormData || body instanceof Blob) {
			return body
		}

		if (typeof body === 'string') {
			return body
		}

		// Default to JSON serialization
		try {
			return JSON.stringify(body)
		} catch (error) {
			throw new Error(
				`Failed to serialize request body: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Parse response based on response type
	 */
	private async parseResponse<T>(response: Response, responseType?: string): Promise<T> {
		switch (responseType) {
			case 'blob':
				return response.blob() as Promise<T>

			case 'text':
				return response.text() as Promise<T>

			case 'stream':
				if (!response.body) {
					throw new Error('Response body is not available for streaming')
				}
				return response.body as unknown as T

			case 'json':
			default:
				// Handle empty responses
				const contentLength = response.headers.get('content-length')
				if (contentLength === '0' || response.status === 204) {
					return {} as T
				}

				const text = await response.text()
				if (!text) {
					return {} as T
				}

				try {
					return JSON.parse(text) as T
				} catch (error) {
					throw new Error(
						`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				}
		}
	}

	/**
	 * Create detailed HttpError with context
	 */
	private async createHttpError(
		response: Response,
		requestId?: string,
		request?: {
			url: string
			method: string
			headers: Record<string, string>
		}
	): Promise<Error> {
		return ErrorHandler.createHttpError(response, requestId, request)
	}

	/**
	 * Get user agent string for client identification
	 */
	private getUserAgent(): string {
		const version = '1.0.0' // This would come from package.json in real implementation
		const platform = typeof window !== 'undefined' ? 'browser' : 'node'
		return `audit-client/${version} (${platform})`
	}

	/**
	 * Parse response headers into a plain object
	 */
	private parseHeaders(headers: Headers): Record<string, string> {
		const result: Record<string, string> = {}
		headers.forEach((value, key) => {
			result[key] = value
		})
		return result
	}

	/**
	 * Convert Headers object to plain object
	 */
	private headersToObject(headers: Headers): Record<string, string> {
		const result: Record<string, string> = {}
		headers.forEach((value, key) => {
			result[key] = value
		})
		return result
	}

	/**
	 * Log HTTP request details
	 */
	private logHttpRequest(
		method: string,
		url: string,
		headers?: Record<string, string>,
		body?: any,
		requestId?: string
	): void {
		if (!this.config.logging.enabled) {
			return
		}

		this.logger.info(`HTTP ${method} ${url}`, {
			type: 'request',
			method,
			url,
			headers: this.config.logging.maskSensitiveData ? this.maskSensitiveData(headers) : headers,
			body:
				this.config.logging.includeRequestBody && this.config.logging.maskSensitiveData
					? this.maskSensitiveData(body)
					: this.config.logging.includeRequestBody
						? body
						: undefined,
			requestId,
		})
	}

	/**
	 * Log HTTP response details
	 */
	private logHttpResponse(
		status: number,
		statusText: string,
		headers?: Record<string, string>,
		body?: any,
		requestId?: string
	): void {
		if (!this.config.logging.enabled) {
			return
		}

		const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info'
		this.logger[level](`HTTP ${status} ${statusText}`, {
			type: 'response',
			status,
			statusText,
			headers: this.config.logging.maskSensitiveData ? this.maskSensitiveData(headers) : headers,
			body:
				this.config.logging.includeResponseBody && this.config.logging.maskSensitiveData
					? this.maskSensitiveData(body)
					: this.config.logging.includeResponseBody
						? body
						: undefined,
			requestId,
		})
	}

	/**
	 * Basic sensitive data masking
	 */
	private maskSensitiveData(data: any): any {
		if (!data || typeof data !== 'object') {
			return data
		}

		const sensitiveFields = ['password', 'token', 'apiKey', 'authorization', 'cookie', 'session']
		const masked = { ...data }

		for (const field of sensitiveFields) {
			if (field in masked) {
				masked[field] = '***'
			}
		}

		return masked
	}
}
