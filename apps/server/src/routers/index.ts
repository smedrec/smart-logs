import { router } from '@/lib/trpc'

import { alertsRouter } from './alerts'
import { eventsRouter } from './events'
import { healthRouter } from './health'
import { metricsRouter } from './metrics'
import { performanceRouter } from './performance'
import { presetsRouter } from './presets'
import { reportsRouter } from './reports'
import { templatesRouter } from './templates'

export const createTRPCRouter = router

export const appRouter = createTRPCRouter({
	health: healthRouter,
	metrics: metricsRouter,
	alerts: alertsRouter,
	templates: templatesRouter,
	reports: reportsRouter,
	presets: presetsRouter,
	events: eventsRouter,
	performance: performanceRouter,
})

export type AppRouter = typeof appRouter
