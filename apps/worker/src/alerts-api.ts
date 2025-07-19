/**
 * @fileoverview Alerts API Routes
 *
 */

import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { pino } from 'pino'

import type { DatabaseAlertHandler } from '@repo/audit'

const apiLogger = pino({ name: 'alerts-api' })

/**
 * Create errors API router
 */
export function createAlertsAPI(
	databaseAlertHandler: DatabaseAlertHandler
): Hono {
	const app = new Hono()

	// Alerts endpoints
	app.get('/:organizationId', async (c) => {
		if (!databaseAlertHandler) {
			c.status(503)
			return c.json({ error: 'Database alerts service not initialized' })
		}
	
		const organizationId = c.req.param('organizationId')
		if (!organizationId) {
			c.status(400)
			return c.json({ error: 'Organization ID is required' })
		}

		try {
			const activeAlerts = await databaseAlertHandler.getActiveAlerts(organizationId)
			return c.json({
				alerts: activeAlerts,
				count: activeAlerts.length,
				timestamp: new Date().toISOString(),
			})
		} catch (error) {
			apiLogger.error('Failed to get alerts:', error)
			c.status(500)
			return c.json({
				error: 'Failed to get alerts',
				message: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	})

	app.get('/:organizationId/statistics', async (c) => {
		if (!databaseAlertHandler) {
			c.status(503)
			return c.json({ error: 'Database alerts service not initialized' })
		}
	
		const organizationId = c.req.param('organizationId')
		if (!organizationId) {
			c.status(400)
			return c.json({ error: 'Organization ID is required' })
		}
		apiLogger.info(`Organization ID: ${organizationId}`)

		try {
			const statistics = await databaseAlertHandler.getAlertStatistics(organizationId)
			return c.json(statistics)
		} catch (error) {
			apiLogger.error('Failed to get statistics:', error)
			c.status(500)
			return c.json({
				error: 'Failed to get alerts',
				message: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	})
	
	app.post('/:alertId/resolve', async (c) => {
		if (!databaseAlertHandler) {
			c.status(503)
			return c.json({ error: 'Database alerts service not initialized' })
		}
	
		const alertId = c.req.param('alertId')
		const body = await c.req.json().catch(() => ({}))
		const resolvedBy = body.resolvedBy || 'system'
	
		try {
			await databaseAlertHandler.resolveAlert(alertId, resolvedBy)
			return c.json({
				success: true,
				message: `Alert ${alertId} resolved by ${resolvedBy}`,
				timestamp: new Date().toISOString(),
			})
		} catch (error) {
			apiLogger.error('Failed to resolve alert:', error)
			c.status(500)
			return c.json({
				error: 'Failed to resolve alert',
				message: error instanceof Error ? error.message : 'Unknown error',
			})
		}
	})

	return app
}
