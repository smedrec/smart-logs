/**
 * Audit Presets GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type {
	AuditPreset,
	CreateAuditPresetInput,
	GraphQLContext,
	UpdateAuditPresetInput,
} from '../types'

export const auditPresetResolvers = {
	Query: {
		/**
		 * Get all audit presets
		 * Requirements: 3.1, 3.2
		 */
		auditPresets: async (_: any, __: any, context: GraphQLContext): Promise<AuditPreset[]> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const presets = await compliance.preset.getPresets(organizationId)

				const auditPresets: AuditPreset[] = presets.map((preset: any) => ({
					name: preset.name,
					description: preset.description,
					configuration: {
						actions: preset.configuration.actions,
						dataClassifications: preset.configuration.dataClassifications,
						retentionPolicy: preset.configuration.retentionPolicy,
						encryptionEnabled: preset.configuration.encryptionEnabled,
						integrityCheckEnabled: preset.configuration.integrityCheckEnabled,
						alertThresholds: preset.configuration.alertThresholds
							? {
									errorRate: preset.configuration.alertThresholds.errorRate,
									responseTime: preset.configuration.alertThresholds.responseTime,
									volumeThreshold: preset.configuration.alertThresholds.volumeThreshold,
								}
							: undefined,
					},
					isActive: preset.isActive,
					createdAt: preset.createdAt,
					updatedAt: preset.updatedAt,
				}))

				logger.info('GraphQL audit presets retrieved', {
					organizationId,
					presetCount: auditPresets.length,
				})

				return auditPresets
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit presets via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
						},
					},
					'graphql-api',
					'auditPresets'
				)

				throw new GraphQLError(`Failed to get audit presets: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Get a single audit preset by name
		 * Requirements: 3.1, 3.2
		 */
		auditPreset: async (
			_: any,
			args: { name: string },
			context: GraphQLContext
		): Promise<AuditPreset | null> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const preset = await compliance.preset.getPreset(args.name, organizationId)

				if (!preset) {
					return null
				}

				const auditPreset: AuditPreset = {
					name: preset.name,
					description: preset.description,
					configuration: {
						actions: preset.configuration.actions,
						dataClassifications: preset.configuration.dataClassifications,
						retentionPolicy: preset.configuration.retentionPolicy,
						encryptionEnabled: preset.configuration.encryptionEnabled,
						integrityCheckEnabled: preset.configuration.integrityCheckEnabled,
						alertThresholds: preset.configuration.alertThresholds
							? {
									errorRate: preset.configuration.alertThresholds.errorRate,
									responseTime: preset.configuration.alertThresholds.responseTime,
									volumeThreshold: preset.configuration.alertThresholds.volumeThreshold,
								}
							: undefined,
					},
					isActive: preset.isActive,
					createdAt: preset.createdAt,
					updatedAt: preset.updatedAt,
				}

				logger.info('GraphQL audit preset retrieved', {
					organizationId,
					presetName: args.name,
				})

				return auditPreset
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to get audit preset via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							presetName: args.name,
						},
					},
					'graphql-api',
					'auditPreset'
				)

				throw new GraphQLError(`Failed to get audit preset: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},

	Mutation: {
		/**
		 * Create a new audit preset
		 * Requirements: 3.1, 3.2
		 */
		createAuditPreset: async (
			_: any,
			args: { input: CreateAuditPresetInput },
			context: GraphQLContext
		): Promise<AuditPreset> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const preset = await compliance.preset.createPreset(args.input, organizationId)

				const auditPreset: AuditPreset = {
					name: preset.name,
					description: preset.description,
					configuration: {
						actions: preset.configuration.actions,
						dataClassifications: preset.configuration.dataClassifications,
						retentionPolicy: preset.configuration.retentionPolicy,
						encryptionEnabled: preset.configuration.encryptionEnabled,
						integrityCheckEnabled: preset.configuration.integrityCheckEnabled,
						alertThresholds: preset.configuration.alertThresholds
							? {
									errorRate: preset.configuration.alertThresholds.errorRate,
									responseTime: preset.configuration.alertThresholds.responseTime,
									volumeThreshold: preset.configuration.alertThresholds.volumeThreshold,
								}
							: undefined,
					},
					isActive: preset.isActive,
					createdAt: preset.createdAt,
					updatedAt: preset.updatedAt,
				}

				logger.info('GraphQL audit preset created', {
					organizationId,
					presetName: auditPreset.name,
				})

				return auditPreset
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create audit preset via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							input: args.input,
						},
					},
					'graphql-api',
					'createAuditPreset'
				)

				throw new GraphQLError(`Failed to create audit preset: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Update an existing audit preset
		 * Requirements: 3.1, 3.2
		 */
		updateAuditPreset: async (
			_: any,
			args: { name: string; input: UpdateAuditPresetInput },
			context: GraphQLContext
		): Promise<AuditPreset> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const preset = await compliance.preset.updatePreset(args.name, args.input, organizationId)

				if (!preset) {
					throw new GraphQLError('Audit preset not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				const auditPreset: AuditPreset = {
					name: preset.name,
					description: preset.description,
					configuration: {
						actions: preset.configuration.actions,
						dataClassifications: preset.configuration.dataClassifications,
						retentionPolicy: preset.configuration.retentionPolicy,
						encryptionEnabled: preset.configuration.encryptionEnabled,
						integrityCheckEnabled: preset.configuration.integrityCheckEnabled,
						alertThresholds: preset.configuration.alertThresholds
							? {
									errorRate: preset.configuration.alertThresholds.errorRate,
									responseTime: preset.configuration.alertThresholds.responseTime,
									volumeThreshold: preset.configuration.alertThresholds.volumeThreshold,
								}
							: undefined,
					},
					isActive: preset.isActive,
					createdAt: preset.createdAt,
					updatedAt: preset.updatedAt,
				}

				logger.info('GraphQL audit preset updated', {
					organizationId,
					presetName: args.name,
				})

				return auditPreset
			} catch (e) {
				if (e instanceof GraphQLError) {
					throw e
				}

				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to update audit preset via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							presetName: args.name,
							input: args.input,
						},
					},
					'graphql-api',
					'updateAuditPreset'
				)

				throw new GraphQLError(`Failed to update audit preset: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},

		/**
		 * Delete an audit preset
		 * Requirements: 3.1, 3.2
		 */
		deleteAuditPreset: async (
			_: any,
			args: { name: string },
			context: GraphQLContext
		): Promise<boolean> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string

			try {
				const success = await compliance.preset.deletePreset(args.name, organizationId)

				logger.info('GraphQL audit preset deleted', {
					organizationId,
					presetName: args.name,
					success,
				})

				return success
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to delete audit preset via GraphQL: ${message}`)

				await error.handleError(
					e as Error,
					{
						requestId: context.requestId,
						userId: context.session.session.userId,
						sessionId: context.session.session.id,
						metadata: {
							organizationId,
							presetName: args.name,
						},
					},
					'graphql-api',
					'deleteAuditPreset'
				)

				throw new GraphQLError(`Failed to delete audit preset: ${message}`, {
					extensions: { code: 'INTERNAL_ERROR' },
				})
			}
		},
	},
}
