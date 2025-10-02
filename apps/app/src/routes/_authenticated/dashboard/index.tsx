import { ComingSoon } from '@/components/coming-soon'
import ComplianceDashboard from '@/components/dashboard-page'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard/')({
	component: ComplianceDashboard,
})
