import { z } from 'zod'

import {
	DataClassificationSchema,
	DateRangeFilterSchema,
	PaginationMetadataSchema,
	PaginationParamsSchema,
	QueryFilterSchema,
} from './api'

// ============================================================================
// Compliance Report Types
// ============================================================================

/**
 * Report types
 */
export const ReportTypeSchema = z.enum(['hipaa', 'gdpr', 'integrity', 'custom'])
export type ReportType = z.infer<typeof ReportTypeSchema>

/**
 * Report status
 */
export const ReportStatusSchema = z.enum([
	'pending',
	'processing',
	'completed',
	'failed',
	'cancelled',
])
export type ReportStatus = z.infer<typeof ReportStatusSchema>

/**
 * Report format
 */
export const ReportFormatSchema = z.enum(['pdf', 'html', 'csv', 'json', 'xlsx', 'xml'])
export type ReportFormat = z.infer<typeof ReportFormatSchema>

/**
 * Report criteria with validation
 */
export const ReportCriteriaSchema = z.object({
	dateRange: DateRangeFilterSchema,
	organizationIds: z.array(z.string().min(1)).optional(),
	principalIds: z.array(z.string().min(1)).optional(),
	actions: z.array(z.string().min(1)).optional(),
	resourceTypes: z.array(z.string().min(1)).optional(),
	dataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])).optional(),
	statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
	verifiedOnly: z.boolean().default(false).optional(),
	includeSuccessfulEvents: z.boolean().default(true).optional(),
	includeFailedEvents: z.boolean().default(true).optional(),
	includeAttemptEvents: z.boolean().default(false).optional(),
	customFilters: z.record(z.unknown()).optional(),
	limit: z.number().int().min(1).max(10000).optional(),
	offset: z.number().int().min(0).optional(),
	sortBy: z.enum(['timestamp', 'status']).optional(),
	sortOrder: z.enum(['asc', 'desc']).optional(),
})
export type ReportCriteria = z.infer<typeof ReportCriteriaSchema>

/**
 * Report metadata
 */
export const ReportMetadataSchema = z.object({
	generatedBy: z.string().min(1),
	generatedAt: z.string().datetime(),
	reportId: z.string().uuid(),
	version: z.string().min(1),
	dataRange: DateRangeFilterSchema,
	totalEvents: z.number().int().min(0),
	processingTime: z.number().min(0),
	filters: z.record(z.unknown()).optional(),
	customFields: z.record(z.unknown()).optional(),
})
export type ReportMetadata = z.infer<typeof ReportMetadataSchema>

// ============================================================================
// HIPAA Compliance Types
// ============================================================================

/**
 * HIPAA safeguards
 */
export const HIPAASafeguardSchema = z.enum([
	'administrative',
	'physical',
	'technical',
	'organizational',
])
export type HIPAASafeguard = z.infer<typeof HIPAASafeguardSchema>

/**
 * HIPAA compliance status
 */
export const HIPAAComplianceStatusSchema = z.enum([
	'compliant',
	'non_compliant',
	'partial',
	'unknown',
])
export type HIPAAComplianceStatus = z.infer<typeof HIPAAComplianceStatusSchema>

/**
 * Simplified event structure for compliance reports
 */
export const ComplianceReportEventSchema = z.object({
	id: z.string().uuid(),
	timestamp: z.string().datetime(),
	principalId: z.string().min(1),
	organizationId: z.string().min(1),
	action: z.string().min(1),
	targetResourceType: z.string().min(1),
	targetResourceId: z.string().optional(),
	status: z.enum(['attempt', 'success', 'failure']),
	outcomeDescription: z.string().optional(),
	dataClassification: DataClassificationSchema,
	sessionContext: z
		.object({
			ipAddress: z.string().ip(),
			userAgent: z.string().min(1),
			sessionId: z.string().min(1),
		})
		.optional(),
	integrityStatus: z.enum(['verified', 'failed', 'not_checked']).optional(),
	correlationId: z.string().optional(),
})
export type ComplianceReportEvent = z.infer<typeof ComplianceReportEventSchema>

