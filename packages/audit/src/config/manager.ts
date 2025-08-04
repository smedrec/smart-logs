/**
 * Configuration management system for the audit service
 * Provides environment-specific configuration, validation, hot-reloading, and secure storage
 */
import 'dotenv/config'

import { createCipheriv, createDecipheriv, createHash, pbkdf2, randomBytes, scrypt } from 'crypto'
import { EventEmitter } from 'events'
import { existsSync, unwatchFile, watchFile } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { sql } from 'drizzle-orm'
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { validateConfiguration } from './validator.js'

import type {
	AuditConfig,
	ConfigChangeEvent,
	HotReloadConfig,
	SecureStorageConfig,
	StorageType,
} from './types.js'

const pbkdf2Async = promisify(pbkdf2)
const scryptAsync = promisify(scrypt)

/**
 * Configuration manager with hot-reloading, versioning, and secure storage
 */
export class ConfigurationManager extends EventEmitter {
	private db: PostgresJsDatabase<any> | null = null
	private s3: S3Client | null = null
	private config: AuditConfig | null = null
	private configPath: string
	private storageType: StorageType
	private hotReloadConfig: HotReloadConfig
	private secureStorageConfig: SecureStorageConfig
	private watcherActive = false
	private encryptionKey: Buffer | null = null
	private bucket: string | null = null

	constructor(
		configPath: string,
		storageType: StorageType = 'file',
		hotReloadConfig: HotReloadConfig = {
			enabled: false,
			reloadableFields: [],
			checkInterval: 30000,
		},
		secureStorageConfig?: SecureStorageConfig
	) {
		super()
		this.configPath = configPath
		this.storageType = storageType
		this.hotReloadConfig = hotReloadConfig
		this.secureStorageConfig = secureStorageConfig || {
			enabled: false,
			algorithm: 'AES-256-GCM',
			kdf: 'PBKDF2',
			salt: process.env.AUDIT_CONFIG_SALT || randomBytes(32).toString('hex'),
			iterations: 100000,
		}
	}

