/**
 * @fileoverview Scheduled Report API Routes
 *
 * Provides REST API endpoints for scheduled reports:
 * - Manage scheduled reports
 *
 * Requirements: 4.1, 4.4, 8.1
 */

import { ApiError } from '@/lib/errors'
import { openApiErrorResponses } from '@/lib/errors/openapi_responses'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { HonoEnv } from '@/lib/hono/context'

// Simple schemas that work with OpenAPI
const CreateScheduledReportInputSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	reportType: z.enum([
		'HIPAA_AUDIT_TRAIL',
		'GDPR_PROCESSING_ACTIVITIES',
		'GENERAL_COMPLIANCE',
		'INTEGRITY_VERIFICATION',
	]),
	criteria: z.object({
		dateRange: z.object({
			startDate: z.string(),
			endDate: z.string(),
		}),
	}),
	format: z.enum(['json', 'csv', 'pdf', 'xml']),
	schedule: z.object({
		frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
		time: z.string(),
		timezone: z.string().optional(),
	}),
	delivery: z.object({
		method: z.enum(['email', 'webhook', 'storage']),
		recipients: z.array(z.string().email()).optional(),
	}),
	enabled: z.boolean().optional(),
	createdBy: z.string(),
})

const ScheduledReportSchema = CreateScheduledReportInputSchema.extend({
	id: z.string(),
	createdAt: z.string(),
	lastRun: z.string().optional(),
	nextRun: z.string().optional(),
})

const UpdateScheduledReportInputSchema = CreateScheduledReportInputSchema.partial().extend({
	updatedBy: z.string().optional(),
})

const ListScheduledReportsParamsSchema = z.object({
	enabled: z.boolean().optional(),
	reportType: z.string().optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(20),
})

const PaginatedScheduledReportsSchema = z.object({
	success: z.boolean(),
	scheduledReports: z.array(ScheduledReportSchema),
})

// Route definitions

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
					schema: CreateScheduledReportInputSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Scheduled report created successfully',
			content: {
				'application/json': {
					schema: ScheduledReportSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const getScheduledReportsRoute = createRoute({
	method: 'get',
	path: '/scheduled-reports',
	tags: ['Scheduled Reports'],
	summary: 'Get all scheduled reports',
	description: 'Retrieves all scheduled compliance reports.',
	request: {
		query: ListScheduledReportsParamsSchema,
	},
	responses: {
		200: {
			description: 'Scheduled reports retrieved successfully',
			content: {
				'application/json': {
					schema: PaginatedScheduledReportsSchema,
				},
			},
		},
		...openApiErrorResponses,
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
			id: z.string().startsWith('report-'),
		}),
	},
	responses: {
		200: {
			description: 'Scheduled report retrieved successfully',
			content: {
				'application/json': {
					schema: ScheduledReportSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const updateScheduledReportRoute = createRoute({
	method: 'put',
	path: '/scheduled-reports/{id}',
	tags: ['Scheduled Reports'],
	summary: 'Update scheduled report by ID',
	description: 'Updates a specific scheduled report by its ID.',
	request: {
		params: z.object({
			id: z.string(),
		}),
		body: {
			content: {
				'application/json': {
					schema: UpdateScheduledReportInputSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Scheduled report updated successfully',
			content: {
				'application/json': {
					schema: ScheduledReportSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const deleteScheduledReportRoute = createRoute({
	method: 'delete',
	path: '/scheduled-reports/{id}',
	tags: ['Scheduled Reports'],
	summary: 'Delete scheduled report by ID',
	description: 'Deletes a specific scheduled report by its ID.',
	request: {
		params: z.object({
			id: z.string().startsWith('report-'),
		}),
	},
	responses: {
		200: {
			description: 'Scheduled report deleted successfully',
			content: {
				'application/json': {
					schema: z.object({
						success: z.boolean(),
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
				enabled: true,
				format: 'json' as const,
				criteria: {
					...config.criteria,
					dateRange: {
						startDate:
							config.criteria.dateRange.startDate ||
							new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
						endDate: config.criteria.dateRange.endDate || new Date().toISOString(),
					},
				},
				export: {
					format: 'json' as const,
					filename: `${config.name}-report`,
				},
				createdBy: session.session.userId,
				organizationId: session.session.activeOrganizationId as string,
			}

			const scheduledReport =
				await compliance.scheduled.createScheduledReport(configWithOrganization)

			logger.info(`Created scheduled report: ${scheduledReport.id}`)

			return c.json(scheduledReport, 201)
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

			return c.json(
				{
					success: true,
					scheduledReports: scheduledReports,
				},
				200
			)
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

			// Ensure nextRun and createdAt are always present as strings
			const safeScheduledReport = {
				...scheduledReport,
				nextRun: scheduledReport.nextRun ?? new Date().toISOString(),
				createdAt: scheduledReport.createdAt ?? new Date().toISOString(),
			}

			return c.json(safeScheduledReport, 200)
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

	// Update scheduled report
	app.openapi(updateScheduledReportRoute, async (c) => {
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
			const config = c.req.valid('json')

			const scheduledReport = await compliance.scheduled.updateScheduledReport(id, config)

			logger.info(`Updated scheduled report: ${scheduledReport.id}`)

			return c.json(scheduledReport, 200)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to update scheduled report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	// Delete scheduled report
	app.openapi(deleteScheduledReportRoute, async (c) => {
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
			await compliance.scheduled.deleteScheduledReport(id)

			logger.info(`Deleted scheduled report: ${id}`)

			return c.json(
				{
					success: true,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to delete scheduled report: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
