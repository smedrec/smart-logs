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

import { PaginationParamsSchema, ReportTypeSchema } from './rest-api'

import type { HonoEnv } from '@/lib/hono/context'

// Schemas that work with OpenAPI
const CreateScheduledReportInputSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	templateId: z.string().optional(),
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
		organizationIds: z.array(z.string().min(1)).optional(),
		principalIds: z.array(z.string().min(1)).optional(),
		actions: z.array(z.string().min(1)).optional(),
		resourceTypes: z.array(z.string().min(1)).optional(),
		dataClassifications: z.array(z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PHI'])).optional(),
		statuses: z.array(z.enum(['attempt', 'success', 'failure'])).optional(),
		verifiedOnly: z.boolean().default(false).optional(),
		includeIntegrityFailures: z.boolean().default(true).optional(),
		//customFilters: z.record(z.string(), z.any()).optional(),
		limit: z.number().int().min(1).max(10000).optional(),
		offset: z.number().int().min(0).optional(),
		sortBy: z.enum(['timestamp', 'status']).optional(),
		sortOrder: z.enum(['asc', 'desc']).optional(),
	}),
	format: z.enum(['json', 'csv', 'pdf', 'xml', 'parquet', 'avro']),
	schedule: z.object({
		frequency: z.enum([
			'once',
			'hourly',
			'daily',
			'weekly',
			'monthly',
			'quarterly',
			'yearly',
			'custom',
		]),
		timezone: z.string().default('UTC'),
		hour: z.number().int().min(0).max(23),
		minute: z.number().int().min(0).max(59),
		skipWeekends: z.boolean().default(false),
		skipHolidays: z.boolean().default(false),
		catchUpMissedRuns: z.boolean().default(false),
		cronExpression: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
		dayOfWeek: z
			.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
			.optional(),
		dayOfMonth: z.number().int().min(1).max(31).optional(),
		monthOfYear: z.number().int().min(1).max(12).optional(),
		holidayCalendarId: z.string().optional(),
	}),
	delivery: z.object({
		destinations: z.union([z.array(z.string()), z.literal('default')]),
	}),
	export: z
		.object({
			storageType: z.enum(['s3', 'azure', 'gcs']),
			config: z.record(z.string(), z.any()),
			path: z.string(),
			retention: z.object({
				days: z.number().int().min(1).max(365),
				autoCleanup: z.boolean(),
			}),
		})
		.optional(),
	notification: z
		.object({
			recipients: z.array(z.string().email()),
			onSuccess: z.boolean(), //.default(false),
			onFailure: z.boolean(), //.default(true),
			onSkip: z.boolean(), //.default(false),
			includeReport: z.boolean(), //.default(false),
			customMessage: z.string().optional(),
		})
		.optional(),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

const ScheduledReportSchema = CreateScheduledReportInputSchema.extend({
	id: z.string(),
	organizationId: z.string(),
	createdAt: z.string(),
	createdBy: z.string(),
	lastRun: z.string().optional(),
	nextRun: z.string().optional(),
	version: z.number().int().min(1),
})

const UpdateScheduledReportInputSchema = CreateScheduledReportInputSchema.partial().extend({
	updatedBy: z.string().optional(),
})

const PaginatedScheduledReportsSchema = z.object({
	data: z.array(ScheduledReportSchema),
	pagination: z.object({
		total: z.number().int().min(0),
		limit: z.number().int().min(1),
		offset: z.number().int().min(0),
		hasNext: z.boolean(),
		hasPrevious: z.boolean(),
		nextCursor: z.string().optional(),
		previousCursor: z.string().optional(),
	}),
})

// Route definitions

