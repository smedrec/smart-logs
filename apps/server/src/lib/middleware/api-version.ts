/**
 * @fileoverview API Versioning Middleware
 *
 * Implements API versioning support through headers:
 * - Accept-Version header parsing
 * - API-Version response header
 * - Version compatibility checking
 * - Deprecation warnings
 *
 * Requirements: 2.4, 2.5
 */

import { ApiError } from '@/lib/errors'
import { createMiddleware } from 'hono/factory'

import type { HonoEnv } from '@/lib/hono/context'

export interface ApiVersionConfig {
	currentVersion: string
	supportedVersions: string[]
	deprecatedVersions: string[]
	defaultVersion: string
	headerName: string
	responseHeaderName: string
	strictVersioning: boolean
}

export interface VersionInfo {
	requested: string
	resolved: string
	isDeprecated: boolean
	isSupported: boolean
}

/**
 * Default API version configuration
 */
const DEFAULT_CONFIG: ApiVersionConfig = {
	currentVersion: '1.0.0',
	supportedVersions: ['1.0.0'],
	deprecatedVersions: [],
	defaultVersion: '1.0.0',
	headerName: 'Accept-Version',
	responseHeaderName: 'API-Version',
	strictVersioning: false,
}

/**
 * API versioning middleware
 */
export function apiVersion(config: Partial<ApiVersionConfig> = {}) {
	const fullConfig = { ...DEFAULT_CONFIG, ...config }

	return createMiddleware<HonoEnv>(async (c, next) => {
		const { logger } = c.get('services')

		try {
			// Parse requested version from header
			const requestedVersion = parseVersionHeader(c, fullConfig.headerName)

			// Resolve version to use
			const versionInfo = resolveVersion(requestedVersion, fullConfig)

			// Check if version is supported
			if (!versionInfo.isSupported) {
				throw new ApiError({
					code: 'BAD_REQUEST',
					message: `API version ${versionInfo.requested} is not supported. Supported versions: ${fullConfig.supportedVersions.join(', ')}`,
				})
			}

			// Set version info in context
			c.set('apiVersion', versionInfo)

			// Set response header
			c.header(fullConfig.responseHeaderName, versionInfo.resolved)

			// Add deprecation warning if needed
			if (versionInfo.isDeprecated) {
				c.header('Deprecation', 'true')
				c.header('Sunset', getSunsetDate(versionInfo.resolved, fullConfig))
				c.header('Link', `</api/docs>; rel="successor-version"`)

				logger.warn(`Deprecated API version used: ${versionInfo.resolved}`, {
					requestedVersion: versionInfo.requested,
					resolvedVersion: versionInfo.resolved,
					userAgent: c.req.header('user-agent'),
					path: c.req.path,
				})
			}

			// Log version usage for analytics
			logger.info('API version resolved', {
				requested: versionInfo.requested,
				resolved: versionInfo.resolved,
				deprecated: versionInfo.isDeprecated,
				path: c.req.path,
				method: c.req.method,
			})

			await next()
		} catch (error) {
			if (error instanceof ApiError) {
				throw error
			}

			logger.error('API versioning error', {
				path: c.req.path,
				error:
					error instanceof Error
						? { name: error.name, message: error.message, stack: error.stack }
						: 'Unknown error',
			})

			// Set default version and continue
			c.set('apiVersion', {
				requested: 'unknown',
				resolved: fullConfig.defaultVersion,
				isDeprecated: false,
				isSupported: true,
			})

			c.header(fullConfig.responseHeaderName, fullConfig.defaultVersion)

			await next()
		}
	})
}

/**
 * Parse version from request header
 */
function parseVersionHeader(c: any, headerName: string): string | null {
	const versionHeader = c.req.header(headerName.toLowerCase())

	if (!versionHeader) {
		return null
	}

	// Support different version formats:
	// - "1.0.0"
	// - "v1.0.0"
	// - "application/vnd.api+json;version=1.0.0"

	// Simple version string
	if (/^v?\d+\.\d+\.\d+$/.test(versionHeader)) {
		return versionHeader.replace(/^v/, '')
	}

	// Media type with version parameter
	const mediaTypeMatch = versionHeader.match(/version=([^;,\s]+)/)
	if (mediaTypeMatch) {
		return mediaTypeMatch[1].replace(/^v/, '')
	}

	// Major version only (e.g., "1", "v1")
	const majorVersionMatch = versionHeader.match(/^v?(\d+)$/)
	if (majorVersionMatch) {
		return `${majorVersionMatch[1]}.0.0`
	}

	return versionHeader
}

/**
 * Resolve requested version to supported version
 */
