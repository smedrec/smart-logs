#!/usr/bin/env node

/**
 * Configuration CLI utility for managing server configuration
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { ConfigurationManager } from './manager.js'
import { ConfigValidator } from './validator.js'

import type { Environment, ServerConfig } from './schema.js'

interface CLIOptions {
	command: 'validate' | 'show' | 'generate' | 'help'
	environment?: Environment
	output?: string
	format?: 'json' | 'yaml'
}

class ConfigCLI {
	private options: CLIOptions

	constructor(args: string[]) {
		this.options = this.parseArgs(args)
	}

	async run(): Promise<void> {
		switch (this.options.command) {
			case 'validate':
				await this.validateConfig()
				break
			case 'show':
				await this.showConfig()
				break
			case 'generate':
				await this.generateConfig()
				break
			case 'help':
			default:
				this.showHelp()
				break
		}
	}

	private parseArgs(args: string[]): CLIOptions {
		const options: CLIOptions = {
			command: 'help',
		}

		for (let i = 0; i < args.length; i++) {
			const arg = args[i]
			switch (arg) {
				case 'validate':
				case 'show':
				case 'generate':
				case 'help':
					options.command = arg
					break
				case '--env':
				case '-e':
					options.environment = args[++i] as Environment
					break
				case '--output':
				case '-o':
					options.output = args[++i]
					break
				case '--format':
				case '-f':
					options.format = args[++i] as 'json' | 'yaml'
					break
			}
		}

		return options
	}

	private async validateConfig(): Promise<void> {
		try {
			const manager = new ConfigurationManager(this.options.environment)
			await manager.initialize()
			const config = manager.getConfig()

			console.log(`🔍 Validating configuration for ${manager.getEnvironment()} environment...\n`)

			const result = ConfigValidator.validate(config)
			ConfigValidator.printValidationResults(result, manager.getEnvironment())

			if (!result.isValid) {
				process.exit(1)
			}
		} catch (error) {
			console.error('❌ Configuration validation failed:', error)
			process.exit(1)
		}
	}

	private async showConfig(): Promise<void> {
		try {
			const manager = new ConfigurationManager(this.options.environment)
			await manager.initialize()
			const config = manager.getConfig()

			console.log(`📋 Configuration for ${manager.getEnvironment()} environment:\n`)

			if (this.options.output) {
				const output =
					this.options.format === 'yaml'
						? this.configToYaml(config)
						: JSON.stringify(config, null, 2)

				writeFileSync(this.options.output, output)
				console.log(`Configuration saved to ${this.options.output}`)
			} else {
				console.log(manager.toJSON())
			}
		} catch (error) {
			console.error('❌ Failed to show configuration:', error)
			process.exit(1)
		}
	}

	private async generateConfig(): Promise<void> {
		const templatePath =
			this.options.output || `config/${this.options.environment || 'development'}.json`

		if (existsSync(templatePath)) {
			console.log(`⚠️  Configuration file already exists: ${templatePath}`)
			console.log('Use --output to specify a different path or remove the existing file.')
			return
		}

		const template = this.getConfigTemplate(this.options.environment || 'development')

		try {
			writeFileSync(templatePath, JSON.stringify(template, null, 2))
			console.log(`✅ Configuration template generated: ${templatePath}`)
			console.log('\n📝 Next steps:')
			console.log('1. Review and update the generated configuration')
			console.log('2. Set environment variables or update config values')
			console.log('3. Run validation: npm run config validate')
		} catch (error) {
			console.error('❌ Failed to generate configuration:', error)
			process.exit(1)
		}
	}

	private getConfigTemplate(environment: Environment): Partial<ServerConfig> {
		const baseTemplate = {
			server: {
				port: 3000,
				host: '0.0.0.0',
				environment,
			},
			cors: {
				origin: environment === 'development' ? '*' : ['https://app.example.com'],
				credentials: true,
			},
			database: {
				url: `postgresql://localhost:5432/audit_${environment}`,
				poolSize: environment === 'production' ? 20 : 10,
				ssl: environment === 'production',
			},
			redis: {
				url: environment === 'test' ? 'redis://localhost:6379/15' : 'redis://localhost:6379',
			},
			auth: {
				sessionSecret: 'CHANGE_ME_TO_A_SECURE_SECRET_AT_LEAST_32_CHARS',
				betterAuthUrl: `http://localhost:3000`,
			},
			security: {
				encryptionKey: 'CHANGE_ME_TO_A_SECURE_KEY_AT_LEAST_32_CHARS',
			},
			monitoring: {
				logLevel: environment === 'production' ? 'warn' : 'debug',
				enableMetrics: true,
			},
		}

		// Environment-specific overrides
		if (environment === 'production') {
			return {
				...baseTemplate,
				performance: {
					enableCompression: true,
					compressionLevel: 9,
					enableCaching: true,
				},
				security: {
					...baseTemplate.security,
					enableApiKeyAuth: true,
				},
			}
		}

		if (environment === 'test') {
			return {
				...baseTemplate,
				server: {
					...baseTemplate.server,
					port: 0, // Random port for tests
				},
				monitoring: {
					...baseTemplate.monitoring,
					enableMetrics: false,
				},
				performance: {
					enableCompression: false,
					enableCaching: false,
				},
			}
		}

		return baseTemplate
	}

	private configToYaml(config: any, indent = 0): string {
		const spaces = '  '.repeat(indent)
		let yaml = ''

		for (const [key, value] of Object.entries(config)) {
			if (value === null || value === undefined) {
				yaml += `${spaces}${key}: null\n`
			} else if (typeof value === 'object' && !Array.isArray(value)) {
				yaml += `${spaces}${key}:\n`
				yaml += this.configToYaml(value, indent + 1)
			} else if (Array.isArray(value)) {
				yaml += `${spaces}${key}:\n`
				for (const item of value) {
					yaml += `${spaces}  - ${item}\n`
				}
			} else {
				yaml += `${spaces}${key}: ${value}\n`
			}
		}

		return yaml
	}

	private showHelp(): void {
		console.log(`
🔧 Server Configuration CLI

Usage: npm run config <command> [options]

Commands:
  validate    Validate configuration for specified environment
  show        Display current configuration
  generate    Generate configuration template
  help        Show this help message

Options:
  --env, -e <env>        Environment (development|staging|production|test)
  --output, -o <file>    Output file path
  --format, -f <format>  Output format (json|yaml)

Examples:
  npm run config validate --env production
  npm run config show --env development
  npm run config generate --env production --output config/prod.json
  npm run config show --output current-config.json --format yaml

Environment Variables:
  The configuration system supports environment variables for all settings.
  See the .env file for available variables.

Configuration Files:
  - config/base.json         Base configuration
  - config/development.json  Development overrides
  - config/production.json   Production overrides
  - config/staging.json      Staging overrides
  - config/test.json         Test overrides
`)
	}
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const cli = new ConfigCLI(process.argv.slice(2))
	cli.run().catch((error) => {
		console.error('CLI error:', error)
		process.exit(1)
	})
}

export { ConfigCLI }
