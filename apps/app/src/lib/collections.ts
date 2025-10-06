import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { createCollection, createOptimisticAction } from '@tanstack/react-db'
import { z } from 'zod'

const AlertSeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const AlertTypeSchema = z.enum([
	'SECURITY',
	'COMPLIANCE',
	'PERFORMANCE',
	'SYSTEM',
	'METRICS',
	'CUSTOM',
])
const AlertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'dismissed'])

const AlertSchema = z.object({
	id: z.string(),
	organization_id: z.string(),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	title: z.string().min(1),
	description: z.string(),
	source: z.string(),
	status: AlertStatusSchema,
	correlationId: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	acknowledged: z.string().default('false'),
	acknowledged_at: z.iso.datetime().optional(),
	acknowledged_by: z.string().optional(),
	resolved: z.string().default('false'),
	resolved_at: z.iso.datetime().optional(),
	resolved_by: z.string().optional(),
	resolution_notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
})

const ExecutionSchema = z.object({
	id: z.string(),
	scheduled_report_id: z.string(),
	organization_id: z.string(),
	run_id: z.string(),
	scheduled_time: z.iso.datetime(),
	execution_time: z.iso.datetime().optional(),
	status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
	trigger: z.enum(['SCHEDULE', 'MANUAL']),
	duration: z.number().optional(),
	records_processed: z.number().optional(),
	export_results: z.string().optional(),
	integrity_report: z.string().optional(),
	delivery_attempts: z.array(z.unknown()).optional(),
	created_at: z.iso.datetime(),
})

export type Execution = z.infer<typeof ExecutionSchema>

export type Alert = z.infer<typeof AlertSchema>

export const recentAlertsCollection = (activeOrganizationId: string) =>
	createCollection(
		electricCollectionOptions({
			id: 'sync-recent-alerts',
			shapeOptions: {
				url: 'https://electric.smedrec.qzz.io/v1/shape',
				params: {
					table: 'alerts',
					where: `
          organization_id = '${activeOrganizationId}'
        `,
				},
			},
			getKey: (item) => item.id,
			schema: AlertSchema,
		})
	)

export const recentExecutionsCollection = (activeOrganizationId: string) =>
	createCollection(
		electricCollectionOptions({
			id: 'sync-recent-executions',
			shapeOptions: {
				url: 'https://electric.smedrec.qzz.io/v1/shape',
				params: {
					table: 'report_executions',
					where: `
          organization_id = '${activeOrganizationId}'
        `,
				},
			},
			getKey: (item) => item.id,
			schema: ExecutionSchema,
		})
	)

type ResolveAlertInput = {
	id: string
	resolutionNotes: string
}
const resolveAlert = createOptimisticAction<ResolveAlertInput>({
	onMutate: (input) => {
		return {
			id: input.id,
			resolutionNotes: input.resolutionNotes,
		}
	},
	mutationFn: async (input, params) => {
		const response = await fetch(`/api/alerts/${input.id}/resolve`, {
			method: 'POST',
			body: JSON.stringify(input),
		})
		return response.json()
	},
})