function resolveVersion(requestedVersion: string | null, config: ApiVersionConfig): VersionInfo {
	// Use default if no version requested
	if (!requestedVersion) {
		return {
			requested: 'default',
			resolved: config.defaultVersion,
			isDeprecated: config.deprecatedVersions.includes(config.defaultVersion),
			isSupported: config.supportedVersions.includes(config.defaultVersion),
		}
	}

	// Check if exact version is supported
	if (config.supportedVersions.includes(requestedVersion)) {
		return {
			requested: requestedVersion,
			resolved: requestedVersion,
			isDeprecated: config.deprecatedVersions.includes(requestedVersion),
			isSupported: true,
		}
	}

	// Try to find compatible version if strict versioning is disabled
	if (!config.strictVersioning) {
		const compatibleVersion = findCompatibleVersion(requestedVersion, config.supportedVersions)
		if (compatibleVersion) {
			return {
				requested: requestedVersion,
				resolved: compatibleVersion,
				isDeprecated: config.deprecatedVersions.includes(compatibleVersion),
				isSupported: true,
			}
		}
	}

	// Version not supported
	return {
		requested: requestedVersion,
		resolved: requestedVersion,
		isDeprecated: false,
		isSupported: false,
	}
}

/**
 * Find compatible version using semantic versioning rules
 */
function findCompatibleVersion(requested: string, supported: string[]): string | null {
	const requestedParts = parseVersion(requested)
	if (!requestedParts) return null

	// Find the highest compatible version
	let bestMatch: string | null = null
	let bestMatchParts: [number, number, number] | null = null

	for (const version of supported) {
		const versionParts = parseVersion(version)
		if (!versionParts) continue

		// Check compatibility (same major version, minor version >= requested)
		if (versionParts[0] === requestedParts[0] && versionParts[1] >= requestedParts[1]) {
			if (!bestMatchParts || compareVersions(versionParts, bestMatchParts) > 0) {
				bestMatch = version
				bestMatchParts = versionParts
			}
		}
	}

	return bestMatch
}

/**
 * Parse version string into [major, minor, patch]
 */
function parseVersion(version: string): [number, number, number] | null {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
	if (!match) return null

	return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

/**
 * Compare two version tuples
 */
function compareVersions(a: [number, number, number], b: [number, number, number]): number {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) {
			return a[i] - b[i]
		}
	}
	return 0
}

/**
 * Get sunset date for deprecated version
 */
function getSunsetDate(version: string, config: ApiVersionConfig): string {
	// Calculate sunset date (6 months from now for deprecated versions)
	const sunsetDate = new Date()
	sunsetDate.setMonth(sunsetDate.getMonth() + 6)
	return sunsetDate.toISOString().split('T')[0] // YYYY-MM-DD format
}

/**
 * Middleware to check minimum API version
 */
export function requireMinVersion(minVersion: string) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const versionInfo = c.get('apiVersion') as VersionInfo

		if (!versionInfo) {
			throw new ApiError({
				code: 'BAD_REQUEST',
				message: 'API version information is required',
			})
		}

		const resolvedParts = parseVersion(versionInfo.resolved)
		const minParts = parseVersion(minVersion)

		if (!resolvedParts || !minParts) {
			throw new ApiError({
				code: 'BAD_REQUEST',
				message: 'Invalid API version format',
			})
		}

		if (compareVersions(resolvedParts, minParts) < 0) {
			throw new ApiError({
				code: 'BAD_REQUEST',
				message: `This endpoint requires API version ${minVersion} or higher. Current version: ${versionInfo.resolved}`,
			})
		}

		await next()
	})
}

/**
 * Middleware to mark endpoint as deprecated
 */
export function deprecated(sunsetDate?: string, successorPath?: string) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const { logger } = c.get('services')

		// Set deprecation headers
		c.header('Deprecation', 'true')

		if (sunsetDate) {
			c.header('Sunset', sunsetDate)
		}

		if (successorPath) {
			c.header('Link', `<${successorPath}>; rel="successor-version"`)
		}

		// Log deprecated endpoint usage
		logger.warn('Deprecated endpoint accessed', {
			path: c.req.path,
			method: c.req.method,
			userAgent: c.req.header('user-agent'),
			sunsetDate,
			successorPath,
		})

		await next()
	})
}

/**
 * Get version-specific configuration
 */
export function getVersionConfig() {
	return {
		'1.0.0': {
			features: ['audit-events', 'compliance-reports', 'metrics'],
			limits: {
				maxPageSize: 100,
				maxQueryComplexity: 1000,
			},
		},
		// Future versions can be added here
	}
}
