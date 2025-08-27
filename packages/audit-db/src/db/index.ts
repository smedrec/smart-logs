import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import {
	DatabaseConfig,
	EnhancedClientConfig,
	MonitoringService,
	RedisMetricsCollector,
} from '@repo/audit'

import { EnhancedAuditDatabaseClient } from './enhanced-client.js'
import * as schema from './schema.js'

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis as RedisInstanceType } from 'ioredis'
import type { Sql } from 'postgres'

// Helper to try and get env variables from Cloudflare Workers or Node.js process.env
function getEnv(variableName: string): string | undefined {
	// Check Cloudflare Workers env
	// @ts-expect-error Hides `Cannot find name 'env'.` when not in CF Worker context.
	if (typeof env !== 'undefined' && env[variableName]) {
		// @ts-expect-error
		return env[variableName]
	}
	// Check Node.js process.env
	if (typeof process !== 'undefined' && process.env && process.env[variableName]) {
		return process.env[variableName]
	}
	return undefined
}

export class AuditDb {
	private client: Sql
	private auditDb: PostgresJsDatabase<typeof schema>

	/**
	 * Constructs an AuditDb instance, establishing a connection to the PostgreSQL database
	 * and initializing Drizzle ORM.
	 * @param postgresUrl Optional. The PostgreSQL connection URL. If not provided, it attempts to use
	 *                    the `AUDIT_DB_URL` environment variable.
	 * @param params Optional. PostgreSQL connection parameters.
	 * @throws Error if the PostgreSQL URL is not provided and cannot be found in environment variables.
	 */
	constructor(postgresUrl?: string, params?: { maxConnections?: number }) {
		const effectivePostgresUrl = postgresUrl || getEnv('AUDIT_DB_URL')

		if (!effectivePostgresUrl) {
			throw new Error(
				'AuditDb: PostgreSQL connection URL not provided and could not be found in environment variables (AUDIT_DB_URL).'
			)
		}
		const maxConnections = params?.maxConnections || 10
		this.client = postgres(effectivePostgresUrl, {
			max: maxConnections,
		})
		this.auditDb = drizzle(this.client, { schema })
	}

	/**
	 * Provides access to the Drizzle ORM instance for database operations.
	 * @returns The Drizzle ORM instance typed with the audit log schema.
	 */
	public getDrizzleInstance(): PostgresJsDatabase<typeof schema> {
		return this.auditDb
	}

	/**
	 * Checks the database connection by executing a simple query.
	 * @returns true or false.
	 */
	public async checkAuditDbConnection() {
		try {
			await this.client`SELECT 1` // Simple query to check connection
			//console.log('🟢 Database connection successful.')
			return true
		} catch (error) {
			console.error('🔴 Database connection failed:', error)
			// In a real app, you might want to throw the error or handle it more gracefully
			// For the worker, if the DB isn't available, it might retry or exit.
			// process.exit(1); // Consider if failure to connect on startup is fatal
			return false
		}
	}

	/**
	 * Ends the client connection.
	 * @returns void.
	 */
	public async end(): Promise<void> {
		await this.client.end()
	}
}

export class AuditDbWithConfig {
	private client: Sql
	private auditDb: PostgresJsDatabase<typeof schema>

	/**
	 * Constructs an AuditDb instance, establishing a connection to the PostgreSQL database
	 * and initializing Drizzle ORM.
	 * @param config The database configuration.
	 */
	constructor(config: DatabaseConfig) {
		this.client = postgres(config.url, {
			max: config.poolSize,
			ssl: config.ssl,
		})
		this.auditDb = drizzle(this.client, { schema })
	}

	/**
	 * Provides access to the Drizzle ORM instance for database operations.
	 * @returns The Drizzle ORM instance typed with the audit log schema.
	 */
	public getDrizzleInstance(): PostgresJsDatabase<typeof schema> {
		return this.auditDb
	}

	/**
	 * Checks the database connection by executing a simple query.
	 * @returns true or false.
	 */
	public async checkAuditDbConnection() {
		try {
			await this.client`SELECT 1` // Simple query to check connection
			//console.log('🟢 Database connection successful.')
			return true
		} catch (error) {
			console.error('🔴 Database connection failed:', error)
			// In a real app, you might want to throw the error or handle it more gracefully
			// For the worker, if the DB isn't available, it might retry or exit.
			// process.exit(1); // Consider if failure to connect on startup is fatal
			return false
		}
	}

	/**
	 * Ends the client connection.
	 * @returns void.
	 */
	public async end(): Promise<void> {
		await this.client.end()
	}
}

export class EnhancedAuditDb {
	private client: EnhancedAuditDatabaseClient
	private monitor: MonitoringService

	/**
	 * Constructs an AuditDb instance, establishing a connection to the PostgreSQL database
	 * and initializing Drizzle ORM.
	 * @param connection The Redis connection instance.
	 * @param config The database configuration.
	 */
	constructor(connection: RedisInstanceType, config: EnhancedClientConfig) {
		const metricsCollector = new RedisMetricsCollector(connection)
		this.monitor = new MonitoringService(undefined, metricsCollector)
		this.client = new EnhancedAuditDatabaseClient(this.monitor, config)
	}

	/**
	 * Provides access to the Drizzle ORM instance for database operations.
	 * @returns The Drizzle ORM instance typed with the audit log schema.
	 */
	public getDrizzleInstance(): PostgresJsDatabase<typeof schema> {
		return this.client.getDatabase()
	}

	/**
	 * Provides access to the enhanced client instance for database operations.
	 * @returns The enhanced client instance.
	 */
	public getEnhancedClientInstance(): EnhancedAuditDatabaseClient {
		return this.client
	}

	/**
	 * Checks the database connection by executing a simple query.
	 * @returns true or false.
	 */
	public async checkAuditDbConnection() {
		try {
			const status = await this.client.getHealthStatus()
			//console.log('🟢 Database connection successful.')
			return status.components.connectionPool.status === 'healthy'
		} catch (error) {
			console.error('🔴 Database connection failed:', error)
			// In a real app, you might want to throw the error or handle it more gracefully
			// For the worker, if the DB isn't available, it might retry or exit.
			// process.exit(1); // Consider if failure to connect on startup is fatal
			return false
		}
	}

	/**
	 *
	 * @returns The health status of the database connection.
	 */
	public async healthStatus() {
		return await this.client.getHealthStatus()
	}

	/**
	 * Ends the client connection.
	 * @returns void.
	 */
	public async end(): Promise<void> {
		await this.client.close()
	}
}
