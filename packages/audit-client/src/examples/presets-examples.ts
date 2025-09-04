/**
 * Audit Presets Service Examples
 *
 * This file demonstrates how to use the PresetsService for managing
 * audit configuration templates and creating audit events from presets.
 */

import { AuditClient } from '../index'

import type {
	CreateAuditPresetInput,
	PresetContext,
	UpdateAuditPresetInput,
} from '../services/presets'

// Initialize the client
const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key-here',
	},
})

/**
 * Example 1: Creating a new audit preset
 */
export async function createUserLoginPreset() {
	try {
		const presetInput: CreateAuditPresetInput = {
			name: 'user-login-success',
			description: 'Template for successful user login events',
			template: {
				action: 'user.login',
				targetResourceType: 'user',
				dataClassification: 'INTERNAL',
				defaultStatus: 'success',
				defaultOutcomeDescription: 'User successfully authenticated',
			},
			validation: {
				requiredFields: ['principalId', 'organizationId'],
				optionalFields: ['targetResourceId', 'sessionContext', 'customDetails'],
				fieldValidation: {
					principalId: {
						type: 'string',
						required: true,
						minLength: 1,
					},
					organizationId: {
						type: 'string',
						required: true,
						minLength: 1,
					},
					targetResourceId: {
						type: 'string',
						minLength: 1,
					},
				},
			},
			tags: ['authentication', 'login', 'success'],
			category: 'authentication',
		}

		const preset = await client.presets.create(presetInput)
		console.log('Created preset:', preset.name)
		console.log('Version:', preset.metadata.version)

		return preset
	} catch (error) {
		console.error('Failed to create preset:', error)
		throw error
	}
}

/**
 * Example 2: Listing and filtering presets
 */
export async function listAuthenticationPresets() {
	try {
		// List all presets in the authentication category
		const result = await client.presets.list({
			category: 'authentication',
			tags: ['login'],
			sortBy: 'name',
			sortOrder: 'asc',
			limit: 20,
		})

		console.log(`Found ${result.presets.length} authentication presets`)

		result.presets.forEach((preset) => {
			console.log(`- ${preset.name}: ${preset.description}`)
			console.log(`  Tags: ${preset.metadata.tags.join(', ')}`)
			console.log(`  Version: ${preset.metadata.version}`)
		})

		return result
	} catch (error) {
		console.error('Failed to list presets:', error)
		throw error
	}
}

/**
 * Example 3: Getting a specific preset
 */
export async function getPresetDetails() {
	try {
		const preset = await client.presets.get('user-login-success')

		if (preset) {
			console.log('Preset found:', preset.name)
			console.log('Description:', preset.description)
			console.log('Action:', preset.template.action)
			console.log('Required fields:', preset.validation.requiredFields)
			console.log('Optional fields:', preset.validation.optionalFields)
		} else {
			console.log('Preset not found')
		}

		return preset
	} catch (error) {
		console.error('Failed to get preset:', error)
		throw error
	}
}

/**
 * Example 4: Updating an existing preset
 */
export async function updatePresetDescription() {
	try {
		const updates: UpdateAuditPresetInput = {
			description: 'Enhanced template for successful user login events with MFA support',
			template: {
				defaultDetails: {
					mfaRequired: true,
					securityLevel: 'high',
				},
			},
			tags: ['authentication', 'login', 'success', 'mfa'],
		}

		const updatedPreset = await client.presets.update('user-login-success', updates)
		console.log('Updated preset:', updatedPreset.name)
		console.log('New version:', updatedPreset.metadata.version)
		console.log('Updated description:', updatedPreset.description)

		return updatedPreset
	} catch (error) {
		console.error('Failed to update preset:', error)
		throw error
	}
}

/**
 * Example 5: Validating preset context before applying
 */
