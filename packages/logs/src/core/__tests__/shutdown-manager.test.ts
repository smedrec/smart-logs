import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShutdownManager } from '../shutdown-manager.js'

import type { ShutdownResource } from '../shutdown-manager.js'

describe('ShutdownManager', () => {
	let shutdownManager: ShutdownManager
	let mockResources: ShutdownResource[]

	beforeEach(() => {
		shutdownManager = new ShutdownManager({
			timeoutMs: 5000,
			handleSignals: false, // Disable signal handling in tests
		})
		mockResources = []
	})

	afterEach(async () => {
		await shutdownManager.destroy()
	})

	describe('Resource Registration', () => {
		it('should register resources successfully', () => {
			const resource: ShutdownResource = {
				name: 'test-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
				priority: 10,
			}

			shutdownManager.register(resource)
			expect(shutdownManager.getRegisteredResources()).toContain('test-resource')
		})

		it('should unregister resources successfully', () => {
			const resource: ShutdownResource = {
				name: 'test-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			shutdownManager.register(resource)
			expect(shutdownManager.unregister('test-resource')).toBe(true)
			expect(shutdownManager.getRegisteredResources()).not.toContain('test-resource')
		})

		it('should not allow registration during shutdown', async () => {
			const resource: ShutdownResource = {
				name: 'test-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			// Start shutdown
			const shutdownPromise = shutdownManager.shutdown()

			// Try to register during shutdown
			expect(() => shutdownManager.register(resource)).toThrow(
				'Cannot register resources during shutdown'
			)

			await shutdownPromise
		})
	})

	describe('Graceful Shutdown', () => {
		it('should shutdown resources in priority order', async () => {
			const cleanupOrder: string[] = []

			const resources: ShutdownResource[] = [
				{
					name: 'high-priority',
					cleanup: vi.fn().mockImplementation(() => {
						cleanupOrder.push('high-priority')
						return Promise.resolve()
					}),
					priority: 1,
				},
				{
					name: 'medium-priority',
					cleanup: vi.fn().mockImplementation(() => {
						cleanupOrder.push('medium-priority')
						return Promise.resolve()
					}),
					priority: 50,
				},
				{
					name: 'low-priority',
					cleanup: vi.fn().mockImplementation(() => {
						cleanupOrder.push('low-priority')
						return Promise.resolve()
					}),
					priority: 100,
				},
			]

			resources.forEach((resource) => shutdownManager.register(resource))

			await shutdownManager.shutdown()

			expect(cleanupOrder).toEqual(['high-priority', 'medium-priority', 'low-priority'])
		})

		it('should wait for all pending operations to complete', async () => {
			let operationCompleted = false
			const resource: ShutdownResource = {
				name: 'async-resource',
				cleanup: vi.fn().mockImplementation(async () => {
					await new Promise((resolve) => setTimeout(resolve, 100))
					operationCompleted = true
				}),
			}

			shutdownManager.register(resource)

			await shutdownManager.shutdown()

			expect(operationCompleted).toBe(true)
			expect(resource.cleanup).toHaveBeenCalledOnce()
		})

		it('should handle cleanup errors gracefully', async () => {
			const workingResource: ShutdownResource = {
				name: 'working-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			const failingResource: ShutdownResource = {
				name: 'failing-resource',
				cleanup: vi.fn().mockRejectedValue(new Error('Cleanup failed')),
			}

			shutdownManager.register(workingResource)
			shutdownManager.register(failingResource)

			await expect(shutdownManager.shutdown()).rejects.toThrow('Shutdown errors occurred')

			// Both cleanup methods should have been called
			expect(workingResource.cleanup).toHaveBeenCalledOnce()
			expect(failingResource.cleanup).toHaveBeenCalledOnce()
		})

		it('should timeout if shutdown takes too long', async () => {
			const slowResource: ShutdownResource = {
				name: 'slow-resource',
				cleanup: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(resolve, 10000)) // 10 seconds
				),
			}

			const fastShutdownManager = new ShutdownManager({
				timeoutMs: 100, // 100ms timeout
				handleSignals: false,
			})

			fastShutdownManager.register(slowResource)

			await expect(fastShutdownManager.shutdown()).rejects.toThrow('Shutdown timeout after 100ms')

			await fastShutdownManager.destroy()
		})

		it('should emit shutdown events', async () => {
			const events: string[] = []

			shutdownManager.on('shutdownStarted', () => events.push('started'))
			shutdownManager.on('shutdownCompleted', () => events.push('completed'))
			shutdownManager.on('resourceShutdownStarted', (name) =>
				events.push(`resource-${name}-started`)
			)
			shutdownManager.on('resourceShutdownCompleted', ({ name }) =>
				events.push(`resource-${name}-completed`)
			)

			const resource: ShutdownResource = {
				name: 'test-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			shutdownManager.register(resource)
			await shutdownManager.shutdown()

			expect(events).toEqual([
				'started',
				'resource-test-resource-started',
				'resource-test-resource-completed',
				'completed',
			])
		})

		it('should not allow multiple shutdown calls', async () => {
			const resource: ShutdownResource = {
				name: 'test-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			shutdownManager.register(resource)

			const firstShutdown = shutdownManager.shutdown()
			const secondShutdown = shutdownManager.shutdown()

			await Promise.all([firstShutdown, secondShutdown])

			// Cleanup should only be called once
			expect(resource.cleanup).toHaveBeenCalledOnce()
		})
	})

	describe('Signal Handling', () => {
		it('should setup signal handlers when enabled', () => {
			const signalManager = new ShutdownManager({
				handleSignals: true,
				signals: ['SIGTERM', 'SIGINT'],
			})

			// We can't easily test actual signal handling in unit tests,
			// but we can verify the manager was created successfully
			expect(signalManager.isShutdown()).toBe(false)

			// Cleanup
			signalManager.destroy()
		})

		it('should not setup signal handlers when disabled', () => {
			const signalManager = new ShutdownManager({
				handleSignals: false,
			})

			expect(signalManager.isShutdown()).toBe(false)

			// Cleanup
			signalManager.destroy()
		})
	})

	describe('Resource Lifecycle', () => {
		it('should track resource registration and unregistration', () => {
			const events: Array<{ event: string; name: string }> = []

			shutdownManager.on('resourceRegistered', (name) => events.push({ event: 'registered', name }))
			shutdownManager.on('resourceUnregistered', (name) =>
				events.push({ event: 'unregistered', name })
			)

			const resource: ShutdownResource = {
				name: 'tracked-resource',
				cleanup: vi.fn().mockResolvedValue(undefined),
			}

			shutdownManager.register(resource)
			shutdownManager.unregister('tracked-resource')

			expect(events).toEqual([
				{ event: 'registered', name: 'tracked-resource' },
				{ event: 'unregistered', name: 'tracked-resource' },
			])
		})

		it('should handle synchronous cleanup functions', async () => {
			let cleanupCalled = false

			const resource: ShutdownResource = {
				name: 'sync-resource',
				cleanup: () => {
					cleanupCalled = true
				},
			}

			shutdownManager.register(resource)
			await shutdownManager.shutdown()

			expect(cleanupCalled).toBe(true)
		})
	})
})
