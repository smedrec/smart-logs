/**
 * Metrics GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type {
	AuditMetrics,
	GraphQLContext,
	MetricsGroupBy,
	SystemMetrics,
	TimeRangeInput,
} from '../types'

export const metricsResolvers = {
	Query: {
		/**
		 * Get system metrics
		 * Requirements: 3.1, 3.2
		 */
		systemMetrics: async (_: any, __: any, context: GraphQLContext): Promise<SystemMetrics> => {
			const { services } = context
			const { monitor, logger, error } = services

			try {
				// Get system metrics from monitoring service
				const metrics = await monitor.metrics.getSystemMetrics()

				const systemMetrics: SystemMetrics = {
					timestamp: new Date().toISOString(),
					server: {
						uptime: process.uptime(),
						memoryUsage: {
							used: process.memoryUsage().heapUsed,
							total: process.memoryUsage().heapTotal,
							percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
						},
						cpuUsage: {
							percentage: metrics.cpu?.usage || 0,
							loadAverage: metrics.cpu?.loadAverage || [0, 0, 0],
						},
					},
					database: {
						connectionCount: metrics.database?.connections || 0,
						activeQueries: metrics.database?.activeQueries || 0,
						averageQueryTime: metrics.database?.averageQueryTime || 0,
					},
					redis: {
						connectionCount: metrics.redis?.connections || 0,
						memoryUsage: metrics.redis?.memoryUsage || 0,
						keyCount: metrics.redis?.keyCount || 0,
					},
					api: {
						requestsPerSecond: metrics.api?.requestsPerSecond || 0,
						averageResponseTime: metrics.api?.averageResponseTime || 0,
						errorRate: metrics.api?.errorRate || 0,
					},
				}

				logger.info('GraphQL system metrics retrieved', {
					timestamp: systemMetrics.timestamp,
				})

				return systemMetrics
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get system metrics via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						metadata: {
							operation: 'systemMetrics',
						},
					},
					'graphql-api',
					'systemMetrics'
				)

				throw new GraphQLError(`Failed to get system metrics: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Get audit-specific metrics
		 * Requirements: 3.1, 3.2
		 */
		auditMetrics: async (
			_: any,
			args: {
				timeRange: TimeRangeInput
				groupBy?: MetricsGroupBy
			},
			context: GraphQLContext
		): Promise<AuditMetrics> => {
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
				// Get audit metrics from monitoring service
				const metrics = await monitor.metrics.getAuditMetrics({
					startDate: args.timeRange.startDate,
					endDate: args.timeRange.endDate,
					organizationId,
					groupBy: args.groupBy,
				})

				const auditMetrics: AuditMetrics = {
					timestamp: new Date().toISOString(),
					timeRange: {
						startDate: args.timeRange.startDate,
						endDate: args.timeRange.endDate,
					},
					eventsProcessed: metrics.eventsProcessed || 0,
					processingLatency: {
						average: metrics.latency?.average || 0,
						p50: metrics.latency?.p50 || 0,
						p95: metrics.latency?.p95 || 0,
						p99: metrics.latency?.p99 || 0,
					},
					integrityVerifications: {
						total: metrics.integrity?.total || 0,
						passed: metrics.integrity?.passed || 0,
						failed: metrics.integrity?.failed || 0,
						successRate: metrics.integrity?.total
							? (metrics.integrity.passed / metrics.integrity.total) * 100
							: 0,
					},
					complianceReports: {
						generated: metrics.compliance?.generated || 0,
						scheduled: metrics.compliance?.scheduled || 0,
						failed: metrics.compliance?.failed || 0,
						successRate: metrics.compliance?.generated
							? ((metrics.compliance.generated - metrics.compliance.failed) /
									metrics.compliance.generated) *
								100
							: 0,
					},
					errorMetrics: {
						total: metrics.errors?.total || 0,
						byType: metrics.errors?.byType || {},
						errorRate: metrics.errors?.rate || 0,
					},
				}

				logger.info('GraphQL audit metrics retrieved', {
					organizationId,
					timeRange: args.timeRange,
					groupBy: args.groupBy,
					eventsProcessed: auditMetrics.eventsProcessed,
				})

				return auditMetrics
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit metrics via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							timeRange: args.timeRange,
							groupBy: args.groupBy,
						},
					},
					'graphql-api',
					'auditMetrics'
				)

				throw new GraphQLError(`Failed to get audit metrics: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},
}
