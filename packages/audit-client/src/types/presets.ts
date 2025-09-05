import { z } from 'zod'

import {
	AuditEventSchema,
	AuditEventStatusSchema,
	CreateAuditEventInputSchema,
	DataClassificationSchema,
} from './api'

// ============================================================================
// Validation Rule Types
// ============================================================================

/**
 * Validation rule types
 */
export const ValidationRuleTypeSchema = z.enum([
	'required',
	'optional',
	'string',
	'number',
	'boolean',
	'array',
	'object',
	'email',
	'url',
	'uuid',
	'date',
	'regex',
	'enum',
	'min',
	'max',
	'minLength',
	'maxLength',
	'custom',
])
export type ValidationRuleType = z.infer<typeof ValidationRuleTypeSchema>

/**
 * Validation rule
 */
export const ValidationRuleSchema = z.object({
	type: ValidationRuleTypeSchema,
	value: z.unknown().optional(),
	message: z.string().optional(),
	required: z.boolean().default(false),
	allowEmpty: z.boolean().default(false),
	customValidator: z.string().optional(), // Function name or code
})
export type ValidationRule = z.infer<typeof ValidationRuleSchema>

/**
 * Field validation configuration
 */
export const FieldValidationSchema = z.object({
	rules: z.array(ValidationRuleSchema),
	transform: z.string().optional(), // Transformation function
	defaultValue: z.unknown().optional(),
	description: z.string().optional(),
})
export type FieldValidation = z.infer<typeof FieldValidationSchema>

// ============================================================================
// Preset Template Types
// ============================================================================

/**
 * Preset template field
 */
export const PresetTemplateFieldSchema = z.object({
	name: z.string().min(1),
	type: z.enum(['string', 'number', 'boolean', 'array', 'object', 'date']),
	required: z.boolean().default(false),
	defaultValue: z.unknown().optional(),
	description: z.string().optional(),
	validation: FieldValidationSchema.optional(),
	placeholder: z.string().optional(),
	options: z
		.array(
			z.object({
				label: z.string(),
				value: z.unknown(),
			})
		)
		.optional(),
})
export type PresetTemplateField = z.infer<typeof PresetTemplateFieldSchema>

/**
 * Preset template
 */
export const PresetTemplateSchema = z.object({
	action: z.string().min(1, 'Action is required'),
	targetResourceType: z.string().min(1, 'Target resource type is required'),
	dataClassification: DataClassificationSchema,
	status: AuditEventStatusSchema.optional(),
	defaultDetails: z.record(z.unknown()).optional(),

	// Template fields for dynamic values
	fields: z.array(PresetTemplateFieldSchema).optional(),

	// Conditional logic
	conditions: z
		.array(
			z.object({
				field: z.string().min(1),
				operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
				value: z.unknown(),
				action: z.enum(['show', 'hide', 'require', 'optional', 'set_value']),
				target: z.string().optional(),
				targetValue: z.unknown().optional(),
			})
		)
		.optional(),
})
export type PresetTemplate = z.infer<typeof PresetTemplateSchema>

// ============================================================================
// Preset Validation Types
// ============================================================================

/**
 * Preset validation configuration
 */
export const PresetValidationSchema = z.object({
	requiredFields: z.array(z.string()),
	optionalFields: z.array(z.string()),
	fieldValidation: z.record(FieldValidationSchema),

	// Cross-field validation
	crossFieldRules: z
		.array(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				condition: z.string().min(1), // JavaScript expression
				message: z.string().min(1),
				severity: z.enum(['error', 'warning', 'info']).default('error'),
			})
		)
		.optional(),

	// Business rules
	businessRules: z
		.array(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				rule: z.string().min(1), // JavaScript expression or function name
				message: z.string().min(1),
				severity: z.enum(['error', 'warning', 'info']).default('error'),
				enabled: z.boolean().default(true),
			})
		)
		.optional(),
})
export type PresetValidation = z.infer<typeof PresetValidationSchema>

// ============================================================================
// Audit Preset Types
// ============================================================================

/**
 * Preset category
 */
export const PresetCategorySchema = z.enum([
	'authentication',
	'authorization',
	'data_access',
	'data_modification',
	'system_administration',
	'compliance',
	'security',
	'user_management',
	'configuration',
	'monitoring',
	'custom',
])
export type PresetCategory = z.infer<typeof PresetCategorySchema>

/**
 * Preset metadata
 */
export const PresetMetadataSchema = z.object({
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	createdBy: z.string().min(1),
	lastModifiedBy: z.string().min(1),
	version: z.string().min(1),
	tags: z.array(z.string()).default([]),
	category: PresetCategorySchema.optional(),

	// Usage statistics
	usageCount: z.number().int().min(0).default(0),
	lastUsed: z.string().datetime().optional(),

	// Compliance and governance
	complianceFrameworks: z.array(z.string()).optional(),
	retentionPolicy: z.string().optional(),
	approvalRequired: z.boolean().default(false),
	approvedBy: z.string().optional(),
	approvedAt: z.string().datetime().optional(),

	// Documentation
	documentation: z
		.object({
			description: z.string().optional(),
			examples: z
				.array(
					z.object({
						title: z.string(),
						description: z.string().optional(),
						context: z.record(z.unknown()),
					})
				)
				.optional(),
			relatedPresets: z.array(z.string()).optional(),
			changelog: z
				.array(
					z.object({
						version: z.string(),
						date: z.string().datetime(),
						changes: z.array(z.string()),
						author: z.string(),
					})
				)
				.optional(),
		})
		.optional(),
})
export type PresetMetadata = z.infer<typeof PresetMetadataSchema>

