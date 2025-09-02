/**
 * GDPR GraphQL Resolvers
 * Requirements: 7.4, 7.5 - GDPR data export and pseudonymization APIs
 */

import { GraphQLError } from 'graphql'

import type {
	GDPRExportInput,
	GDPRExportResult,
	GDPRPseudonymizeInput,
	GDPRPseudonymizeResult,
	GraphQLContext,
} from '../types'

export const gdprResolvers = {
	Query: {
		// No query resolvers for GDPR operations
	},

	Mutation: {
		/**
		 * Export user audit data for GDPR compliance
		 * Requirements: 7.4 - GDPR data export APIs
		 */
		gdprExportUserData: async (
			_: any,
			args: { input: GDPRExportInput },
			context: GraphQLContext
		): Promise<GDPRExportResult> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const requestedBy = context.session.session.userId
			const organizationId = context.session.session.activeOrganizationId as string

			try {
				// Create GDPR export request
				const exportRequest = {
					principalId: args.input.principalId,
					organizationId,
					requestType: 'access' as const,
					format: args.input.format,
					dateRange: args.input.dateRange
						? {
								start: args.input.dateRange.startDate,
								end: args.input.dateRange.endDate,
							}
						: undefined,
					includeMetadata: args.input.includeMetadata,
					requestedBy,
					requestTimestamp: new Date().toISOString(),
				}

				const exportResult = await compliance.gdpr.exportUserData(exportRequest)

				logger.info('GDPR data export completed via GraphQL', {
					principalId: args.input.principalId,
					format: args.input.format,
					recordCount: exportResult.recordCount,
					requestedBy,
				})

				return {
					requestId: exportResult.requestId,
					principalId: exportResult.principalId,
					recordCount: exportResult.recordCount,
					dataSize: exportResult.dataSize,
					format: exportResult.format,
					exportTimestamp: exportResult.exportTimestamp,
					metadata: exportResult.metadata,
					// Convert buffer to base64 for GraphQL transport
					data: exportResult.data.toString('base64'),
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to export GDPR data via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							principalId: args.input.principalId,
							format: args.input.format,
						},
					},
					'graphql-api',
					'gdprExportUserData'
				)

				throw new GraphQLError(`Failed to export GDPR data: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Pseudonymize user audit data for GDPR compliance
		 * Requirements: 7.5 - GDPR pseudonymization APIs
		 */
		gdprPseudonymizeUserData: async (
			_: any,
			args: { input: GDPRPseudonymizeInput },
			context: GraphQLContext
		): Promise<GDPRPseudonymizeResult> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const requestedBy = context.session.session.userId

			try {
				const result = await compliance.gdpr.pseudonymizeUserData(
					args.input.principalId,
					args.input.strategy,
					requestedBy
				)

				logger.info('GDPR data pseudonymization completed via GraphQL', {
					principalId: args.input.principalId,
					strategy: args.input.strategy,
					recordsAffected: result.recordsAffected,
					requestedBy,
				})

				return {
					pseudonymId: result.pseudonymId,
					recordsAffected: result.recordsAffected,
					timestamp: new Date().toISOString(),
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to pseudonymize GDPR data via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							principalId: args.input.principalId,
							strategy: args.input.strategy,
						},
					},
					'graphql-api',
					'gdprPseudonymizeUserData'
				)

				throw new GraphQLError(`Failed to pseudonymize GDPR data: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Delete user audit data with GDPR compliance
		 * Requirements: 7.5 - GDPR data deletion APIs
		 */
		gdprDeleteUserData: async (
			_: any,
			args: {
				input: {
					principalId: string
					preserveComplianceAudits?: boolean
				}
			},
			context: GraphQLContext
		): Promise<{
			recordsDeleted: number
			complianceRecordsPreserved: number
			timestamp: string
		}> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const requestedBy = context.session.session.userId

			try {
				const result = await compliance.gdpr.deleteUserDataWithAuditTrail(
					args.input.principalId,
					requestedBy,
					args.input.preserveComplianceAudits ?? true
				)

				logger.info('GDPR data deletion completed via GraphQL', {
					principalId: args.input.principalId,
					recordsDeleted: result.recordsDeleted,
					complianceRecordsPreserved: result.complianceRecordsPreserved,
					requestedBy,
				})

				return {
					recordsDeleted: result.recordsDeleted,
					complianceRecordsPreserved: result.complianceRecordsPreserved,
					timestamp: new Date().toISOString(),
				}
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to delete GDPR data via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							principalId: args.input.principalId,
							preserveComplianceAudits: args.input.preserveComplianceAudits,
						},
					},
					'graphql-api',
					'gdprDeleteUserData'
				)

				throw new GraphQLError(`Failed to delete GDPR data: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},
}
