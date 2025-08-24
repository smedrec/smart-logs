import { type AuditConfig } from '@repo/audit'
import { Auth } from '@repo/auth'

let authInstance: Auth | undefined = undefined

export async function initializeAuth(config: AuditConfig) {
	if (!authInstance) {
		authInstance = new Auth(config)
	}
	return authInstance
}

export async function getAuthInstance(config: AuditConfig) {
	if (!authInstance) {
		authInstance = await initializeAuth(config)
	}
	return authInstance.getAuthInstance()
}

export async function getAuthDb(config: AuditConfig) {
	if (!authInstance) {
		authInstance = await initializeAuth(config)
	}
	return authInstance.getDbInstance()
}

export async function getAuthRedis(config: AuditConfig) {
	if (!authInstance) {
		authInstance = await initializeAuth(config)
	}
	return authInstance.getRedisInstance()
}
