import { EventSchemas } from 'inngest'

import type { ScheduledReportConfig } from '@repo/audit'

type DemoEventSent = {
	name: 'demo/event.sent'
	data: {
		message: string
	}
}

type CleanupResolvedAlerts = {
	name: 'alerts/cleanup.resolved.alerts'
	data: {
		organization_id: string
		retention_days: number
	}
}

type CleanupOldErrors = {
	name: 'errors/cleanup.old.errors'
	data: {
		retention_days: number
	}
}

type ScheduleReport = {
	name: 'reports/schedule.report'
	data: {
		config: ScheduledReportConfig
	}
}

type UnscheduleReport = {
	name: 'reports/unschedule.report'
	data: {
		reportId: string
	}
}

export const schemas = new EventSchemas().fromUnion<
	DemoEventSent | CleanupResolvedAlerts | CleanupOldErrors | ScheduleReport | UnscheduleReport
>()
