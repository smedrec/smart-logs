import { ComingSoon } from '@/components/coming-soon'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/compliance/hipaa')({
	component: RouteComponent,
})

const today = new Date(Date.now())

function RouteComponent() {
	return <ComingSoon />
}