export async function validatePresetContext() {
	try {
		const context: PresetContext = {
			principalId: 'user123',
			organizationId: 'org456',
			targetResourceId: 'user123',
			sessionContext: {
				sessionId: 'sess789',
				ipAddress: '192.168.1.1',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
			customDetails: {
				loginMethod: 'password',
				mfaUsed: true,
				deviceTrusted: false,
			},
		}

		const validation = await client.presets.validate('user-login-success', context)

		if (validation.isValid) {
			console.log('Context is valid for preset')
		} else {
			console.log('Validation errors:')
			validation.errors.forEach((error) => {
				console.log(`- ${error.field}: ${error.message} (${error.code})`)
			})
		}

		if (validation.warnings) {
			console.log('Validation warnings:')
			validation.warnings.forEach((warning) => {
				console.log(`- ${warning.field}: ${warning.message} (${warning.code})`)
			})
		}

		return validation
	} catch (error) {
		console.error('Failed to validate context:', error)
		throw error
	}
}

/**
 * Example 6: Applying a preset to create an audit event
 */
export async function applyPresetToCreateEvent() {
	try {
		const context: PresetContext = {
			principalId: 'user123',
			organizationId: 'org456',
			targetResourceId: 'user123',
			sessionContext: {
				sessionId: 'sess789',
				ipAddress: '192.168.1.1',
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				location: 'New York, NY',
			},
			customDetails: {
				loginMethod: 'password',
				mfaUsed: true,
				deviceTrusted: false,
				riskScore: 0.2,
			},
			overrides: {
				outcomeDescription: 'User successfully logged in with MFA',
			},
		}

		const result = await client.presets.apply('user-login-success', context)

		if (result.success && result.auditEvent) {
			console.log('Audit event created successfully!')
			console.log('Event ID:', result.auditEvent.id)
			console.log('Timestamp:', result.auditEvent.timestamp)
			console.log('Action:', result.auditEvent.action)
			console.log('Status:', result.auditEvent.status)
			console.log('Correlation ID:', result.auditEvent.correlationId)
		} else {
			console.log('Failed to create audit event')
			if (result.errors) {
				result.errors.forEach((error) => {
					console.log(`Error: ${error.message} (${error.code})`)
				})
			}
		}

		return result
	} catch (error) {
		console.error('Failed to apply preset:', error)
		throw error
	}
}

/**
 * Example 7: Working with preset versions
 */
export async function managePresetVersions() {
	try {
		// Get version history
		const history = await client.presets.getVersionHistory('user-login-success', 10)
		console.log(`Preset has ${history.totalVersions} versions`)
		console.log('Current version:', history.currentVersion)

		history.versions.forEach((version) => {
			console.log(`Version ${version.version} (${version.createdAt}):`)
			version.changes.forEach((change) => {
				console.log(`  - ${change}`)
			})
		})

		// Get a specific version
		const specificVersion = await client.presets.getVersion('user-login-success', '1.0.0')
		if (specificVersion) {
			console.log('Found version 1.0.0')
			console.log('Changes:', specificVersion.changes)
		}

		return { history, specificVersion }
	} catch (error) {
		console.error('Failed to manage versions:', error)
		throw error
	}
}

/**
 * Example 8: Getting preset usage statistics
 */
export async function getPresetUsageStats() {
	try {
		const stats = await client.presets.getUsageStats('user-login-success', 'month', 5)

		console.log(`Preset usage statistics:`)
		console.log(`Total usage: ${stats.totalUsage}`)
		console.log(`Success rate: ${stats.successRate}%`)
		console.log(`Average execution time: ${stats.averageExecutionTime}ms`)
		console.log(`Last used: ${stats.lastUsed}`)

		console.log('Usage by period:')
		stats.usageByPeriod.forEach((period) => {
			console.log(`  ${period.period}: ${period.count} uses`)
		})

		console.log('Top users:')
		stats.topUsers.forEach((user) => {
			console.log(`  ${user.principalId}: ${user.count} uses`)
		})

		return stats
	} catch (error) {
		console.error('Failed to get usage stats:', error)
		throw error
	}
}

/**
 * Example 9: Duplicating a preset
 */
export async function duplicatePreset() {
	try {
		const updates = {
			description: 'Template for admin login attempts with enhanced security',
			tags: ['authentication', 'admin', 'login', 'security'],
			category: 'admin-authentication',
		}

		const duplicated = await client.presets.duplicate(
			'user-login-success',
			'admin-login-success',
			updates
		)

		console.log('Duplicated preset:', duplicated.name)
		console.log('New description:', duplicated.description)
		console.log('New tags:', duplicated.metadata.tags)

		return duplicated
	} catch (error) {
		console.error('Failed to duplicate preset:', error)
		throw error
	}
}

/**
 * Example 10: Exporting and importing presets
 */
export async function exportAndImportPresets() {
	try {
		// Export specific presets
		const exportData = await client.presets.export(
			['user-login-success', 'admin-login-success'],
			'json',
			false
		)

		console.log('Exported presets data length:', exportData.length)

		// Parse and display export structure
		const parsed = JSON.parse(exportData)
		console.log(
			'Exported presets:',
			parsed.presets?.map((p: any) => p.name)
		)

		// Import presets (in a real scenario, you might import to a different environment)
		const importResult = await client.presets.import(exportData, 'json', false)

		console.log('Import results:')
		console.log('Imported:', importResult.imported)
		console.log('Skipped:', importResult.skipped)
		console.log('Errors:', importResult.errors)

		return { exportData, importResult }
	} catch (error) {
		console.error('Failed to export/import presets:', error)
		throw error
	}
}

/**
 * Example 11: Comprehensive preset management workflow
 */
export async function comprehensivePresetWorkflow() {
	try {
		console.log('=== Comprehensive Preset Management Workflow ===')

		// 1. Create a new preset
		console.log('\n1. Creating new preset...')
		const newPreset = await createUserLoginPreset()

		// 2. List presets to verify creation
		console.log('\n2. Listing authentication presets...')
		await listAuthenticationPresets()

		// 3. Get preset details
		console.log('\n3. Getting preset details...')
		await getPresetDetails()

		// 4. Update the preset
		console.log('\n4. Updating preset...')
		await updatePresetDescription()

		// 5. Validate context
		console.log('\n5. Validating preset context...')
		const validation = await validatePresetContext()

		// 6. Apply preset if validation passes
		if (validation.isValid) {
			console.log('\n6. Applying preset to create audit event...')
			await applyPresetToCreateEvent()
		}

		// 7. Check version history
		console.log('\n7. Checking version history...')
		await managePresetVersions()

		// 8. Get usage statistics
		console.log('\n8. Getting usage statistics...')
		await getPresetUsageStats()

		// 9. Duplicate preset
		console.log('\n9. Duplicating preset...')
		await duplicatePreset()

		// 10. Export and import
		console.log('\n10. Exporting and importing presets...')
		await exportAndImportPresets()

		console.log('\n=== Workflow completed successfully! ===')
	} catch (error) {
		console.error('Workflow failed:', error)
		throw error
	}
}

// Export all examples for easy access
export const presetExamples = {
	createUserLoginPreset,
	listAuthenticationPresets,
	getPresetDetails,
	updatePresetDescription,
	validatePresetContext,
	applyPresetToCreateEvent,
	managePresetVersions,
	getPresetUsageStats,
	duplicatePreset,
	exportAndImportPresets,
	comprehensivePresetWorkflow,
}
