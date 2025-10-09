import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultBatchManager } from '../batch-manager.js'

import type { BatchConfig } from '../../types/batch.js'
import type { LogEntry } from '../../types/log-entry.js'

describe('DefaultBatchManager', () => {
	let batchManager: DefaultBatchManager
	let mockProcessor: vi.MockedFunction<(entries: LogEntry[]) => Promise<void>>
	let mockLogEntry: LogEntry

	beforeEach(() => {
		mockProcessor = vi.fn().mockResolvedValue(undefined)
		mockLogEntry = {
			id: 'test-id',
			timestamp: new Date(),
			level: 'info',
			message: 'test message',
			correlationId: 'test-correlation',
			fields: {},
			metadata: {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 1234,
			},
			source: 'test-source',
			version: '1.0.0',
		}
	})

	afterEach(async () => {
		if (batchManager) {
			await batchManager.close()
		}
		vi.clearAllMocks()
	})

	describe('Batch Size Management', () => {
		it('should flush when batch size is reached', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 2,
				timeoutMs: 10000, // Long timeout to avoid time-based flush
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			// Add entries up to batch size
			await batchManager.add(mockLogEntry)
			expect(mockProcessor).not.toHaveBeenCalled()

			await batchManager.add({ ...mockLogEntry, id: 'test-id-2' })

			// Should flush immediately when batch size is reached
			await new Promise((resolve) => setTimeout(resolve, 10)) // Allow async processing
			expect(mockProcessor).toHaveBeenCalledWith([
				mockLogEntry,
				{ ...mockLogEntry, id: 'test-id-2' },
			])
		})

		it('should handle entries larger than batch size', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 1,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			await batchManager.add(mockLogEntry)
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(mockProcessor).toHaveBeenCalledWith([mockLogEntry])
		})
	})

	describe('Timeout-based Flushing', () => {
		it('should flush after timeout even with partial batch', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				timeoutMs: 50, // Short timeout for testing
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			await batchManager.add(mockLogEntry)
			expect(mockProcessor).not.toHaveBeenCalled()

			// Wait for timeout
			await new Promise((resolve) => setTimeout(resolve, 100))
			expect(mockProcessor).toHaveBeenCalledWith([mockLogEntry])
		})
	})

	describe('Backpressure Handling', () => {
		it('should reject entries when queue is full', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				maxQueueSize: 2,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			// Fill the queue
			await batchManager.add(mockLogEntry)
			await batchManager.add({ ...mockLogEntry, id: 'test-id-2' })

			// Third entry should be rejected
			await expect(batchManager.add({ ...mockLogEntry, id: 'test-id-3' })).rejects.toThrow(
				'Queue is full'
			)
		})

		it('should report correct pending count', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			expect(batchManager.getPendingCount()).toBe(0)

			await batchManager.add(mockLogEntry)
			expect(batchManager.getPendingCount()).toBe(1)

			await batchManager.add({ ...mockLogEntry, id: 'test-id-2' })
			expect(batchManager.getPendingCount()).toBe(2)
		})
	})

	describe('Concurrency Management', () => {
		it('should respect max concurrency limits', async () => {
			let processingCount = 0
			let maxConcurrentProcessing = 0

			const slowProcessor = vi.fn().mockImplementation(async () => {
				processingCount++
				maxConcurrentProcessing = Math.max(maxConcurrentProcessing, processingCount)
				await new Promise((resolve) => setTimeout(resolve, 50))
				processingCount--
			})

			const config: Partial<BatchConfig> = {
				maxSize: 1,
				maxConcurrency: 2,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, slowProcessor)

			// Add multiple entries quickly
			const promises = []
			for (let i = 0; i < 5; i++) {
				promises.push(batchManager.add({ ...mockLogEntry, id: `test-id-${i}` }))
			}

			await Promise.all(promises)
			await batchManager.flush()

			expect(maxConcurrentProcessing).toBeLessThanOrEqual(2)
			expect(slowProcessor).toHaveBeenCalledTimes(5)
		})
	})

	describe('Flush Operations', () => {
		it('should flush all pending entries', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			await batchManager.add(mockLogEntry)
			await batchManager.add({ ...mockLogEntry, id: 'test-id-2' })

			await batchManager.flush()

			expect(mockProcessor).toHaveBeenCalledWith([
				mockLogEntry,
				{ ...mockLogEntry, id: 'test-id-2' },
			])
		})

		it('should wait for all processing to complete during flush', async () => {
			let processingComplete = false
			const slowProcessor = vi.fn().mockImplementation(async () => {
				await new Promise((resolve) => setTimeout(resolve, 50))
				processingComplete = true
			})

			const config: Partial<BatchConfig> = {
				maxSize: 1,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, slowProcessor)

			await batchManager.add(mockLogEntry)
			await batchManager.flush()

			expect(processingComplete).toBe(true)
		})
	})

	describe('Error Handling', () => {
		it('should handle processor errors gracefully', async () => {
			const errorProcessor = vi.fn().mockRejectedValue(new Error('Processing failed'))

			const config: Partial<BatchConfig> = {
				maxSize: 1,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, errorProcessor)

			// Should not throw even if processor fails
			await batchManager.add(mockLogEntry)
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(errorProcessor).toHaveBeenCalled()
		})

		it('should reject new entries when closing', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			const closePromise = batchManager.close()

			await expect(batchManager.add(mockLogEntry)).rejects.toThrow('BatchManager is closing')

			await closePromise
		})
	})

	describe('Health Monitoring', () => {
		it('should report healthy when queue is not full', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				maxQueueSize: 100,
				maxConcurrency: 10,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			expect(batchManager.isHealthy()).toBe(true)

			await batchManager.add(mockLogEntry)
			expect(batchManager.isHealthy()).toBe(true)
		})

		it('should report unhealthy when queue is near capacity', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				maxQueueSize: 10,
				maxConcurrency: 1,
				timeoutMs: 10000,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			// Fill queue to 90% capacity (9 out of 10)
			for (let i = 0; i < 9; i++) {
				await batchManager.add({ ...mockLogEntry, id: `test-id-${i}` })
			}

			expect(batchManager.isHealthy()).toBe(false)
		})
	})

	describe('Resource Cleanup', () => {
		it('should cleanup resources on close', async () => {
			const config: Partial<BatchConfig> = {
				maxSize: 10,
				timeoutMs: 100,
			}

			batchManager = new DefaultBatchManager(config, mockProcessor)

			await batchManager.add(mockLogEntry)
			await batchManager.close()

			// Should have processed the entry
			expect(mockProcessor).toHaveBeenCalledWith([mockLogEntry])

			// Should reject new entries
			await expect(batchManager.add(mockLogEntry)).rejects.toThrow('BatchManager is closing')
		})
	})
})
