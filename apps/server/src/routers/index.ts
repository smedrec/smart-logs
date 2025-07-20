import { router } from '@/lib/trpc'

import { alertsRouter } from './alerts'
import { healthRouter } from './health'

export const createTRPCRouter = router

export const appRouter = createTRPCRouter({
	health: healthRouter,
	alerts: alertsRouter,
})

export type AppRouter = typeof appRouter
