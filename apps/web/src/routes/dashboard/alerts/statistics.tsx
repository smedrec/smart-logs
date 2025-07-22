import { ComingSoon } from '@/components/pages/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/alerts/statistics')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
