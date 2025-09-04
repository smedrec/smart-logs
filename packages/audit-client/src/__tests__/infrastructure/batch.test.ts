import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BatchManager, BatchRequestOptions } from '../../infrastructure/batch'

import type { BatchingConfig } from '../../core/config'

describe('BatchManager', () => {
	let batchManager: BatchManager
	let mockRequestExecutor: vi.MockedFunction<
		(endpoint: string, options: BatchRequestOptions) => Promise<any>
	>
	let config: BatchingConfig

	beforeEach(() => {
		vi.useFakeTimers()

		config = {
			enabled: true,
			maxBatchSize: 3,
			batchTimeoutMs: 1000,
			batchableEndpoints: ['/audit/events', '/metrics/*'],
		}

		mockRequestExecutor = vi.fn()
		batchManager = new BatchManager(config, mockRequestExecutor)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
		batchManager.clear()
	})

	describe('constructor', () => {
		it('should create BatchManager instance', () => {
			expect(batchManager).toBeInstanceOf(BatchManager)
		})
	})

	describe('addToBatch', () => {
		it('should throw error when batching is disabled', async () => {
			const disabledConfig = { ...config, enabled: false }
			const disabledBatchManager = new BatchManager(disabledConfig, mockRequestExecutor)

			await expect(
				disabledBatchManager.addToBatch('/audit/events', { method: 'POST' })
			).rejects.toThrow('Batching is disabled')
		})

		it('should execute immediately for non-batchable endpoints', async () => {
			const expectedResult = { id: '123', success: true }
			mockRequestExecutor.mockResolvedValueOnce(expectedResult)

			const result = await batchManager.addToBatch('/non-batchable', { method: 'GET' })

			expect(result).toEqual(expectedResult)
			expect(mockRequestExecutor).toHaveBeenCalledWith('/non-batchable', { method: 'GET' })
		})

		it('should batch requests for batchable endpoints', async () => {
			const promise1 = batchManager.addToBatch('/audit/events', {
				method: 'POST',
				body: { id: '1' },
			})
			const promise2 = batchManager.addToBatch('/audit/events', {
				method: 'POST',
				body: { id: '2' },
			})

			mockRequestExecutor
				.mockResolvedValueOnce({ id: '1', success: true })
				.mockResolvedValueOnce({ id: '2', success: true })

			vi.advanceTimersByTime(1000)

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toEqual({ id: '1', success: true })
			expect(result2).toEqual({ id: '2', success: true })
			expect(mockRequestExecutor).toHaveBeenCalledTimes(2)
		})

		it('should deduplicate identical requests', async () => {
			const requestOptions = { method: 'POST', body: { id: '1' } }

			const promise1 = batchManager.addToBatch('/audit/events', requestOptions)
			const promise2 = batchManager.addToBatch('/audit/events', requestOptions)

			mockRequestExecutor.mockResolvedValueOnce({ id: '1', success: true })

			vi.advanceTimersByTime(1000)

			const [result1, result2] = await Promise.all([promise1, promise2])

			expect(result1).toEqual(result2)
			expect(mockRequestExecutor).toHaveBeenCalledTimes(1)
		})
	})

	describe('getStats', () => {
		it('should return correct statistics', () => {
			batchManager.addToBatch('/audit/events', { method: 'POST', body: { id: '1' } })
			batchManager.addToBatch('/audit/events', { method: 'POST', body: { id: '2' } })
			batchManager.addToBatch('/metrics/system', { method: 'GET' })

			const stats = batchManager.getStats()

			expect(stats.activeBatches).toBe(2)
			expect(stats.totalPendingRequests).toBe(3)
			expect(stats.averageBatchSize).toBe(1.5)
			expect(stats.pendingDeduplicatedRequests).toBe(3)
			expect(stats.oldestPendingRequestAge).toBeGreaterThanOrEqual(0)
		})

		it('should return zero stats when no pending requests', () => {
			const stats = batchManager.getStats()

			expect(stats.activeBatches).toBe(0)
			expect(stats.totalPendingRequests).toBe(0)
			expect(stats.averageBatchSize).toBe(0)
			expect(stats.pendingDeduplicatedRequests).toBe(0)
			expect(stats.oldestPendingRequestAge).toBe(0)
		})
	})

	describe('clear', () => {
		it('should clear all pending batches and reject promises', async () => {
			const promise = batchManager.addToBatch('/audit/events', {
				method: 'POST',
				body: { id: '1' },
			})

			batchManager.clear()

			await expect(promise).rejects.toThrow('Batch manager cleared')

			const stats = batchManager.getStats()
			expect(stats.activeBatches).toBe(0)
			expect(stats.totalPendingRequests).toBe(0)
		})
	})

	describe('updateConfig', () => {
		it('should update configuration', () => {
			const newConfig = { maxBatchSize: 5, batchTimeoutMs: 2000 }
			batchManager.updateConfig(newConfig)

			// Test that new config is applied
			for (let i = 0; i < 4; i++) {
				batchManager.addToBatch('/audit/events', {
					method: 'POST',
					body: { id: i.toString() },
				})
			}

			// Should not execute immediately since max batch size is now 5
			expect(mockRequestExecutor).not.toHaveBeenCalled()
		})
	})

	describe('endpoint pattern matching', () => {
		it('should match wildcard patterns', async () => {
			const expectedResult = { data: 'metrics' }
			mockRequestExecutor.mockResolvedValueOnce(expectedResult)

			const promise = batchManager.addToBatch('/metrics/system', { method: 'GET' })

			vi.advanceTimersByTime(1000)

			const result = await promise
			expect(result).toEqual(expectedResult)
		})

		it('should not batch non-matching endpoints', async () => {
			const expectedResult = { data: 'other' }
			mockRequestExecutor.mockResolvedValueOnce(expectedResult)

			const result = await batchManager.addToBatch('/other/endpoint', { method: 'GET' })

			expect(result).toEqual(expectedResult)
			expect(mockRequestExecutor).toHaveBeenCalledWith('/other/endpoint', { method: 'GET' })
		})
	})
})
