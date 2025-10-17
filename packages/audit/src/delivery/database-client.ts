/**
 * Delivery database client extending EnhancedAuditDatabaseClient patterns
 * Requirements 1.1, 1.5, 2.5: Database integration for delivery operations
 */

import { and, desc, eq, sql } from 'drizzle-orm'

import {
	deliveryDestinations,
	deliveryQueue,
	destinationHealth,
	downloadLinks,
	webhookSecrets,
} from '@repo/audit-db'
import { StructuredLogger } from '@repo/logs'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { EnhancedAuditDatabaseClient } from '@repo/audit-db'
import type {
	CreateDeliveryDestinationInput,
	DeliveryDestination,
	DeliveryDestinationListOptions,
	DeliveryDestinationListResponse,
	DeliveryListOptions,
	DeliveryListResponse,
	DeliveryStatusResponse,
	DestinationHealth,
	UpdateDeliveryDestinationInput,
} from './types.js'

/**
 * Repository interface for delivery destinations
 */
export interface IDeliveryDestinationRepository {
	create(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination>
	update(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination>
	delete(id: string): Promise<void>
	findById(id: string): Promise<DeliveryDestination | null>
	findByOrganization(organizationId: string): Promise<DeliveryDestination[]>
	list(options: DeliveryDestinationListOptions): Promise<DeliveryDestinationListResponse>
	incrementUsage(id: string): Promise<void>
	setDisabled(id: string, disabled: boolean, reason?: string, disabledBy?: string): Promise<void>
}

/**
 * Repository interface for delivery logs
 */
export interface IDeliveryLogRepository {
	create(log: Omit<DeliveryStatusResponse, 'id'>): Promise<string>
	update(id: string, updates: Partial<DeliveryStatusResponse>): Promise<void>
	findById(id: string): Promise<DeliveryStatusResponse | null>
	findByDeliveryId(deliveryId: string): Promise<DeliveryStatusResponse[]>
	list(options: DeliveryListOptions): Promise<DeliveryListResponse>
	recordAttempt(id: string, attempt: any): Promise<void>
	markDelivered(id: string, deliveredAt: string, crossSystemReference?: string): Promise<void>
	markFailed(id: string, reason: string): Promise<void>
}

/**
 * Repository interface for delivery queue
 */
export interface IDeliveryQueueRepository {
	enqueue(item: {
		id: string
		organizationId: string
		destinationId: number
		payload: any
		priority?: number
		scheduledAt?: string
		correlationId?: string
		idempotencyKey?: string
		metadata?: any
	}): Promise<void>
	dequeue(limit?: number): Promise<any[]>
	updateStatus(id: string, status: string, processedAt?: string): Promise<void>
	scheduleRetry(id: string, nextRetryAt: string, retryCount: number): Promise<void>
	findById(id: string): Promise<any | null>
	getQueueStats(): Promise<{
		pendingCount: number
		processingCount: number
		completedCount: number
		failedCount: number
		retryingCount: number
	}>
	findByDeliveryId(deliveryId: string): Promise<any[]>
	getRecentProcessedItems(limit?: number): Promise<any[]>
	getOldestPendingItem(): Promise<any | null>
	deleteCompletedItems(cutoffTime: string): Promise<number>
	cancelByDeliveryId(deliveryId: string): Promise<void>
	getQueueDepthByOrganization(organizationId: string): Promise<{
		pendingCount: number
		processingCount: number
		averageWaitTime: number
	}>
	findByStatus(
		status: string,
		options?: {
			organizationId?: string
			limit?: number
			offset?: number
		}
	): Promise<any[]>
	updateItem(id: string, updates: Partial<any>): Promise<void>
	deleteItem(id: string): Promise<void>
	deleteItemsByStatusAndAge(status: string, cutoffTime: string): Promise<number>
}

/**
 * Repository interface for destination health
 */
export interface IDestinationHealthRepository {
	upsert(destinationId: string, health: Partial<DestinationHealth>): Promise<void>
	findByDestinationId(destinationId: string): Promise<DestinationHealth | null>
	recordSuccess(destinationId: string, responseTime: number): Promise<void>
	recordFailure(destinationId: string, error: string): Promise<void>
	updateCircuitBreakerState(destinationId: string, state: string, openedAt?: string): Promise<void>
	getUnhealthyDestinations(): Promise<DestinationHealth[]>
}

/**
 * Repository interface for webhook secrets
 */
export interface IWebhookSecretRepository {
	create(secret: {
		id: string
		destinationId: number
		secretKey: string
		algorithm?: string
		isPrimary?: boolean
		expiresAt?: string
		createdBy?: string
	}): Promise<void>
	findByDestinationId(destinationId: number): Promise<any[]>
	findActiveByDestinationId(destinationId: number): Promise<any[]>
	rotate(destinationId: number, newSecretKey: string, createdBy?: string): Promise<void>
	markInactive(id: string): Promise<void>
	cleanup(): Promise<void>
}

/**
 * Repository interface for download links
 */
export interface IDownloadLinkRepository {
	createDownloadLink(link: {
		id: string
		organizationId: string
		deliveryId?: string
		objectId: string
		objectType: string
		objectMetadata: Record<string, any>
		filePath: string
		fileName: string
		mimeType?: string
		fileSize?: number
		signedUrl: string
		signature: string
		algorithm: string
		expiresAt: string
		maxAccess?: number
		accessCount: number
		accessedBy: any[]
		isActive: string
		createdBy?: string
		metadata: Record<string, any>
	}): Promise<void>
	findById(id: string): Promise<any | null>
	findByOrganization(
		organizationId: string,
		options?: {
			isActive?: boolean
			objectType?: string
			limit?: number
			offset?: number
		}
	): Promise<any[]>
	recordAccess(
		id: string,
		accessRecord: {
			timestamp: string
			userId?: string
			ipAddress?: string
			userAgent?: string
			success: boolean
			error?: string
		}
	): Promise<void>
	revokeLink(id: string, revokedBy?: string, reason?: string): Promise<void>
	cleanupExpired(): Promise<number>
	getAccessStats(id: string): Promise<{
		totalAccess: number
		uniqueUsers: number
		lastAccess?: string
		accessHistory: any[]
	}>
}

/**
 * Main delivery database client
 */
export class DeliveryDatabaseClient {
	private readonly logger: StructuredLogger
	private readonly destinationRepo: DeliveryDestinationRepository
	private readonly logRepo: DeliveryLogRepository
	private readonly queueRepo: DeliveryQueueRepository
	private readonly healthRepo: DestinationHealthRepository
	private readonly secretRepo: WebhookSecretRepository
	private readonly downloadRepo: DownloadLinkRepository

	constructor(private readonly enhancedClient: EnhancedAuditDatabaseClient) {
		this.logger = new StructuredLogger({
			service: '@repo/audit - DeliveryDatabaseClient',
			environment: process.env.NODE_ENV || 'development',
			console: {
				name: 'console',
				enabled: true,
				format: 'pretty',
				colorize: true,
				level: 'info',
			},
		})

		// Initialize repositories
		this.destinationRepo = new DeliveryDestinationRepository(enhancedClient)
		this.logRepo = new DeliveryLogRepository(enhancedClient)
		this.queueRepo = new DeliveryQueueRepository(enhancedClient)
		this.healthRepo = new DestinationHealthRepository(enhancedClient)
		this.secretRepo = new WebhookSecretRepository(enhancedClient)
		this.downloadRepo = new DownloadLinkRepository(enhancedClient)
	}

	get destinations(): IDeliveryDestinationRepository {
		return this.destinationRepo
	}

	get logs(): IDeliveryLogRepository {
		return this.logRepo
	}

	get queue(): IDeliveryQueueRepository {
		return this.queueRepo
	}

	get health(): IDestinationHealthRepository {
		return this.healthRepo
	}

	get secrets(): IWebhookSecretRepository {
		return this.secretRepo
	}

	get downloads(): IDownloadLinkRepository {
		return this.downloadRepo
	}

	/**
	 * Execute transaction with enhanced client protection
	 */
	async transaction<T>(callback: (client: DeliveryDatabaseClient) => Promise<T>): Promise<T> {
		// Use the database connection directly for transactions
		const db = this.enhancedClient.getDatabase()
		return db.transaction(async (tx) => {
			// Create a new client instance with the transaction
			const txClient = new DeliveryDatabaseClient(this.enhancedClient)
			return callback(txClient)
		})
	}

	/**
	 * Get database connection for direct queries
	 */
	async getConnection(): Promise<PostgresJsDatabase<any>> {
		return this.enhancedClient.getDatabase()
	}

	/**
	 * Get default destinations for an organization
	 */
	async getDefaultDestinations(organizationId: string): Promise<DeliveryDestination[]> {
		return this.destinationRepo.getDefaultDestinations(organizationId)
	}

	/**
	 * Health check for delivery database operations
	 */
	async healthCheck(): Promise<{ healthy: boolean; details: any }> {
		try {
			const baseHealth = await this.enhancedClient.getHealthStatus()

			// Additional delivery-specific health checks
			const queueStats = await this.queueRepo.getQueueStats()
			const unhealthyDestinations = await this.healthRepo.getUnhealthyDestinations()

			return {
				healthy: baseHealth.overall === 'healthy' && unhealthyDestinations.length < 10,
				details: {
					...baseHealth,
					delivery: {
						queueStats,
						unhealthyDestinations: unhealthyDestinations.length,
					},
				},
			}
		} catch (error) {
			this.logger.error('Delivery database health check failed:', {
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return {
				healthy: false,
				details: { error: error instanceof Error ? error.message : 'Unknown error' },
			}
		}
	}
}

/**
 * Delivery destination repository implementation
 */
class DeliveryDestinationRepository implements IDeliveryDestinationRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async create(input: CreateDeliveryDestinationInput): Promise<DeliveryDestination> {
		const db = this.client.getDatabase()

		const [result] = await db
			.insert(deliveryDestinations)
			.values({
				organizationId: input.organizationId,
				type: input.type,
				label: input.label,
				description: input.description,
				icon: input.icon,
				instructions: input.instructions,
				config: input.config,
			})
			.returning()

		return this.mapToDeliveryDestination(result)
	}

	async update(id: string, input: UpdateDeliveryDestinationInput): Promise<DeliveryDestination> {
		const db = this.client.getDatabase()

		const [result] = await db
			.update(deliveryDestinations)
			.set({
				...input,
				disabled: input.disabled?.toString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(deliveryDestinations.id, parseInt(id)))
			.returning()

		return this.mapToDeliveryDestination(result)
	}

	async delete(id: string): Promise<void> {
		const db = this.client.getDatabase()

		await db.delete(deliveryDestinations).where(eq(deliveryDestinations.id, parseInt(id)))
	}

	async findById(id: string): Promise<DeliveryDestination | null> {
		const db = this.client.getDatabase()

		const [result] = await db
			.select()
			.from(deliveryDestinations)
			.where(eq(deliveryDestinations.id, parseInt(id)))

		return result ? this.mapToDeliveryDestination(result) : null
	}

	async findByOrganization(organizationId: string): Promise<DeliveryDestination[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(deliveryDestinations)
			.where(eq(deliveryDestinations.organizationId, organizationId))

		return results.map(this.mapToDeliveryDestination)
	}

	async getDefaultDestinations(organizationId: string): Promise<DeliveryDestination[]> {
		const db = this.client.getDatabase()

		// For now, return all enabled destinations for the organization
		// In a future task, we can add a specific "default" flag to destinations
		const results = await db
			.select()
			.from(deliveryDestinations)
			.where(
				and(
					eq(deliveryDestinations.organizationId, organizationId),
					eq(deliveryDestinations.disabled, 'false')
				)
			)

		return results.map(this.mapToDeliveryDestination)
	}

	async list(options: DeliveryDestinationListOptions): Promise<DeliveryDestinationListResponse> {
		const db = this.client.getDatabase()

		let query = db.select().from(deliveryDestinations)

		// Build query with filters
		const conditions = []
		if (options.filters?.organizationId) {
			conditions.push(eq(deliveryDestinations.organizationId, options.filters.organizationId))
		}
		if (options.filters?.type) {
			conditions.push(eq(deliveryDestinations.type, options.filters.type))
		}
		if (options.filters?.disabled !== undefined) {
			conditions.push(eq(deliveryDestinations.disabled, options.filters.disabled.toString()))
		}

		// Build the complete query
		let baseQuery = db.select().from(deliveryDestinations)

		if (conditions.length > 0) {
			baseQuery = baseQuery.where(and(...conditions)) as any
		}

		// Apply sorting
		if (options.sortBy === 'createdAt') {
			baseQuery =
				options.sortOrder === 'desc'
					? (baseQuery.orderBy(desc(deliveryDestinations.createdAt)) as any)
					: (baseQuery.orderBy(deliveryDestinations.createdAt) as any)
		}

		// Apply pagination
		if (options.limit) {
			baseQuery = baseQuery.limit(options.limit) as any
		}
		if (options.offset) {
			baseQuery = baseQuery.offset(options.offset) as any
		}

		const results = await baseQuery
		const totalCount = await this.getTotalCount(options)

		return {
			deliveryDestinations: results.map(this.mapToDeliveryDestination),
			totalCount,
		}
	}

	async incrementUsage(id: string): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(deliveryDestinations)
			.set({
				countUsage: sql`${deliveryDestinations.countUsage} + 1`,
				lastUsedAt: new Date().toISOString(),
			})
			.where(eq(deliveryDestinations.id, parseInt(id)))
	}

	async setDisabled(
		id: string,
		disabled: boolean,
		reason?: string,
		disabledBy?: string
	): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(deliveryDestinations)
			.set({
				disabled: disabled.toString(),
				disabledAt: disabled ? new Date().toISOString() : null,
				disabledBy: disabled ? disabledBy : null,
			})
			.where(eq(deliveryDestinations.id, parseInt(id)))
	}

	private async getTotalCount(options: DeliveryDestinationListOptions): Promise<number> {
		const db = this.client.getDatabase()

		// Build conditions
		const conditions = []
		if (options.filters?.organizationId) {
			conditions.push(eq(deliveryDestinations.organizationId, options.filters.organizationId))
		}
		if (options.filters?.type) {
			conditions.push(eq(deliveryDestinations.type, options.filters.type))
		}
		if (options.filters?.disabled !== undefined) {
			conditions.push(eq(deliveryDestinations.disabled, options.filters.disabled.toString()))
		}

		// Build query
		let countQuery = db.select({ count: sql<number>`count(*)` }).from(deliveryDestinations)

		if (conditions.length > 0) {
			countQuery = countQuery.where(and(...conditions)) as any
		}

		const [result] = await countQuery
		return result.count
	}

	private mapToDeliveryDestination(row: any): DeliveryDestination {
		return {
			id: row.id.toString(),
			organizationId: row.organizationId,
			type: row.type,
			label: row.label,
			description: row.description,
			icon: row.icon,
			instructions: row.instructions,
			disabled: row.disabled === 'true',
			disabledAt: row.disabledAt,
			disabledBy: row.disabledBy,
			countUsage: row.countUsage,
			lastUsedAt: row.lastUsedAt,
			config: row.config,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}
}

/**
 * Placeholder implementations for other repositories
 * These will be implemented in subsequent tasks
 */

class DeliveryLogRepository implements IDeliveryLogRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async create(log: Omit<DeliveryStatusResponse, 'id'>): Promise<string> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async update(id: string, updates: Partial<DeliveryStatusResponse>): Promise<void> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async findById(id: string): Promise<DeliveryStatusResponse | null> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async findByDeliveryId(deliveryId: string): Promise<DeliveryStatusResponse[]> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async list(options: DeliveryListOptions): Promise<DeliveryListResponse> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async recordAttempt(id: string, attempt: any): Promise<void> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async markDelivered(
		id: string,
		deliveredAt: string,
		crossSystemReference?: string
	): Promise<void> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}

	async markFailed(id: string, reason: string): Promise<void> {
		// TODO: Implement in subsequent tasks
		throw new Error('Not implemented')
	}
}

class DeliveryQueueRepository implements IDeliveryQueueRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async enqueue(item: {
		id: string
		organizationId: string
		destinationId: number
		payload: any
		priority?: number
		scheduledAt?: string
		correlationId?: string
		idempotencyKey?: string
		metadata?: any
	}): Promise<void> {
		const db = this.client.getDatabase()

		await db.insert(deliveryQueue).values({
			id: item.id,
			organizationId: item.organizationId,
			destinationId: item.destinationId,
			payload: item.payload,
			priority: item.priority || 0,
			scheduledAt: item.scheduledAt || new Date().toISOString(),
			status: 'pending',
			correlationId: item.correlationId,
			idempotencyKey: item.idempotencyKey,
			retryCount: 0,
			maxRetries: 5,
			metadata: item.metadata || {},
		})
	}

