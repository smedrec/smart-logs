import { EventEmitter } from 'node:events'

import { ConfigLoader } from './config-loader.js'
import { ConfigWatcher } from './config-watcher.js'

import type { LoggingConfig } from '../types/config.js'
import type {
	ConfigurationCriticalChangesEvent,
	ConfigurationReloadErrorEvent,
	ConfigurationReloadEvent,
} from './config-watcher.js'

/**
 * Centralized configuration manager with loading, validation, and hot-reloading
 * Addresses requirements 7.1, 7.2, 7.5: Configuration management with hot-reloading
 */
export class ConfigManager extends EventEmitter {
	private watcher?: ConfigWatcher
	private currentConfig?: LoggingConfig
	private isWatching = false

	/**
	 * Load configuration from multiple sources
	 */
	load(providedConfig: Partial<LoggingConfig> = {}): LoggingConfig {
		this.currentConfig = ConfigLoader.load(providedConfig)
		this.emit('loaded', this.currentConfig)
		return this.currentConfig
	}

	/**
	 * Load configuration from a specific file path
	 */
	loadFromPath(configPath: string, providedConfig: Partial<LoggingConfig> = {}): LoggingConfig {
		this.currentConfig = ConfigLoader.loadFromPath(configPath, providedConfig)
		this.emit('loaded', this.currentConfig)
		return this.currentConfig
	}

	/**
	 * Start watching a configuration file for changes
	 */
	startWatching(configPath: string, initialConfig?: Partial<LoggingConfig>): LoggingConfig {
		if (this.isWatching) {
			throw new Error(
				'Configuration watcher is already active. Stop watching before starting a new watcher.'
			)
		}

		this.watcher = new ConfigWatcher()

		// Forward events from watcher
		this.watcher.on('loaded', (config) => {
			this.currentConfig = config
			this.emit('loaded', config)
		})

		this.watcher.on('reloaded', (data) => {
			this.currentConfig = data.current
			this.emit('reloaded', data)
		})

		this.watcher.on('reload-error', (data) => {
			this.emit('reload-error', data)
		})

		this.watcher.on('critical-changes', (data) => {
			this.emit('critical-changes', data)
		})

		this.watcher.on('error', (error) => {
			this.emit('error', error)
		})

		try {
			const config = this.watcher.startWatching(configPath, initialConfig)
			this.isWatching = true
			return config
		} catch (error) {
			this.watcher = undefined
			throw error
		}
	}

	/**
	 * Stop watching configuration file changes
	 */
	stopWatching(): void {
		if (this.watcher) {
			this.watcher.stopWatching()
			this.watcher.removeAllListeners()
			this.watcher = undefined
		}
		this.isWatching = false
	}

	/**
	 * Manually reload configuration (only works when watching)
	 */
	async reloadConfig(providedConfig?: Partial<LoggingConfig>): Promise<LoggingConfig> {
		if (!this.watcher) {
			throw new Error('Configuration watcher is not active. Cannot reload configuration.')
		}

		return await this.watcher.reloadConfig(providedConfig)
	}

	/**
	 * Get the current configuration
	 */
	getCurrentConfig(): LoggingConfig | undefined {
		return this.currentConfig
	}

	/**
	 * Validate configuration without loading
	 */
	validate(config: unknown): LoggingConfig {
		return ConfigLoader.validate(config)
	}

	/**
	 * Validate partial configuration
	 */
	validatePartial(config: unknown): Partial<LoggingConfig> {
		return ConfigLoader.validatePartial(config)
	}

	/**
	 * Check if configuration watcher is active
	 */
	isWatchingConfig(): boolean {
		return this.isWatching
	}

	/**
	 * Get default configuration values
	 */
	getDefaults(): Partial<LoggingConfig> {
		return ConfigLoader.getDefaults()
	}

	/**
	 * Merge multiple configuration objects with proper precedence
	 */
	mergeConfigs(...configs: Partial<LoggingConfig>[]): LoggingConfig {
		const merged = configs.reduce(
			(acc, config) => ({
				...acc,
				...config,
			}),
			ConfigLoader.getDefaults()
		)

		return this.validate(merged)
	}

	/**
	 * Create a configuration snapshot for debugging
	 */
	createSnapshot(): ConfigurationSnapshot {
		return {
			timestamp: new Date(),
			config: this.currentConfig ? { ...this.currentConfig } : undefined,
			isWatching: this.isWatching,
			source: this.isWatching ? 'file-watcher' : 'static-load',
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.stopWatching()
		this.removeAllListeners()
		this.currentConfig = undefined
	}
}

/**
 * Configuration snapshot for debugging and monitoring
 */
export interface ConfigurationSnapshot {
	timestamp: Date
	config: LoggingConfig | undefined
	isWatching: boolean
	source: 'file-watcher' | 'static-load'
}

// Type augmentation for ConfigManager events
export interface ConfigManager {
	on(event: 'loaded', listener: (config: LoggingConfig) => void): this
	on(event: 'reloaded', listener: (data: ConfigurationReloadEvent) => void): this
	on(event: 'reload-error', listener: (data: ConfigurationReloadErrorEvent) => void): this
	on(event: 'critical-changes', listener: (data: ConfigurationCriticalChangesEvent) => void): this
	on(event: 'error', listener: (error: Error) => void): this

	emit(event: 'loaded', config: LoggingConfig): boolean
	emit(event: 'reloaded', data: ConfigurationReloadEvent): boolean
	emit(event: 'reload-error', data: ConfigurationReloadErrorEvent): boolean
	emit(event: 'critical-changes', data: ConfigurationCriticalChangesEvent): boolean
	emit(event: 'error', error: Error): boolean
}
