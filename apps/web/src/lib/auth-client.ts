import {
	adminClient,
	apiKeyClient,
	inferOrgAdditionalFields,
	organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { auth } from '@repo/auth'

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
	plugins: [
		adminClient(),
		apiKeyClient(),
		organizationClient({
			schema: inferOrgAdditionalFields<typeof auth>(),
		}),
	],
})

export type Session = {
	session: (typeof authClient.$Infer.Session)['session'] & {
		activeOrganizationId: string | null | undefined
		activeOrganizationRole: string | null | undefined
	}
	user: (typeof authClient.$Infer.Session)['user']
}
