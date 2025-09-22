/**
 * Enhanced Request/Response Interceptor System
 *
 * This module provides a comprehensive interceptor system for the audit client library.
 * It supports request transformation, response processing, error handling, and interceptor chaining.
 */

import type { RequestOptions } from '../core/base-resource'
import type { Logger } from './logger'

/**
 * Interceptor execution context
 */
export interface InterceptorContext {
	requestId: string
	endpoint: string
	method: string
	timestamp: number
	metadata?: Record<string, any> | undefined
}

/**
 * Request interceptor interface with enhanced capabilities
 */
export interface RequestInterceptor {
	/**
	 * Unique identifier for the interceptor
	 */
	id?: string

	/**
	 * Priority for execution order (higher numbers execute first)
	 */
	priority?: number

	/**
	 * Whether this interceptor should be executed
	 */
	enabled?: boolean

	/**
	 * Transform the request options
	 */
	intercept(
		options: RequestOptions,
		context: InterceptorContext
	): Promise<RequestOptions> | RequestOptions

	/**
	 * Handle errors that occur during request processing
	 */
	onError?(error: Error, options: RequestOptions, context: InterceptorContext): Promise<void> | void

	/**
	 * Called when the interceptor is registered
	 */
	onRegister?(): Promise<void> | void

	/**
	 * Called when the interceptor is unregistered
	 */
	onUnregister?(): Promise<void> | void
}

/**
 * Response interceptor interface with enhanced capabilities
 */
export interface ResponseInterceptor {
	/**
	 * Unique identifier for the interceptor
	 */
	id?: string

	/**
	 * Priority for execution order (higher numbers execute first)
	 */
	priority?: number

	/**
	 * Whether this interceptor should be executed
	 */
	enabled?: boolean

	/**
	 * Transform the response data
	 */
	intercept<T>(response: T, options: RequestOptions, context: InterceptorContext): Promise<T> | T

	/**
	 * Handle errors that occur during response processing
	 */
	onError?(
		error: Error,
		response: any,
		options: RequestOptions,
		context: InterceptorContext
	): Promise<void> | void

	/**
	 * Called when the interceptor is registered
	 */
	onRegister?(): Promise<void> | void

	/**
	 * Called when the interceptor is unregistered
	 */
	onUnregister?(): Promise<void> | void
}

/**
 * Interceptor registration options
 */
export interface InterceptorRegistrationOptions {
	/**
	 * Whether to enable the interceptor immediately
	 */
	enabled: boolean

	/**
	 * Priority for execution order
	 */
	priority: number

	/**
	 * Metadata associated with the interceptor
	 */
	metadata?: Record<string, any>
}

/**
 * Interceptor execution result
 */
export interface InterceptorExecutionResult<T = any> {
	success: boolean
	result?: T
	error?: Error
	executionTime: number
	interceptorId?: string
}

/**
 * Interceptor chain execution statistics
 */
export interface InterceptorChainStats {
	totalExecutions: number
	successfulExecutions: number
	failedExecutions: number
	averageExecutionTime: number
	interceptorStats: Map<
		string,
		{
			executions: number
			successes: number
			failures: number
			averageTime: number
		}
	>
}

/**
 * Request interceptor manager
 */
export class RequestInterceptorManager {
	private interceptors: Map<string, RequestInterceptor> = new Map()
	private registrationOptions: Map<string, InterceptorRegistrationOptions> = new Map()
	private executionStats: InterceptorChainStats = {
		totalExecutions: 0,
		successfulExecutions: 0,
		failedExecutions: 0,
		averageExecutionTime: 0,
		interceptorStats: new Map(),
	}
	private logger: Logger | undefined

	constructor(logger?: Logger) {
		this.logger = logger
	}

