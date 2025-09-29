import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { createCollection, localOnlyCollectionOptions } from '@tanstack/react-db'
import {
	apiKeyClient,
	inferOrgAdditionalFields,
	organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { z } from 'zod'

import { queryClient } from './query-client'

import type { InvitationStatus } from 'better-auth/plugins/organization'

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
	plugins: [apiKeyClient(), organizationClient()],
})

const authStateSchema = z.object({
	id: z.string(),
	session: z.any().nullable(),
	user: z.any().nullable(),
})

const activeOrganizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	createdAt: z.date(),
	logo: z.string().nullable(),
	metadata: z.any().nullable(),
	retentionDays: z.number(),
	members: z.any().nullable(),
	invitations: z.any().nullable(),
	teams: z.any().nullable(),
})

type Organization = {
	id: string
	name: string
	slug: string
	createdAt: Date
	logo?: string | null | undefined
	metadata?: any
}

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
		schema: activeOrganizationSchema,
	})
)

export const OrganizationsCollection = createCollection(
	queryCollectionOptions({
		queryKey: [`organizations`],
		queryFn: async () => {
			const { data } = await authClient.organization.list()
			return data as Organization[]
		},
		queryClient,
		getKey: (item) => item.id,
	})
)

export type ActiveOrganization =
	| ({
			members: {
				id: string
				organizationId: string
				role: 'member' | 'admin' | 'owner' | 'auditor' | 'officer' | 'developer'
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
