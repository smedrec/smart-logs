import { BaseResource } from '../core/base-resource'

import type { RequestOptions } from '../core/base-resource'
import type { AuditClientConfig } from '../core/config'
import type { Logger } from '../infrastructure/logger'

/**
 * Validation rule interface for preset field validation
 */
export interface ValidationRule {
	type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'date'
	required?: boolean
	minLength?: number
	maxLength?: number
	min?: number
	max?: number
	pattern?: string
	enum?: string[]
	customValidator?: (value: any) => boolean | string
}

/**
 * Audit preset template interface
 */
export interface AuditPresetTemplate {
	action: string
	targetResourceType: string
	dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
	defaultDetails?: Record<string, any>
	defaultStatus?: 'attempt' | 'success' | 'failure'
	defaultOutcomeDescription?: string
}

/**
 * Audit preset validation configuration
 */
export interface AuditPresetValidation {
	requiredFields: string[]
	optionalFields: string[]
	fieldValidation: Record<string, ValidationRule>
	customValidation?: (context: PresetContext) => ValidationResult
}

/**
 * Audit preset metadata
 */
export interface AuditPresetMetadata {
	createdAt: string
	updatedAt: string
	version: string
	tags: string[]
	author?: string
	description?: string
	category?: string
	usageCount?: number
	lastUsed?: string
}

/**
 * Complete audit preset interface
 */
export interface AuditPreset {
	name: string
	description?: string
	template: AuditPresetTemplate
	validation: AuditPresetValidation
	metadata: AuditPresetMetadata
}

/**
 * Input for creating a new audit preset
 */
export interface CreateAuditPresetInput {
	name: string
	description?: string
	template: AuditPresetTemplate
	validation: AuditPresetValidation
	tags?: string[]
	category?: string
}

/**
 * Input for updating an existing audit preset
 */
export interface UpdateAuditPresetInput {
	description?: string
	template?: Partial<AuditPresetTemplate>
	validation?: Partial<AuditPresetValidation>
	tags?: string[]
	category?: string
}

/**
 * Context for applying a preset to create an audit event
 */
export interface PresetContext {
	principalId: string
	organizationId: string
	targetResourceId?: string
	sessionContext?: {
		sessionId?: string
		ipAddress?: string
		userAgent?: string
		location?: string
	}
	customDetails?: Record<string, any>
	overrides?: {
		action?: string
		targetResourceType?: string
		dataClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		status?: 'attempt' | 'success' | 'failure'
		outcomeDescription?: string
	}
}

/**
 * Result of preset validation
 */
export interface ValidationResult {
	isValid: boolean
	errors: Array<{
		field: string
		message: string
		code: string
	}>
	warnings?: Array<{
		field: string
		message: string
		code: string
	}>
}

/**
 * Result of applying a preset to create an audit event
 */
export interface PresetApplicationResult {
	success: boolean
	auditEvent?: {
		id: string
		timestamp: string
		action: string
		targetResourceType: string
		targetResourceId?: string
		principalId: string
		organizationId: string
		status: 'attempt' | 'success' | 'failure'
		outcomeDescription?: string
		dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI'
		details?: Record<string, any>
		correlationId?: string
	}
	validationResult: ValidationResult
	errors?: Array<{
		message: string
		code: string
		details?: any
	}>
}

/**
 * Parameters for listing audit presets
 */
export interface ListAuditPresetsParams {
	category?: string
	tags?: string[]
	search?: string
	includeMetadata?: boolean
	sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount'
	sortOrder?: 'asc' | 'desc'
	limit?: number
	offset?: number
}

/**
 * Paginated list of audit presets
 */
export interface PaginatedAuditPresets {
	presets: AuditPreset[]
	pagination: {
		total: number
		limit: number
		offset: number
		hasNext: boolean
		hasPrevious: boolean
	}
	metadata?: {
		queryTime: number
		totalCategories: number
		totalTags: number
	}
}

/**
 * Preset versioning information
 */
export interface PresetVersion {
	version: string
	createdAt: string
	changes: string[]
	author?: string
	preset: AuditPreset
}

/**
 * Preset version history
 */
export interface PresetVersionHistory {
	presetName: string
	currentVersion: string
	versions: PresetVersion[]
	totalVersions: number
}

