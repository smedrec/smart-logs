/**
 * @fileoverview Organization configuration API
 *
 * Provides REST API endpoints for config organizations:
 * - Configure Organization Email Provider
 * - Create Organization Role
 * - Update Organization Role
 * - Delete Organization Role
 * - Create Organization Member
 * - Update Organization Member
 * - Delete Organization Member
 *
 */
import { ApiError } from '@/lib/errors/http.js'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { emailProvider } from '@repo/auth'

import { openApiErrorResponses } from '../lib/errors/openapi_responses.js'

import type { HonoEnv } from '../lib/hono/context.js'

const EmailProviderConfigSchema = z.object({
	provider: z.enum(['smtp', 'resend', 'sendgrid']),
	host: z.string().optional(),
	port: z.number().optional(),
	secure: z.boolean().optional(),
	user: z.string().optional(),
	password: z.string().optional(),
	apiKey: z.string().optional(),
	fromName: z.string().optional(),
	fromEmail: z.string().optional(),
})

const EmailProviderResponseSchema = z.object({
	organizationID: z.string(),
	provider: z.enum(['smtp', 'resend', 'sendgrid']),
	host: z.string().optional(),
	port: z.number().optional(),
	secure: z.boolean().optional(),
	user: z.string().optional(),
	fromName: z.string().optional(),
	fromEmail: z.string().optional(),
})

const RoleSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	permissions: z.array(
		z.object({
			resource: z.string(),
			action: z.string(),
			conditions: z.record(z.string(), z.any()).optional(),
		})
	),
	inherits: z.array(z.string()).optional(),
})

// Route definitions
const organizationEmailProviderRoute = createRoute({
	method: 'post',
	path: '/email/provider',
	tags: ['Organization'],
	summary: 'Configure Organization Email Provider',
	description: 'Configures the organization email provider.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: EmailProviderConfigSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Event sent successfully',
			content: {
				'application/json': {
					schema: EmailProviderResponseSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

const organizationRoleCreateRoute = createRoute({
	method: 'post',
	path: '/role',
	tags: ['Organization'],
	summary: 'Create Organization Role',
	description: 'Creates a new organization role.',
	request: {
		body: {
			content: {
				'application/json': {
					schema: RoleSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Role created successfully',
			content: {
				'application/json': {
					schema: RoleSchema,
				},
			},
		},
		...openApiErrorResponses,
	},
})

/**
 * Create Inngest functions API router
 */
export function createOrganizationAPI(): OpenAPIHono<any> {
	const app = new OpenAPIHono<HonoEnv>()

	// Hello World function
	app.openapi(organizationEmailProviderRoute, async (c) => {
		const { db, kms } = c.get('services')
		const session = c.get('session')

		const config = c.req.valid('json')

		switch (config.provider) {
			case 'smtp':
				if (!config.password) {
					throw new ApiError({
						code: 'BAD_REQUEST',
						message: 'SMTP password is required',
					})
				}
				const encryptionPassword = await kms.encrypt(config.password)
				config.password = encryptionPassword.ciphertext
				break
			case 'resend':
			case 'sendgrid':
				if (!config.apiKey) {
					throw new ApiError({
						code: 'BAD_REQUEST',
						message: 'API key is required',
					})
				}
				const encryptionApiKey = await kms.encrypt(config.apiKey)
				config.apiKey = encryptionApiKey.ciphertext
				break
			default:
				break
		}

		try {
			const provider = await db.auth
				.insert(emailProvider)
				.values({
					organizationId: session?.session.activeOrganizationId!,
					provider: config.provider,
					host: config.host,
					port: config.port,
					secure: config.secure,
					user: config.user,
					password: config.password,
					apiKey: config.apiKey,
					fromName: config.fromName,
					fromEmail: config.fromEmail,
				})
				.onConflictDoUpdate({
					target: emailProvider.organizationId,
					set: {
						provider: config.provider,
						host: config.host,
						port: config.port,
						secure: config.secure,
						user: config.user,
						password: config.password,
						apiKey: config.apiKey,
						fromName: config.fromName,
						fromEmail: config.fromEmail,
					},
				})
				.returning()

			return c.json(
				{
					organizationID: provider[0].organizationId,
					provider: provider[0].provider as 'smtp' | 'resend' | 'sendgrid',
					host: provider[0].host || undefined,
					port: provider[0].port || undefined,
					secure: provider[0].secure || undefined,
					user: provider[0].user || undefined,
					fromName: provider[0].fromName || undefined,
					fromEmail: provider[0].fromEmail || undefined,
				},
				200
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to create/update email provider: ${message}`,
			})
		}
	})

	app.openapi(organizationRoleCreateRoute, async (c) => {
		const { authorization, logger } = c.get('services')
		const session = c.get('session')
		const role = c.req.valid('json')

		role.name = `${session?.session.activeOrganizationId}:${role.name}`
		try {
			await authorization.addRole(role)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			throw new ApiError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to create role: ${message}`,
			})
		}

		return c.json(role, 201)
	})

	return app
}
