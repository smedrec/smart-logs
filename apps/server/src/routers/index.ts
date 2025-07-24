import { router } from '@/lib/trpc'

import { alertsRouter } from './alerts'
import { healthRouter } from './health'
import { templatesRouter } from './templates'

export const createTRPCRouter = router

export const appRouter = createTRPCRouter({
	health: healthRouter,
	alerts: alertsRouter,
	templates: templatesRouter,
})

export type AppRouter = typeof appRouter
