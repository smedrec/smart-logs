import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MemoryAwareQueue } from '../memory-aware-queue.js'

describe('MemoryAwareQueue', () => {
	let queue: MemoryAwareQueue<string>

	beforeEach(() => {
		queue = new MemoryAwareQueue<string>({
			maxSize: 100,
			maxMemoryBytes: 10 * 1024, // 10KB for testing
			monitoringIntervalMs: 100, // Fast monitoring for tests
			enableAdaptiveSize: true,
		})
	})

	afterEach(async () => {
		await queue.close()
	})

	describe('Basic Queue Operations', () => {
		it('should enqueue and dequeue items', () => {
			expect(queue.enqueue('item1')).toBe(true)
			expect(queue.enqueue('item2')).toBe(true)

			expect(queue.size()).toBe(2)
			expect(queue.dequeue()).toBe('item1')
			expect(queue.dequeue()).toBe('item2')
			expect(queue.size()).toBe(0)
		})

		it('should maintain FIFO order', () => {
			const items = ['first', 'second', 'third']
			items.forEach((item) => queue.enqueue(item))

			const dequeued = []
			while (!queue.isEmpty()) {
				dequeued.push(queue.dequeue())
			}

			expect(dequeued).toEqual(items)
		})

		it('should handle peek operation', () => {
			queue.enqueue('peek-item')
			queue.enqueue('second-item')

			expect(queue.peek()).toBe('peek-item')
			expect(queue.size()).toBe(2) // Size should not change

			queue.dequeue()
			expect(queue.peek()).toBe('second-item')
		})

		it('should handle empty queue operations', () => {
			expect(queue.dequeue()).toBeUndefined()
			expect(queue.peek()).toBeUndefined()
			expect(queue.isEmpty()).toBe(true)
			expect(queue.size()).toBe(0)
		})
	})

	describe('Batch Operations', () => {
		it('should dequeue items in batches', () => {
			const items = ['item1', 'item2', 'item3', 'item4', 'item5']
			items.forEach((item) => queue.enqueue(item))

			const batch1 = queue.dequeueBatch(3)
			expect(batch1).toEqual(['item1', 'item2', 'item3'])
			expect(queue.size()).toBe(2)

			const batch2 = queue.dequeueBatch(5) // Request more than available
			expect(batch2).toEqual(['item4', 'item5'])
			expect(queue.size()).toBe(0)
		})

		it('should handle batch operations on empty queue', () => {
			const batch = queue.dequeueBatch(5)
			expect(batch).toEqual([])
		})
	})

	describe('Memory Management', () => {
		it('should estimate item sizes', () => {
			const smallItem = 'small'
			const largeItem = 'a'.repeat(1000)

			queue.enqueue(smallItem)
			const statsAfterSmall = queue.getStats()

			queue.clear()
			queue.enqueue(largeItem)
			const statsAfterLarge = queue.getStats()

			expect(statsAfterLarge.estimatedMemoryBytes).toBeGreaterThan(
				statsAfterSmall.estimatedMemoryBytes
			)
		})

		it('should apply backpressure when memory limit is exceeded', () => {
			// Create a queue with very small memory limit
			const smallQueue = new MemoryAwareQueue<string>({
				maxSize: 1000,
				maxMemoryBytes: 100, // 100 bytes
				monitoringIntervalMs: 1000,
			})

			// Fill with large items to exceed memory limit
			const largeItem = 'x'.repeat(50) // 50 bytes each
			let rejectedCount = 0

			for (let i = 0; i < 10; i++) {
				if (!smallQueue.enqueue(largeItem)) {
					rejectedCount++
				}
			}

			expect(rejectedCount).toBeGreaterThan(0)
			smallQueue.close()
		})

		it('should apply backpressure when size limit is exceeded', () => {
			const smallQueue = new MemoryAwareQueue<string>({
				maxSize: 3,
				maxMemoryBytes: 10 * 1024,
				monitoringIntervalMs: 1000,
			})

			// Fill beyond size limit
			expect(smallQueue.enqueue('item1')).toBe(true)
			expect(smallQueue.enqueue('item2')).toBe(true)
			expect(smallQueue.enqueue('item3')).toBe(true)
			expect(smallQueue.enqueue('item4')).toBe(false) // Should be rejected

			expect(smallQueue.size()).toBe(3)
			smallQueue.close()
		})

		it('should emit backpressure events', async () => {
			const smallQueue = new MemoryAwareQueue<string>({
				maxSize: 2,
				maxMemoryBytes: 10 * 1024,
				monitoringIntervalMs: 1000,
			})

			const backpressurePromise = new Promise<void>((resolve) => {
				smallQueue.on('backpressure', (data) => {
					expect(data.queueSize).toBe(2)
					expect(data.reason).toBe('queue_full_or_memory_pressure')
					resolve()
				})
			})

			smallQueue.enqueue('item1')
			smallQueue.enqueue('item2')
			smallQueue.enqueue('item3') // Should trigger backpressure event

			await backpressurePromise
			await smallQueue.close()
		})
	})

	describe('Age-based Cleanup', () => {
		it('should remove old items', async () => {
			queue.enqueue('old-item')

			// Wait a bit to make the item "old"
			await new Promise((resolve) => setTimeout(resolve, 50))

			queue.enqueue('new-item')

			// Remove items older than 25ms
			const removedCount = queue.removeOldItems(25)

			expect(removedCount).toBe(1)
			expect(queue.size()).toBe(1)
			expect(queue.peek()).toBe('new-item')
		})

		it('should not remove recent items', () => {
			queue.enqueue('recent-item')

			// Remove items older than 1 second (should not remove anything)
			const removedCount = queue.removeOldItems(1000)

			expect(removedCount).toBe(0)
			expect(queue.size()).toBe(1)
		})

		it('should emit old items removal events', async () => {
			const removalPromise = new Promise<void>((resolve) => {
				queue.on('oldItemsRemoved', (data) => {
					expect(data.removedCount).toBe(1)
					expect(data.queueSize).toBe(0)
					resolve()
				})
			})

			queue.enqueue('old-item')

			// Wait and then remove old items
			await new Promise((resolve) => setTimeout(resolve, 20))
			queue.removeOldItems(10) // Remove items older than 10ms

			await removalPromise
		})
	})

	describe('Statistics and Monitoring', () => {
		it('should provide accurate statistics', () => {
			const items = ['item1', 'item2', 'item3']
			items.forEach((item) => queue.enqueue(item))

			const stats = queue.getStats()

			expect(stats.size).toBe(3)
			expect(stats.estimatedMemoryBytes).toBeGreaterThan(0)
			expect(stats.averageItemSize).toBeGreaterThan(0)
			expect(stats.oldestItemAge).toBeGreaterThanOrEqual(0)
		})

		it('should handle statistics for empty queue', () => {
			const stats = queue.getStats()

			expect(stats.size).toBe(0)
			expect(stats.estimatedMemoryBytes).toBe(0)
			expect(stats.averageItemSize).toBe(0)
			expect(stats.oldestItemAge).toBeNull()
		})

		it('should emit item lifecycle events', () => {
			const events: string[] = []

			queue.on('itemAdded', () => events.push('added'))
			queue.on('itemRemoved', () => events.push('removed'))
			queue.on('batchRemoved', () => events.push('batchRemoved'))

			queue.enqueue('item1')
			queue.enqueue('item2')
			queue.dequeue()
			queue.dequeueBatch(1)

			expect(events).toEqual(['added', 'added', 'removed', 'batchRemoved'])
		})
	})

	describe('Clear and Close Operations', () => {
		it('should clear all items', () => {
			const items = ['item1', 'item2', 'item3']
			items.forEach((item) => queue.enqueue(item))

			queue.clear()

			expect(queue.size()).toBe(0)
			expect(queue.isEmpty()).toBe(true)
			expect(queue.getStats().estimatedMemoryBytes).toBe(0)
		})

		it('should emit clear events', async () => {
			const clearPromise = new Promise<void>((resolve) => {
				queue.on('queueCleared', (data) => {
					expect(data.clearedCount).toBe(2)
					resolve()
				})
			})

			queue.enqueue('item1')
			queue.enqueue('item2')
			queue.clear()

			await clearPromise
		})

		it('should reject items after close', async () => {
			await queue.close()

			expect(queue.enqueue('item')).toBe(false)
		})
	})

	describe('Memory Pressure Handling', () => {
		it('should emit memory pressure warnings', async () => {
			// Create queue with very small memory limit
			const pressureQueue = new MemoryAwareQueue<string>({
				maxSize: 1000,
				maxMemoryBytes: 200, // 200 bytes
				monitoringIntervalMs: 50,
			})

			const pressurePromise = new Promise<void>((resolve) => {
				pressureQueue.on('memoryPressureWarning', (data) => {
					expect(data.currentUsage).toBeGreaterThan(data.maxUsage * 0.8)
					resolve()
				})
			})

			// Fill with items to trigger memory pressure
			const largeItem = 'x'.repeat(50)
			for (let i = 0; i < 5; i++) {
				pressureQueue.enqueue(largeItem)
			}

			await pressurePromise
			await pressureQueue.close()
		})

		it('should handle adaptive size adjustments', async () => {
			// This test verifies that the queue can adapt to memory pressure
			// by removing old items automatically
			const adaptiveQueue = new MemoryAwareQueue<string>({
				maxSize: 1000,
				maxMemoryBytes: 10 * 1024,
				monitoringIntervalMs: 50,
				enableAdaptiveSize: true,
			})

			// Add items and wait for potential cleanup
			adaptiveQueue.enqueue('item1')
			adaptiveQueue.enqueue('item2')

			// Wait for monitoring cycle
			await new Promise((resolve) => setTimeout(resolve, 100))

			// Queue should still be functional
			expect(adaptiveQueue.enqueue('item3')).toBe(true)

			await adaptiveQueue.close()
		})
	})

	describe('Error Handling', () => {
		it('should handle serialization errors gracefully', () => {
			// Create an object that will cause JSON.stringify to fail
			const circularObj: any = {}
			circularObj.self = circularObj

			// Should still enqueue successfully with default size estimate
			expect(queue.enqueue(circularObj as any)).toBe(true)
			expect(queue.size()).toBe(1)
		})

		it('should handle monitoring errors gracefully', async () => {
			// Create a queue and let it run for a bit to ensure monitoring doesn't crash
			const monitoringQueue = new MemoryAwareQueue<string>({
				maxSize: 100,
				maxMemoryBytes: 10 * 1024,
				monitoringIntervalMs: 10, // Very fast monitoring
			})

			monitoringQueue.enqueue('test-item')

			// Wait for several monitoring cycles
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(monitoringQueue.size()).toBe(1)
			await monitoringQueue.close()
		})
	})
})