const createScheduledReportRoute = createRoute({
	method: 'post',
	path: '/',
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
	path: '/',
	tags: ['Scheduled Reports'],
	summary: 'Get scheduled reports',
	description: 'Retrieves scheduled compliance reports.',
	request: {
		query: z.object({
			enabled: z.boolean().optional(),
			reportType: z
				.array(
					z.enum([
						'HIPAA_AUDIT_TRAIL',
						'GDPR_PROCESSING_ACTIVITIES',
						'GENERAL_COMPLIANCE',
						'INTEGRITY_VERIFICATION',
					])
				)
				.optional(),
			createdBy: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			search: z.string().optional(),
			rangeBy: z.enum(['created_at', 'updated_at', 'last_run', 'next_run']).optional(),
			startDate: z.string().datetime().optional(),
			endDate: z.string().datetime().optional(),
			limit: z.string().optional(),
			offset: z.string().optional(),
			sortBy: z
				.enum(['name', 'created_at', 'updated_at', 'last_run', 'next_run', 'execution_count'])
				.optional(),
			sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
		}),
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
	path: '/{id}',
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
	path: '/{id}',
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
	path: '/{id}',
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

const getExecutionHistoryRoute = createRoute({
	method: 'get',
	path: '/{id}/executions',
	tags: ['Scheduled Reports'],
	summary: 'Get execution history for a scheduled report',
	description: 'Retrieves the execution history for a specific scheduled report.',
	request: {
		params: z.object({
			id: z.string().startsWith('report-'),
		}),
		query: z.object({
			status: z
				.array(
					z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'timeout'])
				)
				.optional(),
			trigger: z.array(z.enum(['scheduled', 'manual', 'api', 'retry', 'catchup'])).optional(),
			startDate: z.string().datetime().optional(),
			endDate: z.string().datetime().optional(),
			limit: z.string().optional(),
			offset: z.string().optional(),
			sortBy: z.enum(['scheduled_time', 'execution_time', 'duration', 'status']).optional(),
			sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
		}),
	},
	responses: {
		200: {
			description: 'Execution history retrieved successfully',
			content: {
				'application/json': {
					schema: z.object({
						data: z.array(
							z.object({
								id: z.string().startsWith('execution-'),
								scheduledReportId: z.string(),
								status: z.enum([
									'pending',
									'running',
									'completed',
									'failed',
									'cancelled',
									'skipped',
									'timeout',
								]),
								trigger: z.enum(['scheduled', 'manual', 'api', 'retry', 'catchup']),
								scheduledTime: z.string().datetime(),
								executionTime: z.string().datetime().optional(),
								duration: z.number().min(0).optional(),
								reportId: z.string().optional(),
								recordsProcessed: z.number().int().min(0).optional(),
								deliveryId: z.string().optional(),
								error: z
									.object({
										code: z.string(),
										message: z.string(),
										details: z.record(z.string(), z.any()).optional(),
										stackTrace: z.string().optional(),
									})
									.optional(),
							})
						),
						pagination: z.object({
							total: z.number().int().min(0),
							limit: z.number().int().min(1),
							offset: z.number().int().min(0),
							hasNext: z.boolean(),
							hasPrevious: z.boolean(),
							nextCursor: z.string().optional(),
							previousCursor: z.string().optional(),
						}),
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
export function createscheduledReportAPI(): OpenAPIHono<HonoEnv> {
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
				criteria: {
					...config.criteria,
					dateRange: {
						startDate:
							config.criteria.dateRange.startDate ||
							new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
						endDate: config.criteria.dateRange.endDate || new Date().toISOString(),
					},
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
		const { compliance, performance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		const query = c.req.valid('query')
		const params = {
			...query,
			limit: query.limit ? parseInt(query.limit) : 50,
			offset: query.offset ? parseInt(query.offset) : 0,
		}

		try {
			const scheduledReports = await compliance.scheduled.getScheduledReports(
				session.session.activeOrganizationId as string,
				{ ...params }
			)

			const response = performance.createPaginatedResponse(scheduledReports, {
				limit: params.limit,
				offset: params.offset,
			})

			return c.json(
				{
					data: response.data,
					pagination: response.pagination,
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

			return c.json(scheduledReport, 200)
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

	// Get execution history
	app.openapi(getExecutionHistoryRoute, async (c) => {
		const { compliance, performance, logger } = c.get('services')
		const session = c.get('session')

		if (!session) {
			throw new ApiError({
				code: 'UNAUTHORIZED',
				message: 'Authentication required',
			})
		}

		try {
			const { id } = c.req.valid('param')
			const query = c.req.valid('query')
			const params = {
				...query,
				limit: query.limit ? parseInt(query.limit) : 50,
				offset: query.offset ? parseInt(query.offset) : 0,
			}

			logger.info(`Getting execution history for report: ${id}`)

			const executionHistory = await compliance.scheduled.getExecutionHistory(id, params.limit)

			const response = performance.createPaginatedResponse(executionHistory, {
				limit: params.limit,
				offset: params.offset,
			})

			return c.json(
				{
					data: response.data,
					pagination: response.pagination,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			logger.error(`Failed to get execution history: ${message}`)

			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
		}
	})

	return app
}
