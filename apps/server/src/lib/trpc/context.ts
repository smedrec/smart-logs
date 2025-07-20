import type { Session } from '@/lib/auth/index.js'
import type { ServiceContext } from '../hono/context'


export type Context = {
	session: Session | null
	requestId: string
	services: ServiceContext
}
