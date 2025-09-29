import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { createCollection, createOptimisticAction } from '@tanstack/react-db'
import { z } from 'zod'

const AlertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const AlertTypeSchema = z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM'])

const AlertSchema = z.object({
	id: z.string(),
	organization_id: z.string(),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	title: z.string().min(1),
	description: z.string(),
	source: z.string(),
	correlationId: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	acknowledged: z.string().default('false'),
	acknowledged_at: z.iso.datetime().optional(),
	acknowledged_by: z.string().optional(),
	resolved: z.string().default('false'),
	resolved_at: z.iso.datetime().optional(),
	resolved_by: z.string().optional(),
	resolutionNotes: z.string().optional(),
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
})

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
