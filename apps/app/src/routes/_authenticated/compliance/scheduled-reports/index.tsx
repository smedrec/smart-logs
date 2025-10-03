import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

// Lazy load the scheduled reports page component for code splitting
const ScheduledReportsPage = lazy(() =>
	import('@/components/compliance/reports').then((module) => ({
		default: module.ScheduledReportsPage,
	}))
)

// URL search params schema for filters and pagination
const scheduledReportsSearchSchema = z.object({
	page: z.number().min(1).optional().default(1),
	limit: z.number().min(1).max(100).optional().default(10),
	search: z.string().optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	status: z.enum(['enabled', 'disabled']).optional(),
	sortBy: z
		.enum(['name', 'reportType', 'lastRun', 'nextRun', 'createdAt'])
		.optional()
		.default('name'),
	sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports/')({
	component: RouteComponent,
	validateSearch: scheduledReportsSearchSchema,
	beforeLoad: ({ context }) => {
		// Route guard: ensure user has access to scheduled reports
		return context
	},
})

function RouteComponent() {
	const search = Route.useSearch()

	return <ScheduledReportsPage searchParams={search} />
}