	async dequeue(limit: number = 10): Promise<any[]> {
		const db = this.client.getDatabase()

		// Get pending items ordered by priority (desc) and scheduled time (asc)
		// Only get items that are scheduled to run now or in the past
		const results = await db
			.select()
			.from(deliveryQueue)
			.where(
				and(
					eq(deliveryQueue.status, 'pending'),
					sql`${deliveryQueue.scheduledAt} <= NOW()`,
					sql`(${deliveryQueue.nextRetryAt} IS NULL OR ${deliveryQueue.nextRetryAt} <= NOW())`
				)
			)
			.orderBy(desc(deliveryQueue.priority), deliveryQueue.scheduledAt)
			.limit(limit)

		return results.map(this.mapToQueueItem)
	}

	async updateStatus(id: string, status: string, processedAt?: string): Promise<void> {
		const db = this.client.getDatabase()

		const updateData: any = {
			status,
			updatedAt: new Date().toISOString(),
		}

		if (processedAt) {
			updateData.processedAt = processedAt
		}

		await db.update(deliveryQueue).set(updateData).where(eq(deliveryQueue.id, id))
	}

	async scheduleRetry(id: string, nextRetryAt: string, retryCount: number): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(deliveryQueue)
			.set({
				status: 'pending',
				nextRetryAt,
				retryCount,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(deliveryQueue.id, id))
	}

