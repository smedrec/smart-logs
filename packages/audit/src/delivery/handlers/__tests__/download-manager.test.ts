/**
 * Unit tests for download manager
 * Requirements 9.3, 9.4: Download tracking, analytics, and management testing
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DownloadManager } from '../download-manager.js'

import type { IDownloadLinkRepository } from '../../database-client.js'

// Mock download link repository
const mockDownloadRepository: IDownloadLinkRepository = {
	createDownloadLink: vi.fn(),
	findById: vi.fn(),
	findByOrganization: vi.fn(),
	recordAccess: vi.fn(),
	revokeLink: vi.fn(),
	cleanupExpired: vi.fn(),
	getAccessStats: vi.fn(),
}

describe('DownloadManager', () => {
	let manager: DownloadManager

	beforeEach(() => {
		vi.clearAllMocks()
		manager = new DownloadManager(mockDownloadRepository)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Access Validation', () => {
		const mockLink = {
			id: 'test-link-123',
			organizationId: 'test-org',
			isActive: true,
			expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
			accessCount: 2,
			maxAccess: 5,
			accessedBy: [],
		}

		it('should allow access to valid active link', async () => {
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(mockLink)

			const result = await manager.validateAccess('test-link-123', 'user-123', '192.168.1.1')

			expect(result.allowed).toBe(true)
			expect(result.remainingAccess).toBe(3)
			expect(result.timeUntilExpiry).toBeGreaterThan(0)
		})

		it('should deny access to non-existent link', async () => {
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(null)

			const result = await manager.validateAccess('non-existent-link')

			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Download link not found')
		})

		it('should deny access to inactive link', async () => {
			const inactiveLink = {
				...mockLink,
				isActive: false,
				revokedReason: 'Link revoked by admin',
			}
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(inactiveLink)

			const result = await manager.validateAccess('test-link-123')

			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Link revoked by admin')
		})

		it('should deny access to expired link', async () => {
			const expiredLink = {
				...mockLink,
				expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
			}
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(expiredLink)

			const result = await manager.validateAccess('test-link-123')

			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Download link has expired')
		})

		it('should deny access when max access limit reached', async () => {
			const maxedLink = {
				...mockLink,
				accessCount: 5,
				maxAccess: 5,
			}
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(maxedLink)

			const result = await manager.validateAccess('test-link-123')

			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Maximum access limit reached')
		})

		it('should handle links without max access limit', async () => {
			const unlimitedLink = {
				...mockLink,
				maxAccess: undefined,
			}
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(unlimitedLink)

			const result = await manager.validateAccess('test-link-123')

			expect(result.allowed).toBe(true)
			expect(result.remainingAccess).toBeUndefined()
		})

		it('should handle repository errors gracefully', async () => {
			mockDownloadRepository.findById = vi.fn().mockRejectedValue(new Error('Database error'))

			const result = await manager.validateAccess('test-link-123')

			expect(result.allowed).toBe(false)
			expect(result.reason).toBe('Internal error validating access')
		})
	})

	describe('Access Recording', () => {
		it('should record successful access', async () => {
			mockDownloadRepository.recordAccess = vi.fn().mockResolvedValue(undefined)

			await manager.recordAccess('test-link-123', true, 'user-123', '192.168.1.1', 'Mozilla/5.0...')

			expect(mockDownloadRepository.recordAccess).toHaveBeenCalledWith('test-link-123', {
				timestamp: expect.any(String),
				userId: 'user-123',
				ipAddress: '192.168.1.1',
				userAgent: 'Mozilla/5.0...',
				success: true,
				error: undefined,
			})
		})

		it('should record failed access with error', async () => {
			mockDownloadRepository.recordAccess = vi.fn().mockResolvedValue(undefined)

			await manager.recordAccess(
				'test-link-123',
				false,
				'user-123',
				undefined,
				undefined,
				'File not found'
			)

			expect(mockDownloadRepository.recordAccess).toHaveBeenCalledWith('test-link-123', {
				timestamp: expect.any(String),
				userId: 'user-123',
				ipAddress: undefined,
				userAgent: undefined,
				success: false,
				error: 'File not found',
			})
		})

		it('should handle recording errors gracefully', async () => {
			mockDownloadRepository.recordAccess = vi.fn().mockRejectedValue(new Error('Database error'))

			// Should not throw
			await expect(manager.recordAccess('test-link-123', true)).resolves.toBeUndefined()
		})
	})

	describe('Analytics', () => {
		const mockLinks = [
			{
				id: 'link-1',
				objectType: 'report',
				isActive: true,
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
				accessCount: 5,
				accessedBy: [
					{ timestamp: '2023-10-01T10:00:00Z', userId: 'user-1', success: true },
					{ timestamp: '2023-10-01T11:00:00Z', userId: 'user-2', success: true },
					{ timestamp: '2023-10-01T12:00:00Z', userId: 'user-1', success: false },
				],
			},
			{
				id: 'link-2',
				objectType: 'export',
				isActive: false,
				expiresAt: new Date(Date.now() - 3600000).toISOString(),
				revokedAt: '2023-10-01T09:00:00Z',
				accessCount: 3,
				accessedBy: [{ timestamp: '2023-10-01T08:00:00Z', userId: 'user-3', success: true }],
			},
			{
				id: 'link-3',
				objectType: 'report',
				isActive: true,
				expiresAt: new Date(Date.now() - 7200000).toISOString(), // Expired
				accessCount: 0,
				accessedBy: [],
			},
		]

		it('should calculate comprehensive analytics', async () => {
			mockDownloadRepository.findByOrganization = vi.fn().mockResolvedValue(mockLinks)

			const analytics = await manager.getAnalytics('test-org')

			expect(analytics.totalLinks).toBe(3)
			expect(analytics.activeLinks).toBe(2)
			expect(analytics.expiredLinks).toBe(2) // link-2 and link-3 are expired
			expect(analytics.revokedLinks).toBe(1) // link-2 is revoked
			expect(analytics.totalDownloads).toBe(8) // 5 + 3 + 0
			expect(analytics.uniqueUsers).toBe(3) // user-1, user-2, user-3 (only successful downloads)
			expect(analytics.averageDownloadsPerLink).toBe(8 / 3)

			expect(analytics.topObjectTypes).toEqual([
				{ type: 'report', count: 5 },
				{ type: 'export', count: 3 },
			])

			expect(analytics.downloadsByDay).toHaveLength(30) // Last 30 days
			expect(analytics.recentActivity).toBeDefined()
		})

		it('should handle empty organization gracefully', async () => {
			mockDownloadRepository.findByOrganization = vi.fn().mockResolvedValue([])

			const analytics = await manager.getAnalytics('empty-org')

			expect(analytics.totalLinks).toBe(0)
			expect(analytics.activeLinks).toBe(0)
			expect(analytics.expiredLinks).toBe(0)
			expect(analytics.revokedLinks).toBe(0)
			expect(analytics.totalDownloads).toBe(0)
			expect(analytics.uniqueUsers).toBe(0)
			expect(analytics.averageDownloadsPerLink).toBe(0)
			expect(analytics.topObjectTypes).toEqual([])
			expect(analytics.downloadsByDay).toHaveLength(30)
			expect(analytics.recentActivity).toEqual([])
		})

		it('should handle repository errors gracefully', async () => {
			mockDownloadRepository.findByOrganization = vi
				.fn()
				.mockRejectedValue(new Error('Database error'))

			const analytics = await manager.getAnalytics('test-org')

			// Should return empty analytics instead of throwing
			expect(analytics.totalLinks).toBe(0)
			expect(analytics.totalDownloads).toBe(0)
		})

		it('should filter by object type when specified', async () => {
			mockDownloadRepository.findByOrganization = vi
				.fn()
				.mockResolvedValue(mockLinks.filter((l) => l.objectType === 'report'))

			const analytics = await manager.getAnalytics('test-org', { objectType: 'report' })

			expect(mockDownloadRepository.findByOrganization).toHaveBeenCalledWith('test-org', {
				objectType: 'report',
			})
		})
	})

	describe('Link Management', () => {
		it('should revoke link successfully', async () => {
			mockDownloadRepository.revokeLink = vi.fn().mockResolvedValue(undefined)

			await manager.revokeLink('test-link-123', 'admin-user', 'Security concern')

			expect(mockDownloadRepository.revokeLink).toHaveBeenCalledWith(
				'test-link-123',
				'admin-user',
				'Security concern'
			)
		})

		it('should handle revocation errors', async () => {
			mockDownloadRepository.revokeLink = vi.fn().mockRejectedValue(new Error('Database error'))

			await expect(manager.revokeLink('test-link-123')).rejects.toThrow('Database error')
		})
	})

	describe('Cleanup Operations', () => {
		it('should cleanup expired links successfully', async () => {
			mockDownloadRepository.findByOrganization = vi.fn().mockResolvedValue([
				{
					id: 'expired-1',
					expiresAt: new Date(Date.now() - 3600000).toISOString(),
					fileSize: 1024,
				},
				{
					id: 'expired-2',
					expiresAt: new Date(Date.now() - 7200000).toISOString(),
					fileSize: 2048,
				},
			])
			mockDownloadRepository.cleanupExpired = vi.fn().mockResolvedValue(2)

			const result = await manager.cleanupExpiredLinks()

			expect(result.expiredLinksRemoved).toBe(2)
			expect(result.inactiveLinksRemoved).toBe(0)
			expect(result.cleanupDuration).toBeGreaterThanOrEqual(0)
			expect(mockDownloadRepository.cleanupExpired).toHaveBeenCalled()
		})

		it('should handle cleanup errors gracefully', async () => {
			mockDownloadRepository.findByOrganization = vi
				.fn()
				.mockRejectedValue(new Error('Database error'))

			const result = await manager.cleanupExpiredLinks()

			expect(result.expiredLinksRemoved).toBe(0)
			expect(result.inactiveLinksRemoved).toBe(0)
			expect(result.cleanupDuration).toBeGreaterThanOrEqual(0) // Can be 0 if error happens immediately
		})

		it('should schedule automatic cleanup', () => {
			const intervalId = manager.scheduleCleanup(1) // 1 minute

			expect(intervalId).toBeDefined()
			expect(typeof intervalId).toBe('object') // NodeJS.Timeout

			// Clean up the interval
			clearInterval(intervalId)
		})
	})

	describe('Link Statistics', () => {
		const mockLink = {
			id: 'test-link-123',
			fileName: 'test-file.pdf',
			accessCount: 10,
			accessedBy: [
				{
					timestamp: '2023-10-01T10:00:00Z',
					userId: 'user-1',
					ipAddress: '192.168.1.1',
					userAgent: 'Mozilla/5.0 (Chrome)',
					success: true,
				},
				{
					timestamp: '2023-10-01T11:00:00Z',
					userId: 'user-2',
					ipAddress: '192.168.1.2',
					userAgent: 'Mozilla/5.0 (Firefox)',
					success: true,
				},
				{
					timestamp: '2023-10-01T12:00:00Z',
					userId: 'user-1',
					ipAddress: '192.168.1.1',
					userAgent: 'Mozilla/5.0 (Chrome)',
					success: false,
				},
			],
		}

		const mockStats = {
			totalAccess: 10,
			uniqueUsers: 2,
			lastAccess: '2023-10-01T12:00:00Z',
			accessHistory: mockLink.accessedBy,
		}

		it('should get detailed link statistics', async () => {
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(mockLink)
			mockDownloadRepository.getAccessStats = vi.fn().mockResolvedValue(mockStats)

			const result = await manager.getLinkStats('test-link-123')

			expect(result.link).toEqual(mockLink)
			expect(result.stats).toEqual(mockStats)
			expect(result.analytics.successRate).toBe(66.67) // 2 successful out of 3 total
			expect(result.analytics.accessByHour).toHaveLength(24)
			expect(result.analytics.accessByDay).toHaveLength(30)
			expect(result.analytics.userAgents).toContainEqual({
				userAgent: 'Mozilla/5.0 (Chrome)',
				count: 2,
			})
			expect(result.analytics.ipAddresses).toContainEqual({
				ip: '192.168.1.1',
				count: 2,
			})
		})

		it('should handle non-existent link', async () => {
			mockDownloadRepository.findById = vi.fn().mockResolvedValue(null)

			await expect(manager.getLinkStats('non-existent')).rejects.toThrow(
				'Download link not found: non-existent'
			)
		})

		it('should handle repository errors', async () => {
			mockDownloadRepository.findById = vi.fn().mockRejectedValue(new Error('Database error'))

			await expect(manager.getLinkStats('test-link-123')).rejects.toThrow('Database error')
		})

		it('should calculate analytics for link with no access history', async () => {
			const emptyLink = {
				...mockLink,
				accessCount: 0,
				accessedBy: [],
			}

			const emptyStats = {
				totalAccess: 0,
				uniqueUsers: 0,
				lastAccess: undefined,
				accessHistory: [],
			}

			mockDownloadRepository.findById = vi.fn().mockResolvedValue(emptyLink)
			mockDownloadRepository.getAccessStats = vi.fn().mockResolvedValue(emptyStats)

			const result = await manager.getLinkStats('test-link-123')

			expect(result.analytics.successRate).toBe(0)
			expect(result.analytics.userAgents).toEqual([])
			expect(result.analytics.ipAddresses).toEqual([])
		})
	})

	describe('Time-based Analytics', () => {
		it('should calculate downloads by day correctly', async () => {
			const now = new Date('2023-10-15T12:00:00Z')
			vi.setSystemTime(now)

			const linksWithTimeData = [
				{
					id: 'link-1',
					objectType: 'report',
					isActive: true,
					expiresAt: new Date(Date.now() + 3600000).toISOString(),
					accessCount: 2,
					accessedBy: [
						{ timestamp: '2023-10-15T10:00:00Z', success: true }, // Today
						{ timestamp: '2023-10-14T10:00:00Z', success: true }, // Yesterday
					],
				},
			]

			mockDownloadRepository.findByOrganization = vi.fn().mockResolvedValue(linksWithTimeData)

			const analytics = await manager.getAnalytics('test-org')

			// Should have 30 days of data
			expect(analytics.downloadsByDay).toHaveLength(30)

			// Today should have 1 download
			const today = analytics.downloadsByDay[29] // Last item is today
			expect(today.date).toBe('2023-10-15')
			expect(today.count).toBe(1)

			// Yesterday should have 1 download
			const yesterday = analytics.downloadsByDay[28]
			expect(yesterday.date).toBe('2023-10-14')
			expect(yesterday.count).toBe(1)

			vi.useRealTimers()
		})

		it('should sort recent activity by timestamp', async () => {
			const linksWithActivity = [
				{
					id: 'link-1',
					fileName: 'file1.pdf',
					accessedBy: [
						{ timestamp: '2023-10-01T10:00:00Z', userId: 'user-1', success: true },
						{ timestamp: '2023-10-01T12:00:00Z', userId: 'user-2', success: true },
					],
				},
				{
					id: 'link-2',
					fileName: 'file2.pdf',
					accessedBy: [{ timestamp: '2023-10-01T11:00:00Z', userId: 'user-3', success: true }],
				},
			]

			mockDownloadRepository.findByOrganization = vi.fn().mockResolvedValue(linksWithActivity)

			const analytics = await manager.getAnalytics('test-org')

			// Should be sorted by timestamp (most recent first)
			expect(analytics.recentActivity).toHaveLength(3)
			expect(analytics.recentActivity[0].timestamp).toBe('2023-10-01T12:00:00Z')
			expect(analytics.recentActivity[1].timestamp).toBe('2023-10-01T11:00:00Z')
			expect(analytics.recentActivity[2].timestamp).toBe('2023-10-01T10:00:00Z')
		})
	})
})
