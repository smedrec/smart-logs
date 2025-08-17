/**
 * Configuration module exports
 */

// Schema exports
export {
	validateConfig,
	validateCompleteConfig,
	ConfigValidationError,
	getDefaultConfig,
} from './schema.js'

export type { ServerConfig, Environment, EnvironmentOverrides, CompleteConfig } from './schema.js'

// Loader exports
export { ConfigurationLoader, configLoader } from './loader.js'

// Manager exports
export { ConfigurationManager, configManager } from './manager.js'

// Validator exports
export { ConfigValidator } from './validator.js'
export type { ValidationResult } from './validator.js'

// Convenience function to get initialized configuration
export async function getServerConfig() {
	const manager = ConfigurationManager.getInstance()
	if (!manager.validateConfiguration()) {
		await manager.initialize()
	}
	return manager.getConfig()
}

// Convenience function to get specific config sections
export async function getConfigSection<T extends keyof ServerConfig>(
	section: T
): Promise<ServerConfig[T]> {
	const config = await getServerConfig()
	return config[section]
}
