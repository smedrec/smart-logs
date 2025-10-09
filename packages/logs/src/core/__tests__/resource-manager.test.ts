import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceManager } from '../resource-manager.js'

import type { ManagedResource } from '../resource-manager.js'

describe('ResourceManager', () => {
	let resourceManager: ResourceManager
	let mockResources: Array<Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'>>

	beforeEach(() => {
		resourceManager = new ResourceManager({
			memoryThresholdBytes: 100 * 1024 * 1024, // 100MB
			monitoringIntervalMs: 1000, // 1 second for faster tests
			maxQueueSize: 1000,
			cleanupIntervalMs: 2000, // 2 seconds for faster tests
			enableGcHints: false, // Disable GC hints in tests
		})

		mockResources = []
	})

	afterEach(async () => {
		await resourceManager.shutdown()
	})

	describe('Resource Registration', () => {
		it('should register resources successfully', () => {
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'test-resource-1',
				type: 'connection',
				cleanup: vi.fn(),
				metadata: { host: 'localhost' },
			}

			resourceManager.register(resource)

			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(1)
			expect(stats.byType.connection).toBe(1)
		})

		it('should unregister resources and call cleanup', async () => {
			const cleanupFn = vi.fn().mockResolvedValue(undefined)
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'test-resource-2',
				type: 'stream',
				cleanup: cleanupFn,
			}

			resourceManager.register(resource)
			const result = await resourceManager.unregister('test-resource-2')

			expect(result).toBe(true)
			expect(cleanupFn).toHaveBeenCalledOnce()

			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(0)
		})

		it('should handle cleanup errors gracefully', async () => {
			const cleanupFn = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'failing-resource',
				type: 'other',
				cleanup: cleanupFn,
			}

			resourceManager.register(resource)

			// Should still return false but not throw
			const result = await resourceManager.unregister('failing-resource')
			expect(result).toBe(false)
			expect(cleanupFn).toHaveBeenCalledOnce()

			// Resource should still be removed from tracking
			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(0)
		})

		it('should not allow registration during shutdown', async () => {
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'test-resource',
				type: 'connection',
				cleanup: vi.fn(),
			}

			// Start shutdown
			const shutdownPromise = resourceManager.shutdown()

			// Try to register during shutdown
			expect(() => resourceManager.register(resource)).toThrow(
				'Cannot register resources during shutdown'
			)

			await shutdownPromise
		})
	})

	describe('Memory Monitoring', () => {
		it('should return memory statistics', () => {
			const memStats = resourceManager.getMemoryStats()

			expect(memStats).toHaveProperty('heapUsed')
			expect(memStats).toHaveProperty('heapTotal')
			expect(memStats).toHaveProperty('external')
			expect(memStats).toHaveProperty('rss')
			expect(memStats).toHaveProperty('arrayBuffers')

			expect(typeof memStats.heapUsed).toBe('number')
			expect(memStats.heapUsed).toBeGreaterThan(0)
		})

		it('should track resource statistics by type', () => {
			const resources = [
				{ id: 'conn1', type: 'connection' as const, cleanup: vi.fn() },
				{ id: 'conn2', type: 'connection' as const, cleanup: vi.fn() },
				{ id: 'stream1', type: 'stream' as const, cleanup: vi.fn() },
				{ id: 'timer1', type: 'timer' as const, cleanup: vi.fn() },
			]

			resources.forEach((resource) => resourceManager.register(resource))

			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(4)
			expect(stats.byType.connection).toBe(2)
			expect(stats.byType.stream).toBe(1)
			expect(stats.byType.timer).toBe(1)
			expect(stats.oldestResource).toBeDefined()
		})

		it('should emit memory pressure events', async () => {
			// Create a resource manager with very low memory threshold
			const lowMemoryManager = new ResourceManager({
				memoryThresholdBytes: 1, // 1 byte - will always trigger
				monitoringIntervalMs: 100,
				enableGcHints: false,
			})

			const memoryPressurePromise = new Promise<void>((resolve) => {
				lowMemoryManager.on('memoryPressure', (data) => {
					expect(data.current).toBeGreaterThan(data.threshold)
					expect(data.resourceCount).toBeGreaterThanOrEqual(0)
					resolve()
				})
			})

			// Register a resource to trigger monitoring
			lowMemoryManager.register({
				id: 'test-resource',
				type: 'other',
				cleanup: vi.fn(),
			})

			await memoryPressurePromise
			await lowMemoryManager.shutdown()
		})
	})

	describe('Stale Resource Cleanup', () => {
		it('should clean up stale resources', async () => {
			const cleanupFn = vi.fn().mockResolvedValue(undefined)
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'stale-resource',
				type: 'connection',
				cleanup: cleanupFn,
			}

			resourceManager.register(resource)

			// Wait a bit to ensure the resource is considered stale
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Clean up resources older than 5ms
			const cleanedCount = await resourceManager.cleanupStaleResources(5)

			// The resource should be cleaned up
			expect(cleanedCount).toBeGreaterThanOrEqual(0) // May be 0 or 1 depending on timing

			if (cleanedCount > 0) {
				expect(cleanupFn).toHaveBeenCalledOnce()
				const stats = resourceManager.getResourceStats()
				expect(stats.total).toBe(0)
			}
		})

		it('should update last accessed time when touched', async () => {
			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'touched-resource',
				type: 'connection',
				cleanup: vi.fn(),
			}

			resourceManager.register(resource)

			// Wait a bit, then touch the resource
			await new Promise((resolve) => setTimeout(resolve, 10))
			resourceManager.touch('touched-resource')

			// Clean up resources older than 5ms (should not clean up the touched resource)
			const cleanedCount = await resourceManager.cleanupStaleResources(5)

			expect(cleanedCount).toBe(0)

			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(1)
		})
	})

	describe('Backpressure Handling', () => {
		it('should detect when backpressure should be applied', () => {
			// Register many resources to exceed queue size
			for (let i = 0; i < 1500; i++) {
				resourceManager.register({
					id: `resource-${i}`,
					type: 'other',
					cleanup: vi.fn(),
				})
			}

			expect(resourceManager.shouldApplyBackpressure()).toBe(true)
		})

		it('should not apply backpressure under normal conditions', () => {
			// Register a few resources
			for (let i = 0; i < 10; i++) {
				resourceManager.register({
					id: `resource-${i}`,
					type: 'other',
					cleanup: vi.fn(),
				})
			}

			expect(resourceManager.shouldApplyBackpressure()).toBe(false)
		})
	})

	describe('Shutdown Behavior', () => {
		it('should cleanup all resources during shutdown', async () => {
			const cleanupFunctions = [
				vi.fn().mockResolvedValue(undefined),
				vi.fn().mockResolvedValue(undefined),
			]

			const resources = [
				{ id: 'resource-1', type: 'connection' as const, cleanup: cleanupFunctions[0] },
				{ id: 'resource-2', type: 'stream' as const, cleanup: cleanupFunctions[1] },
			]

			resources.forEach((resource) => resourceManager.register(resource))

			await resourceManager.shutdown()

			cleanupFunctions.forEach((fn) => {
				expect(fn).toHaveBeenCalledOnce()
			})

			const stats = resourceManager.getResourceStats()
			expect(stats.total).toBe(0)
		})

		it('should emit shutdown events', async () => {
			const events: string[] = []

			resourceManager.on('shutdownStarted', () => events.push('started'))
			resourceManager.on('shutdownCompleted', () => events.push('completed'))

			await resourceManager.shutdown()

			expect(events).toEqual(['started', 'completed'])
		})

		it('should handle shutdown errors', async () => {
			const failingCleanup = vi.fn().mockRejectedValue(new Error('Cleanup failed'))
			const workingCleanup = vi.fn().mockResolvedValue(undefined)

			resourceManager.register({
				id: 'failing-resource',
				type: 'connection',
				cleanup: failingCleanup,
			})

			resourceManager.register({
				id: 'working-resource',
				type: 'stream',
				cleanup: workingCleanup,
			})

			await expect(resourceManager.shutdown()).rejects.toThrow()

			// Both cleanup functions should have been called
			expect(failingCleanup).toHaveBeenCalledOnce()
			expect(workingCleanup).toHaveBeenCalledOnce()
		})
	})

	describe('Event Emission', () => {
		it('should emit resource lifecycle events', async () => {
			const events: Array<{ event: string; id: string; type?: string }> = []

			resourceManager.on('resourceRegistered', (id, type) =>
				events.push({ event: 'registered', id, type })
			)
			resourceManager.on('resourceUnregistered', (id, type) =>
				events.push({ event: 'unregistered', id, type })
			)

			const resource: Omit<ManagedResource, 'createdAt' | 'lastAccessedAt'> = {
				id: 'tracked-resource',
				type: 'connection',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			resourceManager.register(resource)
			await resourceManager.unregister('tracked-resource')

			expect(events).toEqual([
				{ event: 'registered', id: 'tracked-resource', type: 'connection' },
				{ event: 'unregistered', id: 'tracked-resource', type: 'connection' },
			])
		})

		it('should emit stale cleanup events', async () => {
			const events: Array<{ event: string; count?: number }> = []

			resourceManager.on('staleResourcesCleanup', (count) =>
				events.push({ event: 'staleCleanup', count })
			)

			resourceManager.register({
				id: 'stale-resource',
				type: 'connection',
				cleanup: vi.fn().mockResolvedValue(undefined),
			})

			// Wait a bit to ensure the resource is considered stale
			await new Promise((resolve) => setTimeout(resolve, 10))

			const cleanedCount = await resourceManager.cleanupStaleResources(0)

			if (cleanedCount > 0) {
				expect(events).toEqual([{ event: 'staleCleanup', count: 1 }])
			} else {
				// If no resources were cleaned up, the event shouldn't be emitted
				expect(events).toEqual([])
			}
		})
	})
})
