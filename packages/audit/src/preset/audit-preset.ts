import { AuditPreset } from './preset-types.js'

/**
 * Preset handler interface
 */
export interface PresetHandler {
	getPresets(organizationId?: string): Promise<AuditPreset[]>
	getPreset(name: string, organizationId?: string): Promise<AuditPreset | null>
	createPreset(preset: AuditPreset & { createdBy: string }): Promise<AuditPreset>
	updatePreset(preset: AuditPreset & { id: string; updatedBy: string }): Promise<AuditPreset>
	deletePreset(name: string, organizationId: string): Promise<{ success: true }>
}
