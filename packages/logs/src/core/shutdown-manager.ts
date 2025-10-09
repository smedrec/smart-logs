import { EventEmitter } from 'node:events'

/**
 * Graceful shutdown system for logging infrastructure
 * Addresses requirements 8.1, 8.2, 8.4: Proper resource cleanup and shutdown handling
 */

export interface ShutdownConfig {
	/** Timeout in milliseconds for graceful shutdown */
	timeoutMs: number
	/** Whether to handle process signals automatically */
	handleSignals: boolean
	/** Signals to handle for graceful shutdown */
	signals: NodeJS.Signals[]
}

export interface ShutdownResource {
	/** Resource name for logging */
	name: string
	/** Cleanup function that returns a promise */
	cleanup: () => Promise<void>
	/** Priority for shutdown order (lower numbers shut down first) */
	priority?: number
}

/**
 * Manages graceful shutdown of logging resources
 */
export class ShutdownManager extends EventEmitter {
	private readonly resources = new Map<string, ShutdownResource>()
	private isShuttingDown = false
	private shutdownPromise: Promise<void> | null = null
	private readonly config: ShutdownConfig
	private signalHandlers = new Map<NodeJS.Signals, () => void>()

	constructor(config: Partial<ShutdownConfig> = {}) {
		super()

		this.config = {
			timeoutMs: config.timeoutMs || 30000,
			handleSignals: config.handleSignals !== false,
			signals: config.signals || ['SIGTERM', 'SIGINT', 'SIGUSR2'],
		}

		if (this.config.handleSignals) {
			this.setupSignalHandlers()
		}
	}

	/**
	 * Register a resource for graceful shutdown
	 */
	register(resource: ShutdownResource): void {
		if (this.isShuttingDown) {
			throw new Error('Cannot register resources during shutdown')
		}

		this.resources.set(resource.name, {
			...resource,
			priority: resource.priority || 100, // Default priority
		})

		this.emit('resourceRegistered', resource.name)
	}

	/**
	 * Unregister a resource from shutdown management
	 */
	unregister(name: string): boolean {
		if (this.isShuttingDown) {
			return false
		}

		const removed = this.resources.delete(name)
		if (removed) {
			this.emit('resourceUnregistered', name)
		}
		return removed
	}

	/**
	 * Initiate graceful shutdown of all registered resources
	 */
	async shutdown(): Promise<void> {
		if (this.shutdownPromise) {
			return this.shutdownPromise
		}

		this.isShuttingDown = true
		this.emit('shutdownStarted')

		this.shutdownPromise = this.performShutdown()
		return this.shutdownPromise
	}

	/**
	 * Check if shutdown is in progress
	 */
	isShutdown(): boolean {
		return this.isShuttingDown
	}

	/**
	 * Get the list of registered resource names
	 */
	getRegisteredResources(): string[] {
		return Array.from(this.resources.keys())
	}

	/**
	 * Perform the actual shutdown process
	 */
	private async performShutdown(): Promise<void> {
		const startTime = Date.now()

		try {
			// Remove signal handlers to prevent multiple shutdown attempts
			this.removeSignalHandlers()

			// Sort resources by priority (lower numbers first)
			const sortedResources = Array.from(this.resources.values()).sort(
				(a, b) => (a.priority || 100) - (b.priority || 100)
			)

			// Create timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Shutdown timeout after ${this.config.timeoutMs}ms`))
				}, this.config.timeoutMs)
			})

			// Shutdown resources with timeout
			const shutdownPromise = this.shutdownResources(sortedResources)

			await Promise.race([shutdownPromise, timeoutPromise])

			const duration = Date.now() - startTime
			this.emit('shutdownCompleted', { duration, resourceCount: sortedResources.length })
		} catch (error) {
			const duration = Date.now() - startTime
			this.emit('shutdownError', { error, duration })
			throw error
		}
	}

	/**
	 * Shutdown all resources in priority order
	 */
	private async shutdownResources(resources: ShutdownResource[]): Promise<void> {
		const errors: Array<{ name: string; error: Error }> = []

		for (const resource of resources) {
			try {
				this.emit('resourceShutdownStarted', resource.name)
				const startTime = Date.now()

				await resource.cleanup()

				const duration = Date.now() - startTime
				this.emit('resourceShutdownCompleted', { name: resource.name, duration })
			} catch (error) {
				const shutdownError = error instanceof Error ? error : new Error(String(error))
				errors.push({ name: resource.name, error: shutdownError })
				this.emit('resourceShutdownError', { name: resource.name, error: shutdownError })
			}
		}

		// If there were errors, throw an aggregate error
		if (errors.length > 0) {
			const errorMessage = errors.map(({ name, error }) => `${name}: ${error.message}`).join('; ')
			throw new Error(`Shutdown errors occurred: ${errorMessage}`)
		}
	}

	/**
	 * Setup process signal handlers for graceful shutdown
	 */
	private setupSignalHandlers(): void {
		for (const signal of this.config.signals) {
			const handler = () => {
				console.log(`Received ${signal}, initiating graceful shutdown...`)
				this.shutdown()
					.then(() => {
						console.log('Graceful shutdown completed')
						process.exit(0)
					})
					.catch((error) => {
						console.error('Graceful shutdown failed:', error)
						process.exit(1)
					})
			}

			this.signalHandlers.set(signal, handler)
			process.on(signal, handler)
		}
	}

	/**
	 * Remove process signal handlers
	 */
	private removeSignalHandlers(): void {
		for (const [signal, handler] of this.signalHandlers) {
			process.removeListener(signal, handler)
		}
		this.signalHandlers.clear()
	}

	/**
	 * Cleanup the shutdown manager itself
	 */
	async destroy(): Promise<void> {
		this.removeSignalHandlers()
		this.removeAllListeners()
		this.resources.clear()
	}
}

/**
 * Global shutdown manager instance
 */
let globalShutdownManager: ShutdownManager | null = null

/**
 * Get or create the global shutdown manager
 */
export function getShutdownManager(config?: Partial<ShutdownConfig>): ShutdownManager {
	if (!globalShutdownManager) {
		globalShutdownManager = new ShutdownManager(config)
	}
	return globalShutdownManager
}

/**
 * Convenience function to register a resource for shutdown
 */
export function registerForShutdown(resource: ShutdownResource): void {
	getShutdownManager().register(resource)
}

/**
 * Convenience function to initiate graceful shutdown
 */
export async function gracefulShutdown(): Promise<void> {
	if (globalShutdownManager) {
		await globalShutdownManager.shutdown()
	}
}