/**
 * Audit preset
 */
export const AuditPresetSchema = z.object({
	name: z.string().min(1, 'Preset name is required').max(255),
	description: z.string().max(1000).optional(),
	template: PresetTemplateSchema,
	validation: PresetValidationSchema,
	metadata: PresetMetadataSchema,

	// Status and configuration
	enabled: z.boolean().default(true),
	deprecated: z.boolean().default(false),
	deprecationMessage: z.string().optional(),
	replacedBy: z.string().optional(),
})
export type AuditPreset = z.infer<typeof AuditPresetSchema>

/**
 * Create audit preset input
 */
export const CreateAuditPresetInputSchema = AuditPresetSchema.omit({
	metadata: true,
}).extend({
	metadata: PresetMetadataSchema.pick({
		tags: true,
		category: true,
		complianceFrameworks: true,
		retentionPolicy: true,
		approvalRequired: true,
		documentation: true,
	}).optional(),
})
export type CreateAuditPresetInput = z.infer<typeof CreateAuditPresetInputSchema>

/**
 * Update audit preset input
 */
export const UpdateAuditPresetInputSchema = CreateAuditPresetInputSchema.partial().extend({
	lastModifiedBy: z.string().min(1),
})
export type UpdateAuditPresetInput = z.infer<typeof UpdateAuditPresetInputSchema>

// ============================================================================
// Preset Context and Application Types
// ============================================================================

/**
 * Preset context for applying presets
 */
export const PresetContextSchema = z.object({
	// Required context fields
	principalId: z.string().min(1, 'Principal ID is required'),
	organizationId: z.string().min(1, 'Organization ID is required'),

	// Optional context fields
	targetResourceId: z.string().optional(),
	sessionContext: z
		.object({
			sessionId: z.string().min(1),
			ipAddress: z.string().ip(),
			userAgent: z.string().min(1),
			geolocation: z.string().optional(),
		})
		.optional(),

	// Dynamic field values
	fieldValues: z.record(z.unknown()).optional(),

	// Additional context
	correlationId: z.string().optional(),
	outcomeDescription: z.string().optional(),
	customDetails: z.record(z.unknown()).optional(),

	// Override options
	overrides: z
		.object({
			action: z.string().optional(),
			targetResourceType: z.string().optional(),
			dataClassification: DataClassificationSchema.optional(),
			status: AuditEventStatusSchema.optional(),
		})
		.optional(),
})
export type PresetContext = z.infer<typeof PresetContextSchema>

/**
 * Preset application result
 */
export const PresetApplicationResultSchema = z.object({
	success: z.boolean(),
	auditEvent: AuditEventSchema.optional(),
	validationErrors: z
		.array(
			z.object({
				field: z.string(),
				message: z.string(),
				code: z.string(),
				severity: z.enum(['error', 'warning', 'info']),
			})
		)
		.optional(),
	warnings: z
		.array(
			z.object({
				field: z.string(),
				message: z.string(),
				code: z.string(),
			})
		)
		.optional(),
	appliedTransformations: z
		.array(
			z.object({
				field: z.string(),
				originalValue: z.unknown(),
				transformedValue: z.unknown(),
				transformation: z.string(),
			})
		)
		.optional(),
	metadata: z
		.object({
			presetName: z.string(),
			presetVersion: z.string(),
			applicationTime: z.number().min(0),
			validationTime: z.number().min(0),
		})
		.optional(),
})
export type PresetApplicationResult = z.infer<typeof PresetApplicationResultSchema>

// ============================================================================
// Preset Management Types
// ============================================================================

/**
 * Preset import/export format
 */
export const PresetExportFormatSchema = z.enum(['json', 'yaml', 'xml'])
export type PresetExportFormat = z.infer<typeof PresetExportFormatSchema>

/**
 * Preset export parameters
 */
export const PresetExportParamsSchema = z.object({
	presetNames: z.array(z.string().min(1)).optional(),
	categories: z.array(PresetCategorySchema).optional(),
	tags: z.array(z.string()).optional(),
	includeMetadata: z.boolean().default(true),
	includeUsageStats: z.boolean().default(false),
	format: PresetExportFormatSchema.default('json'),
	compression: z.boolean().default(false),
})
export type PresetExportParams = z.infer<typeof PresetExportParamsSchema>

/**
 * Preset import parameters
 */
