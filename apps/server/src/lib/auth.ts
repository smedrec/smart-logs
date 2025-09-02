import { Audit } from '@repo/audit'
import { Auth } from '@repo/auth'

import type { AuditConfig } from '@repo/audit'

let authInstance: Auth | undefined = undefined

export async function initializeAuth(config: AuditConfig, audit?: Audit) {
	if (!authInstance) {
		authInstance = new Auth(config, audit)
	}
	return authInstance
}

export async function getAuthInstance(config: AuditConfig, audit?: Audit) {
	if (!authInstance) {
		authInstance = await initializeAuth(config, audit)
	}
	return authInstance.getAuthInstance()
}

export async function getAuthDb(config: AuditConfig, audit?: Audit) {
	if (!authInstance) {
		authInstance = await initializeAuth(config, audit)
	}
	return authInstance.getDrizzleInstance()
}

export async function getAuthRedis(config: AuditConfig, audit?: Audit) {
	if (!authInstance) {
		authInstance = await initializeAuth(config, audit)
	}
	return authInstance.getRedisInstance()
}