/**
 * Preset usage statistics
 */
export interface PresetUsageStats {
	presetName: string
	totalUsage: number
	usageByPeriod: Array<{
		period: string
		count: number
	}>
	topUsers: Array<{
		principalId: string
		count: number
	}>
	successRate: number
	averageExecutionTime: number
	lastUsed: string
}

/**
 * Comprehensive Audit Presets Service
 *
 * Provides functionality for managing audit configuration templates including:
 * - CRUD operations for audit presets
 * - Preset validation and application
 * - Version management and history tracking
 * - Usage statistics and analytics
 * - Template-based audit event creation
 */
export class PresetsService extends BaseResource {
	constructor(config: AuditClientConfig, logger?: Logger) {
		super(config, logger)
	}

	/**
	 * List all audit presets with optional filtering and pagination
	 *
	 * @param params - Optional filtering and pagination parameters
	 * @returns Promise resolving to paginated list of audit presets
	 *
	 * @example
	 * ```typescript
	 * const presets = await client.presets.list({
	 *   category: 'authentication',
	 *   tags: ['login', 'security'],
	 *   limit: 10
	 * })
	 * ```
	 */
	async list(params: ListAuditPresetsParams = {}): Promise<PaginatedAuditPresets> {
		const options: RequestOptions = {
			method: 'GET',
			query: params,
		}

		return this.request<PaginatedAuditPresets>('/audit-presets', options)
	}