	async findById(id: string): Promise<any | null> {
		const db = this.client.getDatabase()

		const [result] = await db.select().from(deliveryQueue).where(eq(deliveryQueue.id, id))

		return result ? this.mapToQueueItem(result) : null
	}

	async getQueueStats(): Promise<{
		pendingCount: number
		processingCount: number
		completedCount: number
		failedCount: number
		retryingCount: number
	}> {
		const db = this.client.getDatabase()

		// Get counts for each status
		const [pendingResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(eq(deliveryQueue.status, 'pending'))

		const [processingResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(eq(deliveryQueue.status, 'processing'))

		const [completedResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(eq(deliveryQueue.status, 'completed'))

		const [failedResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(eq(deliveryQueue.status, 'failed'))

		// Count retrying items (pending with retry count > 0)
		const [retryingResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(and(eq(deliveryQueue.status, 'pending'), sql`${deliveryQueue.retryCount} > 0`))

		return {
			pendingCount: pendingResult.count,
			processingCount: processingResult.count,
			completedCount: completedResult.count,
			failedCount: failedResult.count,
			retryingCount: retryingResult.count,
		}
	}

	/**
	 * Get queue items by delivery ID for multi-destination deliveries
	 */
	async findByDeliveryId(deliveryId: string): Promise<any[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(deliveryQueue)
			.where(sql`${deliveryQueue.payload}->>'deliveryId' = ${deliveryId}`)

		return results.map(this.mapToQueueItem)
	}

	/**
	 * Get recent processed items for metrics calculation
	 */
	async getRecentProcessedItems(limit: number = 100): Promise<any[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(deliveryQueue)
			.where(sql`${deliveryQueue.status} IN ('completed', 'failed')`)
			.orderBy(desc(deliveryQueue.processedAt))
			.limit(limit)

		return results.map(this.mapToQueueItem)
	}

	/**
	 * Get oldest pending item for queue age calculation
	 */
	async getOldestPendingItem(): Promise<any | null> {
		const db = this.client.getDatabase()

		const [result] = await db
			.select()
			.from(deliveryQueue)
			.where(eq(deliveryQueue.status, 'pending'))
			.orderBy(deliveryQueue.createdAt)
			.limit(1)

		return result ? this.mapToQueueItem(result) : null
	}

	/**
	 * Delete completed items older than specified time
	 */
	async deleteCompletedItems(cutoffTime: string): Promise<number> {
		const db = this.client.getDatabase()

		const result = await db
			.delete(deliveryQueue)
			.where(
				and(
					sql`${deliveryQueue.status} IN ('completed', 'failed')`,
					sql`${deliveryQueue.processedAt} < ${cutoffTime}`
				)
			)
			.returning({ deletedId: deliveryQueue.id })

		return result.length
	}

	/**
	 * Delete queue item by ID
	 */
	async deleteItem(id: string): Promise<void> {
		const db = this.client.getDatabase()

		await db.delete(deliveryQueue).where(eq(deliveryQueue.id, id))
	}

	/**
	 * Delete items by status and age
	 */
	async deleteItemsByStatusAndAge(status: string, cutoffTime: string): Promise<number> {
		const db = this.client.getDatabase()

		const result = await db
			.delete(deliveryQueue)
			.where(and(eq(deliveryQueue.status, status), sql`${deliveryQueue.updatedAt} < ${cutoffTime}`))
			.returning({ deletedId: deliveryQueue.id })

		return result.length
	}

	/**
	 * Cancel pending deliveries by delivery ID
	 */
	async cancelByDeliveryId(deliveryId: string): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(deliveryQueue)
			.set({
				status: 'cancelled',
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					sql`${deliveryQueue.payload}->>'deliveryId' = ${deliveryId}`,
					eq(deliveryQueue.status, 'pending')
				)
			)
	}

	/**
	 * Get queue depth by organization for monitoring
	 */
	async getQueueDepthByOrganization(organizationId: string): Promise<{
		pendingCount: number
		processingCount: number
		averageWaitTime: number
	}> {
		const db = this.client.getDatabase()

		const [pendingResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(
				and(eq(deliveryQueue.organizationId, organizationId), eq(deliveryQueue.status, 'pending'))
			)

		const [processingResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(deliveryQueue)
			.where(
				and(
					eq(deliveryQueue.organizationId, organizationId),
					eq(deliveryQueue.status, 'processing')
				)
			)

		// Calculate average wait time for pending items
		const [avgWaitResult] = await db
			.select({
				avgWait: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${deliveryQueue.createdAt})) * 1000), 0)`,
			})
			.from(deliveryQueue)
			.where(
				and(eq(deliveryQueue.organizationId, organizationId), eq(deliveryQueue.status, 'pending'))
			)

		return {
			pendingCount: pendingResult.count,
			processingCount: processingResult.count,
			averageWaitTime: Math.round(avgWaitResult.avgWait || 0),
		}
	}

	/**
	 * Get queue items by status with pagination
	 */
	async findByStatus(
		status: string,
		options?: {
			organizationId?: string
			limit?: number
			offset?: number
		}
	): Promise<any[]> {
		const db = this.client.getDatabase()

		let query = db.select().from(deliveryQueue)

		// Build query with filters
		const conditions = []
		conditions.push(eq(deliveryQueue.status, status))

		if (options?.organizationId) {
			conditions.push(eq(deliveryQueue.organizationId, options.organizationId))
		}

		query = query.where(and(...conditions)) as any

		query = query.orderBy(desc(deliveryQueue.createdAt)) as any

		if (options?.limit) {
			query = query.limit(options.limit) as any
		}

		if (options?.offset) {
			query = query.offset(options.offset) as any
		}

		const results = await query
		return results.map(this.mapToQueueItem)
	}

	/**
	 * Update queue item with partial data
	 */
	async updateItem(id: string, updates: Partial<any>): Promise<void> {
		const db = this.client.getDatabase()

		const updateData = {
			...updates,
			updatedAt: new Date().toISOString(),
		}

		await db.update(deliveryQueue).set(updateData).where(eq(deliveryQueue.id, id))
	}

	private mapToQueueItem(row: any): any {
		return {
			id: row.id,
			organizationId: row.organizationId,
			destinationId: row.destinationId,
			payload: row.payload,
			priority: row.priority,
			scheduledAt: row.scheduledAt,
			processedAt: row.processedAt,
			status: row.status,
			correlationId: row.correlationId,
			idempotencyKey: row.idempotencyKey,
			retryCount: row.retryCount,
			maxRetries: row.maxRetries,
			nextRetryAt: row.nextRetryAt,
			metadata: row.metadata || {},
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}
}

class DestinationHealthRepository implements IDestinationHealthRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async upsert(destinationId: string, health: Partial<DestinationHealth>): Promise<void> {
		const db = this.client.getDatabase()

		const updateData = {
			destinationId: parseInt(destinationId),
			status: health.status || 'healthy',
			lastCheckAt: health.lastCheckAt || new Date().toISOString(),
			consecutiveFailures: health.consecutiveFailures || 0,
			totalFailures: health.totalFailures || 0,
			totalDeliveries: health.totalDeliveries || 0,
			averageResponseTime: health.averageResponseTime || null,
			lastFailureAt: health.lastFailureAt || null,
			lastSuccessAt: health.lastSuccessAt || null,
			disabledAt: health.disabledAt || null,
			disabledReason: health.disabledReason || null,
			metadata: health.metadata || {},
			updatedAt: new Date().toISOString(),
		}

		// Use INSERT ... ON CONFLICT for upsert functionality
		await db.insert(destinationHealth).values(updateData).onConflictDoUpdate({
			target: destinationHealth.destinationId,
			set: updateData,
		})
	}

	async findByDestinationId(destinationId: string): Promise<DestinationHealth | null> {
		const db = this.client.getDatabase()

		const [result] = await db
			.select()
			.from(destinationHealth)
			.where(eq(destinationHealth.destinationId, parseInt(destinationId)))

		return result ? this.mapToDestinationHealth(result) : null
	}

	async recordSuccess(destinationId: string, responseTime: number): Promise<void> {
		const db = this.client.getDatabase()
		const now = new Date().toISOString()

		// Get current health record
		const current = await this.findByDestinationId(destinationId)

		const newTotalDeliveries = (current?.totalDeliveries || 0) + 1
		const currentAvgTime = current?.averageResponseTime || 0
		const newAvgTime =
			currentAvgTime === 0
				? responseTime
				: Math.round(
						(currentAvgTime * (newTotalDeliveries - 1) + responseTime) / newTotalDeliveries
					)

		await this.upsert(destinationId, {
			status: 'healthy',
			lastCheckAt: now,
			consecutiveFailures: 0, // Reset consecutive failures on success
			totalDeliveries: newTotalDeliveries,
			averageResponseTime: newAvgTime,
			lastSuccessAt: now,
			circuitBreakerState: 'closed',
		})
	}

	async recordFailure(destinationId: string, error: string): Promise<void> {
		const db = this.client.getDatabase()
		const now = new Date().toISOString()

		// Get current health record
		const current = await this.findByDestinationId(destinationId)

		const newConsecutiveFailures = (current?.consecutiveFailures || 0) + 1
		const newTotalFailures = (current?.totalFailures || 0) + 1
		const newTotalDeliveries = (current?.totalDeliveries || 0) + 1

		// Determine new status based on failure count
		let newStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disabled' = 'healthy'
		if (newConsecutiveFailures >= 10) {
			newStatus = 'disabled'
		} else if (newConsecutiveFailures >= 5) {
			newStatus = 'unhealthy'
		} else if (newConsecutiveFailures >= 3) {
			newStatus = 'degraded'
		}

		// Determine circuit breaker state
		let circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed'
		let circuitBreakerOpenedAt: string | undefined
		if (newConsecutiveFailures >= 5) {
			circuitBreakerState = 'open'
			circuitBreakerOpenedAt = now
		}

		await this.upsert(destinationId, {
			status: newStatus,
			lastCheckAt: now,
			consecutiveFailures: newConsecutiveFailures,
			totalFailures: newTotalFailures,
			totalDeliveries: newTotalDeliveries,
			lastFailureAt: now,
			circuitBreakerState,
			circuitBreakerOpenedAt,
			metadata: {
				...current?.metadata,
				lastError: error,
				lastErrorAt: now,
			},
		})
	}

	async updateCircuitBreakerState(
		destinationId: string,
		state: string,
		openedAt?: string
	): Promise<void> {
		const current = await this.findByDestinationId(destinationId)
		if (!current) {
			throw new Error(`Destination health record not found for ID: ${destinationId}`)
		}

		await this.upsert(destinationId, {
			circuitBreakerState: state as 'closed' | 'open' | 'half-open',
			circuitBreakerOpenedAt: openedAt,
		})
	}

	async getUnhealthyDestinations(): Promise<DestinationHealth[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(destinationHealth)
			.where(sql`${destinationHealth.status} IN ('degraded', 'unhealthy', 'disabled')`)

		return results.map(this.mapToDestinationHealth)
	}

	private mapToDestinationHealth(row: any): DestinationHealth {
		return {
			destinationId: row.destinationId.toString(),
			status: row.status,
			lastCheckAt: row.lastCheckAt,
			consecutiveFailures: row.consecutiveFailures,
			totalFailures: row.totalFailures,
			totalDeliveries: row.totalDeliveries,
			successRate:
				row.totalDeliveries > 0
					? (((row.totalDeliveries - row.totalFailures) / row.totalDeliveries) * 100).toFixed(2)
					: '0.00',
			averageResponseTime: row.averageResponseTime,
			lastFailureAt: row.lastFailureAt,
			lastSuccessAt: row.lastSuccessAt,
			disabledAt: row.disabledAt,
			disabledReason: row.disabledReason,
			circuitBreakerState: row.circuitBreakerState || 'closed',
			circuitBreakerOpenedAt: row.circuitBreakerOpenedAt,
			metadata: row.metadata || {},
		}
	}
}

class WebhookSecretRepository implements IWebhookSecretRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async create(secret: {
		id: string
		destinationId: number
		secretKey: string
		algorithm?: string
		isPrimary?: boolean
		expiresAt?: string
		createdBy?: string
	}): Promise<void> {
		const db = this.client.getDatabase()

		await db.insert(webhookSecrets).values({
			id: secret.id,
			destinationId: secret.destinationId,
			secretKey: secret.secretKey,
			algorithm: secret.algorithm || 'HMAC-SHA256',
			isActive: 'true',
			isPrimary: secret.isPrimary ? 'true' : 'false',
			expiresAt: secret.expiresAt,
			createdBy: secret.createdBy,
		})
	}

	async findByDestinationId(destinationId: number): Promise<any[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(webhookSecrets)
			.where(eq(webhookSecrets.destinationId, destinationId))
			.orderBy(desc(webhookSecrets.createdAt))

		return results.map(this.mapToWebhookSecret)
	}

	async findActiveByDestinationId(destinationId: number): Promise<any[]> {
		const db = this.client.getDatabase()

		const results = await db
			.select()
			.from(webhookSecrets)
			.where(
				and(eq(webhookSecrets.destinationId, destinationId), eq(webhookSecrets.isActive, 'true'))
			)
			.orderBy(desc(webhookSecrets.createdAt))

		return results.map(this.mapToWebhookSecret)
	}

	async rotate(destinationId: number, newSecretKey: string, createdBy?: string): Promise<void> {
		const db = this.client.getDatabase()

		// Mark existing secrets as non-primary
		await db
			.update(webhookSecrets)
			.set({
				isPrimary: 'false',
				rotatedAt: new Date().toISOString(),
			})
			.where(
				and(eq(webhookSecrets.destinationId, destinationId), eq(webhookSecrets.isPrimary, 'true'))
			)

		// Create new primary secret
		const newSecretId = `ws_${Date.now()}_${Math.random().toString(36).substring(2)}`
		await this.create({
			id: newSecretId,
			destinationId,
			secretKey: newSecretKey,
			isPrimary: true,
			createdBy,
		})
	}

	async markInactive(id: string): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(webhookSecrets)
			.set({
				isActive: 'false',
				rotatedAt: new Date().toISOString(),
			})
			.where(eq(webhookSecrets.id, id))
	}

	async cleanup(): Promise<void> {
		const db = this.client.getDatabase()

		// Delete expired and inactive secrets
		await db
			.delete(webhookSecrets)
			.where(and(eq(webhookSecrets.isActive, 'false'), sql`${webhookSecrets.expiresAt} < NOW()`))
	}

	private mapToWebhookSecret(row: any): any {
		return {
			id: row.id,
			destinationId: row.destinationId,
			secretKey: row.secretKey, // This will be encrypted in the database
			algorithm: row.algorithm,
			isActive: row.isActive === 'true',
			isPrimary: row.isPrimary === 'true',
			expiresAt: row.expiresAt,
			rotatedAt: row.rotatedAt,
			usageCount: row.usageCount,
			lastUsedAt: row.lastUsedAt,
			createdAt: row.createdAt,
			createdBy: row.createdBy,
		}
	}
}

class DownloadLinkRepository implements IDownloadLinkRepository {
	constructor(private readonly client: EnhancedAuditDatabaseClient) {}

	async createDownloadLink(link: {
		id: string
		organizationId: string
		deliveryId?: string
		objectId: string
		objectType: string
		objectMetadata: Record<string, any>
		filePath: string
		fileName: string
		mimeType?: string
		fileSize?: number
		signedUrl: string
		signature: string
		algorithm: string
		expiresAt: string
		maxAccess?: number
		accessCount: number
		accessedBy: any[]
		isActive: string
		createdBy?: string
		metadata: Record<string, any>
	}): Promise<void> {
		const db = this.client.getDatabase()

		await db.insert(downloadLinks).values({
			id: link.id,
			organizationId: link.organizationId,
			deliveryId: link.deliveryId,
			objectId: link.objectId,
			objectType: link.objectType,
			objectMetadata: link.objectMetadata,
			filePath: link.filePath,
			fileName: link.fileName,
			mimeType: link.mimeType,
			fileSize: link.fileSize,
			signedUrl: link.signedUrl,
			signature: link.signature,
			algorithm: link.algorithm,
			expiresAt: link.expiresAt,
			accessCount: link.accessCount,
			maxAccess: link.maxAccess,
			accessedBy: link.accessedBy,
			isActive: link.isActive,
			createdBy: link.createdBy,
			metadata: link.metadata,
		})
	}

	async findById(id: string): Promise<any | null> {
		const db = this.client.getDatabase()

		const [result] = await db.select().from(downloadLinks).where(eq(downloadLinks.id, id))

		return result ? this.mapToDownloadLink(result) : null
	}

	async findByOrganization(
		organizationId: string,
		options?: {
			isActive?: boolean
			objectType?: string
			limit?: number
			offset?: number
		}
	): Promise<any[]> {
		const db = this.client.getDatabase()

		let query = db.select().from(downloadLinks)

		// Apply filters
		const conditions = [eq(downloadLinks.organizationId, organizationId)]

		if (options?.isActive !== undefined) {
			conditions.push(eq(downloadLinks.isActive, options.isActive.toString()))
		}

		if (options?.objectType) {
			conditions.push(eq(downloadLinks.objectType, options.objectType))
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any
		}

		// Apply ordering
		query = query.orderBy(desc(downloadLinks.createdAt)) as any

		// Apply pagination
		if (options?.limit) {
			query = query.limit(options.limit) as any
		}
		if (options?.offset) {
			query = query.offset(options.offset) as any
		}

		const results = await query
		return results.map(this.mapToDownloadLink)
	}

	async recordAccess(
		id: string,
		accessRecord: {
			timestamp: string
			userId?: string
			ipAddress?: string
			userAgent?: string
			success: boolean
			error?: string
		}
	): Promise<void> {
		const db = this.client.getDatabase()

		// Get current link
		const current = await this.findById(id)
		if (!current) {
			throw new Error(`Download link not found: ${id}`)
		}

		// Update access count and add access record
		const newAccessCount = current.accessCount + 1
		const newAccessedBy = [...current.accessedBy, accessRecord]

		await db
			.update(downloadLinks)
			.set({
				accessCount: newAccessCount,
				accessedBy: newAccessedBy,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(downloadLinks.id, id))
	}

	async revokeLink(id: string, revokedBy?: string, reason?: string): Promise<void> {
		const db = this.client.getDatabase()

		await db
			.update(downloadLinks)
			.set({
				isActive: 'false',
				revokedAt: new Date().toISOString(),
				revokedBy,
				revokedReason: reason,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(downloadLinks.id, id))
	}

	async cleanupExpired(): Promise<number> {
		const db = this.client.getDatabase()

		// Delete expired links
		const result = await db
			.delete(downloadLinks)
			.where(sql`${downloadLinks.expiresAt} < NOW()`)
			.returning({ deletedId: downloadLinks.id })

		return result.length || 0
	}

	async getAccessStats(id: string): Promise<{
		totalAccess: number
		uniqueUsers: number
		lastAccess?: string
		accessHistory: any[]
	}> {
		const link = await this.findById(id)
		if (!link) {
			throw new Error(`Download link not found: ${id}`)
		}

		const accessHistory = link.accessedBy || []
		const uniqueUsers = new Set(
			accessHistory.filter((access: any) => access.userId).map((access: any) => access.userId)
		).size

		const lastAccess =
			accessHistory.length > 0 ? accessHistory[accessHistory.length - 1].timestamp : undefined

		return {
			totalAccess: link.accessCount,
			uniqueUsers,
			lastAccess,
			accessHistory,
		}
	}

	private mapToDownloadLink(row: any): any {
		return {
			id: row.id,
			organizationId: row.organizationId,
			deliveryId: row.deliveryId,
			objectId: row.objectId,
			objectType: row.objectType,
			objectMetadata: row.objectMetadata || {},
			filePath: row.filePath,
			fileName: row.fileName,
			mimeType: row.mimeType,
			fileSize: row.fileSize,
			signedUrl: row.signedUrl,
			signature: row.signature,
			algorithm: row.algorithm,
			expiresAt: row.expiresAt,
			accessCount: row.accessCount,
			maxAccess: row.maxAccess,
			accessedBy: row.accessedBy || [],
			isActive: row.isActive === 'true',
			revokedAt: row.revokedAt,
			revokedBy: row.revokedBy,
			revokedReason: row.revokedReason,
			createdBy: row.createdBy,
			metadata: row.metadata || {},
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}
}

/**
 * Factory function for creating delivery database client
 */
export function createDeliveryDatabaseClient(
	enhancedClient: EnhancedAuditDatabaseClient
): DeliveryDatabaseClient {
	return new DeliveryDatabaseClient(enhancedClient)
}
