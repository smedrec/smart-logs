import { ComingSoon } from '@/components/coming-soon'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard/')({
	component: ComingSoon,
})