	/**
	 * Initialize the configuration manager
	 */
	async initialize(): Promise<void> {
		try {
			// Initialize encryption key if secure storage is enabled
			if (this.secureStorageConfig.enabled) {
				await this.initializeEncryption()
			}

			// Initialize S3 client
			if (this.storageType === 's3') {
				await this.initializeS3()
			}

			// Load initial configuration
			await this.loadConfiguration()

			// Start hot reloading if enabled
			if (this.hotReloadConfig.enabled) {
				await this.startHotReloading()
			}

			// Initialize the database connection pool
			if (this.config?.database.url) {
				await this.initializeDatabase()
			}

			this.emit('initialized', this.config)
		} catch (error) {
			this.emit('error', error)
			throw error
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): AuditConfig {
		if (!this.config) {
			throw new Error('Configuration not initialized. Call initialize() first.')
		}
		return { ...this.config }
	}

	/**
	 * Get specific configuration value by path
	 */
	getConfigValue<T = any>(path: string): T {
		if (!this.config) {
			throw new Error('Configuration not initialized')
		}

		const keys = path.split('.')
		let value: any = this.config

		for (const key of keys) {
			if (value && typeof value === 'object' && key in value) {
				value = value[key]
			} else {
				throw new Error(`Configuration path '${path}' not found`)
			}
		}

		return value as T
	}

	/**
	 * Update configuration value
	 */
	async updateConfig(
		path: string,
		newValue: any,
		changedBy: string,
		reason?: string
	): Promise<void> {
		if (!this.config) {
			throw new Error('Configuration not initialized')
		}

		const keys = path.split('.')
		const lastKey = keys.pop()!
		let target: any = this.config

		// Navigate to the parent object
		for (const key of keys) {
			if (target && typeof target === 'object' && key in target) {
				target = target[key]
			} else {
				throw new Error(`Configuration path '${path}' not found`)
			}
		}

		const previousValue = target[lastKey]
		const previousVersion = this.config.version

		// Validate the new configuration
		const testConfig = { ...this.config }
		const testTarget = this.getNestedObject(testConfig, keys)
		testTarget[lastKey] = newValue

		await validateConfiguration(testConfig)

		// Apply the change
		target[lastKey] = newValue
		this.config.lastUpdated = new Date().toISOString()
		this.config.version = this.generateVersion()

		// Record the change
		const changeEvent: Omit<ConfigChangeEvent, 'id'> = {
			timestamp: this.config.lastUpdated,
			field: path,
			previousValue,
			newValue,
			changedBy,
			reason,
			environment: this.config.environment,
			previousVersion,
			newVersion: this.config.version,
		}

		// Persist the changeEvent to the database
		if (this.db) {
			await this.db.execute(sql`
				INSERT INTO config_change_event (
					timestamp, field, previous_value, new_value, changed_by, reason, environment, previous_version, new_version
				) VALUES (
					${changeEvent.timestamp}
					${changeEvent.field},
					${JSON.stringify(changeEvent.previousValue)},
					${JSON.stringify(changeEvent.newValue)},
					${changeEvent.changedBy},
					${changeEvent.reason},
					${changeEvent.environment}
					${changeEvent.previousVersion},
					${changeEvent.newVersion}
				)
			`)
		} else {
			console.error('[AuditConfigManager] 🔴 Database connection not initialized')
		}

		// Persist the configuration
		await this.saveConfiguration()

		// Emit change event
		this.emit('configChanged', changeEvent)

		// Check if hot reload is supported for this field
		if (this.hotReloadConfig.enabled && this.isHotReloadable(path)) {
			this.emit('hotReload', { path, newValue, previousValue })
		}
	}

	/**
	 * Get configuration change history
	 */
	async getChangeHistory(limit?: number): Promise<ConfigChangeEvent[]> {
		const result = this.db
			? await this.db.execute(sql`
					SELECT * FROM config_change_event
					ORDER BY timestamp DESC
					LIMIT ${limit || 10}
			  `)
			: []

		const rows = result || []
		return rows.map(this.mapDatabaseChangeEventToChangeEvent)
	}

	/**
	 * Get configuration version
	 */
	getVersion(): string {
		return this.config?.version || '1.0.0'
	}

	/**
	 * Reload configuration from file
	 */
	async reloadConfiguration(): Promise<void> {
		const previousConfig = this.config ? { ...this.config } : null
		await this.loadConfiguration()

		if (previousConfig && this.config) {
			const changes = this.detectChanges(previousConfig, this.config)
			if (changes.length > 0) {
				this.emit('configReloaded', { changes, config: this.config })
			}
		}
	}

	/**
	 * Validate current configuration
	 */
	async validateCurrentConfig(): Promise<void> {
		if (!this.config) {
			throw new Error('Configuration not initialized')
		}
		await validateConfiguration(this.config)
	}

	/**
	 * Export configuration (with sensitive data masked)
	 */
	exportConfig(includeSensitive = false): Partial<AuditConfig> {
		if (!this.config) {
			throw new Error('Configuration not initialized')
		}

		const exported = { ...this.config }

		if (!includeSensitive) {
			// Mask sensitive fields
			if (exported.redis?.url) {
				exported.redis.url = this.maskSensitiveUrl(exported.redis.url)
			}
			if (exported.database?.url) {
				exported.database.url = this.maskSensitiveUrl(exported.database.url)
			}
			if (exported.security?.encryptionKey) {
				exported.security.encryptionKey = '***MASKED***'
			}
		}

		return exported
	}

	/**
	 * Shutdown the configuration manager
	 */
	async shutdown(): Promise<void> {
		if (this.watcherActive) {
			await this.stopHotReloading()
		}
		this.removeAllListeners()
	}

	/**
	 * Initialize the S3 client
	 */
	private async initializeS3(): Promise<void> {
		if (!process.env.S3_BUCKET) {
			throw new Error('S3 bucket not configured')
		}
		if (!process.env.S3_ENDPOINT) {
			throw new Error('S3 endpoint not configured')
		}
		if (!process.env.AWS_ACCESS_KEY_ID) {
			throw new Error('AWS access key ID not configured')
		}
		if (!process.env.AWS_SECRET_ACCESS_KEY) {
			throw new Error('AWS secret access key not configured')
		}

		this.bucket = process.env.S3_BUCKET

		this.s3 = new S3Client({
			region: process.env.S3_REGION || 'auto',
			endpoint: process.env.S3_ENDPOINT,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
			},
		})
	}

