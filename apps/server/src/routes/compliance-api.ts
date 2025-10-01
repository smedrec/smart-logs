/**
 * @fileoverview Compliance API Routes
 *
 * Provides REST API endpoints for compliance reporting and data export:
 * - Generate compliance reports (HIPAA, GDPR, General)
 * - Export audit data in multiple formats
 * - Manage scheduled reports
 * - Verify audit trail integrity
 *
 * Requirements: 4.1, 4.4, 8.1
 */

import { ApiError } from '@/lib/errors'
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { DEFAULT_VALIDATION_CONFIG } from '@repo/audit'

import type { HonoEnv } from '@/lib/hono/context'

// Zod schemas for request/response validation
const ReportCriteriaSchema = z.object({
	startDate: z.string().datetime().optional(),
	endDate: z.string().datetime().optional(),
	principalIds: z.array(z.string()).optional(),
	organizationIds: z.array(z.string()).optional(),
	actions: z.array(z.string()).optional(),
	statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
	dataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])).optional(),
	resourceTypes: z.array(z.string()).optional(),
})

const ExportConfigSchema = z.object({
	format: z.enum(['json', 'csv', 'pdf', 'xml']),
	includeMetadata: z.boolean().optional(),
	compression: z.enum(['none', 'gzip', 'zip']).optional(),
	encryption: z
		.object({
			enabled: z.boolean(),
			algorithm: z.string().optional(),
		})
		.optional(),
})

const AuditPresetSchema = z.object({
	name: z.string().min(1).max(50),
	description: z.string().max(200).optional(),
	organizationId: z.string(),
	action: z.string().min(1).max(100),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	requiredFields: z.array(z.string()),
	defaultValues: z.record(z.string(), z.any()).optional(),
	validation: z
		.object({
			maxStringLength: z.number(),
			allowedDataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])),
			requiredFields: z.array(z.string()),
			maxCustomFieldDepth: z.number(),
			allowedEventVersions: z.array(z.string()),
		})
		.optional(),
})

const AuditPresetCreateSchema = z.object({
	name: z.string().min(1).max(50),
	description: z.string().max(200).optional(),
	action: z.string().min(1).max(100),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	requiredFields: z.array(z.string()).optional(),
	defaultValues: z.record(z.string(), z.any()).optional(),
	validation: z
		.object({
			maxStringLength: z.number(),
			allowedDataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])),
			requiredFields: z.array(z.string()),
			maxCustomFieldDepth: z.number(),
			allowedEventVersions: z.array(z.string()),
		})
		.optional(),
})

const AuditPresetResponseSchema = AuditPresetSchema.extend({
	id: z.string().optional(),
	createdBy: z.string(),
	createdAt: z.string(),
})

const IntegrityReportSchema = z.object({
	verificationId: z.string(),
	verifiedAt: z.string(),
	verifiedBy: z.string().optional(),
	results: z.object({
		totalEvents: z.number(),
		verifiedEvents: z.number(),
		failedVerifications: z.number(),
		unverifiedEvents: z.number(),
		verificationRate: z.number(),
	}),
	failures: z.array(
		z.object({
			eventId: z.number(),
			timestamp: z.string(),
			expectedHash: z.string(),
			actualHash: z.string(),
			hashAlgorithm: z.string(),
			failureReason: z.string(),
			severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
		})
	),
	statistics: z.object({
		hashAlgorithms: z.record(z.string(), z.number()),
		verificationLatency: z.object({
			average: z.number(),
			median: z.number(),
			p95: z.number(),
		}),
	}),
})

