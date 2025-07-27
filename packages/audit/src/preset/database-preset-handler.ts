import { sql } from 'drizzle-orm'

import { DataClassification } from '../types.js'
import { PresetHandler } from './audit-preset.js'
import { AuditPreset } from './preset-types.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * Database preset handler implementation
 */
export class DatabasePresetHandler implements PresetHandler {
	constructor(private db: PostgresJsDatabase<any>) {}

	/**
	 * Get all presets
	 */
	async getPresets(organizationId?: string): Promise<AuditPreset[]> {
		const orgId = organizationId || '*'
		try {
			const result = await this.db.execute(sql`
        SELECT * FROM audit_preset
        WHERE organization_id = ${orgId}
        ORDER BY name
      `)
			const rows = result || []
			return rows.map(this.mapDatabasePresetToPreset)
		} catch (error) {
			throw new Error(`Failed to retrieve presets: ${error}`)
		}
	}

	/**
	 * Get a preset by name
	 */
	async getPreset(name: string, organizationId?: string): Promise<AuditPreset | null> {
		const orgId = organizationId || '*'
		try {
			const result = await this.db.execute(sql`
				SELECT * FROM audit_preset
				WHERE name = ${name}
				AND organization_id = ${orgId}
				LIMIT 1
			`)

			const rows = result || []
			if (rows.length === 0) {
				return null
			}

			return this.mapDatabasePresetToPreset(rows[0])
		} catch (error) {
			throw new Error(`Failed to retrieve preset by ID: ${error}`)
		}
	}

	/**
	 * Create a preset
	 */
	async createPreset(preset: AuditPreset & { createdBy: string }): Promise<AuditPreset> {
		try {
			const result = await this.db.execute(sql`
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
	): Promise<AuditPreset> {
		const now = new Date().toISOString()
		try {
			const result = await this.db.execute(sql`
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
		try {
			await this.db.execute(sql`
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
	private mapDatabasePresetToPreset(dbPreset: any): AuditPreset {
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
		}
	}
}

/**
 * Factory function to create DatabasePresetHandler
 */
export function createDatabasePresetHandler(db: PostgresJsDatabase<any>): DatabasePresetHandler {
	return new DatabasePresetHandler(db)
}
