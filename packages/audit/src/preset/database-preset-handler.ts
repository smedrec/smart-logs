import { sql } from 'drizzle-orm'

import { EnhancedAuditDatabaseClient, EnhancedAuditDb } from '@repo/audit-db'

import { DataClassification } from '../types.js'
import { PresetHandler } from './audit-preset.js'
import { AuditPreset } from './preset-types.js'

/**
 * Database preset handler implementation
 */
export class DatabasePresetHandler implements PresetHandler {
	private client: EnhancedAuditDatabaseClient
	constructor(auditDbInstance: EnhancedAuditDb) {
		this.client = auditDbInstance.getEnhancedClientInstance()
	}

	/**
	 * Get all presets for an organization with default fallbacks
	 * Organization presets take priority over defaults with the same name
	 */
	async getPresets(organizationId?: string): Promise<(AuditPreset & { id?: string })[]> {
		const orgId = organizationId || '*'

		// If no organization specified, just return default presets
		if (orgId === '*') {
			return this.getDefaultPresets()
		}

		try {
			// Fetch both organization and default presets in a single optimized query
			const result = await this.client.executeOptimizedQuery(
				(db) =>
					db.execute(sql`
						SELECT *,
								 CASE WHEN organization_id = ${orgId} THEN 1 ELSE 0 END as priority
						FROM audit_preset
						WHERE organization_id IN (${orgId}, '*')
						ORDER BY name, priority DESC
					`),
				{ cacheKey: `get_merged_presets_${orgId}` }
			)

			const rows = result || []

			// Merge presets: organization presets take priority over defaults
			return this.mergePresetsWithPriority(rows)
		} catch (error) {
			throw new Error(`Failed to retrieve presets. ${error}`)
		}
	}

	/**
	 * Get a preset by name with organization priority and default fallback
	 */
	async getPreset(
		name: string,
		organizationId?: string
	): Promise<(AuditPreset & { id?: string }) | null> {
		const orgId = organizationId || '*'

		// If requesting default preset, get it directly
		if (orgId === '*') {
			return this.getDefaultPreset(name)
		}

		try {
			// Single query to get both organization and default preset with priority
			const result = await this.client.executeOptimizedQuery(
				(db) =>
					db.execute(sql`
						SELECT *,
								 CASE WHEN organization_id = ${orgId} THEN 1 ELSE 0 END as priority
						FROM audit_preset
						WHERE name = ${name}
						AND organization_id IN (${orgId}, '*')
						ORDER BY priority DESC
						LIMIT 1
					`),
				{ cacheKey: `get_preset_${name}_${orgId}` }
			)

			const rows = result || []
			if (rows.length === 0) {
				return null
			}

			return this.mapDatabasePresetToPreset(rows[0])
		} catch (error) {
			throw new Error(`Failed to retrieve preset by name. ${error}`)
		}
	}

	/**
	 * Get default presets only
	 */
	private async getDefaultPresets(): Promise<(AuditPreset & { id?: string })[]> {
		try {
			const result = await this.client.executeOptimizedQuery(
				(db) =>
					db.execute(sql`
						SELECT * FROM audit_preset
						WHERE organization_id = '*'
						ORDER BY name
					`),
				{ cacheKey: 'get_default_presets' }
			)

			const rows = result || []
			return rows.map(this.mapDatabasePresetToPreset)
		} catch (error) {
			throw new Error(`Failed to retrieve default presets. ${error}`)
		}
	}

	/**
	 * Merge presets giving priority to organization-specific ones
	 * @param rows Database rows sorted by name and priority (org presets first)
	 */
	private mergePresetsWithPriority(rows: any[]): (AuditPreset & { id?: string })[] {
		const presetMap = new Map<string, any>()

		// Process rows - organization presets will overwrite defaults due to priority ordering
		for (const row of rows) {
			const presetName = row.name

			// Only add if not already present (organization preset takes priority)
			if (!presetMap.has(presetName)) {
				presetMap.set(presetName, row)
			}
		}

		// Convert map values to preset objects
		return Array.from(presetMap.values()).map(this.mapDatabasePresetToPreset)
	}

