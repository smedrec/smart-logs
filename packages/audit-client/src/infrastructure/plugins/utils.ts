// ============================================================================
// Plugin Utilities
// ============================================================================

import type { ValidationResult } from '@/types/shared-schemas'
import type {
	AuthPlugin,
	MiddlewarePlugin,
	Plugin,
	PluginRegistry,
	StoragePlugin,
} from '../plugins'

// ============================================================================
// Plugin Validation Utilities
// ============================================================================

/**
 * Validate plugin interface compliance
 */
export function validatePlugin(plugin: any): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Check required properties
	if (!plugin.name || typeof plugin.name !== 'string') {
		errors.push('Plugin must have a valid name property')
	}

	if (!plugin.version || typeof plugin.version !== 'string') {
		errors.push('Plugin must have a valid version property')
	}

	if (!plugin.initialize || typeof plugin.initialize !== 'function') {
		errors.push('Plugin must have an initialize method')
	}

	// Check optional properties
	if (plugin.description && typeof plugin.description !== 'string') {
		warnings.push('Plugin description should be a string')
	}

	if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
		errors.push('Plugin dependencies must be an array')
	}

	if (plugin.validateConfig && typeof plugin.validateConfig !== 'function') {
		errors.push('Plugin validateConfig must be a function')
	}

	if (plugin.destroy && typeof plugin.destroy !== 'function') {
		errors.push('Plugin destroy must be a function')
	}

	const result: ValidationResult = {
		isValid: errors.length === 0,
	}

	if (errors.length > 0) {
		result.errors = errors
	}

	if (warnings.length > 0) {
		result.warnings = warnings
	}

	return result
}

/**
 * Validate middleware plugin interface
 */
export function validateMiddlewarePlugin(plugin: any): ValidationResult {
	const baseValidation = validatePlugin(plugin)
	if (!baseValidation.isValid) {
		return baseValidation
	}

	const errors: string[] = []
	const warnings: string[] = []

	if (plugin.type !== 'middleware') {
		errors.push('Middleware plugin must have type "middleware"')
	}

	if (plugin.processRequest && typeof plugin.processRequest !== 'function') {
		errors.push('processRequest must be a function')
	}

	if (plugin.processResponse && typeof plugin.processResponse !== 'function') {
		errors.push('processResponse must be a function')
	}

	if (plugin.handleError && typeof plugin.handleError !== 'function') {
		errors.push('handleError must be a function')
	}

	if (!plugin.processRequest && !plugin.processResponse) {
		warnings.push(
			'Middleware plugin should implement at least one of processRequest or processResponse'
		)
	}

	const allErrors = [...(baseValidation.errors || []), ...errors]
	const allWarnings = [...(baseValidation.warnings || []), ...warnings]

	const result: ValidationResult = {
		isValid: allErrors.length === 0,
	}

	if (allErrors.length > 0) {
		result.errors = allErrors
	}

	if (allWarnings.length > 0) {
		result.warnings = allWarnings
	}

	return result
}

/**
 * Validate storage plugin interface
 */
export function validateStoragePlugin(plugin: any): ValidationResult {
	const baseValidation = validatePlugin(plugin)
	if (!baseValidation.isValid) {
		return baseValidation
	}

	const errors: string[] = []

	if (plugin.type !== 'storage') {
		errors.push('Storage plugin must have type "storage"')
	}

	if (!plugin.createStorage || typeof plugin.createStorage !== 'function') {
		errors.push('Storage plugin must have a createStorage method')
	}

	const allErrors = [...(baseValidation.errors || []), ...errors]

	const result: ValidationResult = {
		isValid: allErrors.length === 0,
	}

	if (allErrors.length > 0) {
		result.errors = allErrors
	}

	if (baseValidation.warnings) {
		result.warnings = baseValidation.warnings
	}

	return result
}

/**
 * Validate auth plugin interface
 */
