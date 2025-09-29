/**
 * Report criteria interface for filtering compliance reports
 */
export interface ReportCriteria {
	dateRange: {
		startDate: string
		endDate: string
	}
	organizationIds?: string[]
	principalIds?: string[]
	resourceTypes?: string[]
	actions?: string[]
	dataClassifications?: ('PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI')[]
	statuses?: ('attempt' | 'success' | 'failure')[]
	includeDetails?: boolean
	includeMetadata?: boolean
}

/**
 * Report metadata interface
 */
export interface ReportMetadata {
	generatedBy: string
	generationTime: number
	queryExecutionTime: number
	totalRecordsProcessed: number
	filterCriteria: ReportCriteria
	reportVersion: string
	complianceFramework: string
}

/**
 * HIPAA report section interface
 */
export interface HIPAASection {
	sectionId: string
	title: string
	description: string
	requirements: string[]
	findings: {
		compliant: number
		nonCompliant: number
		details: Array<{
			eventId: string
			status: 'compliant' | 'non-compliant' | 'warning'
			description: string
			recommendation?: string
		}>
	}
	riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * HIPAA compliance report interface
 */
export interface HIPAAReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		complianceScore: number
		violations: number
		recommendations: string[]
		riskAssessment: {
			overallRisk: 'low' | 'medium' | 'high' | 'critical'
			riskFactors: string[]
		}
	}
	sections: HIPAASection[]
	metadata: ReportMetadata
}

/**
 * GDPR report section interface
 */
export interface GDPRSection {
	sectionId: string
	title: string
	description: string
	lawfulBasis: string[]
	findings: {
		dataSubjects: number
		processingActivities: number
		consentRecords: number
		details: Array<{
			eventId: string
			dataSubject: string
			processingPurpose: string
			lawfulBasis: string
			consentStatus: 'given' | 'withdrawn' | 'not-required'
			retentionPeriod?: string
		}>
	}
	complianceStatus: 'compliant' | 'non-compliant' | 'requires-attention'
}

/**
 * GDPR compliance report interface
 */
export interface GDPRReport {
	id: string
	generatedAt: string
	criteria: ReportCriteria
	summary: {
		totalEvents: number
		dataSubjects: number
		processingActivities: number
		lawfulBases: string[]
		consentManagement: {
			totalConsents: number
			activeConsents: number
			withdrawnConsents: number
		}
		dataRetention: {
			withinRetentionPeriod: number
			exceedsRetentionPeriod: number
		}
	}
	sections: GDPRSection[]
	metadata: ReportMetadata
}

/**
 * Custom report parameters interface
 */
export interface CustomReportParams {
	templateId: string
	name: string
	description?: string
	criteria: ReportCriteria
	parameters: Record<string, any>
	outputFormat: 'json' | 'csv' | 'pdf' | 'xlsx'
	includeCharts?: boolean
	customFields?: string[]
}

/**
 * Custom report interface
 */
export interface CustomReport {
	id: string
	name: string
	description?: string
	generatedAt: string
	template: string
	parameters: Record<string, any>
	data: any[]
	summary: Record<string, any>
	charts?: Array<{
		type: 'bar' | 'line' | 'pie' | 'scatter'
		title: string
		data: any[]
		config: Record<string, any>
	}>
	metadata: ReportMetadata
}

/**
 * GDPR data export parameters
 */
export interface GdprExportParams {
	dataSubjectId: string
	organizationId: string
	includePersonalData: boolean
	includePseudonymizedData: boolean
	includeMetadata: boolean
	format: 'json' | 'csv' | 'xml'
	dateRange?: {
		startDate: string
		endDate: string
	}
	categories?: string[]
}

/**
 * GDPR data export result
 */
export interface GdprExportResult {
	exportId: string
	dataSubjectId: string
	generatedAt: string
	format: string
	data: {
		personalData: Record<string, any>[]
		pseudonymizedData?: Record<string, any>[]
		metadata?: Record<string, any>
	}
	summary: {
		totalRecords: number
		categories: string[]
		dateRange: {
			startDate: string
			endDate: string
		}
	}
	downloadUrl?: string
	expiresAt: string
}

/**
 * Pseudonymization parameters
 */
export interface PseudonymizationParams {
	dataSubjectIds: string[]
	organizationId: string
	fields: string[]
	method: 'hash' | 'encrypt' | 'tokenize' | 'mask'
	preserveFormat?: boolean
	saltValue?: string
	dateRange?: {
		startDate: string
		endDate: string
	}
}

/**
 * Pseudonymization result
 */
export interface PseudonymizationResult {
	operationId: string
	processedAt: string
	method: string
	summary: {
		totalRecords: number
		processedRecords: number
		failedRecords: number
		affectedFields: string[]
	}
	mapping?: Record<string, string>
	errors?: Array<{
		recordId: string
		field: string
		error: string
	}>
}

/**
 * Report template interface
 */
export interface ReportTemplate {
	id: string
	name: string
	description: string
	category: 'hipaa' | 'gdpr' | 'custom' | 'security' | 'audit'
	version: string
	parameters: Array<{
		name: string
		type: 'string' | 'number' | 'boolean' | 'date' | 'array'
		required: boolean
		description: string
		defaultValue?: any
		options?: any[]
	}>
	outputFormats: ('json' | 'csv' | 'pdf' | 'xlsx')[]
	createdAt: string
	updatedAt: string
	isActive: boolean
}

/**
 * Report download options
 */
export interface ReportDownloadOptions {
	format: 'pdf' | 'csv' | 'json' | 'xlsx'
	includeCharts?: boolean
	includeMetadata?: boolean
	compression?: 'none' | 'gzip' | 'zip'
}
