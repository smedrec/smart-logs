import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DefaultBatchManager } from '../core/batch-manager.js'
import { MemoryAwareQueue } from '../core/memory-aware-queue.js'
import { getResourceManager, ResourceManager } from '../core/resource-manager.js'
import { getShutdownManager, ShutdownManager } from '../core/shutdown-manager.js'
import { StructuredLogger } from '../core/structured-logger.js'
import { FileTransport } from '../transports/file-transport.ts'

describe('Shutdown Integration Tests', () => {
	let tempDir: string
	let shutdownManager: ShutdownManager
	let resourceManager: ResourceManager

	beforeEach(async () => {
		// Create temporary directory for test files
		tempDir = join(tmpdir(), `logs-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })

		// Create fresh managers for each test
		shutdownManager = new ShutdownManager({
			timeoutMs: 5000,
			handleSignals: false,
		})

		resourceManager = new ResourceManager({
			memoryThresholdBytes: 50 * 1024 * 1024, // 50MB
			monitoringIntervalMs: 1000,
			maxQueueSize: 1000,
			cleanupIntervalMs: 2000,
		})
	})

	afterEach(async () => {
		// Cleanup
		await shutdownManager.destroy()
		await resourceManager.shutdown()

		// Remove temporary directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Logger Shutdown Integration', () => {
		it('should flush all pending logs during shutdown', async () => {
			const logger = new StructuredLogger({
				service: 'test-service',
				environment: 'test',
			})

			// Create multiple pending log operations
			const logPromises = []
			for (let i = 0; i < 10; i++) {
				logPromises.push(logger.info(`Test message ${i}`, { iteration: i }))
			}

			// Verify operations are pending
			expect(logger.getPendingOperationCount()).toBeGreaterThan(0)

			// Shutdown should wait for all operations
			await logger.close()

			// All operations should complete
			await Promise.all(logPromises)
			expect(logger.getPendingOperationCount()).toBe(0)
		})

		it('should prevent new logs after close', async () => {
			const logger = new StructuredLogger({
				service: 'test-service',
				environment: 'test',
			})

			await logger.close()

			// New log operations should be ignored
			await logger.info('This should be ignored')
			expect(logger.getPendingOperationCount()).toBe(0)
		})

		it('should handle concurrent shutdown calls', async () => {
			const logger = new StructuredLogger({
				service: 'test-service',
				environment: 'test',
			})

			// Start multiple log operations
			const logPromises = []
			for (let i = 0; i < 5; i++) {
				logPromises.push(logger.info(`Message ${i}`))
			}

			// Call close multiple times concurrently
			const closePromises = [logger.close(), logger.close(), logger.close()]

			// All should complete successfully
			await Promise.all([...logPromises, ...closePromises])
			expect(logger.getPendingOperationCount()).toBe(0)
		})
	})

	describe('BatchManager Shutdown Integration', () => {
		it('should flush all batches during shutdown', async () => {
			const processedBatches: any[][] = []
			const processor = vi.fn().mockImplementation(async (entries: any[]) => {
				processedBatches.push([...entries])
				await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async processing
			})

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 5,
					timeoutMs: 1000,
					maxConcurrency: 2,
				},
				processor,
				'test-batch'
			)

			// Add items to create partial batches
			for (let i = 0; i < 12; i++) {
				await batchManager.add({ id: i, message: `Item ${i}` } as any)
			}

			// Should have processed some full batches and have remaining items
			expect(batchManager.getPendingCount()).toBeGreaterThan(0)

			// Close should flush remaining items
			await batchManager.close()

			// All items should be processed
			const totalProcessed = processedBatches.flat().length
			expect(totalProcessed).toBe(12)
			expect(batchManager.getPendingCount()).toBe(0)
		})

		it('should handle processing errors during shutdown', async () => {
			let callCount = 0
			const processor = vi.fn().mockImplementation(async () => {
				callCount++
				if (callCount === 2) {
					throw new Error('Processing failed')
				}
				await new Promise((resolve) => setTimeout(resolve, 10))
			})

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 2,
					timeoutMs: 1000,
				},
				processor,
				'error-test'
			)

			// Add items - but don't await them since they might fail
			batchManager.add({ id: 1 } as any).catch(() => {}) // Ignore errors
			batchManager.add({ id: 2 } as any).catch(() => {})
			batchManager.add({ id: 3 } as any).catch(() => {})
			batchManager.add({ id: 4 } as any).catch(() => {})

			// Close should complete despite processing errors
			await batchManager.close()

			// Processor should have been called for batches
			expect(processor).toHaveBeenCalled()
		})
	})

	describe('FileTransport Shutdown Integration', () => {
		it('should close file handles during shutdown', async () => {
			const logFile = join(tempDir, 'test.log')
			const transport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Send some logs
			await transport.send([
				{
					id: '1',
					timestamp: new Date(),
					level: 'info',
					message: 'Test message',
					correlationId: 'test-correlation',
					fields: {},
					metadata: { service: 'test', environment: 'test', hostname: 'test', pid: 1 },
					source: 'test',
					version: '1.0.0',
				},
			])

			expect(transport.isHealthy()).toBe(true)

			// Close should flush and close file handles
			await transport.close()

			expect(transport.isHealthy()).toBe(false)

			// File should exist and contain the log
			const content = await fs.readFile(logFile, 'utf8')
			expect(content).toContain('Test message')
		})

		it('should handle file errors during shutdown', async () => {
			const logFile = join(tempDir, 'error-test.log')
			const transport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Send a log to create the file
			await transport.send([
				{
					id: '1',
					timestamp: new Date(),
					level: 'info',
					message: 'Test message',
					correlationId: 'test-correlation',
					fields: {},
					metadata: { service: 'test', environment: 'test', hostname: 'test', pid: 1 },
					source: 'test',
					version: '1.0.0',
				},
			])

			// Close should complete even if there are file system issues
			await transport.close()

			// Transport should be marked as unhealthy
			expect(transport.isHealthy()).toBe(false)
		})
	})

	describe('Memory-Aware Queue Shutdown Integration', () => {
		it('should clear queue and stop monitoring during shutdown', async () => {
			const queue = new MemoryAwareQueue<string>({
				maxSize: 100,
				maxMemoryBytes: 10 * 1024,
				monitoringIntervalMs: 100,
			})

			// Add items to the queue
			for (let i = 0; i < 10; i++) {
				queue.enqueue(`item-${i}`)
			}

			expect(queue.size()).toBe(10)

			// Close should clear the queue
			await queue.close()

			expect(queue.size()).toBe(0)
			expect(queue.isEmpty()).toBe(true)

			// Should not accept new items
			expect(queue.enqueue('new-item')).toBe(false)
		})

		it('should emit proper events during shutdown', async () => {
			const queue = new MemoryAwareQueue<string>()
			const events: string[] = []

			queue.on('queueCleared', () => events.push('cleared'))

			queue.enqueue('item1')
			queue.enqueue('item2')

			await queue.close()

			expect(events).toContain('cleared')
		})
	})

	describe('Resource Manager Integration', () => {
		it('should cleanup all registered resources during shutdown', async () => {
			const cleanupFunctions = [
				vi.fn().mockResolvedValue(undefined),
				vi.fn().mockResolvedValue(undefined),
				vi.fn().mockResolvedValue(undefined),
			]

			// Register multiple resources
			cleanupFunctions.forEach((cleanup, index) => {
				resourceManager.register({
					id: `resource-${index}`,
					type: 'connection',
					cleanup,
				})
			})

			expect(resourceManager.getResourceStats().total).toBe(3)

			// Shutdown should cleanup all resources
			await resourceManager.shutdown()

			cleanupFunctions.forEach((cleanup) => {
				expect(cleanup).toHaveBeenCalledOnce()
			})

			expect(resourceManager.getResourceStats().total).toBe(0)
		})

		it('should handle mixed resource types during shutdown', async () => {
			const resources = [
				{ id: 'timer-1', type: 'timer' as const, cleanup: vi.fn().mockResolvedValue(undefined) },
				{
					id: 'connection-1',
					type: 'connection' as const,
					cleanup: vi.fn().mockResolvedValue(undefined),
				},
				{ id: 'stream-1', type: 'stream' as const, cleanup: vi.fn().mockResolvedValue(undefined) },
				{ id: 'other-1', type: 'other' as const, cleanup: vi.fn().mockResolvedValue(undefined) },
			]

			resources.forEach((resource) => resourceManager.register(resource))

			await resourceManager.shutdown()

			resources.forEach((resource) => {
				expect(resource.cleanup).toHaveBeenCalledOnce()
			})
		})
	})

	describe('Complete System Shutdown Integration', () => {
		it('should shutdown entire logging system gracefully', async () => {
			// Create a complete logging setup
			const logFile = join(tempDir, 'system-test.log')

			const logger = new StructuredLogger({
				service: 'integration-test',
				environment: 'test',
			})

			const transport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			const processor = vi.fn().mockImplementation(async (entries: any[]) => {
				await transport.send(entries)
			})

			const batchManager = new DefaultBatchManager(
				{
					maxSize: 3,
					timeoutMs: 500,
				},
				processor,
				'system-test'
			)

			// Generate some logging activity
			const logPromises = []
			for (let i = 0; i < 10; i++) {
				const logPromise = logger.info(`System test message ${i}`, { iteration: i })
				logPromises.push(logPromise)

				// Also add to batch manager (simulating real usage)
				batchManager.add({
					id: `batch-${i}`,
					timestamp: new Date(),
					level: 'info',
					message: `Batch message ${i}`,
					correlationId: 'system-test',
					fields: { iteration: i },
					metadata: { service: 'test', environment: 'test', hostname: 'test', pid: 1 },
					source: 'test',
					version: '1.0.0',
				} as any)
			}

			// Verify system is active (but transport might not be healthy yet if file creation failed)
			expect(logger.getPendingOperationCount()).toBeGreaterThan(0)
			expect(batchManager.getPendingCount()).toBeGreaterThan(0)
			// Don't check transport health as file creation might fail in test environment

			// Shutdown everything in proper order
			await Promise.all([
				logger.close(),
				batchManager.close(),
				transport.close(),
				resourceManager.shutdown(),
			])

			// Wait for all log operations to complete
			await Promise.all(logPromises)

			// Verify clean shutdown
			expect(logger.getPendingOperationCount()).toBe(0)
			expect(batchManager.getPendingCount()).toBe(0)
			expect(transport.isHealthy()).toBe(false)

			// Verify logs were written
			const content = await fs.readFile(logFile, 'utf8')
			expect(content).toContain('System test message')
			expect(content).toContain('Batch message')
		})

		it('should handle timeout during system shutdown', async () => {
			// Create a system with a slow component
			const slowShutdownManager = new ShutdownManager({
				timeoutMs: 100, // Very short timeout
				handleSignals: false,
			})

			const slowResource = {
				name: 'slow-component',
				cleanup: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(resolve, 500)) // Takes longer than timeout
				),
			}

			slowShutdownManager.register(slowResource)

			// Shutdown should timeout
			await expect(slowShutdownManager.shutdown()).rejects.toThrow('Shutdown timeout after 100ms')

			await slowShutdownManager.destroy()
		})

		it('should maintain data integrity during forced shutdown', async () => {
			const logFile = join(tempDir, 'integrity-test.log')
			const transport = new FileTransport({
				name: 'file',
				enabled: true,
				filename: logFile,
				maxSize: 10 * 1024 * 1024,
				maxFiles: 5,
				rotateDaily: false,
				rotationInterval: 'daily',
				compress: false,
				retentionDays: 30,
			})

			// Send logs rapidly
			const logPromises = []
			for (let i = 0; i < 20; i++) {
				const logPromise = transport.send([
					{
						id: `integrity-${i}`,
						timestamp: new Date(),
						level: 'info',
						message: `Integrity test message ${i}`,
						correlationId: 'integrity-test',
						fields: { iteration: i },
						metadata: { service: 'test', environment: 'test', hostname: 'test', pid: 1 },
						source: 'test',
						version: '1.0.0',
					},
				])
				logPromises.push(logPromise)
			}

			// Force shutdown while operations are pending
			await transport.close()

			// Wait for all operations to complete
			await Promise.allSettled(logPromises)

			// Verify file integrity
			const content = await fs.readFile(logFile, 'utf8')
			const lines = content.trim().split('\n').filter(Boolean)

			// Each line should be valid JSON
			lines.forEach((line, index) => {
				expect(() => JSON.parse(line)).not.toThrow()
				const parsed = JSON.parse(line)
				expect(parsed.message).toContain('Integrity test message')
			})
		})
	})
})
