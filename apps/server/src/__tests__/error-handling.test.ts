/**
 * @fileoverview Comprehensive Error Handling Tests
 *
 * Tests for unified error handling, resilience patterns, and graceful degradation
 *
 * Requirements: 1.5, 2.3, 3.5, 6.3
 */

import { TRPCError } from '@trpc/server'
import { GraphQLError } from 'graphql'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	CircuitBreaker,
	CircuitBreakerOpenError,
	DEFAULT_CIRCUIT_BREAKER_CONFIG,
	DEFAULT_RETRY_CONFIG,
	RetryHandler,
	ServiceDegradationHandler,
	ServiceDegradedError,
	TimeoutError,
	withTimeout,
} from '../lib/errors/resilience'
import { ErrorClassifier, UnifiedErrorHandler } from '../lib/errors/unified-handler'
import { LoggerFactory } from '../lib/services/logging'
import { ResilienceService } from '../lib/services/resilience'

describe('Circuit Breaker', () => {
	let circuitBreaker: CircuitBreaker
	let mockLogger: any

	beforeEach(() => {
		mockLogger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
		circuitBreaker = new CircuitBreaker(
			{ ...DEFAULT_CIRCUIT_BREAKER_CONFIG, name: 'test-service' },
			mockLogger
		)
	})

	it('should start in CLOSED state', () => {
		const status = circuitBreaker.getStatus()
		expect(status.circuitBreakerState).toBe('CLOSED')
		expect(status.status).toBe('healthy')
	})

	it('should execute successful operations', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await circuitBreaker.execute(operation)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should open circuit after failure threshold', async () => {
		const operation = vi.fn().mockRejectedValue(new Error('Service error'))

		// Fail enough times to open the circuit
		for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
			try {
				await circuitBreaker.execute(operation)
			} catch (error) {
				// Expected to fail
			}
		}

		const status = circuitBreaker.getStatus()
		expect(status.circuitBreakerState).toBe('OPEN')
		expect(status.status).toBe('unhealthy')
	})

	it('should reject requests when circuit is OPEN', async () => {
		const operation = vi.fn().mockRejectedValue(new Error('Service error'))

		// Open the circuit
		for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
			try {
				await circuitBreaker.execute(operation)
			} catch (error) {
				// Expected to fail
			}
		}

		// Now it should reject immediately
		await expect(circuitBreaker.execute(operation)).rejects.toThrow(CircuitBreakerOpenError)
	})

	it('should transition to HALF_OPEN after recovery timeout', async () => {
		const operation = vi.fn().mockRejectedValue(new Error('Service error'))

		// Open the circuit
		for (let i = 0; i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold; i++) {
			try {
				await circuitBreaker.execute(operation)
			} catch (error) {
				// Expected to fail
			}
		}

		// Mock time passage
		vi.useFakeTimers()
		vi.advanceTimersByTime(DEFAULT_CIRCUIT_BREAKER_CONFIG.recoveryTimeout + 1000)

		// Should now allow one request through
		operation.mockResolvedValueOnce('success')
		const result = await circuitBreaker.execute(operation)
		expect(result).toBe('success')

		vi.useRealTimers()
	})

	it('should reset circuit breaker', () => {
		circuitBreaker.reset()
		const status = circuitBreaker.getStatus()
		expect(status.circuitBreakerState).toBe('CLOSED')
		expect(status.status).toBe('healthy')
	})
})

describe('Retry Handler', () => {
	let retryHandler: RetryHandler
	let mockLogger: any

	beforeEach(() => {
		mockLogger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
		retryHandler = new RetryHandler(DEFAULT_RETRY_CONFIG, mockLogger)
	})

	it('should execute successful operations without retry', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await retryHandler.execute(operation)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should retry retryable errors', async () => {
		const operation = vi
			.fn()
			.mockRejectedValueOnce(new Error('connection error'))
			.mockRejectedValueOnce(new Error('timeout error'))
			.mockResolvedValue('success')

		const result = await retryHandler.execute(operation)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledTimes(3)
	})

	it('should not retry non-retryable errors', async () => {
		const operation = vi.fn().mockRejectedValue(new Error('validation error'))

		await expect(retryHandler.execute(operation)).rejects.toThrow('validation error')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should fail after max retries', async () => {
		const operation = vi.fn().mockRejectedValue(new Error('connection error'))

		await expect(retryHandler.execute(operation)).rejects.toThrow('connection error')
		expect(operation).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1)
	})
})