	/**
	 * Get a specific audit preset by name
	 *
	 * @param name - The name of the preset to retrieve
	 * @param includeMetadata - Whether to include detailed metadata
	 * @returns Promise resolving to the audit preset or null if not found
	 *
	 * @example
	 * ```typescript
	 * const preset = await client.presets.get('user-login-attempt')
	 * if (preset) {
	 *   console.log('Found preset:', preset.name)
	 * }
	 * ```
	 */
	async get(name: string, includeMetadata = true): Promise<AuditPreset | null> {
		try {
			const options: RequestOptions = {
				method: 'GET',
				query: { includeMetadata },
			}

			return await this.request<AuditPreset>(`/audit-presets/${encodeURIComponent(name)}`, options)
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Create a new audit preset
	 *
	 * @param preset - The preset configuration to create
	 * @returns Promise resolving to the created audit preset
	 *
	 * @example
	 * ```typescript
	 * const newPreset = await client.presets.create({
	 *   name: 'user-login-success',
	 *   description: 'Template for successful user login events',
	 *   template: {
	 *     action: 'user.login',
	 *     targetResourceType: 'user',
	 *     dataClassification: 'INTERNAL',
	 *     defaultStatus: 'success'
	 *   },
	 *   validation: {
	 *     requiredFields: ['principalId', 'organizationId'],
	 *     optionalFields: ['targetResourceId', 'sessionContext'],
	 *     fieldValidation: {
	 *       principalId: { type: 'string', required: true, minLength: 1 }
	 *     }
	 *   },
	 *   tags: ['authentication', 'login', 'success']
	 * })
	 * ```
	 */
	async create(preset: CreateAuditPresetInput): Promise<AuditPreset> {
		const options: RequestOptions = {
			method: 'POST',
			body: preset,
		}

		return this.request<AuditPreset>('/audit-presets', options)
	}

	/**
	 * Update an existing audit preset
	 *
	 * @param name - The name of the preset to update
	 * @param updates - The updates to apply to the preset
	 * @returns Promise resolving to the updated audit preset
	 *
	 * @example
	 * ```typescript
	 * const updatedPreset = await client.presets.update('user-login-attempt', {
	 *   description: 'Updated template for user login attempts',
	 *   template: {
	 *     defaultOutcomeDescription: 'User attempted to log in'
	 *   },
	 *   tags: ['authentication', 'login', 'attempt', 'security']
	 * })
	 * ```
	 */
	async update(name: string, updates: UpdateAuditPresetInput): Promise<AuditPreset> {
		const options: RequestOptions = {
			method: 'PUT',
			body: updates,
		}

		return this.request<AuditPreset>(`/audit-presets/${encodeURIComponent(name)}`, options)
	}

	/**
	 * Delete an audit preset
	 *
	 * @param name - The name of the preset to delete
	 * @param force - Whether to force deletion even if preset is in use
	 * @returns Promise resolving when the preset is deleted
	 *
	 * @example
	 * ```typescript
	 * await client.presets.delete('old-preset-name')
	 * console.log('Preset deleted successfully')
	 * ```
	 */
	async delete(name: string, force = false): Promise<void> {
		const options: RequestOptions = {
			method: 'DELETE',
			query: force ? { force: 'true' } : {},
		}

		await this.request<void>(`/audit-presets/${encodeURIComponent(name)}`, options)
	}

	/**
	 * Validate a preset context against a preset's validation rules
	 *
	 * @param name - The name of the preset to validate against
	 * @param context - The context to validate
	 * @returns Promise resolving to validation result
	 *
	 * @example
	 * ```typescript
	 * const validation = await client.presets.validate('user-login-attempt', {
	 *   principalId: 'user123',
	 *   organizationId: 'org456',
	 *   customDetails: { ipAddress: '192.168.1.1' }
	 * })
	 *
	 * if (!validation.isValid) {
	 *   console.log('Validation errors:', validation.errors)
	 * }
	 * ```
	 */
	async validate(name: string, context: PresetContext): Promise<ValidationResult> {
		const options: RequestOptions = {
			method: 'POST',
			body: context,
		}

		return this.request<ValidationResult>(
			`/audit-presets/${encodeURIComponent(name)}/validate`,
			options
		)
	}

	/**
	 * Apply a preset to create an audit event
	 *
	 * @param name - The name of the preset to apply
	 * @param context - The context for creating the audit event
	 * @returns Promise resolving to the application result including the created audit event
	 *
	 * @example
	 * ```typescript
	 * const result = await client.presets.apply('user-login-success', {
	 *   principalId: 'user123',
	 *   organizationId: 'org456',
	 *   targetResourceId: 'user123',
	 *   sessionContext: {
	 *     sessionId: 'sess789',
	 *     ipAddress: '192.168.1.1',
	 *     userAgent: 'Mozilla/5.0...'
	 *   },
	 *   customDetails: {
	 *     loginMethod: 'password',
	 *     mfaUsed: true
	 *   }
	 * })
	 *
	 * if (result.success && result.auditEvent) {
	 *   console.log('Audit event created:', result.auditEvent.id)
	 * }
	 * ```
	 */
	async apply(name: string, context: PresetContext): Promise<PresetApplicationResult> {
		const options: RequestOptions = {
			method: 'POST',
			body: context,
		}

		return this.request<PresetApplicationResult>(
			`/audit-presets/${encodeURIComponent(name)}/apply`,
			options
		)
	}

	/**
	 * Get version history for a preset
	 *
	 * @param name - The name of the preset
	 * @param limit - Maximum number of versions to return
	 * @returns Promise resolving to the preset version history
	 *
	 * @example
	 * ```typescript
	 * const history = await client.presets.getVersionHistory('user-login-attempt', 10)
	 * console.log(`Preset has ${history.totalVersions} versions`)
	 * ```
	 */
	async getVersionHistory(name: string, limit = 50): Promise<PresetVersionHistory> {
		const options: RequestOptions = {
			method: 'GET',
			query: { limit },
		}

		return this.request<PresetVersionHistory>(
			`/audit-presets/${encodeURIComponent(name)}/versions`,
			options
		)
	}

	/**
	 * Get a specific version of a preset
	 *
	 * @param name - The name of the preset
	 * @param version - The version to retrieve
	 * @returns Promise resolving to the preset version or null if not found
	 *
	 * @example
	 * ```typescript
	 * const version = await client.presets.getVersion('user-login-attempt', '1.2.0')
	 * if (version) {
	 *   console.log('Version changes:', version.changes)
	 * }
	 * ```
	 */
	async getVersion(name: string, version: string): Promise<PresetVersion | null> {
		try {
			return await this.request<PresetVersion>(
				`/audit-presets/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`
			)
		} catch (error: any) {
			if (error.status === 404) {
				return null
			}
			throw error
		}
	}

	/**
	 * Restore a preset to a specific version
	 *
	 * @param name - The name of the preset
	 * @param version - The version to restore to
	 * @returns Promise resolving to the restored preset
	 *
	 * @example
	 * ```typescript
	 * const restored = await client.presets.restoreVersion('user-login-attempt', '1.1.0')
	 * console.log('Preset restored to version:', restored.metadata.version)
	 * ```
	 */
	async restoreVersion(name: string, version: string): Promise<AuditPreset> {
		const options: RequestOptions = {
			method: 'POST',
		}

		return this.request<AuditPreset>(
			`/audit-presets/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/restore`,
			options
		)
	}

	/**
	 * Get usage statistics for a preset
	 *
	 * @param name - The name of the preset
	 * @param period - The time period for statistics ('day', 'week', 'month', 'year')
	 * @param limit - Maximum number of top users to return
	 * @returns Promise resolving to usage statistics
	 *
	 * @example
	 * ```typescript
	 * const stats = await client.presets.getUsageStats('user-login-attempt', 'month', 10)
	 * console.log(`Preset used ${stats.totalUsage} times with ${stats.successRate}% success rate`)
	 * ```
	 */
	async getUsageStats(name: string, period = 'month', limit = 10): Promise<PresetUsageStats> {
		const options: RequestOptions = {
			method: 'GET',
			query: { period, limit },
		}

		return this.request<PresetUsageStats>(
			`/audit-presets/${encodeURIComponent(name)}/stats`,
			options
		)
	}

	/**
	 * Duplicate an existing preset with a new name
	 *
	 * @param sourceName - The name of the preset to duplicate
	 * @param targetName - The name for the new preset
	 * @param updates - Optional updates to apply to the duplicated preset
	 * @returns Promise resolving to the new preset
	 *
	 * @example
	 * ```typescript
	 * const duplicated = await client.presets.duplicate(
	 *   'user-login-attempt',
	 *   'admin-login-attempt',
	 *   {
	 *     description: 'Template for admin login attempts',
	 *     tags: ['authentication', 'admin', 'login']
	 *   }
	 * )
	 * ```
	 */
	async duplicate(
		sourceName: string,
		targetName: string,
		updates?: Partial<CreateAuditPresetInput>
	): Promise<AuditPreset> {
		const options: RequestOptions = {
			method: 'POST',
			body: {
				targetName,
				updates,
			},
		}

		return this.request<AuditPreset>(
			`/audit-presets/${encodeURIComponent(sourceName)}/duplicate`,
			options
		)
	}

	/**
	 * Export presets to a portable format
	 *
	 * @param names - Array of preset names to export (empty array exports all)
	 * @param format - Export format ('json' or 'yaml')
	 * @param includeVersionHistory - Whether to include version history
	 * @returns Promise resolving to the exported data
	 *
	 * @example
	 * ```typescript
	 * const exported = await client.presets.export(
	 *   ['user-login-attempt', 'user-login-success'],
	 *   'json',
	 *   false
	 * )
	 * ```
	 */
	async export(
		names: string[] = [],
		format: 'json' | 'yaml' = 'json',
		includeVersionHistory = false
	): Promise<string> {
		const options: RequestOptions = {
			method: 'POST',
			body: {
				names,
				format,
				includeVersionHistory,
			},
		}

		return this.request<string>('/audit-presets/export', options)
	}

	/**
	 * Import presets from a portable format
	 *
	 * @param data - The exported preset data
	 * @param format - The format of the data ('json' or 'yaml')
	 * @param overwrite - Whether to overwrite existing presets
	 * @returns Promise resolving to import results
	 *
	 * @example
	 * ```typescript
	 * const results = await client.presets.import(exportedData, 'json', false)
	 * console.log(`Imported ${results.imported.length} presets`)
	 * ```
	 */
	async import(
		data: string,
		format: 'json' | 'yaml' = 'json',
		overwrite = false
	): Promise<{
		imported: string[]
		skipped: string[]
		errors: Array<{ name: string; error: string }>
	}> {
		const options: RequestOptions = {
			method: 'POST',
			body: {
				data,
				format,
				overwrite,
			},
		}

		return this.request<{
			imported: string[]
			skipped: string[]
			errors: Array<{ name: string; error: string }>
		}>('/audit-presets/import', options)
	}
}