/**
 * HIPAA section
 */
export const HIPAASectionSchema = z.object({
	safeguard: HIPAASafeguardSchema,
	title: z.string().min(1),
	description: z.string().min(1),
	status: HIPAAComplianceStatusSchema,
	events: z.array(z.string().uuid()),
	violations: z.array(
		z.object({
			eventId: z.string().uuid(),
			violationType: z.string().min(1),
			severity: z.enum(['low', 'medium', 'high', 'critical']),
			description: z.string().min(1),
			recommendation: z.string().min(1),
		})
	),
	recommendations: z.array(z.string().min(1)),
	score: z.number().min(0).max(100),
})
export type HIPAASection = z.infer<typeof HIPAASectionSchema>

/**
 * HIPAA report
 */
export const HIPAAReportSchema = z.object({
	id: z.string().uuid(),
	type: z.literal('hipaa'),
	generatedAt: z.string().datetime(),
	criteria: ReportCriteriaSchema,
	summary: z.object({
		totalEvents: z.number().int().min(0),
		complianceScore: z.number().min(0).max(100),
		violations: z.number().int().min(0),
		recommendations: z.array(z.string().min(1)),
		overallStatus: HIPAAComplianceStatusSchema,
	}),
	sections: z.array(HIPAASectionSchema),
	metadata: ReportMetadataSchema,
	downloadUrl: z.string().url().optional(),
	expiresAt: z.string().datetime().optional(),
})
export type HIPAAReport = z.infer<typeof HIPAAReportSchema>

// ============================================================================
// GDPR Compliance Types
// ============================================================================

/**
 * GDPR lawful basis
 */
export const GDPRLawfulBasisSchema = z.enum([
	'consent',
	'contract',
	'legal_obligation',
	'vital_interests',
	'public_task',
	'legitimate_interests',
])
export type GDPRLawfulBasis = z.infer<typeof GDPRLawfulBasisSchema>

/**
 * GDPR data subject rights
 */
export const GDPRDataSubjectRightSchema = z.enum([
	'access',
	'rectification',
	'erasure',
	'restrict_processing',
	'data_portability',
	'object',
	'automated_decision_making',
])
export type GDPRDataSubjectRight = z.infer<typeof GDPRDataSubjectRightSchema>

/**
 * GDPR processing activity
 */
export const GDPRProcessingActivitySchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	purpose: z.string().min(1),
	lawfulBasis: GDPRLawfulBasisSchema,
	dataCategories: z.array(z.string().min(1)),
	dataSubjects: z.array(z.string().min(1)),
	recipients: z.array(z.string().min(1)).optional(),
	retentionPeriod: z.string().min(1).optional(),
	securityMeasures: z.array(z.string().min(1)).optional(),
	eventCount: z.number().int().min(0),
})
export type GDPRProcessingActivity = z.infer<typeof GDPRProcessingActivitySchema>

/**
 * GDPR section
 */
export const GDPRSectionSchema = z.object({
	article: z.string().min(1),
	title: z.string().min(1),
	description: z.string().min(1),
	status: z.enum(['compliant', 'non_compliant', 'partial', 'not_applicable']),
	events: z.array(z.string().uuid()),
	processingActivities: z.array(GDPRProcessingActivitySchema),
	dataSubjectRequests: z.array(
		z.object({
			type: GDPRDataSubjectRightSchema,
			count: z.number().int().min(0),
			averageResponseTime: z.number().min(0),
			completionRate: z.number().min(0).max(100),
		})
	),
	recommendations: z.array(z.string().min(1)),
	score: z.number().min(0).max(100),
})
export type GDPRSection = z.infer<typeof GDPRSectionSchema>

/**
 * GDPR report
 */