describe('Service Degradation Handler', () => {
	let degradationHandler: ServiceDegradationHandler
	let mockLogger: any

	beforeEach(() => {
		mockLogger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}
		degradationHandler = new ServiceDegradationHandler(mockLogger)
	})

	it('should execute operations normally when service is healthy', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await degradationHandler.executeWithDegradation('test-service', operation)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should use fallback when service is unhealthy', async () => {
		const fallback = vi.fn().mockReturnValue('fallback-result')
		degradationHandler.registerFallback('test-service', fallback)

		// Mark service as unhealthy
		degradationHandler.updateServiceHealth({
			name: 'test-service',
			status: 'unhealthy',
			lastCheck: new Date(),
			errorRate: 0.8,
			responseTime: 5000,
			circuitBreakerState: 'OPEN',
		})

		const operation = vi.fn().mockResolvedValue('success')
		const result = await degradationHandler.executeWithDegradation('test-service', operation)

		expect(result).toBe('fallback-result')
		expect(fallback).toHaveBeenCalledOnce()
		expect(operation).not.toHaveBeenCalled()
	})

	it('should use fallback when operation fails', async () => {
		const fallback = vi.fn().mockReturnValue('fallback-result')
		degradationHandler.registerFallback('test-service', fallback)

		const operation = vi.fn().mockRejectedValue(new Error('Service error'))
		const result = await degradationHandler.executeWithDegradation('test-service', operation)

		expect(result).toBe('fallback-result')
		expect(fallback).toHaveBeenCalledOnce()
		expect(operation).toHaveBeenCalledOnce()
	})
})

describe('Timeout Wrapper', () => {
	it('should execute operations within timeout', async () => {
		const operation = vi.fn().mockResolvedValue('success')
		const result = await withTimeout(operation, 1000)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should timeout long-running operations', async () => {
		const operation = vi
			.fn()
			.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

		await expect(withTimeout(operation, 500)).rejects.toThrow(TimeoutError)
	})
})

describe('Error Classifier', () => {
	it('should classify TRPC errors correctly', () => {
		const error = new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' })
		const classification = ErrorClassifier.classify(error)

		expect(classification.category).toBe('validation')
		expect(classification.severity).toBe('low')
		expect(classification.retryable).toBe(false)
		expect(classification.userFacing).toBe(true)
	})

	it('should classify circuit breaker errors correctly', () => {
		const error = new CircuitBreakerOpenError('Circuit breaker is open')
		const classification = ErrorClassifier.classify(error)

		expect(classification.category).toBe('circuit_breaker')
		expect(classification.severity).toBe('high')
		expect(classification.retryable).toBe(false)
		expect(classification.userFacing).toBe(true)
	})

	it('should classify timeout errors correctly', () => {
		const error = new TimeoutError('Operation timed out', 5000)
		const classification = ErrorClassifier.classify(error)

		expect(classification.category).toBe('timeout')
		expect(classification.severity).toBe('medium')
		expect(classification.retryable).toBe(true)
		expect(classification.userFacing).toBe(true)
	})

	it('should classify GraphQL errors correctly', () => {
		const error = new GraphQLError('Forbidden', {
			extensions: { code: 'FORBIDDEN' },
		})
		const classification = ErrorClassifier.classify(error)

		expect(classification.category).toBe('authorization')
		expect(classification.severity).toBe('medium')
		expect(classification.retryable).toBe(false)
		expect(classification.userFacing).toBe(true)
	})
})

describe('Unified Error Handler', () => {
	let errorHandler: UnifiedErrorHandler
	let mockLogger: any

	beforeEach(() => {
		mockLogger = LoggerFactory.createLogger()
		errorHandler = new UnifiedErrorHandler(mockLogger)
	})

	it('should handle TRPC errors correctly', () => {
		const error = new Error('Test error')
		const context = {
			requestId: 'test-123',
			endpoint: '/trpc/test',
			method: 'POST',
			timestamp: new Date().toISOString(),
			apiType: 'trpc' as const,
		}

		const result = errorHandler.handleTRPCError(error, context)

		expect(result).toBeInstanceOf(TRPCError)
		expect(result.code).toBe('INTERNAL_SERVER_ERROR')
	})

	it('should handle circuit breaker errors in TRPC', () => {
		const error = new CircuitBreakerOpenError('Circuit breaker is open')
		const context = {
			requestId: 'test-123',
			endpoint: '/trpc/test',
			method: 'POST',
			timestamp: new Date().toISOString(),
			apiType: 'trpc' as const,
		}

		const result = errorHandler.handleTRPCError(error, context)

		expect(result).toBeInstanceOf(TRPCError)
		expect(result.code).toBe('SERVICE_UNAVAILABLE')
		expect(result.message).toBe('Service temporarily unavailable')
	})

	it('should handle GraphQL errors correctly', () => {
		const error = new Error('Test error')
		const context = {
			requestId: 'test-123',
			endpoint: '/graphql',
			method: 'POST',
			timestamp: new Date().toISOString(),
			apiType: 'graphql' as const,
		}

		const result = errorHandler.handleGraphQLError(error, context)

		expect(result.message).toBe('An error occurred')
		expect(result.extensions?.requestId).toBe('test-123')
		expect(result.extensions?.code).toBe('INTERNAL_ERROR')
	})
})

