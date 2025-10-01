import { ExecutionHistoryPage } from '@/components/compliance/execution'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/compliance/execution-history')({
	component: ExecutionHistoryRoute,
})

function ExecutionHistoryRoute() {
	// For now, we'll use a default report ID or get it from search params
	// In a real implementation, this would come from the route parameters
	const reportId = 'report-1' // Mock report ID

	return <ExecutionHistoryPage reportId={reportId} />
}
