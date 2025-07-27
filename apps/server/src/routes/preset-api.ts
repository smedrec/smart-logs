import { ApiError } from '@/lib/errors'
import { validator } from 'hono/validator'

import { DEFAULT_VALIDATION_CONFIG } from '@repo/audit'

import type { HonoEnv } from '@/lib/hono/context'
import type { Hono } from 'hono'
import type { AuditPreset } from '@repo/audit'

export function createPresetAPI(app: Hono<HonoEnv>): Hono<HonoEnv> {
	/**
	 * Get all audit presets
	 * GET /api/audit-presets
	 */
	app.get('/', async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')
		if (!session) {
			throw new Error('Session required')
		}
		const organizationId = session.session.activeOrganizationId as string
		try {
			const presets = await compliance.preset.getPresets(organizationId)
			return c.json({
				success: true,
				presets,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get all audit presets: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Get specific audit preset
	 * GET /api/audit-presets/:name
	 */
	app.get('/:name', async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')
		if (!session) {
			throw new Error('Session required')
		}
		const organizationId = session.session.activeOrganizationId as string
		try {
			const name = c.req.param('name')
			const preset = await compliance.preset.getPreset(name, organizationId)
			if (!preset) {
				return c.json(
					{
						success: false,
						error: 'Audit preset not found',
					},
					404
				)
			}
			return c.json({
				success: true,
				preset,
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to get audit preset: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})

	/**
	 * Create audit preset
	 * POST /api/audit-presets
	 */
	app.post(
		'/',
		validator('json', (value, c) => {
			const { preset } = value
			if (!preset || typeof preset !== 'object') {
				return c.text('Invalid preset', 400)
			}
			return { preset: preset as Omit<AuditPreset, 'organizationId'> }
		}),
		async (c) => {
			const { compliance, logger } = c.get('services')
			const session = c.get('session')
			if (!session) {
				throw new Error('Session required')
			}
			const userId = session.session.userId
			const organizationId = session.session.activeOrganizationId as string
			const { preset } = c.req.valid('json')
			try {
				const {
					name,
					description,
					action,
					dataClassification,
					requiredFields,
					defaultValues,
					validation,
				} = preset
				const newPreset = await compliance.preset.createPreset({
					name,
					description,
					organizationId,
					action,
					dataClassification,
					requiredFields,
					defaultValues,
					validation,
					createdBy: userId,
				})
				logger.info(`Created audit preset: ${preset.name}`)
				return c.json({
					success: true,
					preset: newPreset,
				})
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Unknown error'
				logger.error(`Failed to create audit preset: ${message}`)
				const error = new ApiError({
					code: 'INTERNAL_SERVER_ERROR',
					message,
				})
				throw error
			}
		}
	)

	/**
	 * Update audit preset
	 * PUT /api/audit-presets/:name
	 */
	/**app.put(
        "/audit-presets/:name",
        async (c) => {
            const { compliance, logger } = c.get("services");
            try {
                const name = c.req.param("name");
                const { description, action, dataClassification, requiredFields, defaultValues, validation } = c.req.body;
                const preset = await compliance.preset.updatePreset(name, {
                    description,
                    action,
                    dataClassification,
                    requiredFields,
                    defaultValues,
                    validation,
                });
                logger.info(`Updated audit preset: ${name}`);
                return c.json({
                    success: true,
                    preset,
                });
            } catch (e) {
                const message = e instanceof Error ? e.message : "Unknown error";
                logger.error(`Failed to update audit preset: ${message}`);
                const error = new ApiError({
                    code: "INTERNAL_SERVER_ERROR",
                    message,
                });
                throw error;
            }
        }
    ); */

	/**
	 * Delete audit preset
	 * DELETE /api/audit-presets/:name
	 */
	app.delete('/:name', async (c) => {
		const { compliance, logger } = c.get('services')
		const session = c.get('session')
		if (!session) {
			throw new Error('Session required')
		}
		const organizationId = session.session.activeOrganizationId as string
		try {
			const name = c.req.param('name')
			await compliance.preset.deletePreset(name, organizationId)
			logger.info(`Deleted audit preset: ${name}`)
			return c.json({
				success: true,
				message: 'Audit preset deleted successfully',
			})
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Unknown error'
			logger.error(`Failed to delete audit preset: ${message}`)
			const error = new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message,
			})
			throw error
		}
	})
	return app
}
