import { z } from 'zod'

// ============================================================================
// Generic Utility Types
// ============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
	[P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Make specific properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Pick properties by their type
 */
export type PickByType<T, U> = {
	[K in keyof T as T[K] extends U ? K : never]: T[K]
}

/**
 * Omit properties by their type
 */
export type OmitByType<T, U> = {
	[K in keyof T as T[K] extends U ? never : K]: T[K]
}

/**
 * Extract keys that have values of a specific type
 */
export type KeysOfType<T, U> = {
	[K in keyof T]: T[K] extends U ? K : never
}[keyof T]

/**
 * Create a union of all possible keys in a nested object
 */
export type NestedKeys<T> = T extends object
	? {
			[K in keyof T]: K extends string
				? T[K] extends object
					? `${K}` | `${K}.${NestedKeys<T[K]>}`
					: `${K}`
				: never
		}[keyof T]
	: never

/**
 * Get the type of a nested property using dot notation
 */
export type NestedValue<T, K extends string> = K extends `${infer P}.${infer S}`
	? P extends keyof T
		? NestedValue<T[P], S>
		: never
	: K extends keyof T
		? T[K]
		: never

/**
 * Flatten nested object types
 */
export type Flatten<T> = T extends object
	? T extends infer O
		? { [K in keyof O]: Flatten<O[K]> }
		: never
	: T

/**
 * Extract the item type from an array
 */
export type ArrayItem<T> = T extends (infer U)[] ? U : never

/**
 * Extract the data type from a paginated response
 */
export type ExtractPaginatedData<T> = T extends { data: infer U } ? U : never

/**
 * Create a type that excludes null and undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * Create a type that only includes string keys
 */
export type StringKeys<T> = Extract<keyof T, string>

/**
 * Create a type that only includes number keys
 */
export type NumberKeys<T> = Extract<keyof T, number>

/**
 * Create a type that only includes symbol keys
 */
export type SymbolKeys<T> = Extract<keyof T, symbol>

// ============================================================================
// Function Utility Types
// ============================================================================

/**
 * Check if a type is a function
 */
export type IsFunction<T> = T extends (...args: any[]) => any ? true : false

/**
 * Extract function return type
 */
export type FunctionReturnType<T> = T extends (...args: any[]) => infer R ? R : never

/**
 * Extract function parameters
 */
export type FunctionParameters<T> = T extends (...args: infer P) => any ? P : never

/**
 * Create a function type with specific parameters and return type
 */
export type FunctionType<P extends readonly unknown[], R> = (...args: P) => R

/**
 * Make function parameters optional
 */
export type OptionalParameters<T extends (...args: any[]) => any> = T extends (
	...args: infer P
) => infer R
	? (...args: Partial<P>) => R
	: never

// ============================================================================
// Promise Utility Types
// ============================================================================

/**
 * Check if a type is a promise
 */
export type IsPromise<T> = T extends Promise<any> ? true : false

/**
 * Extract promise type
 */
export type PromiseType<T> = T extends Promise<infer U> ? U : T

/**
 * Convert a type to a promise
 */
export type Promisify<T> = T extends Promise<any> ? T : Promise<T>

/**
 * Convert all methods in an interface to return promises
 */
export type PromisifyMethods<T> = {
	[K in keyof T]: T[K] extends (...args: infer P) => infer R ? (...args: P) => Promise<R> : T[K]
}

// ============================================================================
// Array Utility Types
// ============================================================================

/**
 * Check if a type is an array
 */
export type IsArray<T> = T extends any[] ? true : false

/**
 * Get the length of a tuple type
 */
export type Length<T extends readonly any[]> = T['length']

/**
 * Get the first element of a tuple
 */
export type Head<T extends readonly any[]> = T extends readonly [infer H, ...any[]] ? H : never

/**
 * Get all elements except the first
 */
export type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : []

/**
 * Get the last element of a tuple
 */
export type Last<T extends readonly any[]> = T extends readonly [...any[], infer L] ? L : never

/**
 * Reverse a tuple type
 */
export type Reverse<T extends readonly any[]> = T extends readonly [...infer Rest, infer Last]
	? [Last, ...Reverse<Rest>]
	: []

/**
 * Concatenate two tuple types
 */
export type Concat<T extends readonly any[], U extends readonly any[]> = [...T, ...U]

// ============================================================================
// Object Utility Types
// ============================================================================

/**
 * Get all values from an object type
 */
export type Values<T> = T[keyof T]

/**
 * Create a type with all properties set to a specific type
 */
export type MapToType<T, U> = {
	[K in keyof T]: U
}

/**
 * Merge two object types
 */
export type Merge<T, U> = Omit<T, keyof U> & U

/**
 * Deep merge two object types
 */
export type DeepMerge<T, U> = {
	[K in keyof T | keyof U]: K extends keyof U
		? K extends keyof T
			? T[K] extends object
				? U[K] extends object
					? DeepMerge<T[K], U[K]>
					: U[K]
				: U[K]
			: U[K]
		: K extends keyof T
			? T[K]
			: never
}

/**
 * Create an intersection of two types
 */
export type Intersection<T, U> = T & U

/**
 * Create a union of two types
 */
export type Union<T, U> = T | U

/**
 * Exclude properties that are never
 */
export type ExcludeNever<T> = {
	[K in keyof T as T[K] extends never ? never : K]: T[K]
}

// ============================================================================
// String Utility Types
// ============================================================================

/**
 * Convert string to uppercase
 */
export type Uppercase<S extends string> = Intrinsic.Uppercase<S>

/**
 * Convert string to lowercase
 */
export type Lowercase<S extends string> = Intrinsic.Lowercase<S>

/**
 * Capitalize first letter
 */
export type Capitalize<S extends string> = Intrinsic.Capitalize<S>

/**
 * Uncapitalize first letter
 */
export type Uncapitalize<S extends string> = Intrinsic.Uncapitalize<S>

/**
 * Split string by delimiter
 */
export type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
	? [T, ...Split<U, D>]
	: [S]

/**
 * Join array of strings with delimiter
 */
export type Join<T extends readonly string[], D extends string> = T extends readonly [
	infer F,
	...infer R,
]
	? F extends string
		? R extends readonly string[]
			? R['length'] extends 0
				? F
				: `${F}${D}${Join<R, D>}`
			: never
		: never
	: ''

/**
 * Replace all occurrences in string
 */
export type Replace<S extends string, From extends string, To extends string> = From extends ''
	? S
	: S extends `${infer L}${From}${infer R}`
		? `${L}${To}${Replace<R, From, To>}`
		: S

// ============================================================================
// Conditional Utility Types
// ============================================================================

/**
 * If-then-else type
 */
export type If<C extends boolean, T, F> = C extends true ? T : F

/**
 * Check if two types are equal
 */
export type Equals<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

/**
 * Check if a type extends another
 */
export type Extends<T, U> = T extends U ? true : false

/**
 * Check if a type is any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Check if a type is unknown
 */
export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false

/**
 * Check if a type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false

/**
 * Check if a type is null
 */
export type IsNull<T> = [T] extends [null] ? true : false

/**
 * Check if a type is undefined
 */
export type IsUndefined<T> = [T] extends [undefined] ? true : false

// ============================================================================
// Brand Types for Nominal Typing
// ============================================================================

/**
 * Brand type for creating nominal types
 */
export type Brand<T, B> = T & { readonly __brand: B }

/**
 * Unbrand a branded type
 */
export type Unbrand<T> = T extends Brand<infer U, any> ? U : T

/**
 * Branded string types for better type safety
 */
export type UUID = Brand<string, 'UUID'>
export type Email = Brand<string, 'Email'>
export type URL = Brand<string, 'URL'>
export type ISODateTime = Brand<string, 'ISODateTime'>
export type Base64 = Brand<string, 'Base64'>
export type JSONString = Brand<string, 'JSONString'>
export type HexString = Brand<string, 'HexString'>
export type IPAddress = Brand<string, 'IPAddress'>
export type PhoneNumber = Brand<string, 'PhoneNumber'>

/**
 * Branded number types
 */
export type PositiveNumber = Brand<number, 'PositiveNumber'>
export type NegativeNumber = Brand<number, 'NegativeNumber'>
export type Integer = Brand<number, 'Integer'>
export type Percentage = Brand<number, 'Percentage'>
export type Timestamp = Brand<number, 'Timestamp'>

// ============================================================================
// Validation Utility Types
// ============================================================================

/**
 * Type for validation result
 */
export interface ValidationResult<T = unknown> {
	success: boolean
	data?: T
	error?: {
		message: string
		path?: (string | number)[]
		code?: string
	}
	zodError?: import('zod').ZodError
}

/**
 * Type for validation function
 */
export type Validator<T> = (value: unknown) => ValidationResult<T>

/**
 * Type for schema validation
 */
export type SchemaValidator<T> = {
	parse: (value: unknown) => T
	safeParse: (value: unknown) => ValidationResult<T>
	optional: () => SchemaValidator<T | undefined>
	nullable: () => SchemaValidator<T | null>
	array: () => SchemaValidator<T[]>
}

// ============================================================================
// Event Utility Types
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (event: T) => void | Promise<void>

/**
 * Event listener map type
 */
export type EventListenerMap<T extends Record<string, any>> = {
	[K in keyof T]: EventHandler<T[K]>[]
}

/**
 * Event emitter interface
 */
export interface EventEmitter<T extends Record<string, any>> {
	on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
	off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void
	emit<K extends keyof T>(event: K, data: T[K]): void
	removeAllListeners(event?: keyof T): void
}

// ============================================================================
// HTTP Utility Types
// ============================================================================

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

/**
 * HTTP status codes
 */
export type HttpStatusCode =
	| 200
	| 201
	| 202
	| 204
	| 300
	| 301
	| 302
	| 304
	| 400
	| 401
	| 403
	| 404
	| 409
	| 422
	| 429
	| 500
	| 501
	| 502
	| 503
	| 504

/**
 * Content types
 */
export type ContentType =
	| 'application/json'
	| 'application/xml'
	| 'application/x-www-form-urlencoded'
	| 'multipart/form-data'
	| 'text/plain'
	| 'text/html'
	| 'text/csv'

/**
 * HTTP headers type
 */
export type HttpHeaders = Record<string, string>

/**
 * Query parameters type
 */
export type QueryParams = Record<string, string | number | boolean | string[] | undefined>

// ============================================================================
// Configuration Utility Types
// ============================================================================

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test'

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Configuration with environment overrides
 */
export type EnvironmentConfig<T> = T & {
	[K in Environment]?: Partial<T>
}

/**
 * Configuration validation schema
 */
export type ConfigSchema<T> = {
	[K in keyof T]: {
		type: 'string' | 'number' | 'boolean' | 'object' | 'array'
		required?: boolean
		default?: T[K]
		validate?: (value: T[K]) => boolean
		transform?: (value: any) => T[K]
	}
}

// ============================================================================
// Error Utility Types
// ============================================================================

/**
 * Error with additional context
 */
export interface ContextualError extends Error {
	context?: Record<string, unknown>
	code?: string
	statusCode?: number
	correlationId?: string
}

/**
 * Error handler function type
 */
export type ErrorHandler<T = Error> = (error: T) => void | Promise<void>

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

/**
 * Option type for values that may not exist
 */
export type Option<T> = T | null | undefined

/**
 * Try-catch wrapper result
 */
export type TryResult<T> = Result<T, Error>

// ============================================================================
// Async Utility Types
// ============================================================================

/**
 * Async function type
 */
export type AsyncFunction<P extends any[] = any[], R = any> = (...args: P) => Promise<R>

/**
 * Callback function type
 */
export type Callback<T = any, E = Error> = (error: E | null, result?: T) => void

/**
 * Promisified callback function
 */
export type PromisifiedFunction<T extends (...args: any[]) => any> = T extends (
	...args: [...infer P, Callback<infer R, infer E>]
) => any
	? (...args: P) => Promise<R>
	: never

/**
 * Retry configuration
 */
export interface RetryConfig {
	maxAttempts: number
	initialDelay: number
	maxDelay: number
	backoffMultiplier: number
	retryCondition?: (error: Error) => boolean
}

// ============================================================================
// Cache Utility Types
// ============================================================================

/**
 * Cache key type
 */
export type CacheKey = string | number

/**
 * Cache value with metadata
 */
export interface CacheEntry<T = any> {
	value: T
	expiresAt: number
	createdAt: number
	accessCount: number
	lastAccessed: number
}

/**
 * Cache storage interface
 */
export interface CacheStorage<T = any> {
	get(key: CacheKey): Promise<T | null>
	set(key: CacheKey, value: T, ttl?: number): Promise<void>
	delete(key: CacheKey): Promise<boolean>
	clear(): Promise<void>
	has(key: CacheKey): Promise<boolean>
	keys(): Promise<CacheKey[]>
	size(): Promise<number>
}

// ============================================================================
// Serialization Utility Types
// ============================================================================

/**
 * Serializable types
 */
export type Serializable =
	| string
	| number
	| boolean
	| null
	| undefined
	| Serializable[]
	| { [key: string]: Serializable }

/**
 * JSON-serializable types
 */
export type JSONSerializable = Exclude<Serializable, undefined>

/**
 * Serializer interface
 */
export interface Serializer<T, S = string> {
	serialize(value: T): S
	deserialize(serialized: S): T
}

// ============================================================================
// Type Guard Utility Types
// ============================================================================

/**
 * Type guard function
 */
export type TypeGuard<T> = (value: unknown) => value is T

/**
 * Assertion function
 */
export type AssertionFunction<T> = (value: unknown) => asserts value is T

/**
 * Predicate function
 */
export type Predicate<T> = (value: T) => boolean

// ============================================================================
// Utility Functions for Type Manipulation
// ============================================================================

/**
 * Create a type guard for checking if a value is of a specific type
 */
export const createTypeGuard = <T>(validator: (value: unknown) => boolean): TypeGuard<T> => {
	return (value: unknown): value is T => validator(value)
}

/**
 * Create an assertion function
 */
export const createAssertion = <T>(
	validator: (value: unknown) => boolean,
	errorMessage: string
): AssertionFunction<T> => {
	return (value: unknown): asserts value is T => {
		if (!validator(value)) {
			throw new Error(errorMessage)
		}
	}
}

/**
 * Type guard for checking if a value is defined (not null or undefined)
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
	return value !== null && value !== undefined
}

/**
 * Type guard for checking if a value is a string
 */
export const isString = (value: unknown): value is string => {
	return typeof value === 'string'
}

/**
 * Type guard for checking if a value is a number
 */
export const isNumber = (value: unknown): value is number => {
	return typeof value === 'number' && !isNaN(value)
}

/**
 * Type guard for checking if a value is a boolean
 */
export const isBoolean = (value: unknown): value is boolean => {
	return typeof value === 'boolean'
}

/**
 * Type guard for checking if a value is an object
 */
export const isObject = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Type guard for checking if a value is an array
 */
export const isArray = <T = unknown>(value: unknown): value is T[] => {
	return Array.isArray(value)
}

/**
 * Type guard for checking if a value is a function
 */
export const isFunction = (value: unknown): value is Function => {
	return typeof value === 'function'
}

/**
 * Type guard for checking if a value is a promise
 */
export const isPromise = <T = unknown>(value: unknown): value is Promise<T> => {
	return value instanceof Promise || (isObject(value) && isFunction((value as any).then))
}

// ============================================================================
// Namespace for Intrinsic Types
// ============================================================================

declare namespace Intrinsic {
	type Uppercase<S extends string> = string
	type Lowercase<S extends string> = string
	type Capitalize<S extends string> = string
	type Uncapitalize<S extends string> = string
}