	/**
	 * Get default preset by name
	 */
	async getDefaultPreset(name: string): Promise<(AuditPreset & { id?: string }) | null> {
		try {
			const result = await this.client.executeOptimizedQuery(
				(db) =>
					db.execute(sql`
				SELECT * FROM audit_preset
				WHERE name = ${name}
				AND organization_id = '*'
				LIMIT 1
			`),
				{ cacheKey: `get_default_preset_${name}` }
			)

			const rows = result || []
			if (rows.length === 0) {
				return null
			}

			return this.mapDatabasePresetToPreset(rows[0])
		} catch (error) {
			throw new Error(`Failed to retrieve default preset by name: ${error}`)
		}
	}

	/**
	 * Create a preset
	 */
	async createPreset(
		preset: AuditPreset & { createdBy: string }
	): Promise<AuditPreset & { id?: string }> {
		const db = this.client.getDatabase()
		try {
			const result = await db.execute(sql`
				INSERT INTO audit_preset (
					name, description, organization_id, action, data_classification, required_fields, default_values, validation, created_by
				) VALUES (
					${preset.name}, ${preset.description}, ${preset.organizationId}, ${preset.action}, ${preset.dataClassification}, ${JSON.stringify(preset.requiredFields)}, ${JSON.stringify(preset.defaultValues)}, ${preset.validation ? JSON.stringify(preset.validation) : null}, ${preset.createdBy}
				)
				ON CONFLICT (name, organization_id) DO UPDATE SET
					description = EXCLUDED.description,
					action = EXCLUDED.action,
					data_classification = EXCLUDED.data_classification,
					required_fields = EXCLUDED.required_fields,
					default_values = EXCLUDED.default_values,
					validation = EXCLUDED.validation,
					updated_at = NOW(),
					updated_by = EXCLUDED.created_by
				RETURNING *
			`)

			const rows = result || []
			if (rows.length === 0) {
				throw new Error('Preset already exists or failed to insert')
			}
			return this.mapDatabasePresetToPreset(rows[0])
		} catch (error) {
			throw new Error(`Failed to create preset: ${error}`)
		}
	}

	async updatePreset(
		preset: AuditPreset & { id: string; updatedBy: string }
	): Promise<AuditPreset & { id?: string }> {
		const db = this.client.getDatabase()
		const now = new Date().toISOString()
		try {
			const result = await db.execute(sql`
				UPDATE audit_preset
				SET name = ${preset.name},
					description = ${preset.description},
					organization_id = ${preset.organizationId},
					action = ${preset.action},
					data_classification = ${preset.dataClassification},
					required_fields = ${preset.requiredFields},
					default_values = ${preset.defaultValues},
					validation = ${preset.validation},
          updated_at = ${now},
					updated_by = ${preset.updatedBy}
				WHERE id = ${preset.id}
			`)
			const rows = result || []
			if (rows.length === 0) {
				throw new Error('Failed to update preset: preset not found')
			}
			return this.mapDatabasePresetToPreset(rows[0])
		} catch (error) {
			throw new Error(`Failed to update preset: ${error}`)
		}
	}

	/**
	 * Delete a preset
	 */
	async deletePreset(name: string, organizationId: string): Promise<{ success: true }> {
		const db = this.client.getDatabase()
		try {
			await db.execute(sql`
				DELETE FROM audit_preset
				WHERE name = ${name}
        AND organization_id = ${organizationId}
			`)
			return { success: true }
		} catch (error) {
			throw new Error(`Failed to delete preset: ${error}`)
		}
	}

	/**
	 * Map database preset record to AuditPreset interface
	 */
	private mapDatabasePresetToPreset(dbPreset: any): AuditPreset & { id?: string } {
		return {
			name: dbPreset.name,
			description: dbPreset.description,
			organizationId: dbPreset.organization_id,
			action: dbPreset.action,
			dataClassification: dbPreset.data_classification as DataClassification,
			requiredFields:
				typeof dbPreset.required_fields === 'string'
					? JSON.parse(dbPreset.required_fields)
					: dbPreset.required_fields,
			defaultValues: {
				...(typeof dbPreset.default_values === 'string'
					? JSON.parse(dbPreset.default_values)
					: dbPreset.default_values),
			},
			validation: {
				...(typeof dbPreset.validation === 'string'
					? JSON.parse(dbPreset.validation)
					: dbPreset.validation),
			},
			id: dbPreset.id?.toString(), // Include the database ID
		}
	}
}

/**
 * Factory function to create DatabasePresetHandler
 */
export function createDatabasePresetHandler(
	auditDbInstance: EnhancedAuditDb
): DatabasePresetHandler {
	return new DatabasePresetHandler(auditDbInstance)
}
