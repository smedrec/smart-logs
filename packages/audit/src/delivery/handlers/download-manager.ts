/**
 * Download tracking and management service
 * Requirements 9.3, 9.4: Download tracking, analytics, and link management
 */

import { StructuredLogger } from '@repo/logs'

import type { IDownloadLinkRepository } from '../database-client.js'

/**
 * Download analytics interface
 */
export interface DownloadAnalytics {
	totalLinks: number
	activeLinks: number
	expiredLinks: number
	revokedLinks: number
	totalDownloads: number
	uniqueUsers: number
	averageDownloadsPerLink: number
	topObjectTypes: Array<{ type: string; count: number }>
	downloadsByDay: Array<{ date: string; count: number }>
	recentActivity: Array<{
		linkId: string
		fileName: string
		timestamp: string
		userId?: string
		success: boolean
	}>
}

/**
 * Link cleanup result interface
 */
export interface CleanupResult {
	expiredLinksRemoved: number
	inactiveLinksRemoved: number
	totalSpaceFreed: number // in bytes
	cleanupDuration: number // in milliseconds
}

/**
 * Download access validation result
 */
export interface AccessValidationResult {
	allowed: boolean
	reason?: string
	remainingAccess?: number
	timeUntilExpiry?: number // in milliseconds
}

/**
 * Download manager for tracking and managing download links
 * Requirements 9.3, 9.4: Download access logging and analytics collection
 */
export class DownloadManager {
	private readonly logger: StructuredLogger