const ComplianceReportSchema = z.object({
	metadata: z.object({
		reportId: z.string().uuid(),
		reportType: z.string(),
		generatedAt: z.string(),
		generatedBy: z.string().optional(),
		criteria: ReportCriteriaSchema,
		totalEvents: z.number(),
	}),
	summary: z.object({
		eventsByStatus: z.record(z.string(), z.number()),
		eventsByAction: z.record(z.string(), z.number()),
		eventsByDataClassification: z.record(z.string(), z.number()),
		uniquePrincipals: z.number(),
		uniqueResources: z.number(),
		integrityViolations: z.number(),
		timeRange: z.object({
			earliest: z.string(),
			latest: z.string(),
		}),
	}),
	events: z.array(
		z.object({
			id: z.number().optional(),
			timestamp: z.string(),
			principalId: z.string().optional(),
			organizationId: z.string().optional(),
			action: z.string(),
			targetResourceType: z.string().optional(),
			targetResourceId: z.string().optional(),
			status: z.string(),
			outcomeDescription: z.string().optional(),
			dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']).optional(),
			sessionContext: z
				.object({
					ipAddress: z.string().optional(),
					userAgent: z.string().optional(),
					sessionId: z.string().optional(),
				})
				.optional(),
			integrityStatus: z.enum(['verified', 'failed', 'not_checked']).optional(),
			correlationId: z.string().optional(),
		})
	),
	integrityReport: IntegrityReportSchema.optional(),
})

const HIPAAComplianceReportSchema = ComplianceReportSchema.extend({
	reportType: z.literal('HIPAA_AUDIT_TRAIL'),
	hipaaSpecific: z.object({
		phiAccessEvents: z.number(),
		phiModificationEvents: z.number(),
		unauthorizedAttempts: z.number(),
		emergencyAccess: z.number(),
		breakGlassEvents: z.number(),
		minimumNecessaryViolations: z.number(),
	}),
	riskAssessment: z.object({
		highRiskEvents: z.array(
			z.object({
				id: z.number().optional(),
				timestamp: z.string(),
				principalId: z.string().optional(),
				organizationId: z.string().optional(),
				action: z.string(),
				targetResourceType: z.string().optional(),
				targetResourceId: z.string().optional(),
				status: z.string(),
				outcomeDescription: z.string().optional(),
				dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']).optional(),
				sessionContext: z
					.object({
						ipAddress: z.string().optional(),
						userAgent: z.string().optional(),
						sessionId: z.string().optional(),
					})
					.optional(),
				integrityStatus: z.enum(['verified', 'failed', 'not_checked']).optional(),
				correlationId: z.string().optional(),
			})
		),
		suspiciousPatterns: z.array(
			z.object({
				patternType: z.string(),
				description: z.string(),
				events: z.array(
					z.object({
						id: z.number().optional(),
						timestamp: z.string(),
						principalId: z.string().optional(),
						organizationId: z.string().optional(),
						action: z.string(),
						targetResourceType: z.string().optional(),
						targetResourceId: z.string().optional(),
						status: z.string(),
						outcomeDescription: z.string().optional(),
						dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']).optional(),
						sessionContext: z
							.object({
								ipAddress: z.string().optional(),
								userAgent: z.string().optional(),
								sessionId: z.string().optional(),
							})
							.optional(),
						integrityStatus: z.enum(['verified', 'failed', 'not_checked']).optional(),
						correlationId: z.string().optional(),
					})
				),
				riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
				recommendation: z.string(),
			})
		),
		recommendations: z.array(z.string()),
	}),
})

const GDPRComplianceReportSchema = ComplianceReportSchema.extend({
	reportType: z.literal('GDPR_PROCESSING_ACTIVITIES'),
	gdprSpecific: z.object({
		personalDataEvents: z.number(),
		dataSubjectRights: z.number(),
		consentEvents: z.number(),
		dataBreaches: z.number(),
		crossBorderTransfers: z.number(),
		retentionViolations: z.number(),
	}),
	legalBasisBreakdown: z.record(z.string(), z.number()),
	dataSubjectRights: z.object({
		accessRequests: z.number(),
		rectificationRequests: z.number(),
		erasureRequests: z.number(),
		portabilityRequests: z.number(),
		objectionRequests: z.number(),
	}),
})