export const GDPRReportSchema = z.object({
	id: z.string(),
	type: z.literal('gdpr'),
	generatedAt: z.string().datetime(),
	criteria: ReportCriteriaSchema,
	summary: z.object({
		totalEvents: z.number().int().min(0),
		dataSubjects: z.number().int().min(0),
		processingActivities: z.number().int().min(0),
		lawfulBases: z.array(GDPRLawfulBasisSchema),
		dataSubjectRequests: z.number().int().min(0),
		breaches: z.number().int().min(0),
		complianceScore: z.number().min(0).max(100),
	}),
	sections: z.array(GDPRSectionSchema),
	metadata: ReportMetadataSchema,
	downloadUrl: z.string().url().optional(),
	expiresAt: z.string().datetime().optional(),
})
export type GDPRReport = z.infer<typeof GDPRReportSchema>

// ============================================================================
// Custom Report Types
// ============================================================================

/**
 * Custom report template
 */
export const CustomReportTemplateSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	description: z.string().optional(),
	version: z.string().min(1),
	fields: z.array(
		z.object({
			name: z.string().min(1),
			type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
			required: z.boolean().default(false),
			description: z.string().optional(),
			validation: z.record(z.unknown()).optional(),
		})
	),
	filters: z.array(
		z.object({
			field: z.string().min(1),
			operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
			value: z.unknown(),
			required: z.boolean().default(false),
		})
	),
	aggregations: z
		.array(
			z.object({
				field: z.string().min(1),
				operation: z.enum(['count', 'sum', 'avg', 'min', 'max', 'distinct']),
				groupBy: z.string().optional(),
			})
		)
		.optional(),
	sorting: z
		.array(
			z.object({
				field: z.string().min(1),
				direction: z.enum(['asc', 'desc']),
			})
		)
		.optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
})
export type CustomReportTemplate = z.infer<typeof CustomReportTemplateSchema>

/**
 * Custom report parameters
 */
export const CustomReportParamsSchema = z.object({
	templateId: z.string().optional(),
	name: z.string().min(1),
	template: CustomReportTemplateSchema.optional(),
	criteria: ReportCriteriaSchema,
	parameters: z.record(z.unknown()).optional(),
	format: ReportFormatSchema.default('json'),
	includeRawData: z.boolean().default(false),
	maxRecords: z.number().int().min(1).max(1000000).optional(),
})
export type CustomReportParams = z.infer<typeof CustomReportParamsSchema>

/**
 * Custom report
 */
export const CustomReportSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.literal('custom'),
	templateId: z.string().optional(),
	generatedAt: z.string().datetime(),
	criteria: ReportCriteriaSchema,
	parameters: z.record(z.unknown()).optional(),
	data: z.array(z.record(z.unknown())),
	summary: z.record(z.unknown()),
	aggregations: z.record(z.unknown()).optional(),
	metadata: ReportMetadataSchema,
	downloadUrl: z.string().url().optional(),
	expiresAt: z.string().datetime().optional(),
})
export type CustomReport = z.infer<typeof CustomReportSchema>

// ============================================================================
// GDPR Data Export Types
// ============================================================================

/**
 * GDPR export parameters
 */
export const GdprExportParamsSchema = z.object({
	organizationId: z.string().min(1),
	dataSubjectId: z.string().min(1),
	dataSubjectType: z.enum(['user', 'customer', 'employee', 'contact']).default('user'),
	includePersonalData: z.boolean().default(true),
	includePseudonymizedData: z.boolean().default(false),
	includeMetadata: z.boolean().default(true),
	dateRange: DateRangeFilterSchema.optional(),
	format: z.enum(['json', 'xml', 'csv']).default('json'),
	encryption: z
		.object({
			enabled: z.boolean(),
			algorithm: z.string().optional(),
			publicKey: z.string().optional(),
		})
		.optional(),
	deliveryMethod: z.enum(['download', 'email', 'secure_link']).default('download'),
	recipientEmail: z.string().email().optional(),
})
export type GdprExportParams = z.infer<typeof GdprExportParamsSchema>

/**
 * GDPR export result
 */
