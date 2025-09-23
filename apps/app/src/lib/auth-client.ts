import {
	apiKeyClient,
	inferOrgAdditionalFields,
	organizationClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_SERVER_URL,
	plugins: [apiKeyClient(), organizationClient()],
})

export type Session = {
	session: (typeof authClient.$Infer.Session)['session'] & {
		activeOrganizationId: string | null | undefined
		activeOrganizationRole: string | null | undefined
	}
	user: (typeof authClient.$Infer.Session)['user']
}
