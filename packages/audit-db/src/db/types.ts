/**
 * Common DB types used across the package
 */
export interface QueryResult<T> {
	/** The raw result (rows or single value) */
	rows: T
	/** Estimated row count when rows is an array */
	rowCount: number
	/** Time taken to execute the query (ms) */
	durationMs: number
}

export type MaybeRowCount = { rowCount?: number } | any