export const GdprExportResultSchema = z.object({
	exportId: z.string(),
	dataSubjectId: z.string().min(1),
	status: z.enum(['pending', 'processing', 'completed', 'failed']),
	recordCount: z.number().int().min(0),
	dataSize: z.number().int().min(0),
	format: z.enum(['json', 'xml', 'csv']),
	exportTimestamp: z.string().datetime(),
	downloadUrl: z.string().url().optional(),
	expiresAt: z.string().datetime().optional(),
	deliveryStatus: z
		.object({
			method: z.enum(['download', 'email', 'secure_link']),
			delivered: z.boolean(),
			deliveredAt: z.string().datetime().optional(),
			attempts: z.number().int().min(0),
			lastAttempt: z.string().datetime().optional(),
			error: z.string().optional(),
		})
		.optional(),
	metadata: z
		.object({
			encryption: z.boolean().optional(),
			checksum: z.string().optional(),
			categories: z.array(z.string()).optional(),
			sources: z.array(z.string()).optional(),
		})
		.optional(),
})
export type GdprExportResult = z.infer<typeof GdprExportResultSchema>

/**
 * Integrity verification failure details
 */
export const IntegrityFailureSchema = z.object({
	eventId: z.string(),
	timestamp: z.string().datetime(),
	expectedHash: z.string(),
	actualHash: z.string(),
	hashAlgorithm: z.string(),
	failureReason: z.string(),
	severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
})
export type IntegrityFailure = z.infer<typeof IntegrityFailureSchema>

/**
 * Audit trail verification report
 */
export const IntegrityVerificationReportSchema = z.object({
	verificationId: z.string(),
	verifiedAt: z.string().datetime(),
	verifiedBy: z.string().optional(),
	results: z.object({
		totalEvents: z.number().int().min(0),
		verifiedEvents: z.number().int().min(0),
		failedVerifications: z.number().int().min(0),
		unverifiedEvents: z.number().int().min(0),
		verificationRate: z.number().min(0).max(100),
	}),
	failures: z.array(IntegrityFailureSchema),
	statistics: z.object({
		hashAlgorithms: z.record(z.string(), z.number()),
		verificationLatency: z.object({
			average: z.number().min(0),
			median: z.number().min(0),
			p95: z.number().min(0),
		}),
	}),
})
export type IntegrityVerificationReport = z.infer<typeof IntegrityVerificationReportSchema>

/**
 * Suspicious pattern detection result
 */
export const SuspiciousPatternSchema = z.object({
	patternType: z.string(),
	description: z.string(),
	events: z.array(ComplianceReportEventSchema),
	riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
	recommendation: z.string(),
})
export type SuspiciousPattern = z.infer<typeof SuspiciousPatternSchema>

// ============================================================================
// Pseudonymization Types
// ============================================================================

/**
 * Pseudonymization method
 */
export const PseudonymizationMethodSchema = z.enum([
	'hash',
	'encryption',
	'tokenization',
	'masking',
	'generalization',
	'suppression',
])
export type PseudonymizationMethod = z.infer<typeof PseudonymizationMethodSchema>

/**
 * Pseudonymization parameters
 */
export const PseudonymizationParamsSchema = z.object({
	organizationId: z.string().min(1),
	dataSubjectIds: z.array(z.string().min(1)),
	method: PseudonymizationMethodSchema,
	fields: z.array(z.string().min(1)).optional(),
	preserveFormat: z.boolean().default(false),
	reversible: z.boolean().default(false),
	keyId: z.string().optional(),
	algorithm: z.string().optional(),
	dateRange: DateRangeFilterSchema.optional(),
	dryRun: z.boolean().default(false),
})
export type PseudonymizationParams = z.infer<typeof PseudonymizationParamsSchema>

/**
 * Pseudonymization result
 */
