/**
 * Report Template Types and Interfaces
 *
 * Defines the data structures for the report templates system
 */

import type { ReportType } from '../types'

export interface ReportTemplate {
	id: string
	name: string
	description?: string
	reportType: ReportType
	category: string
	isPublic: boolean
	createdAt: Date
	updatedAt: Date
	createdBy: string
	organizationId: string
	usageCount: number
	tags: string[]
	version: string
	isActive: boolean

	// Template configuration
	configuration: TemplateConfiguration

	// Versioning
	parentTemplateId?: string
	versionHistory?: TemplateVersion[]

	// Sharing
	sharedWith?: TemplateShare[]
	shareSettings: TemplateShareSettings
}

export interface TemplateConfiguration {
	// Report criteria configuration
	criteria: {
		dateRange?: {
			type: 'relative' | 'absolute' | 'custom'
			value?: string
			startDate?: string
			endDate?: string
		}
		filters?: Record<string, any>
		includeFields?: string[]
		excludeFields?: string[]
		groupBy?: string[]
		sortBy?: string[]
	}

	// Output configuration
	output: {
		format: 'pdf' | 'csv' | 'json' | 'xlsx'
		includeCharts?: boolean
		includeRawData?: boolean
		customSections?: TemplateSection[]
	}

	// Schedule template (optional)
	scheduleTemplate?: {
		cronExpression?: string
		timezone?: string
		enabled: boolean
	}

	// Delivery template (optional)
	deliveryTemplate?: {
		method: 'email' | 'webhook' | 'storage'
		configuration: Record<string, any>
	}

	// Validation rules
	validation?: {
		required: string[]
		rules: ValidationRule[]
	}
}

export interface TemplateSection {
	id: string
	name: string
	type: 'text' | 'table' | 'chart' | 'summary'
	configuration: Record<string, any>
	order: number
	enabled: boolean
}

export interface ValidationRule {
	field: string
	type: 'required' | 'min' | 'max' | 'pattern' | 'custom'
	value?: any
	message: string
}

export interface TemplateVersion {
	version: string
	createdAt: Date
	createdBy: string
	changes: string[]
	configuration: TemplateConfiguration
	isActive: boolean
}

export interface TemplateShare {
	id: string
	sharedWith: string // user ID or organization ID
	sharedBy: string
	sharedAt: Date
	permissions: TemplatePermission[]
	expiresAt?: Date
}

export interface TemplatePermission {
	action: 'view' | 'use' | 'edit' | 'share'
	granted: boolean
}

export interface TemplateShareSettings {
	isPublic: boolean
	allowPublicUse: boolean
	allowPublicEdit: boolean
	requireApproval: boolean
	maxShares?: number
}

// Form interfaces
export interface CreateTemplateInput {
	name: string
	description?: string
	reportType: ReportType
	category: string
	tags: string[]
	configuration: TemplateConfiguration
	shareSettings: TemplateShareSettings
	isPublic?: boolean
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
	id: string
	version?: string
}

export interface TemplateFilters {
	reportType?: ReportType[]
	category?: string[]
	tags?: string[]
	isPublic?: boolean
	createdBy?: string[]
	dateRange?: {
		startDate: string
		endDate: string
	}
	search?: string
	usageRange?: {
		min: number
		max: number
	}
}

// UI State interfaces
export interface TemplateFormState {
	data: Partial<CreateTemplateInput>
	errors: Record<string, string>
	touched: Record<string, boolean>
	isSubmitting: boolean
	isDirty: boolean
	currentStep: number
	totalSteps: number
}

export interface TemplateListState {
	templates: ReportTemplate[]
	filters: TemplateFilters
	pagination: {
		page: number
		pageSize: number
		total: number
		totalPages: number
	}
	selection: string[]
	loading: boolean
	error?: string
	sortBy?: string
	sortOrder?: 'asc' | 'desc'
}

// Template categories
export const TEMPLATE_CATEGORIES = [
	{ value: 'healthcare', label: 'Healthcare', description: 'HIPAA and healthcare compliance' },
	{ value: 'privacy', label: 'Privacy', description: 'GDPR and privacy regulations' },
	{ value: 'security', label: 'Security', description: 'Security audits and compliance' },
	{ value: 'financial', label: 'Financial', description: 'Financial regulations and audits' },
	{ value: 'custom', label: 'Custom', description: 'Custom compliance requirements' },
] as const

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]['value']

// Template presets for different report types
export const TEMPLATE_PRESETS: Record<ReportType, Partial<TemplateConfiguration>> = {
	HIPAA_AUDIT_TRAIL: {
		criteria: {
			dateRange: { type: 'relative', value: '30d' },
			includeFields: [
				'timestamp',
				'userId',
				'action',
				'resourceType',
				'resourceId',
				'ipAddress',
				'userAgent',
				'outcome',
			],
			groupBy: ['action', 'resourceType'],
			sortBy: ['timestamp'],
		},
		output: {
			format: 'pdf',
			includeCharts: true,
			includeRawData: false,
			customSections: [
				{
					id: 'summary',
					name: 'Executive Summary',
					type: 'summary',
					configuration: { includeMetrics: true },
					order: 1,
					enabled: true,
				},
				{
					id: 'access-patterns',
					name: 'Access Patterns',
					type: 'chart',
					configuration: { chartType: 'timeline' },
					order: 2,
					enabled: true,
				},
			],
		},
	},
	GDPR_PROCESSING_ACTIVITIES: {
		criteria: {
			dateRange: { type: 'relative', value: '90d' },
			includeFields: [
				'timestamp',
				'dataSubjectId',
				'processingPurpose',
				'dataCategories',
				'legalBasis',
				'retentionPeriod',
				'thirdPartySharing',
			],
			groupBy: ['processingPurpose', 'legalBasis'],
			sortBy: ['timestamp'],
		},
		output: {
			format: 'pdf',
			includeCharts: true,
			includeRawData: true,
			customSections: [
				{
					id: 'processing-overview',
					name: 'Processing Activities Overview',
					type: 'summary',
					configuration: { includeBreakdown: true },
					order: 1,
					enabled: true,
				},
				{
					id: 'legal-basis',
					name: 'Legal Basis Analysis',
					type: 'table',
					configuration: { groupBy: 'legalBasis' },
					order: 2,
					enabled: true,
				},
			],
		},
	},
	INTEGRITY_VERIFICATION: {
		criteria: {
			dateRange: { type: 'relative', value: '7d' },
			includeFields: [
				'timestamp',
				'recordId',
				'checksum',
				'previousChecksum',
				'verificationStatus',
				'anomalies',
			],
			groupBy: ['verificationStatus'],
			sortBy: ['timestamp'],
		},
		output: {
			format: 'json',
			includeCharts: false,
			includeRawData: true,
			customSections: [
				{
					id: 'integrity-status',
					name: 'Integrity Status',
					type: 'summary',
					configuration: { includeAnomalies: true },
					order: 1,
					enabled: true,
				},
			],
		},
	},
}
