import {
	alertsCleanupPrepareDailyDigest,
	cleanupResolvedAlerts,
} from './functions/alerts/cleanup-old-alerts.js'
import {
	cleanupOldErrors,
	errorsCleanupPrepareDailyDigest,
} from './functions/errors/cleanup-old-errors.js'
import { helloWorld } from './functions/helloWorld.js'
import { scheduleReport } from './functions/reports/scheduleReport.js'

export const functions = [
	helloWorld,
	alertsCleanupPrepareDailyDigest,
	cleanupResolvedAlerts,
	errorsCleanupPrepareDailyDigest,
	cleanupOldErrors,
	scheduleReport,
]

export { inngest } from './client.js'
