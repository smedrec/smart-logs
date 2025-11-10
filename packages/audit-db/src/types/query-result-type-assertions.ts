/* Type-only assertions to lock the QueryResult<T> shape.
   This file contains only type-level checks and no runtime code. It is
   included in the package's TypeScript build to ensure the new types
   don't regress. */

import type { QueryResult } from '../db/types.js'

// Utility type: true if A and B are identical
type IsEqual<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type AssertTrue<T extends true> = T

// Example concrete shapes to assert QueryResult behavior
type QRArray = QueryResult<string[]>
type ExpectedQRArray = {
	rows: string[]
	rowCount: number
	durationMs: number
}

// Compile-time checks (will error if types differ)
type _check_array = AssertTrue<IsEqual<QRArray, ExpectedQRArray>>

// Also check a non-array row type
type QRSingle = QueryResult<{ id: number; name: string }>
type ExpectedQRSingle = {
	rows: { id: number; name: string }
	rowCount: number
	durationMs: number
}

type _check_single = AssertTrue<IsEqual<QRSingle, ExpectedQRSingle>>

// Prevent this file from contributing any runtime output
export {}
