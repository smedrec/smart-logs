/**
 * Alerts GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type { AlertQueryFilters, Alert as MonitorAlert } from '@repo/audit'
import type { Alert, AlertConnection, AlertFilter, GraphQLContext, PaginationInput } from '../types'

/**
 * Helper function to convert cursor to offset
 */
function cursorToOffset(cursor: string | undefined): number {
	if (!cursor) return 0
	try {
		return parseInt(Buffer.from(cursor, 'base64').toString('utf-8'))
	} catch {
		return 0
	}
}

/**
 * Helper function to convert offset to cursor
 */
function offsetToCursor(offset: number): string {
	return Buffer.from(offset.toString()).toString('base64')
}

/**
 * Helper function to map monitor alert type to GraphQL alert type
 */
function mapAlertType(monitorType: MonitorAlert['type']): Alert['type'] {
	// Map METRICS to SYSTEM since GraphQL doesn't have METRICS type
	if (monitorType === 'METRICS') {
		return 'SYSTEM'
	}
	return monitorType as Alert['type']
}

/**
 * Helper function to map GraphQL alert type to monitor alert type
 */
function mapGraphQLTypeToMonitor(graphqlType: Alert['type']): MonitorAlert['type'] {
	// Direct mapping since GraphQL types are a subset of monitor types
	return graphqlType as MonitorAlert['type']
}

export const alertResolvers = {
	Query: {
		/**
		 * Get alerts with filtering and pagination
		 * Requirements: 3.1, 3.2
		 */
		alerts: async (
			_: any,
			args: {
				filter?: AlertFilter
				pagination?: PaginationInput
			},
			context: GraphQLContext
		): Promise<AlertConnection> => {
			const { services } = context
			const { monitor, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Handle pagination
				const limit = args.pagination?.first || 50
				const offset = args.pagination?.after ? cursorToOffset(args.pagination.after) : 0

				// Convert GraphQL filter to monitor service filter
				const queryFilters: AlertQueryFilters = {
					organizationId,
					limit,
					offset,
				}

				// Map GraphQL filter to monitor service filter
				if (args.filter) {
					if (args.filter.status === 'ACKNOWLEDGED') {
						queryFilters.acknowledged = true
						queryFilters.resolved = false
					} else if (args.filter.status === 'RESOLVED') {
						queryFilters.resolved = true
					} else if (args.filter.status === 'ACTIVE') {
						queryFilters.acknowledged = false
						queryFilters.resolved = false
					}

					if (args.filter.severities?.length === 1) {
						queryFilters.severity = args.filter.severities[0]
					}

					if (args.filter.types?.length === 1) {
						queryFilters.type = mapGraphQLTypeToMonitor(args.filter.types[0])
					}
				}

				// Get alerts from monitoring service
				const monitorAlerts = await monitor.alert.getAlerts(queryFilters)

				// Get total count for pagination
				const totalCount = monitorAlerts.length // This is a simplified approach

				// Convert monitor alerts to GraphQL format
				const alerts: Alert[] = monitorAlerts.map((alert: MonitorAlert) => ({
					id: alert.id,
					type: mapAlertType(alert.type),
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.timestamp,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: undefined, // Monitor service doesn't have resolution field
					metadata: alert.metadata,
				}))

				const edges = alerts.map((alert, index) => ({
					node: alert,
					cursor: offsetToCursor(offset + index),
				}))

				const pageInfo = {
					hasNextPage: offset + limit < totalCount,
					hasPreviousPage: offset > 0,
					startCursor: edges.length > 0 ? edges[0].cursor : undefined,
					endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
				}

				logger.info('GraphQL alerts retrieved', {
					organizationId,
					alertCount: alerts.length,
					totalCount,
					filters: args.filter,
				})

				return {
					edges,
					pageInfo,
					totalCount,
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get alerts via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							filter: args.filter,
							pagination: args.pagination,
						},
					},
					'graphql-api',
					'alerts'
				)

				throw new GraphQLError(`Failed to get alerts: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	Mutation: {
		/**
		 * Acknowledge an alert
		 * Requirements: 3.1, 3.2
		 */
		acknowledgeAlert: async (
			_: any,
			args: { id: string },
			context: GraphQLContext
		): Promise<Alert> => {
			const { services } = context
			const { monitor, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string
			const userId = context.session.session.userId

			try {
				// Acknowledge the alert
				const result = await monitor.alert.acknowledgeAlert(args.id, userId)

				if (!result.success) {
					throw new GraphQLError('Alert not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				// Get the updated alert
				const alert = await monitor.alert.getAlertById(args.id, organizationId)

				if (!alert) {
					throw new GraphQLError('Alert not found after acknowledgment', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const acknowledgedAlert: Alert = {
					id: alert.id,
					type: mapAlertType(alert.type),
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.timestamp,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: undefined, // Monitor service doesn't have resolution field
					metadata: alert.metadata,
				}

				logger.info('GraphQL alert acknowledged', {
					organizationId,
					alertId: args.id,
					acknowledgedBy: userId,
				})

				return acknowledgedAlert
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to acknowledge alert via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							alertId: args.id,
						},
					},
					'graphql-api',
					'acknowledgeAlert'
				)

				throw new GraphQLError(`Failed to acknowledge alert: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Resolve an alert
		 * Requirements: 3.1, 3.2
		 */
		resolveAlert: async (
			_: any,
			args: { id: string; resolution: string },
			context: GraphQLContext
		): Promise<Alert> => {
			const { services } = context
			const { monitor, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string
			const userId = context.session.session.userId

			try {
				// Resolve the alert with resolution notes
				const result = await monitor.alert.resolveAlert(args.id, userId, {
					resolvedBy: userId,
					resolutionNotes: args.resolution,
				})

				if (!result.success) {
					throw new GraphQLError('Alert not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				// Get the updated alert
				const alert = await monitor.alert.getAlertById(args.id, organizationId)

				if (!alert) {
					throw new GraphQLError('Alert not found after resolution', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const resolvedAlert: Alert = {
					id: alert.id,
					type: mapAlertType(alert.type),
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.timestamp,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: args.resolution, // Use the resolution from args
					metadata: alert.metadata,
				}

				logger.info('GraphQL alert resolved', {
					organizationId,
					alertId: args.id,
					resolvedBy: userId,
					resolution: args.resolution,
				})

				return resolvedAlert
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to resolve alert via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							alertId: args.id,
							resolution: args.resolution,
						},
					},
					'graphql-api',
					'resolveAlert'
				)

				throw new GraphQLError(`Failed to resolve alert: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	// Type resolvers for Alert
	Alert: {
		// Add any field-level resolvers if needed
	},
}
