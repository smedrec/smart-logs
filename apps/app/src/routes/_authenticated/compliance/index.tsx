import { createFileRoute } from '@tanstack/react-router'
import { lazy } from 'react'

// Lazy load the compliance dashboard component for code splitting
const ComplianceDashboard = lazy(
	() => import('@/components/compliance/dashboard/ComplianceDashboard')
)

export const Route = createFileRoute('/_authenticated/compliance/')({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		// Route guard: ensure user has access to compliance features
		// This will be enhanced with proper authorization checks
		return context
	},
})

function RouteComponent() {
	return <ComplianceDashboard />
}
