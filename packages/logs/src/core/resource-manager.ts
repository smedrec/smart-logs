import { EventEmitter } from 'node:events'

import { registerForShutdown } from './shutdown-manager.js'

/**
 * Resource cleanup and memory management system
 * Addresses requirements 8.3, 8.5: Memory leak prevention and resource monitoring
 */

export interface ResourceConfig {
	/** Memory threshold in bytes before triggering cleanup */
	memoryThresholdBytes: number
	/** Interval for resource monitoring in milliseconds */
	monitoringIntervalMs: number
	/** Maximum queue size before applying backpressure */
	maxQueueSize: number
	/** Cleanup interval for stale resources in milliseconds */
	cleanupIntervalMs: number
	/** Enable automatic garbage collection hints */
	enableGcHints: boolean
}

export interface ManagedResource {
	/** Unique identifier for the resource */
	id: string
	/** Resource type for categorization */
	type: 'timer' | 'connection' | 'stream' | 'queue' | 'other'
	/** Cleanup function */
	cleanup: () => Promise<void> | void
	/** Creation timestamp */
	createdAt: Date
	/** Last accessed timestamp */
	lastAccessedAt: Date
	/** Resource metadata */
	metadata?: Record<string, unknown>
}

export interface MemoryStats {
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
	arrayBuffers: number
}

/**
 * Manages resource cleanup and memory monitoring
 */
export class ResourceManager extends EventEmitter {
	private readonly resources = new Map<string, ManagedResource>()
	private readonly config: ResourceConfig
	private monitoringTimer: NodeJS.Timeout | null = null
	private cleanupTimer: NodeJS.Timeout | null = null
	private isShuttingDown = false

	constructor(config: Partial<ResourceConfig> = {}) {
		super()

		this.config = {
			memoryThresholdBytes: config.memoryThresholdBytes || 500 * 1024 * 1024, // 500MB
			monitoringIntervalMs: config.monitoringIntervalMs || 30000, // 30 seconds
			maxQueueSize: config.maxQueueSize || 10000,
			cleanupIntervalMs: config.cleanupIntervalMs || 60000, // 1 minute
			enableGcHints: config.enableGcHints !== false,
		}

		this.startMonitoring()

		// Register for shutdown
		registerForShutdown({
			name: 'ResourceManager',
			cleanup: () => this.shutdown(),
			priority: 5, // Very high priority
		})
	}

	/**
	 * Register a resource for management
	 */
	register(resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'>): void {
		if (this.isShuttingDown) {
			throw new Error('Cannot register resources during shutdown')
		}

		const managedResource: ManagedResource = {
			...resource,
			createdAt: new Date(),
			lastAccessedAt: new Date(),
		}

		this.resources.set(resource.id, managedResource)
		this.emit('resourceRegistered', resource.id, resource.type)

		// Check if we're approaching memory limits
		this.checkMemoryPressure()
	}

	/**
	 * Unregister and cleanup a resource
	 */
	async unregister(id: string): Promise<boolean> {
		const resource = this.resources.get(id)
		if (!resource) {
			return false
		}

		try {
			await this.cleanupResource(resource)
			this.resources.delete(id)
			this.emit('resourceUnregistered', id, resource.type)
			return true
		} catch (error) {
			this.emit('resourceCleanupError', id, error)
			// Still remove from tracking even if cleanup failed
			this.resources.delete(id)
			return false
		}
	}

	/**
	 * Update last accessed time for a resource
	 */
	touch(id: string): void {
		const resource = this.resources.get(id)
		if (resource) {
			resource.lastAccessedAt = new Date()
		}
	}

	/**
	 * Get current memory statistics
	 */
	getMemoryStats(): MemoryStats {
		const memUsage = process.memoryUsage()
		return {
			heapUsed: memUsage.heapUsed,
			heapTotal: memUsage.heapTotal,
			external: memUsage.external,
			rss: memUsage.rss,
			arrayBuffers: memUsage.arrayBuffers,
		}
	}

	/**
	 * Get resource statistics
	 */
	getResourceStats(): {
		total: number
		byType: Record<string, number>
		oldestResource?: { id: string; age: number }
	} {
		const byType: Record<string, number> = {}
		let oldestResource: { id: string; age: number } | undefined

		for (const [id, resource] of this.resources) {
			byType[resource.type] = (byType[resource.type] || 0) + 1

			const age = Date.now() - resource.createdAt.getTime()
			if (!oldestResource || age > oldestResource.age) {
				oldestResource = { id, age }
			}
		}

		return {
			total: this.resources.size,
			byType,
			oldestResource,
		}
	}