export function validateAuthPlugin(plugin: any): ValidationResult {
	const baseValidation = validatePlugin(plugin)
	if (!baseValidation.isValid) {
		return baseValidation
	}

	const errors: string[] = []
	const warnings: string[] = []

	if (plugin.type !== 'auth') {
		errors.push('Auth plugin must have type "auth"')
	}

	if (!plugin.getAuthHeaders || typeof plugin.getAuthHeaders !== 'function') {
		errors.push('Auth plugin must have a getAuthHeaders method')
	}

	if (plugin.refreshToken && typeof plugin.refreshToken !== 'function') {
		errors.push('refreshToken must be a function')
	}

	if (plugin.validateAuthConfig && typeof plugin.validateAuthConfig !== 'function') {
		errors.push('validateAuthConfig must be a function')
	}

	if (plugin.handleAuthError && typeof plugin.handleAuthError !== 'function') {
		errors.push('handleAuthError must be a function')
	}

	const allErrors = [...(baseValidation.errors || []), ...errors]
	const allWarnings = [...(baseValidation.warnings || []), ...warnings]

	const result: ValidationResult = {
		isValid: allErrors.length === 0,
	}

	if (allErrors.length > 0) {
		result.errors = allErrors
	}

	if (allWarnings.length > 0) {
		result.warnings = allWarnings
	}

	return result
}

// ============================================================================
// Plugin Discovery Utilities
// ============================================================================

/**
 * Plugin discovery result
 */
export interface PluginDiscoveryResult {
	plugins: Plugin[]
	errors: Array<{ name: string; error: string }>
}

/**
 * Discover plugins from a list of plugin constructors
 */
export function discoverPlugins(
	pluginConstructors: Array<new () => Plugin>
): PluginDiscoveryResult {
	const plugins: Plugin[] = []
	const errors: Array<{ name: string; error: string }> = []

	for (const PluginConstructor of pluginConstructors) {
		try {
			const plugin = new PluginConstructor()
			const validation = validatePlugin(plugin)

			if (validation.isValid) {
				plugins.push(plugin)
			} else {
				errors.push({
					name: plugin.name || 'Unknown',
					error: validation.errors?.join(', ') || 'Unknown validation error',
				})
			}
		} catch (error) {
			errors.push({
				name: 'Unknown',
				error: `Failed to instantiate plugin: ${error}`,
			})
		}
	}

	return { plugins, errors }
}

/**
 * Load plugins from configuration
 */