	/**
	 * Register a request interceptor
	 */
	async register(
		interceptor: RequestInterceptor,
		options: InterceptorRegistrationOptions = {
			enabled: true,
			priority: 0,
		}
	): Promise<void> {
		const id = interceptor.id || this.generateId()

		// Update interceptor properties
		interceptor.id = id
		interceptor.priority = options.priority
		interceptor.enabled = options.enabled

		// Store interceptor and options
		this.interceptors.set(id, interceptor)
		this.registrationOptions.set(id, options)

		// Initialize stats for this interceptor
		this.executionStats.interceptorStats.set(id, {
			executions: 0,
			successes: 0,
			failures: 0,
			averageTime: 0,
		})

		// Call registration hook
		try {
			await interceptor.onRegister?.()
			this.logger?.debug('Request interceptor registered', {
				interceptorId: id,
				priority: options.priority,
				enabled: options.enabled,
			})
		} catch (error) {
			this.logger?.error('Error during request interceptor registration', {
				interceptorId: id,
				error,
			})
			// Remove from maps if registration failed
			this.interceptors.delete(id)
			this.registrationOptions.delete(id)
			this.executionStats.interceptorStats.delete(id)
			throw error
		}
	}

	/**
	 * Unregister a request interceptor
	 */
	async unregister(interceptorId: string): Promise<boolean> {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		try {
			// Call unregistration hook
			await interceptor.onUnregister?.()

			// Remove from maps
			this.interceptors.delete(interceptorId)
			this.registrationOptions.delete(interceptorId)
			this.executionStats.interceptorStats.delete(interceptorId)

			this.logger?.debug('Request interceptor unregistered', { interceptorId })
			return true
		} catch (error) {
			this.logger?.error('Error during request interceptor unregistration', {
				interceptorId,
				error,
			})
			throw error
		}
	}

	/**
	 * Enable or disable an interceptor
	 */
	setEnabled(interceptorId: string, enabled: boolean): boolean {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		interceptor.enabled = enabled
		const options = this.registrationOptions.get(interceptorId)
		if (options) {
			options.enabled = enabled
		}

		this.logger?.debug('Request interceptor enabled state changed', {
			interceptorId,
			enabled,
		})
		return true
	}

	/**
	 * Update interceptor priority
	 */
	setPriority(interceptorId: string, priority: number): boolean {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		interceptor.priority = priority
		const options = this.registrationOptions.get(interceptorId)
		if (options) {
			options.priority = priority
		}

		this.logger?.debug('Request interceptor priority changed', {
			interceptorId,
			priority,
		})
		return true
	}

	/**
	 * Execute all registered request interceptors in priority order
	 */
	async execute(options: RequestOptions, context: InterceptorContext): Promise<RequestOptions> {
		const startTime = Date.now()
		let processedOptions = { ...options }

		// Get enabled interceptors sorted by priority (highest first)
		const enabledInterceptors = Array.from(this.interceptors.values())
			.filter((interceptor) => interceptor.enabled !== false)
			.sort((a, b) => (b.priority || 0) - (a.priority || 0))

		this.logger?.debug('Executing request interceptor chain', {
			interceptorCount: enabledInterceptors.length,
			requestId: context.requestId,
			endpoint: context.endpoint,
		})

		// Execute interceptors in chain
		for (const interceptor of enabledInterceptors) {
			const interceptorStartTime = Date.now()
			const interceptorId = interceptor.id || 'unknown'

			try {
				// Execute interceptor
				const result = await interceptor.intercept(processedOptions, context)
				processedOptions = result

				// Update stats
				const executionTime = Date.now() - interceptorStartTime
				this.updateInterceptorStats(interceptorId, true, executionTime)

				this.logger?.debug('Request interceptor executed successfully', {
					interceptorId,
					executionTime,
					requestId: context.requestId,
				})
			} catch (error) {
				const executionTime = Date.now() - interceptorStartTime
				this.updateInterceptorStats(interceptorId, false, executionTime)

				this.logger?.error('Request interceptor execution failed', {
					interceptorId,
					error,
					executionTime,
					requestId: context.requestId,
				})

				// Call error handler if available
				try {
					await interceptor.onError?.(error as Error, processedOptions, context)
				} catch (handlerError) {
					this.logger?.error('Request interceptor error handler failed', {
						interceptorId,
						originalError: error,
						handlerError,
						requestId: context.requestId,
					})
				}

				// Re-throw the original error
				throw error
			}
		}

		// Update overall stats
		const totalExecutionTime = Date.now() - startTime
		this.updateOverallStats(true, totalExecutionTime)

		this.logger?.debug('Request interceptor chain completed', {
			totalExecutionTime,
			interceptorCount: enabledInterceptors.length,
			requestId: context.requestId,
		})

		return processedOptions
	}