	/**
	 * Initialize the database connection pool
	 */
	private async initializeDatabase(): Promise<void> {
		if (!this.config?.database.url) {
			throw new Error('Database URL not configured')
		}

		const client = postgres(this.config.database.url, {
			max: this.config.database.poolSize || 10,
		})
		this.db = drizzle(client)
	}

	/**
	 * Load configuration from file
	 */
	private async loadConfiguration(): Promise<void> {
		if (!this.s3 && this.storageType === 's3') {
			throw new Error('S3 client not initialized')
		}
		if (!this.bucket && this.storageType === 's3') {
			throw new Error('S3 bucket not configured')
		}

		try {
			if (this.storageType === 'file') {
				if (!existsSync(this.configPath)) {
					throw new Error(`Configuration file not found: ${this.configPath}`)
				}
			}

			let configData: string
			if (this.secureStorageConfig.enabled) {
				configData = await this.decryptConfigFile()
			} else {
				// Load configuration from S3
				if (this.storageType === 's3') {
					const s3ParamsGetObject: any = {
						Bucket: this.bucket,
						Key: this.configPath,
					}
					const command = new GetObjectCommand(s3ParamsGetObject)
					const s3ResponseGetObject = await this.s3?.send(command)
					const configuration = await s3ResponseGetObject?.Body?.transformToString()
					if (!configuration) {
						throw new Error('Configuration not found in S3')
					}
					configData = configuration
				} else {
					configData = await readFile(this.configPath, 'utf-8')
				}
			}

			const parsedConfig = JSON.parse(configData) as AuditConfig

			// Validate configuration
			await validateConfiguration(parsedConfig)

			// Set version if not present
			if (!parsedConfig.version) {
				parsedConfig.version = this.generateVersion()
			}

			// Set last updated if not present
			if (!parsedConfig.lastUpdated) {
				parsedConfig.lastUpdated = new Date().toISOString()
			}

			this.config = parsedConfig
		} catch (error) {
			throw new Error(
				`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Save configuration to file
	 */
	private async saveConfiguration(): Promise<void> {
		if (!this.config) {
			throw new Error('No configuration to save')
		}
		if (!this.bucket && this.storageType === 's3') {
			throw new Error('S3 bucket not configured')
		}
		if (!this.s3 && this.storageType === 's3') {
			throw new Error('S3 client not initialized')
		}

		try {
			const configData = JSON.stringify(this.config, null, 2)

			if (this.secureStorageConfig.enabled) {
				await this.encryptConfigFile(configData)
			} else {
				if (this.storageType === 's3') {
					const s3ParamsPutObject: any = {
						Bucket: this.bucket,
						Key: this.configPath,
						Body: configData,
					}
					const command = new PutObjectCommand(s3ParamsPutObject)
					await this.s3?.send(command)
				} else {
					await writeFile(this.configPath, configData, 'utf-8')
				}
			}
		} catch (error) {
			throw new Error(
				`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}
	}

	/**
	 * Initialize encryption for secure storage
	 */
	private async initializeEncryption(): Promise<void> {
		const password = process.env.AUDIT_CONFIG_PASSWORD
		if (!password) {
			throw new Error('AUDIT_CONFIG_PASSWORD environment variable required for secure storage')
		}

		const salt = Buffer.from(this.secureStorageConfig.salt, 'hex')

		if (this.secureStorageConfig.kdf === 'PBKDF2') {
			this.encryptionKey = await pbkdf2Async(
				password,
				salt,
				this.secureStorageConfig.iterations,
				32,
				'sha256'
			)
		} else if (this.secureStorageConfig.kdf === 'scrypt') {
			this.encryptionKey = (await scryptAsync(password, salt, 32)) as Buffer
		}
	}

	/**
	 * Encrypt configuration file
	 */
	private async encryptConfigFile(data: string): Promise<void> {
		if (!this.encryptionKey) {
			throw new Error('Encryption key not initialized')
		}
		if (!this.bucket && this.storageType === 's3') {
			throw new Error('S3 bucket not configured')
		}
		if (!this.s3 && this.storageType === 's3') {
			throw new Error('S3 client not initialized')
		}

		const iv = randomBytes(16)
		const cipher = createCipheriv(this.secureStorageConfig.algorithm, this.encryptionKey, iv)

		let encrypted = cipher.update(data, 'utf8', 'hex')
		encrypted += cipher.final('hex')

		const encryptedData: any = {
			algorithm: this.secureStorageConfig.algorithm,
			iv: iv.toString('hex'),
			data: encrypted,
		}

		// Add authentication tag for GCM mode
		if (this.secureStorageConfig.algorithm === 'AES-256-GCM') {
			encryptedData.authTag = (cipher as any).getAuthTag().toString('hex')
		}

		if (this.storageType === 's3') {
			const s3ParamsPutObject: any = {
				Bucket: this.bucket,
				Key: this.configPath,
				Body: JSON.stringify(encryptedData, null, 2),
			}
			const command = new PutObjectCommand(s3ParamsPutObject)
			await this.s3?.send(command)
		} else {
			await writeFile(this.configPath, JSON.stringify(encryptedData, null, 2), 'utf-8')
		}
	}

	/**
	 * Decrypt configuration file
	 */
	private async decryptConfigFile(): Promise<string> {
		if (!this.encryptionKey) {
			throw new Error('Encryption key not initialized')
		}
		if (!this.bucket && this.storageType === 's3') {
			throw new Error('S3 bucket not configured')
		}
		if (!this.s3 && this.storageType === 's3') {
			throw new Error('S3 client not initialized')
		}

		let encryptedData: any

		if (this.storageType === 's3') {
			const s3ParamsGetObject: any = {
				Bucket: this.bucket,
				Key: this.configPath,
			}
			const command = new GetObjectCommand(s3ParamsGetObject)
			const s3ResponseGetObject = await this.s3?.send(command)
			const encryptedString = await s3ResponseGetObject?.Body?.transformToString()
			if (!encryptedString) {
				throw new Error('Encrypted configuration not found in S3')
			}
			encryptedData = JSON.parse(encryptedString)
		} else {
			encryptedData = JSON.parse(await readFile(this.configPath, 'utf-8'))
		}

		const iv = Buffer.from(encryptedData.iv, 'hex')
		const decipher = createDecipheriv(encryptedData.algorithm, this.encryptionKey, iv)

		// Set authentication tag for GCM mode
		if (this.secureStorageConfig.algorithm === 'AES-256-GCM' && encryptedData.authTag) {
			;(decipher as any).setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))
		}

