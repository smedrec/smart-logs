import { ComingSoon } from '@/components/pages/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/settings/billing')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
