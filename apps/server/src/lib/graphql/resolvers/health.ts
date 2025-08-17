/**
 * Health GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type { GraphQLContext, HealthStatus } from '../types'

export const healthResolvers = {
	Query: {
		/**
		 * Get system health status
		 * Requirements: 3.1, 3.2
		 */
		health: async (_: any, __: any, context: GraphQLContext): Promise<HealthStatus> => {
			const { services } = context
			const { health, logger, error } = services

			try {
				// Get health check results
				const healthResults = await health.checkHealth()

				const healthStatus: HealthStatus = {
					status: healthResults.status as 'healthy' | 'unhealthy' | 'degraded',
					timestamp: new Date().toISOString(),
					checks: healthResults.checks.map((check) => ({
						name: check.name,
						status: check.status,
						message: check.message,
						responseTime: check.responseTime,
					})),
				}

				logger.info('GraphQL health check completed', {
					status: healthStatus.status,
					checkCount: healthStatus.checks.length,
				})

				return healthStatus
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get health status via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						metadata: {
							operation: 'health',
						},
					},
					'graphql-api',
					'health'
				)

				throw new GraphQLError(`Failed to get health status: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},
}
