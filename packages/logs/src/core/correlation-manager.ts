import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

import type { LogContext } from '../types/index.js'

/**
 * CorrelationManager for managing correlation IDs and context across async operations
 * Supports requirement 6.1: correlation ID tracking
 */
export class CorrelationManager {
	private static instance: CorrelationManager
	private readonly asyncStorage = new AsyncLocalStorage<LogContext>()

	private constructor() {}

	/**
	 * Get singleton instance
	 */
	static getInstance(): CorrelationManager {
		if (!CorrelationManager.instance) {
			CorrelationManager.instance = new CorrelationManager()
		}
		return CorrelationManager.instance
	}

	/**
	 * Generate a new correlation ID using crypto.randomUUID for collision resistance
	 */
	generateCorrelationId(): string {
		return randomUUID()
	}

	/**
	 * Run a function with correlation context
	 */
	runWithContext<T>(context: LogContext, fn: () => T): T {
		return this.asyncStorage.run(context, fn)
	}

	/**
	 * Get current correlation context
	 */
	getContext(): LogContext | undefined {
		return this.asyncStorage.getStore()
	}

	/**
	 * Get current correlation ID or generate a new one
	 */
	getCorrelationId(): string {
		const context = this.getContext()
		return context?.correlationId || this.generateCorrelationId()
	}

	/**
	 * Get current request ID if available
	 */
	getRequestId(): string | undefined {
		const context = this.getContext()
		return context?.requestId
	}

	/**
	 * Set correlation ID in current context
	 */
	setCorrelationId(correlationId: string): void {
		const context = this.getContext()
		if (context) {
			context.correlationId = correlationId
		}
	}

	/**
	 * Set request ID in current context
	 */
	setRequestId(requestId: string): void {
		const context = this.getContext()
		if (context) {
			context.requestId = requestId
		}
	}
}
