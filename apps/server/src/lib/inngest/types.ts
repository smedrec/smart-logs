import { EventSchemas } from 'inngest'

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

export const schemas = new EventSchemas().fromUnion<
	DemoEventSent | CleanupResolvedAlerts | CleanupOldErrors
>()
