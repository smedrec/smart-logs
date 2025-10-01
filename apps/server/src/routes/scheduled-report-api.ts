/**
 * @fileoverview Scheduled Report API Routes
 *
 * Provides REST API endpoints for scheduled reports:
 * - Manage scheduled reports
 *
 * Requirements: 4.1, 4.4, 8.1
 */

import { version } from 'os'
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
		method: z.enum(['email', 'webhook', 'storage']),
		email: z
			.object({
				smtpConfig: z.object({
					host: z.string(),
					port: z.number().int().min(1).max(65535),
					secure: z.boolean(),
					auth: z.object({
						user: z.string(),
						pass: z.string(),
					}),
				}),
				from: z.string().email(),
				subject: z.string().optional(),
				bodyTemplate: z.string().optional(),
				attachmentName: z.string().optional(),
				recipients: z.array(z.string().email()).optional(),
			})
			.optional(),
		webhook: z
			.object({
				url: z.string().url(),
				method: z.enum(['POST', 'PUT']),
				headers: z.record(z.string(), z.string()).optional(),
				timeout: z.number().int().min(1).max(300).optional(),
				retryConfig: z.object({
					maxRetries: z.number().int().min(0).max(10),
					backoffDelay: z.number().int().min(100).max(10000),
					backoffMultiplier: z.number().int().min(1).max(10),
					maxBackoffDelay: z.number().int().min(100).max(10000),
				}),
			})
			.optional(),
		storage: z
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
		compression: z.enum(['none', 'gzip', 'zip']).optional(),
		encryption: z.boolean().optional(),
		encryptionKey: z.string().optional(),
		retentionDays: z.number().optional(),
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

const ListScheduledReportsParamsSchema = z.object({
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
	dateRange: z
		.object({
			field: z.enum(['created_at', 'updated_at', 'last_run', 'next_run']),
			startDate: z.string().datetime(),
			endDate: z.string().datetime(),
		})
		.optional(),
	pagination: z
		.object({
			limit: z.number().int().min(1).max(1000).default(50),
			offset: z.number().int().min(0).default(0),
		})
		.optional(),
	sort: z
		.object({
			field: z.enum([
				'name',
				'created_at',
				'updated_at',
				'last_run',
				'next_run',
				'execution_count',
			]),
			direction: z.enum(['asc', 'desc']).default('desc'),
		})
		.optional(),
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

		const params = c.req.valid('query')

		logger.info(`Getting scheduled reports: ${JSON.stringify(params)}`)

		try {
			const scheduledReports = await compliance.scheduled.getScheduledReports(
				session.session.activeOrganizationId as string,
				{ ...params }
			)

			const response = performance.createPaginatedResponse(scheduledReports, params.pagination)

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