describe('Resilience Service', () => {
	let resilienceService: ResilienceService
	let mockLogger: any

	beforeEach(() => {
		mockLogger = LoggerFactory.createLogger()
		resilienceService = new ResilienceService(mockLogger)
		resilienceService.initializeDefaultServices()
	})

	it('should register services with resilience patterns', () => {
		resilienceService.registerService('test-service', {
			circuitBreaker: { failureThreshold: 3 },
			retry: { maxRetries: 2 },
			timeout: 5000,
			enableFallback: true,
		})

		const health = resilienceService.getServiceHealth('test-service')
		expect(health).toBeDefined()
		expect(health?.name).toBe('test-service')
	})

	it('should execute operations with resilience protection', async () => {
		resilienceService.registerService('test-service', {
			timeout: 1000,
		})

		const operation = vi.fn().mockResolvedValue('success')
		const result = await resilienceService.executeWithResilience('test-service', operation)

		expect(result).toBe('success')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should handle database operations with resilience', async () => {
		const operation = vi.fn().mockResolvedValue('db-result')
		const result = await resilienceService.executeDatabaseOperation(operation)

		expect(result).toBe('db-result')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should handle Redis operations with resilience', async () => {
		const operation = vi.fn().mockResolvedValue('redis-result')
		const result = await resilienceService.executeRedisOperation(operation)

		expect(result).toBe('redis-result')
		expect(operation).toHaveBeenCalledOnce()
	})

	it('should get all service health statuses', () => {
		const healthStatuses = resilienceService.getAllServiceHealth()
		expect(healthStatuses).toBeInstanceOf(Array)
		expect(healthStatuses.length).toBeGreaterThan(0)
	})

	it('should get circuit breaker metrics', () => {
		const metrics = resilienceService.getCircuitBreakerMetrics()
		expect(metrics).toBeDefined()
		expect(typeof metrics).toBe('object')
	})

	it('should reset circuit breakers', () => {
		const result = resilienceService.resetCircuitBreaker('database')
		expect(result).toBe(true)
	})
})

describe('Integration Tests', () => {
	let resilienceService: ResilienceService
	let mockLogger: any

	beforeEach(() => {
		mockLogger = LoggerFactory.createLogger()
		resilienceService = new ResilienceService(mockLogger)
		resilienceService.initializeDefaultServices()
	})

	it('should handle complete failure scenario with fallback', async () => {
		// Register a service with fallback
		resilienceService.registerService('integration-test', {
			circuitBreaker: { failureThreshold: 2 },
			retry: { maxRetries: 1 },
			enableFallback: true,
		})

		resilienceService.registerFallback('integration-test', () => 'fallback-result')

		// Create an operation that always fails
		const operation = vi.fn().mockRejectedValue(new Error('Service down'))

		// Should eventually use fallback
		const result = await resilienceService.executeWithResilience('integration-test', operation)
		expect(result).toBe('fallback-result')
	})

	it('should handle timeout with retry and circuit breaker', async () => {
		resilienceService.registerService('timeout-test', {
			circuitBreaker: { failureThreshold: 3 },
			retry: { maxRetries: 2, retryableErrors: ['timeout'] },
			timeout: 100,
		})

		// Create an operation that times out
		const operation = vi
			.fn()
			.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)))

		await expect(
			resilienceService.executeWithResilience('timeout-test', operation)
		).rejects.toThrow(TimeoutError)

		// Should have retried
		expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
	})
})

afterEach(() => {
	vi.clearAllMocks()
	vi.useRealTimers()
})
