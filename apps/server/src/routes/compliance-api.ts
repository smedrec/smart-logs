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

const ScheduledReportConfigSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'general', 'integrity']),
	criteria: ReportCriteriaSchema,
	schedule: z.object({
		frequency: z.enum(['daily', 'weekly', 'monthly']),
		time: z.string(),
		timezone: z.string().optional(),
	}),
	delivery: z.object({
		method: z.enum(['email', 'webhook', 'storage']),
		recipients: z.array(z.string()).optional(),
		webhookUrl: z.string().url().optional(),
		storageLocation: z.string().optional(),
	}),
	enabled: z.boolean().optional(),
})

const AuditPresetSchema = z.object({
	name: z.string().min(1).max(50),
	description: z.string().max(200).optional(),
	action: z.string().min(1).max(100),
	dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI']),
	requiredFields: z.array(z.string()).optional(),
	defaultValues: z.record(z.string(), z.any()).optional(),
	validation: z
		.object({
			enabled: z.boolean(),
			rules: z
				.array(
					z.object({
						field: z.string(),
						type: z.enum(['required', 'format', 'range']),
						value: z.any(),
					})
				)
				.optional(),
		})
		.optional(),
})

const ComplianceReportSchema = z.object({
	metadata: z.object({
		reportId: z.string().uuid(),
		reportType: z.string(),
		generatedAt: z.string().datetime(),
		criteria: ReportCriteriaSchema,
		organizationId: z.string(),
	}),
	summary: z.object({
		totalEvents: z.number(),
		complianceScore: z.number(),
		violations: z.number(),
		recommendations: z.array(z.string()),
	}),
	sections: z.array(
		z.object({
			title: z.string(),
			content: z.any(),
		})
	),
})

const IntegrityReportSchema = z.object({
	verificationId: z.string().uuid(),
	timestamp: z.string().datetime(),
	criteria: ReportCriteriaSchema,
	results: z.object({
		totalEvents: z.number(),
		verifiedEvents: z.number(),
		failedVerifications: z.number(),
		integrityScore: z.number(),
	}),
	details: z.array(
		z.object({
			eventId: z.string(),
			status: z.enum(['verified', 'failed', 'missing']),
			details: z.string().optional(),
		})
	),
})

const ErrorResponseSchema = z.object({
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.any()).optional(),
	timestamp: z.string().datetime(),
	requestId: z.string(),
	path: z.string().optional(),
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
					schema: ComplianceReportSchema,
				},
			},
		},
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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
						report: ComplianceReportSchema,
					}),
				},
			},
		},
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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
						report: ComplianceReportSchema,
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
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const createScheduledReportRoute = createRoute({
	method: 'post',
	path: '/scheduled-reports',
	tags: ['Scheduled Reports'],
	summary: 'Create scheduled report',
	description: 'Creates a new scheduled compliance report.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: ScheduledReportConfigSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Scheduled report created successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						scheduledReport: ScheduledReportConfigSchema.extend({
							id: z.string().uuid(),
							createdAt: z.string().datetime(),
							nextRun: z.string().datetime(),
						}),
					}),
				},
			},
		},
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const getScheduledReportsRoute = createRoute({
	method: 'get',
	path: '/scheduled-reports',
	tags: ['Scheduled Reports'],
	summary: 'Get all scheduled reports',
	description: 'Retrieves all scheduled compliance reports.',
	responses: {
		200: {
			description: 'Scheduled reports retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						scheduledReports: z.array(
							ScheduledReportConfigSchema.extend({
								id: z.string().uuid(),
								createdAt: z.string().datetime(),
								nextRun: z.string().datetime(),
							})
						),
					}),
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

const getScheduledReportRoute = createRoute({
	method: 'get',
	path: '/scheduled-reports/{id}',
	tags: ['Scheduled Reports'],
	summary: 'Get scheduled report by ID',
	description: 'Retrieves a specific scheduled report by its ID.',
	request: {
		params: z.object({
			id: z.string().uuid(),
		}),
	},
	responses: {
		200: {
			description: 'Scheduled report retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
						scheduledReport: ScheduledReportConfigSchema.extend({
							id: z.string().uuid(),
							createdAt: z.string().datetime(),
							nextRun: z.string().datetime(),
						}),
					}),
				},
			},
		},
		404: {
			description: 'Scheduled report not found',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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
						presets: z.array(
							AuditPresetSchema.extend({
								organizationId: z.string(),
								createdBy: z.string(),
								createdAt: z.string().datetime(),
							})
						),
					}),
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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
						preset: AuditPresetSchema,
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
						preset: AuditPresetSchema.extend({
							organizationId: z.string(),
							createdBy: z.string(),
							createdAt: z.string().datetime(),
						}),
					}),
				},
			},
		},
		400: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
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

			return c.json(report)
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

			return c.json({
				success: true,
				report,
			})
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

			return c.json({
				success: true,
				report,
			})
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

			// Export the report
			const exportResult = await compliance.export.exportComplianceReport(report, config)

			logger.info(`Exported report: ${exportResult.exportId}`)

			// Set appropriate headers for file download
			c.header('Content-Type', exportResult.contentType)
			c.header('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
			c.header('Content-Length', exportResult.size.toString())
			c.header('X-Export-ID', exportResult.exportId)
			c.header('X-Checksum', exportResult.checksum)

			return c.body(exportResult.data)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to export report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Create scheduled report
	app.openapi(createScheduledReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const config = c.req.valid('json')

			const configWithOrganization = {
				...config,
				organizationId: session.session.activeOrganizationId as string,
			}

			const scheduledReport =
				await compliance.scheduled.createScheduledReport(configWithOrganization)

			logger.info(`Created scheduled report: ${scheduledReport.id}`)

			return c.json(
				{
					success: true,
					scheduledReport,
				},
				201
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to create scheduled report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get all scheduled reports
	app.openapi(getScheduledReportsRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const scheduledReports = await compliance.scheduled.getScheduledReports()

			return c.json({
				success: true,
				scheduledReports,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get scheduled reports: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Get specific scheduled report
	app.openapi(getScheduledReportRoute, async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const scheduledReport = await compliance.scheduled.getScheduledReport(id)

			if (!scheduledReport) {
				throw new ApiError({
					code: 'NOT_FOUND',
					message: 'Scheduled report not found',
				})
			}

			return c.json({
				success: true,
				scheduledReport,
			})
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get scheduled report: ${message}`)

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

			return c.json({
				success: true,
				presets,
			})
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
				requiredFields,
				defaultValues,
				validation: validation || DEFAULT_VALIDATION_CONFIG,
				createdBy: userId,
			})

			logger.info(`Created audit preset: ${preset.name}`)

			return c.json(
				{
					success: true,
					preset: newPreset,
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
