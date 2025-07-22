import { useSession } from '@/hooks/auth-hooks'
import { authClient } from '@/lib/auth-client'
import * as React from 'react'

import type { Session } from '@/lib/auth-client'

export interface AuthContext {
	isAuthenticated: boolean
	session: Session | null
}

const AuthContext = React.createContext<AuthContext | null>(null)

const key = 'tanstack.auth.user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const { data: session } = authClient.useSession()
	const isAuthenticated = !!session

	return (
		<AuthContext.Provider value={{ isAuthenticated, session: session as Session }}>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const context = React.useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}
