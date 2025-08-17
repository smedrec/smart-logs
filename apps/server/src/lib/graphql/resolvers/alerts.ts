/**
 * Alerts GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

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

				// Get alerts from monitoring service
				const alertsResult = await monitor.alert.getAlerts({
					organizationId,
					filter: args.filter,
					limit,
					offset,
				})

				// Convert to GraphQL format
				const alerts: Alert[] = alertsResult.alerts.map((alert: any) => ({
					id: alert.id.toString(),
					type: alert.type,
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.createdAt,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: alert.resolution,
					metadata: alert.metadata,
				}))

				const edges = alerts.map((alert, index) => ({
					node: alert,
					cursor: offsetToCursor(offset + index),
				}))

				const pageInfo = {
					hasNextPage: offset + limit < alertsResult.totalCount,
					hasPreviousPage: offset > 0,
					startCursor: edges.length > 0 ? edges[0].cursor : undefined,
					endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
				}

				logger.info('GraphQL alerts retrieved', {
					organizationId,
					alertCount: alerts.length,
					totalCount: alertsResult.totalCount,
					filters: args.filter,
				})

				return {
					edges,
					pageInfo,
					totalCount: alertsResult.totalCount,
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
				const alert = await monitor.alert.acknowledgeAlert(args.id, userId, organizationId)

				if (!alert) {
					throw new GraphQLError('Alert not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const acknowledgedAlert: Alert = {
					id: alert.id.toString(),
					type: alert.type,
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.createdAt,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: alert.resolution,
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
				const alert = await monitor.alert.resolveAlert(
					args.id,
					args.resolution,
					userId,
					organizationId
				)

				if (!alert) {
					throw new GraphQLError('Alert not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const resolvedAlert: Alert = {
					id: alert.id.toString(),
					type: alert.type,
					severity: alert.severity,
					title: alert.title,
					description: alert.description,
					createdAt: alert.createdAt,
					acknowledgedAt: alert.acknowledgedAt,
					resolvedAt: alert.resolvedAt,
					acknowledgedBy: alert.acknowledgedBy,
					resolvedBy: alert.resolvedBy,
					resolution: alert.resolution,
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