export async function loadPluginsFromConfig(
	pluginConfigs: PluginConfig[],
	registry: PluginRegistry
): Promise<PluginLoadResult> {
	const loaded: string[] = []
	const failed: Array<{ name: string; error: string }> = []

	for (const config of pluginConfigs) {
		try {
			const plugin = await loadPlugin(config)
			await registry.register(plugin, config.config)
			loaded.push(plugin.name)
		} catch (error) {
			failed.push({
				name: config.name,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	return { loaded, failed }
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
	name: string
	module?: string
	constructor?: string
	config?: any
	enabled?: boolean
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
	loaded: string[]
	failed: Array<{ name: string; error: string }>
}

/**
 * Load a single plugin from configuration
 */
async function loadPlugin(config: PluginConfig): Promise<Plugin> {
	if (!config.enabled) {
		throw new Error('Plugin is disabled')
	}

	if (config.module) {
		// Dynamic import (would need proper implementation)
		throw new Error('Dynamic plugin loading not implemented')
	}

	throw new Error('No plugin source specified')
}

// ============================================================================
// Plugin Dependency Resolution
// ============================================================================

/**
 * Resolve plugin dependencies and return sorted list
 */
export function resolveDependencies(plugins: Plugin[]): Plugin[] {
	const pluginMap = new Map<string, Plugin>()
	const visited = new Set<string>()
	const visiting = new Set<string>()
	const sorted: Plugin[] = []

	// Build plugin map
	for (const plugin of plugins) {
		pluginMap.set(plugin.name, plugin)
	}

	// Topological sort with cycle detection
	function visit(pluginName: string): void {
		if (visited.has(pluginName)) {
			return
		}

		if (visiting.has(pluginName)) {
			throw new Error(`Circular dependency detected involving plugin '${pluginName}'`)
		}

		const plugin = pluginMap.get(pluginName)
		if (!plugin) {
			throw new Error(`Plugin '${pluginName}' not found`)
		}

		visiting.add(pluginName)

		// Visit dependencies first
		if (plugin.dependencies) {
			for (const dep of plugin.dependencies) {
				visit(dep)
			}
		}

		visiting.delete(pluginName)
		visited.add(pluginName)
		sorted.push(plugin)
	}

	// Visit all plugins
	for (const plugin of plugins) {
		visit(plugin.name)
	}

	return sorted
}

// ============================================================================
// Plugin Configuration Utilities
// ============================================================================

/**
 * Merge plugin configurations with defaults
 */
export function mergePluginConfig<T extends Record<string, any>>(
	defaultConfig: T,
	userConfig: Partial<T>
): T {
	const merged = { ...defaultConfig }

	for (const [key, value] of Object.entries(userConfig)) {
		if (value !== undefined) {
			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				merged[key as keyof T] = mergePluginConfig(
					merged[key as keyof T] as Record<string, any>,
					value
				) as T[keyof T]
			} else {
				merged[key as keyof T] = value
			}
		}
	}

	return merged
}

/**
 * Validate plugin configuration against schema
 */
export function validatePluginConfig(config: any, schema: any): ValidationResult {
	// Simple validation - in a real implementation, you might use a library like Joi or Zod
	const errors: string[] = []

	if (!schema) {
		return { isValid: true }
	}

	// Basic type checking
	for (const [key, schemaValue] of Object.entries(schema)) {
		const configValue = config[key]
		const schemaObj = schemaValue as any

		if (schemaObj.required && (configValue === undefined || configValue === null)) {
			errors.push(`Required property '${key}' is missing`)
			continue
		}

		if (configValue !== undefined && schemaObj.type) {
			const actualType = Array.isArray(configValue) ? 'array' : typeof configValue
			if (actualType !== schemaObj.type) {
				errors.push(`Property '${key}' must be of type '${schemaObj.type}', got '${actualType}'`)
			}
		}
	}

	const result: ValidationResult = {
		isValid: errors.length === 0,
	}

	if (errors.length > 0) {
		result.errors = errors
	}

	return result
}

// ============================================================================
// Plugin Performance Utilities
// ============================================================================

/**
 * Plugin performance metrics
 */
export interface PluginPerformanceMetrics {
	pluginName: string
	executionCount: number
	totalExecutionTime: number
	averageExecutionTime: number
	minExecutionTime: number
	maxExecutionTime: number
	errorCount: number
	lastExecuted?: Date
}

/**
 * Plugin performance tracker
 */
export class PluginPerformanceTracker {
	private metrics = new Map<string, PluginPerformanceMetrics>()

	/**
	 * Track plugin execution
	 */
	async trackExecution<T>(pluginName: string, operation: () => Promise<T> | T): Promise<T> {
		const startTime = Date.now()
		let error: Error | null = null

		try {
			const result = await operation()
			return result
		} catch (err) {
			error = err as Error
			throw err
		} finally {
			const executionTime = Date.now() - startTime
			this.recordExecution(pluginName, executionTime, error)
		}
	}

	/**
	 * Record plugin execution metrics
	 */
	private recordExecution(pluginName: string, executionTime: number, error: Error | null): void {
		let metrics = this.metrics.get(pluginName)

		if (!metrics) {
			metrics = {
				pluginName,
				executionCount: 0,
				totalExecutionTime: 0,
				averageExecutionTime: 0,
				minExecutionTime: Infinity,
				maxExecutionTime: 0,
				errorCount: 0,
			}
			this.metrics.set(pluginName, metrics)
		}

		metrics.executionCount++
		metrics.totalExecutionTime += executionTime
		metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.executionCount
		metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime)
		metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime)
		metrics.lastExecuted = new Date()

		if (error) {
			metrics.errorCount++
		}
	}

	/**
	 * Get metrics for a specific plugin
	 */
	getMetrics(pluginName: string): PluginPerformanceMetrics | undefined {
		return this.metrics.get(pluginName)
	}

	/**
	 * Get all plugin metrics
	 */
	getAllMetrics(): PluginPerformanceMetrics[] {
		return Array.from(this.metrics.values())
	}

	/**
	 * Reset metrics for a plugin
	 */
	resetMetrics(pluginName: string): void {
		this.metrics.delete(pluginName)
	}

	/**
	 * Reset all metrics
	 */
	resetAllMetrics(): void {
		this.metrics.clear()
	}
}
