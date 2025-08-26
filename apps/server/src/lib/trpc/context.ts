import type { Session } from '@repo/auth'
import type { ServiceContext } from '../hono/context'

export type Context = {
	session: Session | null
	requestId: string
	location: string
	userAgent: string
	services: ServiceContext
}
