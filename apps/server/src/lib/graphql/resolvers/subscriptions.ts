/**
 * GraphQL Subscriptions Resolvers
 * Requirements: 3.3, 3.4
 */

import { GraphQLError } from 'graphql'
import { PubSub } from 'graphql-subscriptions'

import type {
	Alert,
	AlertSeverity,
	AuditEvent,
	AuditEventFilter,
	GraphQLContext,
	ReportExecution,
	SystemMetrics,
} from '../types'

// Create a PubSub instance for real-time subscriptions
const pubsub = new PubSub()

// Subscription event types
export const SUBSCRIPTION_EVENTS = {
	AUDIT_EVENT_CREATED: 'AUDIT_EVENT_CREATED',
	ALERT_CREATED: 'ALERT_CREATED',
	SYSTEM_METRICS_UPDATED: 'SYSTEM_METRICS_UPDATED',
	REPORT_EXECUTION_UPDATED: 'REPORT_EXECUTION_UPDATED',
} as const

// Export pubsub for use in other parts of the application
export { pubsub }

/**
 * Helper function to check if event matches filter
 */
function eventMatchesFilter(event: AuditEvent, filter?: AuditEventFilter): boolean {
	if (!filter) return true

	// Check date range
	if (filter.dateRange) {
		const eventDate = new Date(event.timestamp)
		const startDate = new Date(filter.dateRange.startDate)
		const endDate = new Date(filter.dateRange.endDate)
		if (eventDate < startDate || eventDate > endDate) {
			return false
		}
	}

	// Check principal IDs
	if (filter.principalIds?.length && event.principalId) {
		if (!filter.principalIds.includes(event.principalId)) {
			return false
		}
	}

	// Check organization IDs
	if (filter.organizationIds?.length && event.organizationId) {
		if (!filter.organizationIds.includes(event.organizationId)) {
			return false
		}
	}

	// Check actions
	if (filter.actions?.length) {
		if (!filter.actions.includes(event.action)) {
			return false
		}
	}

	// Check statuses
	if (filter.statuses?.length) {
		if (!filter.statuses.includes(event.status)) {
			return false
		}
	}

	// Check data classifications
	if (filter.dataClassifications?.length && event.dataClassification) {
		if (!filter.dataClassifications.includes(event.dataClassification)) {
			return false
		}
	}

	// Check resource types
	if (filter.resourceTypes?.length && event.targetResourceType) {
		if (!filter.resourceTypes.includes(event.targetResourceType)) {
			return false
		}
	}

	// Check resource IDs
	if (filter.resourceIds?.length && event.targetResourceId) {
		if (!filter.resourceIds.includes(event.targetResourceId)) {
			return false
		}
	}

	// Check correlation IDs
	if (filter.correlationIds?.length && event.correlationId) {
		if (!filter.correlationIds.includes(event.correlationId)) {
			return false
		}
	}

	// Check verified only
	if (filter.verifiedOnly && event.integrityStatus !== 'verified') {
		return false
	}

	return true
}

