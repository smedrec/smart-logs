import type { Session } from '@/lib/auth.js'
import type { ServiceContext } from '../hono/context'


export type Context = {
	session: Session | null
	requestId: string
	services: ServiceContext
}