export const PresetImportParamsSchema = z.object({
	presets: z.array(AuditPresetSchema),
	overwriteExisting: z.boolean().default(false),
	validateOnly: z.boolean().default(false),
	skipValidation: z.boolean().default(false),
	importedBy: z.string().min(1),
})
export type PresetImportParams = z.infer<typeof PresetImportParamsSchema>

/**
 * Preset import result
 */
export const PresetImportResultSchema = z.object({
	requestId: z.string().uuid(),
	total: z.number().int().min(0),
	successful: z.number().int().min(0),
	failed: z.number().int().min(0),
	skipped: z.number().int().min(0),
	results: z.array(
		z.object({
			presetName: z.string(),
			success: z.boolean(),
			action: z.enum(['created', 'updated', 'skipped', 'failed']),
			error: z.string().optional(),
			warnings: z.array(z.string()).optional(),
		})
	),
	processingTime: z.number().min(0),
	validationErrors: z
		.array(
			z.object({
				presetName: z.string(),
				errors: z.array(
					z.object({
						field: z.string(),
						message: z.string(),
						code: z.string(),
					})
				),
			})
		)
		.optional(),
})
export type PresetImportResult = z.infer<typeof PresetImportResultSchema>

// ============================================================================
// Preset Versioning Types
// ============================================================================

/**
 * Preset version
 */
export const PresetVersionSchema = z.object({
	version: z.string().min(1),
	preset: AuditPresetSchema,
	createdAt: z.string().datetime(),
	createdBy: z.string().min(1),
	changeLog: z.string().optional(),
	tags: z.array(z.string()).default([]),
	isActive: z.boolean().default(false),
})
export type PresetVersion = z.infer<typeof PresetVersionSchema>

/**
 * Preset version history
 */
export const PresetVersionHistorySchema = z.object({
	presetName: z.string().min(1),
	versions: z.array(PresetVersionSchema),
	totalVersions: z.number().int().min(0),
	activeVersion: z.string().optional(),
})
export type PresetVersionHistory = z.infer<typeof PresetVersionHistorySchema>

// ============================================================================
// Preset Usage and Analytics Types
// ============================================================================

/**
 * Preset usage statistics
 */
export const PresetUsageStatsSchema = z.object({
	presetName: z.string().min(1),
	totalUsage: z.number().int().min(0),
	usageByPeriod: z.array(
		z.object({
			period: z.string().datetime(),
			count: z.number().int().min(0),
		})
	),
	usageByUser: z.array(
		z.object({
			userId: z.string(),
			count: z.number().int().min(0),
			lastUsed: z.string().datetime(),
		})
	),
	usageByOrganization: z.array(
		z.object({
			organizationId: z.string(),
			count: z.number().int().min(0),
			lastUsed: z.string().datetime(),
		})
	),
	errorRate: z.number().min(0).max(100),
	averageApplicationTime: z.number().min(0),
	lastUsed: z.string().datetime().optional(),
})
export type PresetUsageStats = z.infer<typeof PresetUsageStatsSchema>

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for audit presets
 */
export const isAuditPreset = (value: unknown): value is AuditPreset => {
	return AuditPresetSchema.safeParse(value).success
}

/**
 * Type guard for create audit preset input
 */
export const isCreateAuditPresetInput = (value: unknown): value is CreateAuditPresetInput => {
	return CreateAuditPresetInputSchema.safeParse(value).success
}

/**
 * Type guard for update audit preset input
 */
export const isUpdateAuditPresetInput = (value: unknown): value is UpdateAuditPresetInput => {
	return UpdateAuditPresetInputSchema.safeParse(value).success
}

/**
 * Type guard for preset context
 */
export const isPresetContext = (value: unknown): value is PresetContext => {
	return PresetContextSchema.safeParse(value).success
}

/**
 * Type guard for preset template
 */
export const isPresetTemplate = (value: unknown): value is PresetTemplate => {
	return PresetTemplateSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates audit preset data
 */
export const validateAuditPreset = (data: unknown) => {
	return AuditPresetSchema.safeParse(data)
}

/**
 * Validates create audit preset input
 */
export const validateCreateAuditPresetInput = (data: unknown) => {
	return CreateAuditPresetInputSchema.safeParse(data)
}

/**
 * Validates update audit preset input
 */
export const validateUpdateAuditPresetInput = (data: unknown) => {
	return UpdateAuditPresetInputSchema.safeParse(data)
}

/**
 * Validates preset context
 */
export const validatePresetContext = (data: unknown) => {
	return PresetContextSchema.safeParse(data)
}

/**
 * Validates preset template
 */
export const validatePresetTemplate = (data: unknown) => {
	return PresetTemplateSchema.safeParse(data)
}

/**
 * Validates preset validation configuration
 */
export const validatePresetValidation = (data: unknown) => {
	return PresetValidationSchema.safeParse(data)
}

/**
 * Validates preset export parameters
 */
export const validatePresetExportParams = (data: unknown) => {
	return PresetExportParamsSchema.safeParse(data)
}

/**
 * Validates preset import parameters
 */
export const validatePresetImportParams = (data: unknown) => {
	return PresetImportParamsSchema.safeParse(data)
}
