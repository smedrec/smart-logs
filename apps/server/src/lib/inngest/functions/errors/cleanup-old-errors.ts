import { DatabaseErrorLogger } from '@repo/audit'
import { errorAggregation, errorLog } from '@repo/audit-db'

import { inngest } from '../../client.js'

let databaseErrorLogger: DatabaseErrorLogger | undefined = undefined

/**
 * cron job to cleanup old errors
 */
export const errorsCleanupPrepareDailyDigest = inngest.createFunction(
	{ id: 'errors-cleanup-prepare-daily-digest' },
	{ cron: 'TZ=Europe/Lisbon 0 4 * * *' },
	async ({ step }) => {
		await step.sendEvent('cleanup-old-errors', {
			name: 'errors/cleanup.old.errors',
			data: { retention_days: 90 },
		})
	}
)

/**
 * cleanup old errors
 */
export const cleanupOldErrors = inngest.createFunction(
	{ id: 'cleanup-old-errors' },
	{ event: 'errors/cleanup.old.errors' },
	async ({ event, services }) => {
		const { db, error, logger } = services
		if (!databaseErrorLogger) {
			databaseErrorLogger = new DatabaseErrorLogger(db.audit, errorLog, errorAggregation)
		}
		const { retention_days } = event.data

		try {
			const errors = await databaseErrorLogger.cleanupOldErrors(retention_days)
			logger.info(`Cleaned up ${errors} errors`)
		} catch (e) {
			// If there's an error, we can log it and handle it gracefully
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to cleanup old errors: ${message}`)
			const err = e instanceof Error ? e : new Error(message)
			await error.handleError(
				err,
				{
					metadata: {
						message: err.message,
						name: err.name,
						cause: err.cause,
						event,
					},
				},
				'inngest',
				'cleanup-old-errors'
			)
			throw err
		}
	}
)
