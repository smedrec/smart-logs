import { createDefaultConfigFile, getDefaultConfigPath } from '../config/integration.js'

export class CommandUtils {
	static getCommandName(command: any): string {
		return command.constructor.name
	}

	async create(environment: string): Promise<void> {
		try {
			const configPath = getDefaultConfigPath()
			await createDefaultConfigFile(configPath, 's3', environment)
			console.log(`Configuration for environment ${environment} created: ${configPath}`)
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			console.error('❌ Configuration creation failed:', message)
			throw error
		}
	}

	async close(): Promise<void> {
		// noop
	}
}

/**
 * CLI utility for running migration operations
 */
export async function runConfigCommand(command: string, environment: string): Promise<void> {
	const configUtils = new CommandUtils()

	try {
		switch (command) {
			case 'create':
				if (!environment) {
					throw new Error('Environment required for create command')
				}
				await configUtils.create(environment)
				break

			default:
				console.error('Unknown command:', command)
				console.log('Available commands: create')
		}
	} finally {
		await configUtils.close()
	}
}
