import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CircuitBreakerState,
	HttpError,
	LocalStorageCircuitBreakerPersistence,
	MemoryCircuitBreakerPersistence,
	RetryExhaustedError,
	RetryManager,
} from '../../infrastructure/retry'

import type { RetryConfig } from '../../core/config'
import type {
	CircuitBreakerConfig,
	CircuitBreakerPersistence,
	CircuitBreakerStats,
	RetryContext,
} from '../../infrastructure/retry'

describe('Circuit Breaker Persistence', () => {
	let mockOperation: ReturnType<typeof vi.fn>
	let context: RetryContext

	const defaultConfig: RetryConfig = {
		enabled: true,
		maxAttempts: 3,
		initialDelayMs: 100,
		maxDelayMs: 1000,
		backoffMultiplier: 2,
		retryableStatusCodes: [408, 429, 500, 502, 503, 504],
		retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
	}

	const circuitBreakerConfig: CircuitBreakerConfig = {
		enabled: true,
		failureThreshold: 3,
		recoveryTimeoutMs: 1000,
		monitoringWindowMs: 5000,
		minimumRequestThreshold: 2,
	}

	beforeEach(() => {
		mockOperation = vi.fn()
		context = {
			endpoint: '/test',
			requestId: 'test-123',
			method: 'GET',
		}

		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	describe('MemoryCircuitBreakerPersistence', () => {
		let persistence: MemoryCircuitBreakerPersistence

		beforeEach(() => {
			persistence = new MemoryCircuitBreakerPersistence()
		})

		it('should save and load circuit breaker state', async () => {
			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
				lastFailureTime: Date.now(),
				nextRetryTime: Date.now() + 1000,
			}

			await persistence.save('test-key', stats)
			const loaded = await persistence.load('test-key')

			expect(loaded).toBeTruthy()
			expect(loaded!.state).toBe(CircuitBreakerState.OPEN)
			expect(loaded!.failureCount).toBe(5)
			expect(loaded!.successCount).toBe(2)
			expect(loaded!.persistedAt).toBeDefined()
		})

		it('should return null for non-existent key', async () => {
			const loaded = await persistence.load('non-existent')
			expect(loaded).toBeNull()
		})

		it('should load all persisted states', async () => {
			const stats1: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			const stats2: CircuitBreakerStats = {
				state: CircuitBreakerState.CLOSED,
				failureCount: 1,
				successCount: 10,
				totalRequests: 11,
			}

			await persistence.save('key1', stats1)
			await persistence.save('key2', stats2)

			const allStats = await persistence.loadAll()
			expect(allStats.size).toBe(2)
			expect(allStats.get('key1')?.state).toBe(CircuitBreakerState.OPEN)
			expect(allStats.get('key2')?.state).toBe(CircuitBreakerState.CLOSED)
		})

		it('should clear specific key', async () => {
			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			await persistence.save('test-key', stats)
			await persistence.clear('test-key')

			const loaded = await persistence.load('test-key')
			expect(loaded).toBeNull()
		})

		it('should clear all keys', async () => {
			await persistence.save('key1', {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			})
			await persistence.save('key2', {
				state: CircuitBreakerState.CLOSED,
				failureCount: 1,
				successCount: 10,
				totalRequests: 11,
			})

			await persistence.clearAll()

			const allStats = await persistence.loadAll()
			expect(allStats.size).toBe(0)
		})
	})

	describe('LocalStorageCircuitBreakerPersistence', () => {
		let persistence: LocalStorageCircuitBreakerPersistence
		let localStorageMock: Record<string, string>

		beforeEach(() => {
			localStorageMock = {}

			// Mock localStorage
			const getItemMock = vi.fn((key: string) => localStorageMock[key] || null)
			const setItemMock = vi.fn((key: string, value: string) => {
				localStorageMock[key] = value
			})
			const removeItemMock = vi.fn((key: string) => {
				delete localStorageMock[key]
			})
			const clearMock = vi.fn(() => {
				localStorageMock = {}
			})
			const keyMock = vi.fn((index: number) => Object.keys(localStorageMock)[index] || null)

			global.localStorage = {
				getItem: getItemMock,
				setItem: setItemMock,
				removeItem: removeItemMock,
				clear: clearMock,
				key: keyMock,
				get length() {
					return Object.keys(localStorageMock).length
				},
			} as any

			persistence = new LocalStorageCircuitBreakerPersistence('test-cb:')
		})

		it('should save and load circuit breaker state from localStorage', async () => {
			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
				lastFailureTime: Date.now(),
			}

			await persistence.save('test-key', stats)
			const loaded = await persistence.load('test-key')

			expect(loaded).toBeTruthy()
			expect(loaded!.state).toBe(CircuitBreakerState.OPEN)
			expect(loaded!.failureCount).toBe(5)
			expect(loaded!.persistedAt).toBeDefined()
		})

		it('should use custom prefix for storage keys', async () => {
			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			await persistence.save('test-key', stats)

			expect(localStorage.setItem).toHaveBeenCalledWith('test-cb:test-key', expect.any(String))
		})

		it('should handle localStorage errors gracefully', async () => {
			// Mock localStorage to throw error
			vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
				throw new Error('QuotaExceededError')
			})

			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			// Should not throw
			await expect(persistence.save('test-key', stats)).resolves.toBeUndefined()
		})

		it('should load all persisted states from localStorage', async () => {
			const stats1: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			const stats2: CircuitBreakerStats = {
				state: CircuitBreakerState.CLOSED,
				failureCount: 1,
				successCount: 10,
				totalRequests: 11,
			}

			await persistence.save('key1', stats1)
			await persistence.save('key2', stats2)

			const allStats = await persistence.loadAll()
			expect(allStats.size).toBe(2)
			expect(allStats.get('key1')?.state).toBe(CircuitBreakerState.OPEN)
			expect(allStats.get('key2')?.state).toBe(CircuitBreakerState.CLOSED)
		})

		it('should clear specific key from localStorage', async () => {
			const stats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			}

			await persistence.save('test-key', stats)
			await persistence.clear('test-key')

			const loaded = await persistence.load('test-key')
			expect(loaded).toBeNull()
		})

		it('should clear all keys with prefix from localStorage', async () => {
			await persistence.save('key1', {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
			})
			await persistence.save('key2', {
				state: CircuitBreakerState.CLOSED,
				failureCount: 1,
				successCount: 10,
				totalRequests: 11,
			})

			// Add a key with different prefix that should not be cleared
			localStorageMock['other-prefix:key3'] = JSON.stringify({
				state: CircuitBreakerState.CLOSED,
				failureCount: 0,
				successCount: 5,
				totalRequests: 5,
			})

			await persistence.clearAll()

			const allStats = await persistence.loadAll()
			expect(allStats.size).toBe(0)
			expect(localStorageMock['other-prefix:key3']).toBeDefined()
		})
	})

	describe('RetryManager with Persistence', () => {
		let persistence: CircuitBreakerPersistence
		let retryManager: RetryManager

		beforeEach(() => {
			persistence = new MemoryCircuitBreakerPersistence()
		})

		it('should persist circuit breaker state on failure', async () => {
			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			const httpError = new HttpError(500, 'Internal Server Error')

			// Trigger failures to open circuit breaker
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow()
			}

			// Verify state was persisted
			const persistedStats = await persistence.load('/test:GET')
			expect(persistedStats).toBeTruthy()
			expect(persistedStats!.state).toBe(CircuitBreakerState.OPEN)
			expect(persistedStats!.failureCount).toBeGreaterThan(0)
			expect(persistedStats!.persistedAt).toBeDefined()
		})

		it('should persist circuit breaker state on success', async () => {
			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			mockOperation.mockResolvedValue('success')
			await retryManager.execute(mockOperation, context)

			// Verify state was persisted
			const persistedStats = await persistence.load('/test:GET')
			expect(persistedStats).toBeTruthy()
			expect(persistedStats!.successCount).toBeGreaterThan(0)
			expect(persistedStats!.persistedAt).toBeDefined()
		})

		it('should load persisted state on initialization', async () => {
			// First, create a circuit breaker and trigger it to open
			const firstManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			const httpError = new HttpError(500, 'Internal Server Error')
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = firstManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow()
			}

			// Verify circuit is open
			const stats = firstManager.getCircuitBreakerStats('/test:GET')
			expect(stats).toBeTruthy()
			expect((stats as CircuitBreakerStats).state).toBe(CircuitBreakerState.OPEN)

			// Create a new manager with the same persistence
			const secondManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			// The circuit should still be open (loaded from persistence)
			mockOperation.mockResolvedValue('success')
			await expect(secondManager.execute(mockOperation, context)).rejects.toThrow(
				'Circuit breaker is open'
			)
		})

		it('should only restore states less than 1 hour old', async () => {
			// Create old persisted state (more than 1 hour old)
			const oldStats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 5,
				successCount: 2,
				totalRequests: 7,
				lastFailureTime: Date.now() - 7200000, // 2 hours ago
				persistedAt: Date.now() - 7200000, // 2 hours ago
			}

			await persistence.save('/old:GET', oldStats)

			// Create recent persisted state (less than 1 hour old)
			const recentStats: CircuitBreakerStats = {
				state: CircuitBreakerState.OPEN,
				failureCount: 3,
				successCount: 1,
				totalRequests: 4,
				lastFailureTime: Date.now() - 1800000, // 30 minutes ago
				persistedAt: Date.now() - 1800000, // 30 minutes ago
			}

			await persistence.save('/recent:GET', recentStats)

			// Create new manager
			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			// Load persisted state
			await retryManager.loadPersistedState()

			// Old state should not be loaded into circuit breakers
			const oldLoaded = retryManager.getCircuitBreakerStats('/old:GET')
			expect(oldLoaded).toBeNull()

			// Old state should also be cleared from persistence
			const oldPersisted = await persistence.load('/old:GET')
			expect(oldPersisted).toBeNull()

			// Recent state should be loaded
			const recentLoaded = retryManager.getCircuitBreakerStats('/recent:GET')
			expect(recentLoaded).toBeTruthy()
			expect((recentLoaded as CircuitBreakerStats).state).toBe(CircuitBreakerState.OPEN)
		})

		it('should handle persistence failures gracefully', async () => {
			// Create a persistence implementation that fails
			const failingPersistence: CircuitBreakerPersistence = {
				save: vi.fn().mockRejectedValue(new Error('Save failed')),
				load: vi.fn().mockRejectedValue(new Error('Load failed')),
				loadAll: vi.fn().mockRejectedValue(new Error('LoadAll failed')),
				clear: vi.fn().mockRejectedValue(new Error('Clear failed')),
				clearAll: vi.fn().mockRejectedValue(new Error('ClearAll failed')),
			}

			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, failingPersistence)

			// Should not throw even though persistence fails
			mockOperation.mockResolvedValue('success')
			const result = await retryManager.execute(mockOperation, context)
			expect(result).toBe('success')
		})

		it('should persist state transition to half-open', async () => {
			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			const httpError = new HttpError(500, 'Internal Server Error')

			// Trigger circuit breaker to open
			for (let i = 0; i < 2; i++) {
				mockOperation.mockRejectedValue(httpError)
				const promise = retryManager.execute(mockOperation, context)
				await vi.runAllTimersAsync()
				await expect(promise).rejects.toThrow()
			}

			// Fast-forward past recovery timeout
			await vi.advanceTimersByTimeAsync(1001)

			// Next request should transition to half-open
			mockOperation.mockResolvedValue('success')
			await retryManager.execute(mockOperation, context)

			// Verify half-open state was persisted (then closed after success)
			const persistedStats = await persistence.load('/test:GET')
			expect(persistedStats).toBeTruthy()
			expect(persistedStats!.state).toBe(CircuitBreakerState.CLOSED)
		})

		it('should work without persistence', async () => {
			// Create manager without persistence
			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig)

			mockOperation.mockResolvedValue('success')
			const result = await retryManager.execute(mockOperation, context)

			expect(result).toBe('success')
		})

		it('should only load persisted state once', async () => {
			const loadAllSpy = vi.spyOn(persistence, 'loadAll')

			retryManager = new RetryManager(defaultConfig, circuitBreakerConfig, persistence)

			// Execute multiple operations
			mockOperation.mockResolvedValue('success')
			await retryManager.execute(mockOperation, context)
			await retryManager.execute(mockOperation, context)
			await retryManager.execute(mockOperation, context)

			// loadAll should only be called once
			expect(loadAllSpy).toHaveBeenCalledTimes(1)
		})
	})

	describe('Static Factory Methods with Persistence', () => {
		it('should create retry manager with persistence using create()', () => {
			const persistence = new MemoryCircuitBreakerPersistence()
			const manager = RetryManager.create(defaultConfig, circuitBreakerConfig, persistence)

			expect(manager).toBeInstanceOf(RetryManager)
		})

		it('should create default retry manager with persistence', () => {
			const persistence = new MemoryCircuitBreakerPersistence()
			const manager = RetryManager.createDefault(persistence)

			expect(manager).toBeInstanceOf(RetryManager)
			const config = manager.getConfig()
			expect(config.enabled).toBe(true)
		})
	})
})