		let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8')
		decrypted += decipher.final('utf8')

		return decrypted
	}

	/**
	 * Start hot reloading
	 */
	private async startHotReloading(): Promise<void> {
		if (this.watcherActive) {
			return
		}

		this.watcherActive = true

		watchFile(this.configPath, { interval: this.hotReloadConfig.checkInterval }, async () => {
			try {
				await this.reloadConfiguration()
			} catch (error) {
				this.emit(
					'error',
					new Error(
						`Hot reload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				)
			}
		})

		this.emit('hotReloadStarted')
	}

	/**
	 * Stop hot reloading
	 */
	private async stopHotReloading(): Promise<void> {
		if (!this.watcherActive) {
			return
		}

		unwatchFile(this.configPath)
		this.watcherActive = false
		this.emit('hotReloadStopped')
	}

	/**
	 * Check if a field supports hot reloading
	 */
	private isHotReloadable(path: string): boolean {
		return this.hotReloadConfig.reloadableFields.includes(path)
	}

	/**
	 * Generate a new version string
	 */
	private generateVersion(): string {
		const timestamp = Date.now()
		const hash = createHash('sha256').update(timestamp.toString()).digest('hex').substring(0, 8)
		return `${new Date().toISOString().split('T')[0]}-${hash}`
	}

	/**
	 * Get nested object by path
	 */
	private getNestedObject(obj: any, keys: string[]): any {
		let target = obj
		for (const key of keys) {
			if (target && typeof target === 'object' && key in target) {
				target = target[key]
			} else {
				throw new Error(`Path not found: ${keys.join('.')}`)
			}
		}
		return target
	}

	/**
	 * Detect changes between two configurations
	 */
	private detectChanges(
		oldConfig: AuditConfig,
		newConfig: AuditConfig
	): Array<{ path: string; oldValue: any; newValue: any }> {
		const changes: Array<{ path: string; oldValue: any; newValue: any }> = []

		const compareObjects = (obj1: any, obj2: any, path = ''): void => {
			for (const key in obj2) {
				const currentPath = path ? `${path}.${key}` : key

				if (!(key in obj1)) {
					changes.push({ path: currentPath, oldValue: undefined, newValue: obj2[key] })
				} else if (
					typeof obj2[key] === 'object' &&
					obj2[key] !== null &&
					!Array.isArray(obj2[key])
				) {
					compareObjects(obj1[key], obj2[key], currentPath)
				} else if (obj1[key] !== obj2[key]) {
					changes.push({ path: currentPath, oldValue: obj1[key], newValue: obj2[key] })
				}
			}
		}

		compareObjects(oldConfig, newConfig)
		return changes
	}

	/**
	 * Mask sensitive URLs
	 */
	private maskSensitiveUrl(url: string): string {
		try {
			const urlObj = new URL(url)
			if (urlObj.password) {
				urlObj.password = '***'
			}
			if (urlObj.username) {
				urlObj.username = '***'
			}
			return urlObj.toString()
		} catch {
			return '***MASKED***'
		}
	}

	/**
	 * Map database change event record to ConfigChangeEvent interface
	 */
	private mapDatabaseChangeEventToChangeEvent(dbChangeEvent: any): ConfigChangeEvent {
		return {
			id: dbChangeEvent.id,
			timestamp: dbChangeEvent.timestamp,
			field: dbChangeEvent.field,
			previousValue: {
				...(typeof dbChangeEvent.previous_value === 'string'
					? JSON.parse(dbChangeEvent.previous_value)
					: dbChangeEvent.previous_value),
			},
			newValue: {
				...(typeof dbChangeEvent.new_value === 'string'
					? JSON.parse(dbChangeEvent.new_value)
					: dbChangeEvent.new_value),
			},
			changedBy: dbChangeEvent.changed_by,
			reason: dbChangeEvent.reason,
			environment: dbChangeEvent.environment,
			previousVersion: dbChangeEvent.previous_version,
			newVersion: dbChangeEvent.new_version,
		}
	}
}

/**
 * Default configuration manager instance
 */
let defaultManager: ConfigurationManager | null = null

/**
 * Get or create the default configuration manager
 */
export function getConfigurationManager(
	configPath?: string,
	storageType?: StorageType,
	hotReloadConfig?: HotReloadConfig,
	secureStorageConfig?: SecureStorageConfig
): ConfigurationManager {
	if (!defaultManager) {
		if (!configPath) {
			throw new Error('Configuration path required for first initialization')
		}
		defaultManager = new ConfigurationManager(
			configPath,
			storageType,
			hotReloadConfig,
			secureStorageConfig
		)
	}
	return defaultManager
}

/**
 * Initialize the default configuration manager
 */
export async function initializeConfig(
	configPath: string,
	storageType?: StorageType,
	hotReloadConfig?: HotReloadConfig,
	secureStorageConfig?: SecureStorageConfig
): Promise<ConfigurationManager> {
	const manager = getConfigurationManager(
		configPath,
		storageType,
		hotReloadConfig,
		secureStorageConfig
	)
	await manager.initialize()
	return manager
}