export const subscriptionResolvers = {
	/**
	 * Subscribe to audit event creation
	 * Requirements: 3.3, 3.4
	 */
	auditEventCreated: {
		subscribe: async (_: any, args: { filter?: AuditEventFilter }, context: GraphQLContext) => {
			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			// Create async iterator with filtering
			const asyncIterator = pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.AUDIT_EVENT_CREATED])

			// Return filtered iterator
			return {
				async next(): Promise<IteratorResult<any, any>> {
					const result = await asyncIterator.next()

					if (result.done) {
						return result
					}

					const event: AuditEvent = (result.value as { auditEventCreated: AuditEvent })
						.auditEventCreated

					// Check organization access
					if (event.organizationId !== organizationId) {
						return this.next() // Skip this event and get the next one
					}

					// Check filter match
					if (!eventMatchesFilter(event, args.filter)) {
						return this.next() // Skip this event and get the next one
					}

					return result
				},
				return: asyncIterator.return?.bind(asyncIterator),
				throw: asyncIterator.throw?.bind(asyncIterator),
				[Symbol.asyncIterator]() {
					return this
				},
			}
		},
		resolve: (payload: { auditEventCreated: AuditEvent }) => {
			return payload.auditEventCreated
		},
	},

	/**
	 * Subscribe to alert creation
	 * Requirements: 3.3, 3.4
	 */
	alertCreated: {
		subscribe: async (_: any, args: { severity?: AlertSeverity }, context: GraphQLContext) => {
			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			// Create async iterator with filtering
			const asyncIterator = pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.ALERT_CREATED])

			// Return filtered iterator
			return {
				async next(): Promise<IteratorResult<any, any>> {
					const result = await asyncIterator.next()

					if (result.done) {
						return result
					}

					const alert: Alert = (result.value as { alertCreated: Alert }).alertCreated

					// Check organization access (assuming alerts have organization context)
					// This would need to be implemented based on how alerts are structured

					// Check severity filter
					if (args.severity && alert.severity !== args.severity) {
						return this.next() // Skip this alert and get the next one
					}

					return result
				},
				return: asyncIterator.return?.bind(asyncIterator),
				throw: asyncIterator.throw?.bind(asyncIterator),
				[Symbol.asyncIterator]() {
					return this
				},
			}
		},
		resolve: (payload: { alertCreated: Alert }) => {
			return payload.alertCreated
		},
	},

	/**
	 * Subscribe to system metrics updates
	 * Requirements: 3.3, 3.4
	 */
	systemMetricsUpdated: {
		subscribe: async (_: any, __: any, context: GraphQLContext) => {
			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			// System metrics are global, so no organization filtering needed
			return pubsub.asyncIterableIterator([SUBSCRIPTION_EVENTS.SYSTEM_METRICS_UPDATED])
		},
		resolve: (payload: { systemMetricsUpdated: SystemMetrics }) => {
			return payload.systemMetricsUpdated
		},
	},

	/**
	 * Subscribe to report execution updates
	 * Requirements: 3.3, 3.4
	 */
	reportExecutionUpdated: {
		subscribe: async (_: any, args: { reportId: string }, context: GraphQLContext) => {
			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			// Create async iterator with filtering
			const asyncIterator = pubsub.asyncIterableIterator([
				SUBSCRIPTION_EVENTS.REPORT_EXECUTION_UPDATED,
			])

			// Return filtered iterator
			return {
				async next(): Promise<IteratorResult<any, any>> {
					const result = await asyncIterator.next()

					if (result.done) {
						return result
					}

					const execution: ReportExecution = (
						result.value as { reportExecutionUpdated: ReportExecution }
					).reportExecutionUpdated

					// Check if this is the report we're interested in
					if (execution.reportId !== args.reportId) {
						return this.next() // Skip this execution and get the next one
					}

					// Additional organization check would be needed here
					// This would require looking up the report to verify organization access

					return result
				},
				return: asyncIterator.return?.bind(asyncIterator),
				throw: asyncIterator.throw?.bind(asyncIterator),
				[Symbol.asyncIterator]() {
					return this
				},
			}
		},
		resolve: (payload: { reportExecutionUpdated: ReportExecution }) => {
			return payload.reportExecutionUpdated
		},
	},
}

/**
 * Helper functions to publish events (to be used by other parts of the application)
 */
export const publishAuditEventCreated = (event: AuditEvent) => {
	pubsub.publish(SUBSCRIPTION_EVENTS.AUDIT_EVENT_CREATED, { auditEventCreated: event })
}

export const publishAlertCreated = (alert: Alert) => {
	pubsub.publish(SUBSCRIPTION_EVENTS.ALERT_CREATED, { alertCreated: alert })
}

export const publishSystemMetricsUpdated = (metrics: SystemMetrics) => {
	pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_METRICS_UPDATED, { systemMetricsUpdated: metrics })
}

export const publishReportExecutionUpdated = (execution: ReportExecution) => {
	pubsub.publish(SUBSCRIPTION_EVENTS.REPORT_EXECUTION_UPDATED, {
		reportExecutionUpdated: execution,
	})
}
