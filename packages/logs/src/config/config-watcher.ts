import { EventEmitter } from 'node:events'
import { FSWatcher, watch } from 'node:fs'

import { ConfigLoader } from './config-loader.js'

import type { LoggingConfig } from '../types/config.js'

/**
 * Configuration file watcher with hot-reloading support
 * Addresses requirement 7.5: Configuration hot-reloading
 */
export class ConfigWatcher extends EventEmitter {
	private watcher?: FSWatcher
	private configPath?: string
	private currentConfig?: LoggingConfig
	private reloadTimeoutId?: NodeJS.Timeout
	private readonly reloadDebounceMs: number

	constructor(options: { reloadDebounceMs?: number } = {}) {
		super()
		this.reloadDebounceMs = options.reloadDebounceMs ?? 1000
	}

	/**
	 * Start watching a configuration file for changes
	 */
	startWatching(configPath: string, initialConfig?: Partial<LoggingConfig>): LoggingConfig {
		this.configPath = configPath

		// Load initial configuration
		try {
			this.currentConfig = ConfigLoader.loadFromPath(configPath, initialConfig)
		} catch (error) {
			throw new Error(
				`Failed to load initial configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}

		// Start file watcher
		try {
			this.watcher = watch(configPath, { persistent: false }, (eventType) => {
				if (eventType === 'change') {
					this.scheduleReload()
				}
			})

			this.watcher.on('error', (error) => {
				this.emit('error', new Error(`Configuration file watcher error: ${error.message}`))
			})

			this.emit('loaded', this.currentConfig)
		} catch (error) {
			throw new Error(
				`Failed to start configuration file watcher: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
		}

		return this.currentConfig
	}

	/**
	 * Stop watching the configuration file
	 */
	stopWatching(): void {
		if (this.reloadTimeoutId) {
			clearTimeout(this.reloadTimeoutId)
			this.reloadTimeoutId = undefined
		}

		if (this.watcher) {
			this.watcher.close()
			this.watcher = undefined
		}

		this.configPath = undefined
		this.currentConfig = undefined
	}

	/**
	 * Get the current configuration
	 */
	getCurrentConfig(): LoggingConfig | undefined {
		return this.currentConfig
	}

	/**
	 * Manually reload configuration
	 */
	async reloadConfig(providedConfig?: Partial<LoggingConfig>): Promise<LoggingConfig> {
		if (!this.configPath) {
			throw new Error('No configuration file is being watched')
		}

		const previousConfig = this.currentConfig

		try {
			// Load new configuration
			const newConfig = ConfigLoader.loadFromPath(this.configPath, providedConfig)

			// Validate that the new configuration is safe to apply
			this.validateConfigurationChange(previousConfig, newConfig)

			// Update current configuration
			this.currentConfig = newConfig

			// Emit reload event
			this.emit('reloaded', {
				previous: previousConfig,
				current: newConfig,
				changes: this.getConfigurationChanges(previousConfig, newConfig),
			})

			return newConfig
		} catch (error) {
			// Emit error and keep previous configuration
			const reloadError = new Error(
				`Configuration reload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			)
			this.emit('reload-error', {
				error: reloadError,
				previous: previousConfig,
				fallback: previousConfig,
			})

			// Re-throw to allow caller to handle
			throw reloadError
		}
	}

	/**
	 * Schedule a debounced configuration reload
	 */
	private scheduleReload(): void {
		if (this.reloadTimeoutId) {
			clearTimeout(this.reloadTimeoutId)
		}

		this.reloadTimeoutId = setTimeout(() => {
			this.reloadConfig().catch((error) => {
				// Error is already emitted in reloadConfig, just log it
				console.error('Configuration reload failed:', error.message)
			})
		}, this.reloadDebounceMs)
	}

	/**
	 * Validate that a configuration change is safe to apply
	 */
	private validateConfigurationChange(
		previous: LoggingConfig | undefined,
		next: LoggingConfig
	): void {
		if (!previous) {
			return // Initial load, no validation needed
		}

		// Check for critical changes that might cause issues
		const criticalChanges: string[] = []

		// Service name changes could break log aggregation
		if (previous.service !== next.service) {
			criticalChanges.push(`Service name changed from "${previous.service}" to "${next.service}"`)
		}

		// Environment changes could affect log routing
		if (previous.environment !== next.environment) {
			criticalChanges.push(
				`Environment changed from "${previous.environment}" to "${next.environment}"`
			)
		}

		// Transport endpoint changes need validation
		if (previous.otlp?.endpoint !== next.otlp?.endpoint) {
			criticalChanges.push(
				`OTLP endpoint changed from "${previous.otlp?.endpoint}" to "${next.otlp?.endpoint}"`
			)
		}

		if (previous.redis?.host !== next.redis?.host || previous.redis?.port !== next.redis?.port) {
			criticalChanges.push(`Redis connection changed`)
		}

		// Emit warning for critical changes but don't block them
		if (criticalChanges.length > 0) {
			this.emit('critical-changes', {
				changes: criticalChanges,
				previous,
				next,
			})
		}
	}

	/**
	 * Get a summary of configuration changes
	 */
	private getConfigurationChanges(
		previous: LoggingConfig | undefined,
		current: LoggingConfig
	): ConfigurationChange[] {
		if (!previous) {
			return [{ type: 'initial-load', path: '', previous: undefined, current }]
		}

		const changes: ConfigurationChange[] = []
		this.compareObjects('', previous, current, changes)
		return changes
	}

	/**
	 * Recursively compare configuration objects to find changes
	 */
	private compareObjects(
		path: string,
		previous: any,
		current: any,
		changes: ConfigurationChange[]
	): void {
		// Handle primitive values
		if (
			typeof previous !== 'object' ||
			typeof current !== 'object' ||
			previous === null ||
			current === null
		) {
			if (previous !== current) {
				changes.push({
					type: 'modified',
					path,
					previous,
					current,
				})
			}
			return
		}

		// Get all keys from both objects
		const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)])

		for (const key of allKeys) {
			const newPath = path ? `${path}.${key}` : key
			const prevValue = previous[key]
			const currValue = current[key]

			if (!(key in previous)) {
				changes.push({
					type: 'added',
					path: newPath,
					previous: undefined,
					current: currValue,
				})
			} else if (!(key in current)) {
				changes.push({
					type: 'removed',
					path: newPath,
					previous: prevValue,
					current: undefined,
				})
			} else {
				this.compareObjects(newPath, prevValue, currValue, changes)
			}
		}
	}
}

/**
 * Configuration change event data
 */
export interface ConfigurationChange {
	type: 'initial-load' | 'added' | 'removed' | 'modified'
	path: string
	previous: any
	current: any
}

/**
 * Configuration reload event data
 */
export interface ConfigurationReloadEvent {
	previous: LoggingConfig | undefined
	current: LoggingConfig
	changes: ConfigurationChange[]
}

/**
 * Configuration reload error event data
 */
export interface ConfigurationReloadErrorEvent {
	error: Error
	previous: LoggingConfig | undefined
	fallback: LoggingConfig | undefined
}

/**
 * Critical changes warning event data
 */
export interface ConfigurationCriticalChangesEvent {
	changes: string[]
	previous: LoggingConfig
	next: LoggingConfig
}

// Type augmentation for ConfigWatcher events
export interface ConfigWatcher {
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