export const PseudonymizationResultSchema = z.object({
	requestId: z.string(),
	status: z.enum(['pending', 'processing', 'completed', 'failed']),
	method: PseudonymizationMethodSchema,
	processingTime: z.number().min(0),
	reversible: z.boolean(),
	keyId: z.string().optional(),
	completedAt: z.string().datetime().optional(),
	summary: z.object({
		totalRecords: z.number().int().min(0),
		processedRecords: z.number().int().min(0),
		failedRecords: z.number().int().min(0),
		affectedFields: z.array(z.string()),
	}),
	errors: z
		.array(
			z.object({
				recordId: z.string(),
				field: z.string(),
				error: z.string(),
			})
		)
		.optional(),
	metadata: z
		.object({
			originalDataHash: z.string().optional(),
			pseudonymizedDataHash: z.string().optional(),
			mappingTableId: z.string().optional(),
		})
		.optional(),
})
export type PseudonymizationResult = z.infer<typeof PseudonymizationResultSchema>

// ============================================================================
// Report Template Types
// ============================================================================

/**
 * Report template
 */
export const ReportTemplateSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	description: z.string().optional(),
	category: z.string().min(1),
	type: ReportTypeSchema,
	version: z.string().min(1),
	isDefault: z.boolean().default(false),
	outputFormats: z.enum(['pdf', 'html', 'csv', 'json', 'xml']).default('pdf'),
	configuration: z.object({
		sections: z.array(
			z.object({
				id: z.string().min(1),
				title: z.string().min(1),
				description: z.string().optional(),
				required: z.boolean().default(true),
				fields: z.array(z.string().min(1)),
				filters: z.record(z.unknown()).optional(),
			})
		),
		formatting: z
			.object({
				includeHeader: z.boolean().default(true),
				includeFooter: z.boolean().default(true),
				includeToc: z.boolean().default(true),
				pageNumbers: z.boolean().default(true),
				watermark: z.string().optional(),
			})
			.optional(),
		branding: z
			.object({
				logo: z.string().url().optional(),
				colors: z.record(z.string()).optional(),
				fonts: z.record(z.string()).optional(),
			})
			.optional(),
	}),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	createdBy: z.string().min(1),
})
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for HIPAA reports
 */
export const isHIPAAReport = (value: unknown): value is HIPAAReport => {
	return HIPAAReportSchema.safeParse(value).success
}

/**
 * Type guard for GDPR reports
 */
export const isGDPRReport = (value: unknown): value is GDPRReport => {
	return GDPRReportSchema.safeParse(value).success
}

/**
 * Type guard for custom reports
 */
export const isCustomReport = (value: unknown): value is CustomReport => {
	return CustomReportSchema.safeParse(value).success
}

/**
 * Type guard for report criteria
 */
export const isReportCriteria = (value: unknown): value is ReportCriteria => {
	return ReportCriteriaSchema.safeParse(value).success
}

/**
 * Type guard for GDPR export parameters
 */
export const isGdprExportParams = (value: unknown): value is GdprExportParams => {
	return GdprExportParamsSchema.safeParse(value).success
}

/**
 * Type guard for pseudonymization parameters
 */
export const isPseudonymizationParams = (value: unknown): value is PseudonymizationParams => {
	return PseudonymizationParamsSchema.safeParse(value).success
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates report criteria
 */
export const validateReportCriteria = (data: unknown) => {
	return ReportCriteriaSchema.safeParse(data)
}

/**
 * Validates GDPR export parameters
 */
export const validateGdprExportParams = (data: unknown) => {
	return GdprExportParamsSchema.safeParse(data)
}

/**
 * Validates pseudonymization parameters
 */
export const validatePseudonymizationParams = (data: unknown) => {
	return PseudonymizationParamsSchema.safeParse(data)
}

/**
 * Validates custom report parameters
 */
export const validateCustomReportParams = (data: unknown) => {
	return CustomReportParamsSchema.safeParse(data)
}

/**
 * Validates report template
 */
export const validateReportTemplate = (data: unknown) => {
	return ReportTemplateSchema.safeParse(data)
}