	/**
	 * Get all registered interceptors
	 */
	getInterceptors(): RequestInterceptor[] {
		return Array.from(this.interceptors.values())
	}

	/**
	 * Get interceptor by ID
	 */
	getInterceptor(interceptorId: string): RequestInterceptor | undefined {
		return this.interceptors.get(interceptorId)
	}

	/**
	 * Check if an interceptor is registered
	 */
	hasInterceptor(interceptorId: string): boolean {
		return this.interceptors.has(interceptorId)
	}

	/**
	 * Clear all interceptors
	 */
	async clear(): Promise<void> {
		const interceptorIds = Array.from(this.interceptors.keys())

		for (const id of interceptorIds) {
			try {
				await this.unregister(id)
			} catch (error) {
				this.logger?.error('Error clearing request interceptor', { interceptorId: id, error })
			}
		}

		// Reset stats
		this.executionStats = {
			totalExecutions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			averageExecutionTime: 0,
			interceptorStats: new Map(),
		}

		this.logger?.debug('All request interceptors cleared')
	}

	/**
	 * Get execution statistics
	 */
	getStats(): InterceptorChainStats {
		return {
			...this.executionStats,
			interceptorStats: new Map(this.executionStats.interceptorStats),
		}
	}

	/**
	 * Generate a unique ID for an interceptor
	 */
	private generateId(): string {
		return `req_interceptor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
	}

	/**
	 * Update statistics for a specific interceptor
	 */
	private updateInterceptorStats(
		interceptorId: string,
		success: boolean,
		executionTime: number
	): void {
		const stats = this.executionStats.interceptorStats.get(interceptorId)
		if (stats) {
			stats.executions++
			if (success) {
				stats.successes++
			} else {
				stats.failures++
			}

			// Update average execution time
			stats.averageTime =
				(stats.averageTime * (stats.executions - 1) + executionTime) / stats.executions
		}
	}

	/**
	 * Update overall execution statistics
	 */
	private updateOverallStats(success: boolean, executionTime: number): void {
		this.executionStats.totalExecutions++
		if (success) {
			this.executionStats.successfulExecutions++
		} else {
			this.executionStats.failedExecutions++
		}

		// Update average execution time
		this.executionStats.averageExecutionTime =
			(this.executionStats.averageExecutionTime * (this.executionStats.totalExecutions - 1) +
				executionTime) /
			this.executionStats.totalExecutions
	}
}

/**
 * Response interceptor manager
 */
export class ResponseInterceptorManager {
	private interceptors: Map<string, ResponseInterceptor> = new Map()
	private registrationOptions: Map<string, InterceptorRegistrationOptions> = new Map()
	private executionStats: InterceptorChainStats = {
		totalExecutions: 0,
		successfulExecutions: 0,
		failedExecutions: 0,
		averageExecutionTime: 0,
		interceptorStats: new Map(),
	}
	private logger?: Logger | undefined

	constructor(logger?: Logger) {
		this.logger = logger
	}

	/**
	 * Register a response interceptor
	 */
	async register(
		interceptor: ResponseInterceptor,
		options: InterceptorRegistrationOptions = {
			enabled: true,
			priority: 0,
		}
	): Promise<void> {
		const id = interceptor.id || this.generateId()

		// Update interceptor properties
		interceptor.id = id
		interceptor.priority = options.priority
		interceptor.enabled = options.enabled

		// Store interceptor and options
		this.interceptors.set(id, interceptor)
		this.registrationOptions.set(id, options)

		// Initialize stats for this interceptor
		this.executionStats.interceptorStats.set(id, {
			executions: 0,
			successes: 0,
			failures: 0,
			averageTime: 0,
		})

		// Call registration hook
		try {
			await interceptor.onRegister?.()
			this.logger?.debug('Response interceptor registered', {
				interceptorId: id,
				priority: options.priority,
				enabled: options.enabled,
			})
		} catch (error) {
			this.logger?.error('Error during response interceptor registration', {
				interceptorId: id,
				error,
			})
			// Remove from maps if registration failed
			this.interceptors.delete(id)
			this.registrationOptions.delete(id)
			this.executionStats.interceptorStats.delete(id)
			throw error
		}
	}

	/**
	 * Unregister a response interceptor
	 */
	async unregister(interceptorId: string): Promise<boolean> {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		try {
			// Call unregistration hook
			await interceptor.onUnregister?.()

			// Remove from maps
			this.interceptors.delete(interceptorId)
			this.registrationOptions.delete(interceptorId)
			this.executionStats.interceptorStats.delete(interceptorId)

			this.logger?.debug('Response interceptor unregistered', { interceptorId })
			return true
		} catch (error) {
			this.logger?.error('Error during response interceptor unregistration', {
				interceptorId,
				error,
			})
			throw error
		}
	}

	/**
	 * Enable or disable an interceptor
	 */
	setEnabled(interceptorId: string, enabled: boolean): boolean {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		interceptor.enabled = enabled
		const options = this.registrationOptions.get(interceptorId)
		if (options) {
			options.enabled = enabled
		}

		this.logger?.debug('Response interceptor enabled state changed', {
			interceptorId,
			enabled,
		})
		return true
	}

	/**
	 * Update interceptor priority
	 */
	setPriority(interceptorId: string, priority: number): boolean {
		const interceptor = this.interceptors.get(interceptorId)
		if (!interceptor) {
			return false
		}

		interceptor.priority = priority
		const options = this.registrationOptions.get(interceptorId)
		if (options) {
			options.priority = priority
		}

		this.logger?.debug('Response interceptor priority changed', {
			interceptorId,
			priority,
		})
		return true
	}

	/**
	 * Execute all registered response interceptors in priority order
	 */
	async execute<T>(response: T, options: RequestOptions, context: InterceptorContext): Promise<T> {
		const startTime = Date.now()
		let processedResponse = response

		// Get enabled interceptors sorted by priority (highest first)
		const enabledInterceptors = Array.from(this.interceptors.values())
			.filter((interceptor) => interceptor.enabled !== false)
			.sort((a, b) => (b.priority || 0) - (a.priority || 0))

		this.logger?.debug('Executing response interceptor chain', {
			interceptorCount: enabledInterceptors.length,
			requestId: context.requestId,
			endpoint: context.endpoint,
		})

		// Execute interceptors in chain
		for (const interceptor of enabledInterceptors) {
			const interceptorStartTime = Date.now()
			const interceptorId = interceptor.id || 'unknown'

			try {
				// Execute interceptor
				const result = await interceptor.intercept(processedResponse, options, context)
				processedResponse = result

				// Update stats
				const executionTime = Date.now() - interceptorStartTime
				this.updateInterceptorStats(interceptorId, true, executionTime)

				this.logger?.debug('Response interceptor executed successfully', {
					interceptorId,
					executionTime,
					requestId: context.requestId,
				})
			} catch (error) {
				const executionTime = Date.now() - interceptorStartTime
				this.updateInterceptorStats(interceptorId, false, executionTime)

				this.logger?.error('Response interceptor execution failed', {
					interceptorId,
					error,
					executionTime,
					requestId: context.requestId,
				})

				// Call error handler if available
				try {
					await interceptor.onError?.(error as Error, processedResponse, options, context)
				} catch (handlerError) {
					this.logger?.error('Response interceptor error handler failed', {
						interceptorId,
						originalError: error,
						handlerError,
						requestId: context.requestId,
					})
				}

				// Re-throw the original error
				throw error
			}
		}

		// Update overall stats
		const totalExecutionTime = Date.now() - startTime
		this.updateOverallStats(true, totalExecutionTime)

		this.logger?.debug('Response interceptor chain completed', {
			totalExecutionTime,
			interceptorCount: enabledInterceptors.length,
			requestId: context.requestId,
		})

		return processedResponse
	}

	/**
	 * Get all registered interceptors
	 */
	getInterceptors(): ResponseInterceptor[] {
		return Array.from(this.interceptors.values())
	}

	/**
	 * Get interceptor by ID
	 */
	getInterceptor(interceptorId: string): ResponseInterceptor | undefined {
		return this.interceptors.get(interceptorId)
	}

	/**
	 * Check if an interceptor is registered
	 */
	hasInterceptor(interceptorId: string): boolean {
		return this.interceptors.has(interceptorId)
	}

	/**
	 * Clear all interceptors
	 */
	async clear(): Promise<void> {
		const interceptorIds = Array.from(this.interceptors.keys())

		for (const id of interceptorIds) {
			try {
				await this.unregister(id)
			} catch (error) {
				this.logger?.error('Error clearing response interceptor', { interceptorId: id, error })
			}
		}

		// Reset stats
		this.executionStats = {
			totalExecutions: 0,
			successfulExecutions: 0,
			failedExecutions: 0,
			averageExecutionTime: 0,
			interceptorStats: new Map(),
		}

		this.logger?.debug('All response interceptors cleared')
	}

	/**
	 * Get execution statistics
	 */
	getStats(): InterceptorChainStats {
		return {
			...this.executionStats,
			interceptorStats: new Map(this.executionStats.interceptorStats),
		}
	}

	/**
	 * Generate a unique ID for an interceptor
	 */
	private generateId(): string {
		return `res_interceptor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
	}

