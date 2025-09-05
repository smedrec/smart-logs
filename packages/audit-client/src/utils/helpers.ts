import type {
	AuditEvent,
	CreateAuditEventInput,
	PaginationParams,
	QueryAuditEventsParams,
} from '../types/api'
import type {
	CacheKey,
	DeepPartial,
	HttpHeaders,
	ISODateTime,
	QueryParams,
	Result,
	TryResult,
	UUID,
} from '../types/utils'

// ============================================================================
// ID Generation Utilities
// ============================================================================

/**
 * Generates a UUID v4
 */
export function generateUUID(): UUID {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	}) as UUID
}

/**
 * Generates a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generates a request ID for tracking
 */
export function generateRequestId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generates a session ID
 */
export function generateSessionId(): string {
	return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// ============================================================================
// Date and Time Utilities
// ============================================================================

/**
 * Gets the current ISO datetime string
 */
export function getCurrentISODateTime(): ISODateTime {
	return new Date().toISOString() as ISODateTime
}

/**
 * Converts a date to ISO datetime string
 */
export function toISODateTime(date: Date | string | number): ISODateTime {
	return new Date(date).toISOString() as ISODateTime
}

/**
 * Parses an ISO datetime string to Date
 */
export function parseISODateTime(isoString: ISODateTime): Date {
	return new Date(isoString)
}

/**
 * Adds time to a date
 */
export function addTime(
	date: Date | string,
	amount: number,
	unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
): Date {
	const baseDate = new Date(date)

	switch (unit) {
		case 'milliseconds':
			return new Date(baseDate.getTime() + amount)
		case 'seconds':
			return new Date(baseDate.getTime() + amount * 1000)
		case 'minutes':
			return new Date(baseDate.getTime() + amount * 60 * 1000)
		case 'hours':
			return new Date(baseDate.getTime() + amount * 60 * 60 * 1000)
		case 'days':
			return new Date(baseDate.getTime() + amount * 24 * 60 * 60 * 1000)
		case 'weeks':
			return new Date(baseDate.getTime() + amount * 7 * 24 * 60 * 60 * 1000)
		case 'months':
			const newDate = new Date(baseDate)
			newDate.setMonth(newDate.getMonth() + amount)
			return newDate
		case 'years':
			const yearDate = new Date(baseDate)
			yearDate.setFullYear(yearDate.getFullYear() + amount)
			return yearDate
		default:
			return baseDate
	}
}

/**
 * Formats a duration in milliseconds to human readable string
 */
export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`
	}

	const seconds = Math.floor(milliseconds / 1000)
	if (seconds < 60) {
		return `${seconds}s`
	}

	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) {
		return `${minutes}m ${seconds % 60}s`
	}

	const hours = Math.floor(minutes / 60)
	if (hours < 24) {
		return `${hours}h ${minutes % 60}m`
	}

	const days = Math.floor(hours / 24)
	return `${days}d ${hours % 24}h`
}

/**
 * Checks if a date is within a range
 */
export function isDateInRange(
	date: Date | string,
	startDate: Date | string,
	endDate: Date | string
): boolean {
	const checkDate = new Date(date)
	const start = new Date(startDate)
	const end = new Date(endDate)

	return checkDate >= start && checkDate <= end
}

// ============================================================================
// Object Manipulation Utilities
// ============================================================================

/**
 * Deep clones an object
 */
export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== 'object') {
		return obj
	}

	if (obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as T
	}

	if (obj instanceof Array) {
		return obj.map((item) => deepClone(item)) as unknown as T
	}

	if (typeof obj === 'object') {
		const cloned = {} as T
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				cloned[key] = deepClone(obj[key])
			}
		}
		return cloned
	}

	return obj
}

/**
 * Deep merges two objects
 */
export function deepMerge<T extends Record<string, any>, U extends Record<string, any>>(
	target: T,
	source: U
): T & U {
	const result = { ...target } as T & U

	for (const key in source) {
		if (source.hasOwnProperty(key)) {
			const sourceValue = source[key]
			const targetValue = (target as any)[key]

			if (
				sourceValue &&
				typeof sourceValue === 'object' &&
				!Array.isArray(sourceValue) &&
				targetValue &&
				typeof targetValue === 'object' &&
				!Array.isArray(targetValue)
			) {
				;(result as any)[key] = deepMerge(targetValue, sourceValue)
			} else {
				;(result as any)[key] = sourceValue
			}
		}
	}

	return result
}

/**
 * Picks specific properties from an object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
	obj: T,
	keys: K[]
): Pick<T, K> {
	const result = {} as Pick<T, K>

	for (const key of keys) {
		if (key in obj) {
			result[key] = obj[key]
		}
	}

	return result
}

/**
 * Omits specific properties from an object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
	obj: T,
	keys: K[]
): Omit<T, K> {
	const result = { ...obj } as Omit<T, K>

	for (const key of keys) {
		delete (result as any)[key]
	}

	return result
}

/**
 * Removes undefined properties from an object
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
	const result = {} as T

	for (const key in obj) {
		if (obj[key] !== undefined) {
			result[key] = obj[key]
		}
	}

	return result
}

/**
 * Removes null and undefined properties from an object
 */
export function removeNullish<T extends Record<string, any>>(obj: T): T {
	const result = {} as T

	for (const key in obj) {
		if (obj[key] != null) {
			result[key] = obj[key]
		}
	}

	return result
}

/**
 * Flattens a nested object with dot notation keys
 */
export function flattenObject(
	obj: Record<string, any>,
	prefix = '',
	result: Record<string, any> = {}
): Record<string, any> {
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const newKey = prefix ? `${prefix}.${key}` : key

			if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
				flattenObject(obj[key], newKey, result)
			} else {
				result[newKey] = obj[key]
			}
		}
	}

	return result
}

/**
 * Unflatten an object with dot notation keys
 */
export function unflattenObject(obj: Record<string, any>): Record<string, any> {
	const result: Record<string, any> = {}

	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			const keys = key.split('.')
			let current = result

			for (let i = 0; i < keys.length - 1; i++) {
				const k = keys[i]
				if (!k) continue
				if (!(k in current)) {
					current[k] = {}
				}
				current = current[k]
			}

			const finalKey = keys[keys.length - 1]
			if (finalKey) {
				current[finalKey] = obj[key]
			}
		}
	}

	return result
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunk<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = []

	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size))
	}

	return chunks
}

/**
 * Removes duplicates from an array
 */
export function unique<T>(array: T[]): T[] {
	return Array.from(new Set(array))
}

/**
 * Removes duplicates from an array based on a key function
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
	const seen = new Set<K>()
	return array.filter((item) => {
		const key = keyFn(item)
		if (seen.has(key)) {
			return false
		}
		seen.add(key)
		return true
	})
}

/**
 * Groups array items by a key function
 */
export function groupBy<T, K extends string | number | symbol>(
	array: T[],
	keyFn: (item: T) => K
): Record<K, T[]> {
	const groups = {} as Record<K, T[]>

	for (const item of array) {
		const key = keyFn(item)
		if (!groups[key]) {
			groups[key] = []
		}
		groups[key].push(item)
	}

	return groups
}

/**
 * Sorts an array by multiple criteria
 */
export function sortBy<T>(array: T[], ...criteria: Array<(item: T) => any>): T[] {
	return [...array].sort((a, b) => {
		for (const criterion of criteria) {
			const aVal = criterion(a)
			const bVal = criterion(b)

			if (aVal < bVal) return -1
			if (aVal > bVal) return 1
		}
		return 0
	})
}

/**
 * Finds the intersection of two arrays
 */
export function intersection<T>(array1: T[], array2: T[]): T[] {
	const set2 = new Set(array2)
	return array1.filter((item) => set2.has(item))
}

/**
 * Finds the difference between two arrays
 */
export function difference<T>(array1: T[], array2: T[]): T[] {
	const set2 = new Set(array2)
	return array1.filter((item) => !set2.has(item))
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Converts a string to camelCase
 */
export function toCamelCase(str: string): string {
	return str
		.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
			return index === 0 ? word.toLowerCase() : word.toUpperCase()
		})
		.replace(/\s+/g, '')
}

/**
 * Converts a string to PascalCase
 */
export function toPascalCase(str: string): string {
	return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '')
}

/**
 * Converts a string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/\s+/g, '-')
		.toLowerCase()
}

/**
 * Converts a string to snake_case
 */
export function toSnakeCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, '$1_$2')
		.replace(/\s+/g, '_')
		.toLowerCase()
}

/**
 * Capitalizes the first letter of a string
 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Truncates a string to a specified length
 */
export function truncate(str: string, length: number, suffix = '...'): string {
	if (str.length <= length) {
		return str
	}

	return str.slice(0, length - suffix.length) + suffix
}

/**
 * Masks sensitive data in a string
 */
export function maskString(str: string, visibleChars = 4, maskChar = '*'): string {
	if (str.length <= visibleChars * 2) {
		return maskChar.repeat(str.length)
	}

	const start = str.slice(0, visibleChars)
	const end = str.slice(-visibleChars)
	const middle = maskChar.repeat(str.length - visibleChars * 2)

	return start + middle + end
}

/**
 * Escapes HTML characters in a string
 */
export function escapeHtml(str: string): string {
	const htmlEscapes: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	}

	return str.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char)
}

/**
 * Unescapes HTML characters in a string
 */
export function unescapeHtml(str: string): string {
	const htmlUnescapes: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
	}

	return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => htmlUnescapes[entity] || entity)
}

// ============================================================================
// URL and Query Parameter Utilities
// ============================================================================

/**
 * Builds a URL with query parameters
 */
export function buildUrl(baseUrl: string, path?: string, params?: QueryParams): string {
	let url = baseUrl

	if (path) {
		url = url.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
	}

	if (params && Object.keys(params).length > 0) {
		const searchParams = new URLSearchParams()

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					value.forEach((v) => searchParams.append(key, String(v)))
				} else {
					searchParams.append(key, String(value))
				}
			}
		}

		const queryString = searchParams.toString()
		if (queryString) {
			url += (url.includes('?') ? '&' : '?') + queryString
		}
	}

	return url
}

/**
 * Parses query parameters from a URL
 */
export function parseQueryParams(url: string): QueryParams {
	const params: QueryParams = {}
	const urlObj = new URL(url)

	urlObj.searchParams.forEach((value, key) => {
		if (params[key]) {
			// Convert to array if multiple values
			if (Array.isArray(params[key])) {
				;(params[key] as string[]).push(value)
			} else {
				params[key] = [params[key] as string, value]
			}
		} else {
			params[key] = value
		}
	})

	return params
}

/**
 * Extracts the domain from a URL
 */
export function extractDomain(url: string): string {
	try {
		return new URL(url).hostname
	} catch {
		return ''
	}
}

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Generates a cache key from multiple parts
 */
export function generateCacheKey(
	...parts: (string | number | boolean | undefined | null)[]
): CacheKey {
	return parts
		.filter((part) => part != null)
		.map((part) => String(part))
		.join(':')
}

/**
 * Generates a cache key for audit events query
 */
export function generateAuditEventsCacheKey(params: QueryAuditEventsParams): CacheKey {
	const keyParts = ['audit-events']

	if (params.filter) {
		if (params.filter.dateRange) {
			keyParts.push(`date:${params.filter.dateRange.startDate}-${params.filter.dateRange.endDate}`)
		}

		if (params.filter.principalIds?.length) {
			keyParts.push(`principals:${params.filter.principalIds.sort().join(',')}`)
		}

		if (params.filter.organizationIds?.length) {
			keyParts.push(`orgs:${params.filter.organizationIds.sort().join(',')}`)
		}

		if (params.filter.actions?.length) {
			keyParts.push(`actions:${params.filter.actions.sort().join(',')}`)
		}

		if (params.filter.statuses?.length) {
			keyParts.push(`statuses:${params.filter.statuses.sort().join(',')}`)
		}

		if (params.filter.dataClassifications?.length) {
			keyParts.push(`classifications:${params.filter.dataClassifications.sort().join(',')}`)
		}

		if (params.filter.resourceTypes?.length) {
			keyParts.push(`resources:${params.filter.resourceTypes.sort().join(',')}`)
		}

		if (params.filter.verifiedOnly !== undefined) {
			keyParts.push(`verified:${params.filter.verifiedOnly}`)
		}

		if (params.filter.correlationId) {
			keyParts.push(`correlation:${params.filter.correlationId}`)
		}
	}

	if (params.pagination) {
		keyParts.push(`page:${params.pagination.offset || 0}-${params.pagination.limit || 50}`)
	}

	if (params.sort) {
		keyParts.push(`sort:${params.sort.field}-${params.sort.direction}`)
	}

	return keyParts.join(':')
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Wraps a function in a try-catch and returns a Result
 */
export function trySync<T>(fn: () => T): TryResult<T> {
	try {
		return { success: true, data: fn() }
	} catch (error) {
		return { success: false, error: error as Error }
	}
}

/**
 * Wraps an async function in a try-catch and returns a Result
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<TryResult<T>> {
	try {
		const data = await fn()
		return { success: true, data }
	} catch (error) {
		return { success: false, error: error as Error }
	}
}

/**
 * Creates a retry function with exponential backoff
 */
export function createRetryFunction<T>(
	fn: () => Promise<T>,
	options: {
		maxAttempts: number
		initialDelay: number
		maxDelay: number
		backoffMultiplier: number
		retryCondition?: (error: Error) => boolean
	}
): () => Promise<T> {
	return async () => {
		let lastError: Error
		let delay = options.initialDelay

		for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
			try {
				return await fn()
			} catch (error) {
				lastError = error as Error

				if (attempt === options.maxAttempts) {
					break
				}

				if (options.retryCondition && !options.retryCondition(lastError)) {
					break
				}

				await sleep(delay)
				delay = Math.min(delay * options.backoffMultiplier, options.maxDelay)
			}
		}

		throw lastError!
	}
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that required fields are present in an object
 */
export function validateRequiredFields<T extends Record<string, any>>(
	obj: T,
	requiredFields: (keyof T)[]
): { isValid: boolean; missingFields: (keyof T)[] } {
	const missingFields = requiredFields.filter((field) => !(field in obj) || obj[field] == null)

	return {
		isValid: missingFields.length === 0,
		missingFields,
	}
}

/**
 * Sanitizes an object by removing sensitive fields
 */
export function sanitizeObject<T extends Record<string, any>>(
	obj: T,
	sensitiveFields: (keyof T)[] = ['password', 'token', 'secret', 'key', 'apiKey']
): T {
	const sanitized = { ...obj }

	for (const field of sensitiveFields) {
		if (field in sanitized) {
			sanitized[field] = '[REDACTED]' as any
		}
	}

	return sanitized
}

/**
 * Converts pagination parameters to offset and limit
 */
export function normalizePagination(params: PaginationParams): { offset: number; limit: number } {
	return {
		offset: params.offset || 0,
		limit: Math.min(params.limit || 50, 1000), // Cap at 1000
	}
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Measures the execution time of a function
 */
export async function measureTime<T>(
	fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
	const start = performance.now()
	const result = await fn()
	const duration = performance.now() - start

	return { result, duration }
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: NodeJS.Timeout | null = null

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		timeoutId = setTimeout(() => {
			fn(...args)
		}, delay)
	}
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let lastCall = 0

	return (...args: Parameters<T>) => {
		const now = Date.now()

		if (now - lastCall >= delay) {
			lastCall = now
			fn(...args)
		}
	}
}

/**
 * Creates a memoized version of a function
 */
export function memoize<T extends (...args: any[]) => any>(
	fn: T,
	keyGenerator?: (...args: Parameters<T>) => string
): T {
	const cache = new Map<string, ReturnType<T>>()

	return ((...args: Parameters<T>) => {
		const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

		if (cache.has(key)) {
			return cache.get(key)!
		}

		const result = fn(...args)
		cache.set(key, result)

		return result
	}) as T
}

// All functions are already exported above with their declarations
