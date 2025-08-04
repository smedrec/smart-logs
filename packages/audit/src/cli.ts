#!/usr/bin/env node
import { runConfigCommand } from './command/command-utils.js'

/**
 * CLI script for audit configuration management
 * Usage: tsx src/cli.ts <command> [environment]
 */
async function main() {
	const args = process.argv.slice(2)
	const command = args[0]
	const environment = args[1]

	if (!command) {
		console.log('Usage: tsx src/cli.ts <command> [environment]')
		console.log('Commands:')
		console.log('  create <environment> - Create configuration for specified environment')
		process.exit(1)
	}

	try {
		await runConfigCommand(command, environment)
		process.exit(0)
	} catch (error) {
		console.error('Command failed:', error)
		process.exit(1)
	}
}

main().catch(console.error)
