import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/compliance/integrity')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
