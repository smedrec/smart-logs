import { ComingSoon } from '@/components/pages/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/compliance/gdpr')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
