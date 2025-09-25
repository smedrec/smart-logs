import { electricCollectionOptions } from '@tanstack/electric-db-collection'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { createCollection } from '@tanstack/react-db'
import { z } from 'zod'

import { auditClient } from './audit-client'
import { queryClient } from './query-client'

import type { AlertsParams } from '@smedrec/audit-client'

const AlertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const AlertTypeSchema = z.enum(['SECURITY', 'COMPLIANCE', 'PERFORMANCE', 'SYSTEM'])

const AlertSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	severity: AlertSeveritySchema,
	type: AlertTypeSchema,
	title: z.string().min(1),
	description: z.string(),
	source: z.string(),
	correlationId: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	acknowledged: z.boolean().default(false),
	acknowledgedAt: z.iso.datetime().optional(),
	acknowledgedBy: z.string().optional(),
	resolved: z.boolean().default(false),
	resolvedAt: z.iso.datetime().optional(),
	resolvedBy: z.string().optional(),
	resolutionNotes: z.string().optional(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
})

const queryAlertsCollection = createCollection(
	queryCollectionOptions({
		id: 'fetch-alerts',
		queryKey: ['alerts'],
		queryFn: async () => {
			const alertsWithPagination = await auditClient.metrics.getAlerts()
			return alertsWithPagination.alerts
		},
		getKey: (item) => item.id,
		schema: AlertSchema,
		queryClient,
	})
)

const recentAlertsCollection = createCollection(
	electricCollectionOptions({
		id: 'sync-recent-alerts',
		shapeOptions: {
			url: 'https://electric.smedrec.qzz.io/v1/shape',
			params: {
				table: 'alerts',
				where: `
          organization_id = '${currentUser.id}'
          AND
          inserted_at >= '2025-01-01'
        `,
			},
		},
		getKey: (item) => item.id,
		schema: AlertSchema,
	})
)
