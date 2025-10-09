import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FileTransport } from '../file-transport.js'

import type { FileConfig } from '../../types/config.js'
import type { LogEntry } from '../../types/log-entry.js'

describe('FileTransport', () => {
	let tempDir: string
	let testConfig: FileConfig
	let transport: FileTransport
	let sampleLogEntry: LogEntry

	beforeEach(async () => {
		// Create a unique temp directory for each test
		tempDir = join(
			tmpdir(),
			`file-transport-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		)

		testConfig = {
			name: 'file',
			enabled: true,
			filename: join(tempDir, 'test.log'),
			maxSize: 1024 * 1024, // 1MB
			maxFiles: 5,
			rotateDaily: false,
			rotationInterval: 'daily',
			compress: true,
			retentionDays: 30,
		}

		sampleLogEntry = {
			id: 'test-id',
			timestamp: new Date(),
			level: 'info',
			message: 'Test message',
			correlationId: 'test-correlation-id',
			fields: { key: 'value' },
			metadata: {
				service: 'test-service',
				environment: 'test',
				hostname: 'test-host',
				pid: 12345,
			},
			source: 'test',
			version: '1.0.0',
		}
	})

	afterEach(async () => {
		if (transport) {
			try {
				await transport.close()
			} catch {
				// Ignore cleanup errors
			}
		}

		// Clean up temp directory
		try {
			await fs.rm(tempDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Constructor and Configuration', () => {
		it('should create FileTransport with valid configuration', () => {
			expect(() => new FileTransport(testConfig)).not.toThrow()
		})

		it('should throw error for missing filename', () => {
			const invalidConfig = { ...testConfig, filename: '' }
			expect(() => new FileTransport(invalidConfig)).toThrow('FileTransport: filename is required')
		})

		it('should throw error for invalid maxSize', () => {
			const invalidConfig = { ...testConfig, maxSize: 0 }
			expect(() => new FileTransport(invalidConfig)).toThrow(
				'FileTransport: maxSize must be positive'
			)
		})

		it('should throw error for invalid maxFiles', () => {
			const invalidConfig = { ...testConfig, maxFiles: 0 }
			expect(() => new FileTransport(invalidConfig)).toThrow(
				'FileTransport: maxFiles must be positive'
			)
		})
	})

	describe('Basic Logging Operations', () => {
		beforeEach(() => {
			transport = new FileTransport(testConfig)
		})

		it('should implement LogTransport interface', () => {
			expect(transport.name).toBe('file')
			expect(typeof transport.send).toBe('function')
			expect(typeof transport.flush).toBe('function')
			expect(typeof transport.close).toBe('function')
			expect(typeof transport.isHealthy).toBe('function')
		})

		it('should create directory structure and write log', async () => {
			await transport.send([sampleLogEntry])
			await transport.flush()

			// Check if directory was created
			const dirExists = await fs
				.access(dirname(testConfig.filename))
				.then(() => true)
				.catch(() => false)
			expect(dirExists).toBe(true)

			// Check if file was created and contains log data
			const fileExists = await fs
				.access(testConfig.filename)
				.then(() => true)
				.catch(() => false)
			expect(fileExists).toBe(true)

			if (fileExists) {
				const content = await fs.readFile(testConfig.filename, 'utf8')
				expect(content).toContain('Test message')
				expect(content).toContain('test-correlation-id')

				// Verify JSON format
				const lines = content.trim().split('\n')
				const parsedLog = JSON.parse(lines[0])
				expect(parsedLog['@timestamp']).toBeDefined()
				expect(parsedLog.level).toBe('info')
				expect(parsedLog.message).toBe('Test message')
			}
		})

		it('should handle multiple log entries', async () => {
			const entries = [
				sampleLogEntry,
				{ ...sampleLogEntry, id: 'test-id-2', message: 'Second message' },
			]

			await transport.send(entries)
			await transport.flush()

			const content = await fs.readFile(testConfig.filename, 'utf8')
			const lines = content.trim().split('\n')

			expect(lines).toHaveLength(2)
			expect(lines[0]).toContain('Test message')
			expect(lines[1]).toContain('Second message')
		})

		it('should report health status correctly', async () => {
			// Initially not healthy (no stream)
			expect(transport.isHealthy()).toBe(false)

			// Send a log to create stream
			await transport.send([sampleLogEntry])

			// Should be healthy after creating stream
			expect(transport.isHealthy()).toBe(true)

			await transport.close()

			// Should not be healthy after closing
			expect(transport.isHealthy()).toBe(false)
		})
	})

	describe('File Rotation', () => {
		beforeEach(() => {
			transport = new FileTransport(testConfig)
		})

		it('should rotate file daily when rotateDaily is enabled', async () => {
			const dailyConfig = { ...testConfig, rotateDaily: true }
			transport = new FileTransport(dailyConfig)

			await transport.send([sampleLogEntry])
			await transport.flush()

			// The file should have a date suffix
			const today = new Date().toISOString().split('T')[0]
			const expectedPath = testConfig.filename.replace('.log', `-${today}.log`)

			const fileExists = await fs
				.access(expectedPath)
				.then(() => true)
				.catch(() => false)
			expect(fileExists).toBe(true)
		})

		it('should support weekly rotation interval', async () => {
			const weeklyConfig = { ...testConfig, rotateDaily: true, rotationInterval: 'weekly' as const }
			transport = new FileTransport(weeklyConfig)

			await transport.send([sampleLogEntry])
			await transport.flush()

			// Check that file has weekly format
			const files = await fs.readdir(tempDir)
			const weeklyFile = files.find((f) => f.match(/-\d{4}-W\d{2}\.log$/))
			expect(weeklyFile).toBeDefined()
		})

		it('should support monthly rotation interval', async () => {
			const monthlyConfig = {
				...testConfig,
				rotateDaily: true,
				rotationInterval: 'monthly' as const,
			}
			transport = new FileTransport(monthlyConfig)

			await transport.send([sampleLogEntry])
			await transport.flush()

			// Check that file has monthly format
			const files = await fs.readdir(tempDir)
			const monthlyFile = files.find((f) => f.match(/-\d{4}-\d{2}\.log$/))
			expect(monthlyFile).toBeDefined()
		})

		it('should rotate file when size limit is exceeded', async () => {
			// Configure very small max size for testing
			const smallSizeConfig = { ...testConfig, maxSize: 50 } // 50 bytes
			transport = new FileTransport(smallSizeConfig)

			// Send multiple large entries to exceed size limit
			const largeEntry = {
				...sampleLogEntry,
				message: 'A'.repeat(100), // Large message
			}

			await transport.send([largeEntry])
			await transport.send([largeEntry])
			await transport.flush()

			// Should have created rotated files
			const files = await fs.readdir(tempDir)
			const logFiles = files.filter((f) => f.includes('test') && f.includes('.log'))

			// Should have more than one file due to rotation
			expect(logFiles.length).toBeGreaterThan(1)
		}, 10000) // Increase timeout for this test
	})

	describe('File Cleanup and Retention', () => {
		beforeEach(() => {
			transport = new FileTransport(testConfig)
		})

		it('should respect maxFiles limit', async () => {
			const limitedFilesConfig = { ...testConfig, maxFiles: 2, maxSize: 50 }
			transport = new FileTransport(limitedFilesConfig)

			// Create multiple files by exceeding size limit repeatedly
			const largeEntry = { ...sampleLogEntry, message: 'A'.repeat(100) }

			for (let i = 0; i < 5; i++) {
				await transport.send([largeEntry])
				await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
			}

			await transport.flush()

			const files = await fs.readdir(tempDir)
			const logFiles = files.filter((f) => f.includes('test') && f.includes('.log'))

			// Should not exceed maxFiles + 1 (current file)
			expect(logFiles.length).toBeLessThanOrEqual(limitedFilesConfig.maxFiles + 1)
		}, 15000)
	})

	describe('Error Handling', () => {
		it('should handle invalid directory paths gracefully', async () => {
			const invalidConfig = {
				...testConfig,
				filename: '/invalid/path/that/does/not/exist/test.log',
			}
			transport = new FileTransport(invalidConfig)

			// Should throw error when trying to create directory
			await expect(transport.send([sampleLogEntry])).rejects.toThrow()
		})

		it('should reject operations when transport is closing', async () => {
			transport = new FileTransport(testConfig)
			await transport.close()

			await expect(transport.send([sampleLogEntry])).rejects.toThrow('FileTransport is closing')
		})
	})

	describe('Resource Management', () => {
		beforeEach(() => {
			transport = new FileTransport(testConfig)
		})

		it('should flush pending writes', async () => {
			await transport.send([sampleLogEntry])

			// Flush should complete without error
			await expect(transport.flush()).resolves.not.toThrow()

			// File should contain the log
			const content = await fs.readFile(testConfig.filename, 'utf8')
			expect(content).toContain('Test message')
		})

		it('should close stream properly', async () => {
			await transport.send([sampleLogEntry])

			// Close should complete without error
			await expect(transport.close()).resolves.not.toThrow()

			// Should not be healthy after closing
			expect(transport.isHealthy()).toBe(false)
		})
	})

	describe('Configuration Validation', () => {
		it('should validate filename requirement', () => {
			expect(() => new FileTransport({ ...testConfig, filename: '' })).toThrow(
				'FileTransport: filename is required'
			)
		})

		it('should validate maxSize requirement', () => {
			expect(() => new FileTransport({ ...testConfig, maxSize: -1 })).toThrow(
				'FileTransport: maxSize must be positive'
			)
		})

		it('should validate maxFiles requirement', () => {
			expect(() => new FileTransport({ ...testConfig, maxFiles: 0 })).toThrow(
				'FileTransport: maxFiles must be positive'
			)
		})
	})
})
