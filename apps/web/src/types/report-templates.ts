import z from 'zod'

export const reportTemplate = z.object({
	name: z.string(),
	description: z.string().optional(),
	reportType: z.enum([
		'HIPAA_AUDIT_TRAIL',
		'GDPR_PROCESSING_ACTIVITIES',
		'GENERAL_COMPLIANCE',
		'INTEGRITY_VERIFICATION',
	]),
	defaultCriteria: z.object({
		principalIds: z.array(z.string()).optional(), // Filter by organization
		organizationIds: z.array(z.string()).optional(), // Filter by specific principals/users
		actions: z.array(z.string()).optional(), // Filter by specific actions
		dataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])).optional(), //  Filter by data classification levels
		statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(), // Filter by event status
		resourceTypes: z.array(z.string()).optional(), // Filter by resource types
		verifiedOnly: z.boolean().optional(), // Include only events with integrity verification
		includeIntegrityFailures: z.boolean().optional(), // Include failed integrity checks
		limit: z.number().optional(), // Maximum number of events to include
		offset: z.number().optional(), // Offset for pagination
	}),
	defaultFormat: z.enum(['json', 'csv', 'xml', 'pdf']).default('json'),
	defaultExportConfig: z.object({
		format: z.enum(['json', 'csv', 'xml', 'pdf']).default('json'),
		includeMetadata: z.boolean().optional(),
		includeIntegrityReport: z.boolean().optional(),
		compression: z.enum(['none', 'gzip', 'zip']).optional(),
		encryption: z
			.object({
				enabled: z.boolean(),
				algorithm: z.string().optional(),
				keyId: z.string().optional(),
			})
			.optional(),
	}),
	tags: z.array(z.string()),
	isActive: z.boolean(),
})

export type ReportTemplateData = z.infer<typeof reportTemplate>

export type ReportTemplate = ReportTemplateData & {
	id: string
	organizationId: string
	createdAt: Date
	updatedAt: Date
	createdBy: string
	updatedBy: string
}
