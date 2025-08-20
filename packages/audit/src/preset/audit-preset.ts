import { AuditPreset } from './preset-types.js'

/**
 * Preset handler interface
 */
export interface PresetHandler {
	getPresets(organizationId?: string): Promise<(AuditPreset & { id?: string })[]>
	getPreset(name: string, organizationId?: string): Promise<(AuditPreset & { id?: string }) | null>
	createPreset(preset: AuditPreset & { createdBy: string }): Promise<AuditPreset & { id?: string }>
	updatePreset(
		preset: AuditPreset & { id: string; updatedBy: string }
	): Promise<AuditPreset & { id?: string }>
	deletePreset(name: string, organizationId: string): Promise<{ success: true }>
}
