/**
 * Audit Presets GraphQL Resolvers
 * Requirements: 3.1, 3.2
 */

import { GraphQLError } from 'graphql'

import type { AuditPreset, DataClassification, ValidationConfig } from '@repo/audit'
import type { GraphQLContext } from '../types'

// Extended AuditPreset interface that includes the database ID
export interface AuditPresetWithId extends AuditPreset {
	id?: string
}

// GraphQL input types that match the audit package structure
export interface CreateAuditPresetInput {
	name: string
	description?: string
	action: string
	dataClassification: DataClassification
	requiredFields: string[]
	defaultValues?: Record<string, any>
	validation?: Partial<ValidationConfig>
}

export interface UpdateAuditPresetInput {
	description?: string
	action?: string
	dataClassification?: DataClassification
	requiredFields?: string[]
	defaultValues?: Record<string, any>
	validation?: Partial<ValidationConfig>
}

export const auditPresetResolvers = {
	Query: {
		/**
		 * Get all audit presets
		 * Requirements: 3.1, 3.2
		 */
		auditPresets: async (
			_: any,
			__: any,
			context: GraphQLContext
		): Promise<AuditPresetWithId[]> => {
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

				logger.info('GraphQL audit presets retrieved', {
					organizationId,
					presetCount: presets.length,
				})

				return presets
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
		): Promise<AuditPresetWithId | null> => {
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

				logger.info('GraphQL audit preset retrieved', {
					organizationId,
					presetName: args.name,
				})

				return preset
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
		): Promise<AuditPresetWithId> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string
			const userId = context.session.session.userId

			try {
				const presetData: AuditPreset & { createdBy: string } = {
					...args.input,
					organizationId,
					createdBy: userId,
				}

				const preset = await compliance.preset.createPreset(presetData)

				logger.info('GraphQL audit preset created', {
					organizationId,
					presetName: preset.name,
				})

				return preset
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
		): Promise<AuditPresetWithId> => {
			const { services } = context
			const { compliance, logger, error } = services

			// Check authentication
			if (!context.session) {
				throw new GraphQLError('Authentication required', {
					extensions: { code: 'UNAUTHENTICATED' },
				})
			}

			const organizationId = context.session.session.activeOrganizationId as string
			const userId = context.session.session.userId

			try {
				// First get the existing preset to get its ID
				const existingPreset = await compliance.preset.getPreset(args.name, organizationId)

				if (!existingPreset) {
					throw new GraphQLError('Audit preset not found', {
						extensions: { code: 'NOT_FOUND' },
					})
				}

				// Create update data with required fields
				const updateData = {
					...existingPreset,
					...args.input,
					id: existingPreset.id || args.name, // Use ID if available, fallback to name
					updatedBy: userId,
				} as AuditPreset & { id: string; updatedBy: string }

				const preset = await compliance.preset.updatePreset(updateData)

				logger.info('GraphQL audit preset updated', {
					organizationId,
					presetName: args.name,
				})

				return preset
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
				const result = await compliance.preset.deletePreset(args.name, organizationId)

				logger.info('GraphQL audit preset deleted', {
					organizationId,
					presetName: args.name,
					success: result.success,
				})

				return result.success
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