// Route definitions
const generateHIPAAReportRoute = createRoute({
	method: 'post',
	path: '/reports/hipaa',
	tags: ['Compliance Reports'],
	summary: 'Generate HIPAA compliance report',
	description: 'Generates a HIPAA compliance report based on the provided criteria.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						criteria: ReportCriteriaSchema,
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'HIPAA report generated successfully',
			content: {
				'application/json': {
					schema: HIPAAComplianceReportSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const generateGDPRReportRoute = createRoute({
	method: 'post',
	path: '/reports/gdpr',
	tags: ['Compliance Reports'],
	summary: 'Generate GDPR compliance report',
	description: 'Generates a GDPR compliance report based on the provided criteria.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						criteria: ReportCriteriaSchema,
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'GDPR report generated successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						report: GDPRComplianceReportSchema,
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const generateIntegrityReportRoute = createRoute({
	method: 'post',
	path: '/reports/integrity',
	tags: ['Compliance Reports'],
	summary: 'Generate integrity verification report',
	description: 'Generates an integrity verification report for audit events.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						criteria: ReportCriteriaSchema,
						performVerification: z.boolean().optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Integrity report generated successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						report: IntegrityReportSchema,
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const exportReportRoute = createRoute({
	method: 'post',
	path: '/export/report',
	tags: ['Export'],
	summary: 'Export compliance report',
	description: 'Exports a compliance report in the specified format.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						report: z.any(), // Use z.any() to avoid union type issues
						config: ExportConfigSchema,
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Report exported successfully',
			content: {
				'application/octet-stream': {
					schema: z.string(),
				},
			},
			headers: z.object({
				'Content-Type': z.string(),
				'Content-Disposition': z.string(),
				'Content-Length': z.string(),
				'X-Export-ID': z.string(),
				'X-Checksum': z.string(),
			}),
		},
		...openApiErrorResponses,
	},
})

const getAuditPresetsRoute = createRoute({
	method: 'get',
	path: '/audit-presets',
	tags: ['Audit Presets'],
	summary: 'Get all audit presets',
	description: 'Retrieves all audit presets for the organization.',
	responses: {
		200: {
			description: 'Audit presets retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						presets: z.array(AuditPresetResponseSchema),
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

const createAuditPresetRoute = createRoute({
	method: 'post',
	path: '/audit-presets',
	tags: ['Audit Presets'],
	summary: 'Create audit preset',
	description: 'Creates a new audit preset for the organization.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: z.object({
						preset: AuditPresetCreateSchema,
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Audit preset created successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						preset: AuditPresetResponseSchema,
					}),
				},
			},
		},
		...openApiErrorResponses,
	},
})

/**
 * Create compliance API router
 */
export function createComplianceAPI(): OpenAPIHono<HonoEnv> {
	const app = new OpenAPIHono<HonoEnv>()
	// Generate HIPAA compliance report
	app.openapi(generateHIPAAReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { criteria } = c.req.valid('json')

			const criteriaWithOrganizationId = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [session.session.activeOrganizationId as string],
			}

			// Generate HIPAA report
			const report = await compliance.report.generateHIPAAReport(criteriaWithOrganizationId)

			logger.info(`Generated HIPAA report: ${report.metadata.reportId}`)

			return c.json(report, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to generate HIPAA report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Generate GDPR compliance report
	app.openapi(generateGDPRReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { criteria } = c.req.valid('json')

			const criteriaWithOrganizationId = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [session.session.activeOrganizationId as string],
			}

			// Generate GDPR report
			const report = await compliance.report.generateGDPRReport(criteriaWithOrganizationId)

			logger.info(`Generated GDPR report: ${report.metadata.reportId}`)

			return c.json(
				{
					success: true,
					report,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to generate GDPR report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Generate integrity verification report
	app.openapi(generateIntegrityReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { criteria, performVerification = true } = c.req.valid('json')

			const criteriaWithDateRange = {
				...criteria,
				dateRange: {
					startDate:
						criteria.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
					endDate: criteria.endDate || new Date().toISOString(),
				},
				organizationIds: [session.session.activeOrganizationId as string],
			}

			// Generate integrity verification report
			const report = await compliance.report.generateIntegrityVerificationReport(
				criteriaWithDateRange,
				performVerification
			)

			logger.info(`Generated integrity verification report: ${report.verificationId}`)

			return c.json(
				{
					success: true,
					report,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to generate integrity verification report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Export compliance report
	app.openapi(exportReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { report, config } = c.req.valid('json')

			const exportResult = await compliance.export.exportComplianceReport(report, config)

			logger.info(`Exported report: ${exportResult.exportId}`)

			// Set appropriate headers for file download
			c.header('Content-Type', exportResult.contentType)
			c.header('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
			c.header('Content-Length', exportResult.size.toString())
			c.header('X-Export-ID', exportResult.exportId)
			c.header('X-Checksum', exportResult.checksum)

			if (typeof exportResult.data === 'string') {
				return c.text(exportResult.data)
			} else {
				return c.json(exportResult.data)
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to export report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get all audit presets
	app.openapi(getAuditPresetsRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const organizationId = session.session.activeOrganizationId as string
			const presets = await compliance.preset.getPresets(organizationId)

			return c.json(
				{
					success: true,
					presets: presets.map((preset) => {
						const presetValidation = preset.validation ?? DEFAULT_VALIDATION_CONFIG
						const safeValidation = {
							maxStringLength:
								presetValidation.maxStringLength ?? DEFAULT_VALIDATION_CONFIG.maxStringLength,
							allowedDataClassifications:
								presetValidation.allowedDataClassifications ??
								DEFAULT_VALIDATION_CONFIG.allowedDataClassifications,
							requiredFields: Array.isArray(presetValidation.requiredFields)
								? presetValidation.requiredFields.map((field) => String(field))
								: DEFAULT_VALIDATION_CONFIG.requiredFields.map((field) => String(field)),
							maxCustomFieldDepth:
								presetValidation.maxCustomFieldDepth ??
								DEFAULT_VALIDATION_CONFIG.maxCustomFieldDepth,
							allowedEventVersions:
								presetValidation.allowedEventVersions ??
								DEFAULT_VALIDATION_CONFIG.allowedEventVersions,
						}
						return {
							...preset,
							createdBy: (preset as any).createdBy || 'system',
							createdAt: (preset as any).createdAt || new Date().toISOString(),
							validation: safeValidation,
						}
					}),
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get all audit presets: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Create audit preset
	app.openapi(createAuditPresetRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { preset } = c.req.valid('json')
			const userId = session.session.userId
			const organizationId = session.session.activeOrganizationId as string

			const {
				name,
				description,
				action,
				dataClassification,
				requiredFields,
				defaultValues,
				validation,
			} = preset

			const newPreset = await compliance.preset.createPreset({
				name,
				description,
				organizationId,
				action,
				dataClassification,
				requiredFields: requiredFields || [],
				defaultValues,
				validation: validation || DEFAULT_VALIDATION_CONFIG,
				createdBy: userId,
			})

			logger.info(`Created audit preset: ${preset.name}`)

			// Ensure validation matches schema (all required fields present)
			const presetValidation = newPreset.validation ?? DEFAULT_VALIDATION_CONFIG
			const safeValidation = {
				maxStringLength:
					presetValidation.maxStringLength ?? DEFAULT_VALIDATION_CONFIG.maxStringLength,
				allowedDataClassifications:
					presetValidation.allowedDataClassifications ??
					DEFAULT_VALIDATION_CONFIG.allowedDataClassifications,
				requiredFields: Array.isArray(presetValidation.requiredFields)
					? presetValidation.requiredFields.map((field) => String(field))
					: DEFAULT_VALIDATION_CONFIG.requiredFields.map((field) => String(field)),
				maxCustomFieldDepth:
					presetValidation.maxCustomFieldDepth ?? DEFAULT_VALIDATION_CONFIG.maxCustomFieldDepth,
				allowedEventVersions:
					presetValidation.allowedEventVersions ?? DEFAULT_VALIDATION_CONFIG.allowedEventVersions,
			}

			return c.json(
				{
					success: true,
					preset: {
						...newPreset,
						createdBy: userId,
						createdAt: new Date().toISOString(),
						validation: safeValidation,
					},
				},
				201
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to create audit preset: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
