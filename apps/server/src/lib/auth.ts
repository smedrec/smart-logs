import { Auth } from '@repo/auth'

import { configManager } from './config/manager.js'

let authInstance: Auth | undefined = undefined

export async function initializeAuth() {
	if (!authInstance) {
		// Initialize configuration
		await configManager.initialize()
		const config = configManager.getConfig()
		authInstance = new Auth(config)
	}
	return authInstance
}

export async function getAuthInstance() {
	if (!authInstance) {
		authInstance = await initializeAuth()
	}
	return authInstance.getAuthInstance()
}
