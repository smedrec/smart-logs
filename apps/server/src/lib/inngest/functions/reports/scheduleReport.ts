import { inngest } from '../../client.js'

/**
 * This function is used to schedule a report to be executed at a later time.
 *
 * It uses the `waitForEvent` step to wait for an event to be received from the
 * `unscheduleReport` function.
 *
 * If the event is received, the report is disabled.
 *
 * If the event is not received, the report is executed.
 */
export const scheduleReport = inngest.createFunction(
	{
		id: 'schedule-report',
		name: 'Schedule Report',
		description: 'Schedule a report to be executed at a later time',
	},
	{
		event: 'reports/schedule.report',
	},
	async ({ event, step, env, session, services }) => {
		const { compliance } = services
		const { config } = event.data

		const date = new Date(config.nextRun!)

		const unscheduleReport = await step.waitForEvent('wait-for-unschedule-report', {
			event: 'reports/unschedule.report',
			timeout: date,
			if: `async.data.reportId == "${config.id}"`,
		})

		if (!unscheduleReport) {
			// if no event is received within 3 days, unscheduleReport will be null
			// Execute the report
			// TODO: add error handling for this step
			const report = await compliance.scheduled.executeReport(config.id)
			return {
				message: 'Report executed',
				report,
			}
		} else {
			// if the event is received, unscheduleReport will be the event payload object
			// Update the report's enabled flag to false
			// TODO: add error handling for this step
			const updatedReport = await compliance.scheduled.updateScheduledReport(config.id, {
				enabled: false,
				updatedBy: 'inngest',
			})
			return {
				message: 'Report disabled',
				updatedReport,
			}
		}
	}
)
