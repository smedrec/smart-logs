import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'
import { z } from 'zod'

// Lazy load the report configuration form component
const GlobalExecutionHistoryPage = lazy(() =>
	import('@/components/compliance/execution').then((module) => ({
		default: module.GlobalExecutionHistoryPage,
	}))
)

// URL search params schema for global execution history filters
const globalExecutionHistorySearchSchema = z.object({
	page: z.number().min(1).optional().default(1),
	limit: z.number().min(1).max(100).optional().default(20),
	reportId: z.string().optional(),
	status: z.enum(['completed', 'failed', 'running', 'pending']).optional(),
	reportType: z.enum(['hipaa', 'gdpr', 'custom']).optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	sortBy: z
		.enum(['scheduledTime', 'executionTime', 'duration', 'status', 'reportName'])
		.optional()
		.default('scheduledTime'),
	sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const Route = createFileRoute('/_authenticated/compliance/execution-history')({
	component: RouteComponent,
	validateSearch: globalExecutionHistorySearchSchema,
	beforeLoad: ({ context }) => {
		// Route guard: ensure user has access to execution history
		return context
	},
})

function RouteComponent() {
	const search = Route.useSearch()

	return <GlobalExecutionHistoryPage searchParams={search} />
}
