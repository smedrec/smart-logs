import { DataClassification } from '../types.js'
import { ValidationConfig } from '../validation.js'

/**
 * Predefined audit event configurations
 */
export interface AuditPreset {
	name: string
	description?: string
	organizationId: string
	action: string
	dataClassification: DataClassification
	requiredFields: string[]
	defaultValues?: Record<string, any>
	validation?: Partial<ValidationConfig>
}
