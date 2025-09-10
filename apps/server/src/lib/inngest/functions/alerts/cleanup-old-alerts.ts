import { sql } from 'drizzle-orm'

import { inngest } from '../../client.js'

/**
 * This function is a fan-out function that sends a single event to Inngest for each organization
 * in the database. It is used to cleanup resolved alerts for each organization.
 *
 * This function is designed to be run as a cron job to run daily.
 */
export const alertsCleanupPrepareDailyDigest = inngest.createFunction(
	{ id: 'alerts-cleanup-prepare-daily-digest' },
	{ cron: 'TZ=Europe/Lisbon 0 5 * * *' },
	async ({ step, event, services, logger }) => {
		const { db, error } = services
		// Load all the organizations from database:
		const organizations = await step.run('load-organizations', async () => {
			try {
				return await db.auth.execute(sql`
            SELECT id, retention_days FROM organization
          `)
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to prepare daily digest for alerts: ${message}`)
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
					'alerts-cleanup-prepare-daily-digest'
				)
				throw err
			}
		})

		// 💡 Since we want to send a daily digest to each one of these organizations
		// it may take a long time to iterate through each organization and clean up
		// the resolved alerts. To avoid this, we can use the Inngest "step" object
		// to send a single event to Inngest for each organization.

		// ✨ This is known as a "fan-out" pattern ✨

		// 1️⃣ First, we'll create an event object for every organization return in the query:
		const events = organizations.map((organization) => {
			return {
				name: 'alerts/cleanup.resolved.alerts',
				data: {
					organization_id: organization.id as string,
					retention_days: organization.retention_days as number,
				},
			}
		})

		// 2️⃣ Now, we'll send all events in a single batch:
		await step.sendEvent('cleanup-resolved-alerts', events)

		// This function can now quickly finish and the rest of the logic will
		// be handled in the function below ⬇️
	}
)

/**
 * Since we are "fanning out" with events, these functions can all run in parallel
 */
export const cleanupResolvedAlerts = inngest.createFunction(
	{ id: 'cleanup-resolved-alerts' },
	{ event: 'alerts/cleanup.resolved.alerts' },
	async ({ event, services }) => {
		const { monitor, logger, error } = services
		// 3️⃣ We can now grab the email and user id from the event payload
		const { organization_id, retention_days } = event.data

		try {
			// 4️⃣ Now we can use the email and user id to send the email
			const alerts = await monitor.alert.cleanupResolvedAlerts(organization_id, retention_days)
			logger.info(`Cleaned up ${alerts} resolved alerts for organization ${organization_id}`)
		} catch (e) {
			// 5️⃣ If there's an error, we can log it and handle it gracefully
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(
				`Failed to cleanup resolved alerts for organization ${organization_id}: ${message}`
			)
			const err = e instanceof Error ? e : new Error(message)
			await error.handleError(
				err,
				{
					metadata: {
						organizationId: organization_id,
						message: err.message,
						name: err.name,
						cause: err.cause,
						event,
					},
				},
				'inngest',
				'cleanup-resolved-alerts'
			)
			throw err
		}
	}
)