	/**
	 * Update statistics for a specific interceptor
	 */
	private updateInterceptorStats(
		interceptorId: string,
		success: boolean,
		executionTime: number
	): void {
		const stats = this.executionStats.interceptorStats.get(interceptorId)
		if (stats) {
			stats.executions++
			if (success) {
				stats.successes++
			} else {
				stats.failures++
			}

			// Update average execution time
			stats.averageTime =
				(stats.averageTime * (stats.executions - 1) + executionTime) / stats.executions
		}
	}

	/**
	 * Update overall execution statistics
	 */
	private updateOverallStats(success: boolean, executionTime: number): void {
		this.executionStats.totalExecutions++
		if (success) {
			this.executionStats.successfulExecutions++
		} else {
			this.executionStats.failedExecutions++
		}

		// Update average execution time
		this.executionStats.averageExecutionTime =
			(this.executionStats.averageExecutionTime * (this.executionStats.totalExecutions - 1) +
				executionTime) /
			this.executionStats.totalExecutions
	}
}

/**
 * Combined interceptor manager for both request and response interceptors
 */
export class InterceptorManager {
	public readonly request: RequestInterceptorManager
	public readonly response: ResponseInterceptorManager

	constructor(logger?: Logger) {
		this.request = new RequestInterceptorManager(logger)
		this.response = new ResponseInterceptorManager(logger)
	}

	/**
	 * Clear all interceptors (both request and response)
	 */
	async clearAll(): Promise<void> {
		await Promise.all([this.request.clear(), this.response.clear()])
	}

	/**
	 * Get combined statistics
	 */
	getStats(): {
		request: InterceptorChainStats
		response: InterceptorChainStats
	} {
		return {
			request: this.request.getStats(),
			response: this.response.getStats(),
		}
	}
}