	/**
	 * Force cleanup of stale resources
	 */
	async cleanupStaleResources(maxAgeMs = 300000): Promise<number> {
		const now = Date.now()
		const staleResources: string[] = []

		for (const [id, resource] of this.resources) {
			const age = now - resource.lastAccessedAt.getTime()
			if (age > maxAgeMs) {
				staleResources.push(id)
			}
		}

		let cleanedCount = 0
		for (const id of staleResources) {
			if (await this.unregister(id)) {
				cleanedCount++
			}
		}

		if (cleanedCount > 0) {
			this.emit('staleResourcesCleanup', cleanedCount)
		}

		return cleanedCount
	}

	/**
	 * Apply backpressure when resource limits are exceeded
	 */
	shouldApplyBackpressure(): boolean {
		const stats = this.getResourceStats()
		const memStats = this.getMemoryStats()

		return (
			stats.total > this.config.maxQueueSize || memStats.heapUsed > this.config.memoryThresholdBytes
		)
	}

	/**
	 * Shutdown the resource manager and cleanup all resources
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return
		}

		this.isShuttingDown = true
		this.emit('shutdownStarted')

		// Stop monitoring
		this.stopMonitoring()

		// Cleanup all resources
		const cleanupPromises: Promise<void>[] = []
		for (const resource of this.resources.values()) {
			cleanupPromises.push(this.cleanupResource(resource))
		}

		try {
			await Promise.all(cleanupPromises)
			this.resources.clear()
			this.emit('shutdownCompleted')
		} catch (error) {
			this.emit('shutdownError', error)
			throw error
		}
	}

	/**
	 * Start resource monitoring
	 */
	private startMonitoring(): void {
		// Memory monitoring
		this.monitoringTimer = setInterval(() => {
			if (!this.isShuttingDown) {
				this.checkMemoryPressure()
			}
		}, this.config.monitoringIntervalMs)

		// Stale resource cleanup
		this.cleanupTimer = setInterval(() => {
			if (!this.isShuttingDown) {
				this.cleanupStaleResources().catch((error) => {
					this.emit('cleanupError', error)
				})
			}
		}, this.config.cleanupIntervalMs)
	}

	/**
	 * Stop resource monitoring
	 */
	private stopMonitoring(): void {
		if (this.monitoringTimer) {
			clearInterval(this.monitoringTimer)
			this.monitoringTimer = null
		}

		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer)
			this.cleanupTimer = null
		}
	}

	/**
	 * Check memory pressure and emit warnings
	 */
	private checkMemoryPressure(): void {
		const memStats = this.getMemoryStats()
		const resourceStats = this.getResourceStats()

		// Check memory threshold
		if (memStats.heapUsed > this.config.memoryThresholdBytes) {
			this.emit('memoryPressure', {
				current: memStats.heapUsed,
				threshold: this.config.memoryThresholdBytes,
				resourceCount: resourceStats.total,
			})

			// Suggest garbage collection if enabled
			if (this.config.enableGcHints && global.gc) {
				global.gc()
				this.emit('gcTriggered')
			}
		}

		// Check resource count
		if (resourceStats.total > this.config.maxQueueSize * 0.8) {
			this.emit('resourcePressure', {
				current: resourceStats.total,
				threshold: this.config.maxQueueSize,
			})
		}
	}

	/**
	 * Cleanup a single resource
	 */
	private async cleanupResource(resource: ManagedResource): Promise<void> {
		try {
			const result = resource.cleanup()
			if (result instanceof Promise) {
				await result
			}
		} catch (error) {
			// Log cleanup errors but don't let them stop the process
			console.error(`Failed to cleanup resource ${resource.id}:`, error)
			throw error
		}
	}
}

/**
 * Global resource manager instance
 */
let globalResourceManager: ResourceManager | null = null

/**
 * Get or create the global resource manager
 */
export function getResourceManager(config?: Partial<ResourceConfig>): ResourceManager {
	if (!globalResourceManager) {
		globalResourceManager = new ResourceManager(config)
	}
	return globalResourceManager
}

/**
 * Convenience function to register a resource
 */
export function registerResource(
	resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'>
): void {
	getResourceManager().register(resource)
}

/**
 * Convenience function to unregister a resource
 */
export async function unregisterResource(id: string): Promise<boolean> {
	return getResourceManager().unregister(id)
}

/**
 * Convenience function to check if backpressure should be applied
 */
export function shouldApplyBackpressure(): boolean {
	return getResourceManager().shouldApplyBackpressure()
}
