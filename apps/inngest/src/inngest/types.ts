import { EventSchemas } from 'inngest'

type DemoEventSent = {
	name: 'demo/event.sent'
	data: {
		message: string
	}
}

type cleanupResolvedAlerts = {
	name: 'alerts/cleanup.resolved.alerts'
	data: {
		organization_id: string
		retention_days: number
	}
}

export const schemas = new EventSchemas().fromUnion<DemoEventSent | cleanupResolvedAlerts>()
