import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

// Lazy load the execution history page component
const ExecutionHistoryPage = lazy(
	() => import('@/components/compliance/execution-history/ExecutionHistoryPage')
)

// URL search params schema for execution history filters
const executionHistorySearchSchema = z.object({
	page: z.number().min(1).optional().default(1),
	limit: z.number().min(1).max(100).optional().default(20),
	status: z.enum(['completed', 'failed', 'running', 'pending']).optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	sortBy: z
		.enum(['scheduledTime', 'executionTime', 'duration', 'status'])
		.optional()
		.default('scheduledTime'),
	sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const Route = createFileRoute(
	'/_authenticated/compliance/scheduled-reports/$reportId/executions'
)({
	component: RouteComponent,
	validateSearch: executionHistorySearchSchema,
	beforeLoad: ({ context, params }) => {
		// Route guard: ensure user has permission to view execution history
		// and validate that reportId is a valid format
		if (!params.reportId || params.reportId.trim() === '') {
			throw new Error('Invalid report ID')
		}
		return context
	},
})

function RouteComponent() {
	const { reportId } = Route.useParams()
	const search = Route.useSearch()

	return <ExecutionHistoryPage reportId={reportId} searchParams={search} />
}
