import { router } from '@/lib/trpc'

import { alertsRouter } from './alerts'
import { healthRouter } from './health'
import { presetsRouter } from './presets'
import { reportsRouter } from './reports'
import { templatesRouter } from './templates'

export const createTRPCRouter = router

export const appRouter = createTRPCRouter({
	health: healthRouter,
	alerts: alertsRouter,
	templates: templatesRouter,
	reports: reportsRouter,
	presets: presetsRouter,
})

export type AppRouter = typeof appRouter
