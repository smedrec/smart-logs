import { createCollection, localOnlyCollectionOptions } from '@tanstack/react-db'
import {
	apiKeyClient,
	inferOrgAdditionalFields,
	organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { z } from 'zod'

import type { InvitationStatus } from 'better-auth/plugins/organization'

const authStateSchema = z.object({
	id: z.string(),
	session: z.any().nullable(),
	user: z.any().nullable(),
})

const ActiveOrganizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	createdAt: z.date(),
	logo: z.string().nullable().optional(),
	metadata: z.any().nullable().optional(),
	members: z.any(),
	invitations: z.any().nullable(),
})

export const authStateCollection = createCollection(
	localOnlyCollectionOptions({
		id: `auth-state`,
		getKey: (item) => item.id,
		schema: authStateSchema,
	})
)

export const activeOrganizationCollection = createCollection(
	localOnlyCollectionOptions({
		id: `active-organization`,
		getKey: (item) => item.id,
		schema: ActiveOrganizationSchema,
	})
)

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
	plugins: [apiKeyClient(), organizationClient()],
})

export type ActiveOrganization =
	| ({
			members: {
				id: string
				organizationId: string
				role: 'member' | 'admin' | 'owner'
				createdAt: Date
				userId: string
				user: {
					email: string
					name: string
					image?: string | undefined
				}
			}[]
			invitations: {
				id: string
				organizationId: string
				email: string
				role: 'member' | 'admin' | 'owner' | 'auditor' | 'officer' | 'developer'
				status: InvitationStatus
				inviterId: string
				expiresAt: Date
			}[]
	  } & {
			id: string
			name: string
			slug: string
			createdAt: Date
			logo?: string | null | undefined
			metadata?: any
	  })
	| null

export type Session = {
	session: {
		id: string
		token: string
		userId: string
		expiresAt: Date
		createdAt: Date
		updatedAt: Date
		ipAddress?: string | null | undefined
		userAgent?: string | null | undefined
		activeOrganizationId?: string | null | undefined
		activeOrganizationRole?: string | null | undefined
	}
	user: {
		id: string
		name: string
		emailVerified: boolean
		email: string
		createdAt: Date
		updatedAt: Date
		image?: string | null | undefined
		role: 'user' | 'admin'
		banned: boolean
		banReason?: string | null | undefined
		banExpires?: Date | null
	}
}
