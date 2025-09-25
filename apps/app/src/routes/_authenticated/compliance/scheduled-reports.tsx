import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/compliance/scheduled-reports')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