	constructor(private readonly downloadRepository: IDownloadLinkRepository) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - DownloadManager',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})
	}

	/**
	 * Validate access to a download link
	 * Requirements 9.1, 9.2: Access control and permission validation
	 */
	async validateAccess(
		linkId: string,
		userId?: string,
		ipAddress?: string,
		userAgent?: string
	): Promise<AccessValidationResult> {
		try {
			const link = await this.downloadRepository.findById(linkId)

			if (!link) {
				return {
					allowed: false,
					reason: 'Download link not found',
				}
			}

			// Check if link is active
			if (!link.isActive) {
				return {
					allowed: false,
					reason: link.revokedReason || 'Download link has been revoked',
				}
			}

			// Check expiration
			const now = new Date()
			const expiresAt = new Date(link.expiresAt)
			if (now > expiresAt) {
				return {
					allowed: false,
					reason: 'Download link has expired',
				}
			}

			// Check access limits
			if (link.maxAccess && link.accessCount >= link.maxAccess) {
				return {
					allowed: false,
					reason: 'Maximum access limit reached',
				}
			}

			// Calculate remaining access and time
			const remainingAccess = link.maxAccess ? link.maxAccess - link.accessCount : undefined
			const timeUntilExpiry = expiresAt.getTime() - now.getTime()

			this.logger.info('Download access validated', {
				linkId,
				userId,
				ipAddress,
				remainingAccess,
				timeUntilExpiry,
			})

			return {
				allowed: true,
				remainingAccess,
				timeUntilExpiry,
			}
		} catch (error) {
			this.logger.error('Error validating download access', {
				linkId,
				userId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				allowed: false,
				reason: 'Internal error validating access',
			}
		}
	}

	/**
	 * Record a download access attempt
	 * Requirements 9.3: Download access logging with user tracking
	 */
	async recordAccess(
		linkId: string,
		success: boolean,
		userId?: string,
		ipAddress?: string,
		userAgent?: string,
		error?: string
	): Promise<void> {
		try {
			const accessRecord = {
				timestamp: new Date().toISOString(),
				userId,
				ipAddress,
				userAgent,
				success,
				error,
			}

			await this.downloadRepository.recordAccess(linkId, accessRecord)

			this.logger.info('Download access recorded', {
				linkId,
				success,
				userId,
				ipAddress,
				error,
			})
		} catch (error) {
			this.logger.error('Error recording download access', {
				linkId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	}

	/**
	 * Get download analytics for an organization
	 * Requirements 9.4: Download count and analytics collection
	 */
	async getAnalytics(
		organizationId: string,
		options?: {
			startDate?: string
			endDate?: string
			objectType?: string
		}
	): Promise<DownloadAnalytics> {
		try {
			// Get all links for the organization
			const links = await this.downloadRepository.findByOrganization(organizationId, {
				objectType: options?.objectType,
			})

			// Calculate basic statistics
			const totalLinks = links.length
			const activeLinks = links.filter((link) => link.isActive).length
			const expiredLinks = links.filter((link) => new Date(link.expiresAt) < new Date()).length
			const revokedLinks = links.filter((link) => !link.isActive && link.revokedAt).length

			// Calculate download statistics
			const totalDownloads = links.reduce((sum, link) => sum + link.accessCount, 0)
			const uniqueUsers = new Set(
				links.flatMap((link) =>
					link.accessedBy
						.filter((access: any) => access.userId && access.success)
						.map((access: any) => access.userId)
				)
			).size

			const averageDownloadsPerLink = totalLinks > 0 ? totalDownloads / totalLinks : 0

			// Calculate top object types
			const objectTypeCounts = links.reduce(
				(counts, link) => {
					counts[link.objectType] = (counts[link.objectType] || 0) + link.accessCount
					return counts
				},
				{} as Record<string, number>
			)

			const topObjectTypes = Object.entries(objectTypeCounts)
				.map(([type, count]) => ({ type, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10)

			// Calculate downloads by day (last 30 days)
			const downloadsByDay = this.calculateDownloadsByDay(links, 30)

			// Get recent activity (last 50 activities)
			const recentActivity = this.getRecentActivity(links, 50)

			return {
				totalLinks,
				activeLinks,
				expiredLinks,
				revokedLinks,
				totalDownloads,
				uniqueUsers,
				averageDownloadsPerLink,
				topObjectTypes,
				downloadsByDay,
				recentActivity,
			}
		} catch (error) {
			this.logger.error('Error getting download analytics', {
				organizationId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			// Return empty analytics on error
			return {
				totalLinks: 0,
				activeLinks: 0,
				expiredLinks: 0,
				revokedLinks: 0,
				totalDownloads: 0,
				uniqueUsers: 0,
				averageDownloadsPerLink: 0,
				topObjectTypes: [],
				downloadsByDay: [],
				recentActivity: [],
			}
		}
	}

	/**
	 * Revoke a download link
	 * Requirements 9.2: Download link management and cleanup
	 */
	async revokeLink(linkId: string, revokedBy?: string, reason?: string): Promise<void> {
		try {
			await this.downloadRepository.revokeLink(linkId, revokedBy, reason)

			this.logger.info('Download link revoked', {
				linkId,
				revokedBy,
				reason,
			})
		} catch (error) {
			this.logger.error('Error revoking download link', {
				linkId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Cleanup expired and inactive download links
	 * Requirements 9.4: Automatic link cleanup after expiration
	 */
	async cleanupExpiredLinks(): Promise<CleanupResult> {
		const startTime = Date.now()

		try {
			this.logger.info('Starting download link cleanup')

			// Get expired links before deletion for statistics
			const expiredLinks = await this.downloadRepository.findByOrganization('', {
				// This would need to be modified to get all expired links across organizations
			})

			// Calculate space that will be freed (approximate)
			const totalSpaceFreed = expiredLinks
				.filter((link) => new Date(link.expiresAt) < new Date())
				.reduce((sum, link) => sum + (link.fileSize || 0), 0)

			// Remove expired links
			const expiredLinksRemoved = await this.downloadRepository.cleanupExpired()

			// For now, we don't have inactive link cleanup, but it could be added
			const inactiveLinksRemoved = 0

			const cleanupDuration = Date.now() - startTime

			const result: CleanupResult = {
				expiredLinksRemoved,
				inactiveLinksRemoved,
				totalSpaceFreed,
				cleanupDuration,
			}

			this.logger.info('Download link cleanup completed', result)

			return result
		} catch (error) {
			this.logger.error('Error during download link cleanup', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})

			return {
				expiredLinksRemoved: 0,
				inactiveLinksRemoved: 0,
				totalSpaceFreed: 0,
				cleanupDuration: Date.now() - startTime,
			}
		}
	}

	/**
	 * Get detailed access statistics for a specific link
	 * Requirements 9.3, 9.4: Download status reporting and monitoring
	 */
	async getLinkStats(linkId: string): Promise<{
		link: any
		stats: {
			totalAccess: number
			uniqueUsers: number
			lastAccess?: string
			accessHistory: any[]
		}
		analytics: {
			accessByHour: Array<{ hour: number; count: number }>
			accessByDay: Array<{ date: string; count: number }>
			userAgents: Array<{ userAgent: string; count: number }>
			ipAddresses: Array<{ ip: string; count: number }>
			successRate: number
		}
	}> {
		try {
			const link = await this.downloadRepository.findById(linkId)
			if (!link) {
				throw new Error(`Download link not found: ${linkId}`)
			}

			const stats = await this.downloadRepository.getAccessStats(linkId)

			// Calculate detailed analytics
			const accessHistory = stats.accessHistory || []
			const successfulAccess = accessHistory.filter((access) => access.success)

			// Access by hour (last 24 hours)
			const accessByHour = this.calculateAccessByHour(accessHistory)

			// Access by day (last 30 days)
			const accessByDay = this.calculateAccessByDay(accessHistory, 30)

			// User agents
			const userAgentCounts = accessHistory.reduce(
				(counts, access) => {
					if (access.userAgent) {
						counts[access.userAgent] = (counts[access.userAgent] || 0) + 1
					}
					return counts
				},
				{} as Record<string, number>
			)

			const userAgents = Object.entries(userAgentCounts)
				.map(([userAgent, count]) => ({ userAgent, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10)

			// IP addresses
			const ipCounts = accessHistory.reduce(
				(counts, access) => {
					if (access.ipAddress) {
						counts[access.ipAddress] = (counts[access.ipAddress] || 0) + 1
					}
					return counts
				},
				{} as Record<string, number>
			)

			const ipAddresses = Object.entries(ipCounts)
				.map(([ip, count]) => ({ ip, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10)

			// Success rate
			const successRate =
				accessHistory.length > 0
					? Math.round((successfulAccess.length / accessHistory.length) * 100 * 100) / 100
					: 0

			return {
				link,
				stats,
				analytics: {
					accessByHour,
					accessByDay,
					userAgents,
					ipAddresses,
					successRate,
				},
			}
		} catch (error) {
			this.logger.error('Error getting link statistics', {
				linkId,
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			throw error
		}
	}

	/**
	 * Schedule automatic cleanup of expired links
	 * Requirements 9.4: Automatic link cleanup scheduling
	 */
	scheduleCleanup(intervalMinutes: number = 60): NodeJS.Timeout {
		this.logger.info('Scheduling automatic download link cleanup', {
			intervalMinutes,
		})

		return setInterval(
			async () => {
				try {
					await this.cleanupExpiredLinks()
				} catch (error) {
					this.logger.error('Scheduled cleanup failed', {
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			},
			intervalMinutes * 60 * 1000
		)
	}

	/**
	 * Calculate downloads by day for the specified number of days
	 */
	private calculateDownloadsByDay(
		links: any[],
		days: number
	): Array<{ date: string; count: number }> {
		const result: Array<{ date: string; count: number }> = []
		const now = new Date()

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now)
			date.setDate(date.getDate() - i)
			const dateStr = date.toISOString().split('T')[0]

			const count = links.reduce((sum, link) => {
				const dayAccess = link.accessedBy.filter((access: any) => {
					const accessDate = new Date(access.timestamp).toISOString().split('T')[0]
					return accessDate === dateStr && access.success
				}).length
				return sum + dayAccess
			}, 0)

			result.push({ date: dateStr, count })
		}

		return result
	}

	/**
	 * Calculate access by hour for the last 24 hours
	 */
	private calculateAccessByHour(accessHistory: any[]): Array<{ hour: number; count: number }> {
		const result: Array<{ hour: number; count: number }> = []
		const now = new Date()

		for (let hour = 0; hour < 24; hour++) {
			const count = accessHistory.filter((access) => {
				const accessTime = new Date(access.timestamp)
				const hoursDiff = Math.floor((now.getTime() - accessTime.getTime()) / (1000 * 60 * 60))
				return hoursDiff === 23 - hour && access.success
			}).length

			result.push({ hour, count })
		}

		return result
	}

	/**
	 * Calculate access by day for access history
	 */
	private calculateAccessByDay(
		accessHistory: any[],
		days: number
	): Array<{ date: string; count: number }> {
		const result: Array<{ date: string; count: number }> = []
		const now = new Date()

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date(now)
			date.setDate(date.getDate() - i)
			const dateStr = date.toISOString().split('T')[0]

			const count = accessHistory.filter((access) => {
				const accessDate = new Date(access.timestamp).toISOString().split('T')[0]
				return accessDate === dateStr && access.success
			}).length

			result.push({ date: dateStr, count })
		}

		return result
	}

	/**
	 * Get recent activity from links
	 */
	private getRecentActivity(
		links: any[],
		limit: number
	): Array<{
		linkId: string
		fileName: string
		timestamp: string
		userId?: string
		success: boolean
	}> {
		const allActivity: Array<{
			linkId: string
			fileName: string
			timestamp: string
			userId?: string
			success: boolean
		}> = []

		for (const link of links) {
			for (const access of link.accessedBy || []) {
				allActivity.push({
					linkId: link.id,
					fileName: link.fileName,
					timestamp: access.timestamp,
					userId: access.userId,
					success: access.success,
				})
			}
		}

		// Sort by timestamp (most recent first) and limit
		return allActivity
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
			.slice(0, limit)
	}
}

/**
 * Factory function for creating download manager
 */
export function createDownloadManager(
	downloadRepository: IDownloadLinkRepository
): DownloadManager {
	return new DownloadManager(downloadRepository)
}
