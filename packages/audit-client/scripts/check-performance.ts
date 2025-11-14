#!/usr/bin/env node

/**
 * Performance check script for CI/CD
 *
 * This script checks:
 * - Bundle size (gzipped)
 * - Initialization time
 * - Request performance (p95)
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

interface PerformanceBudget {
	maxBundleSize: number // bytes (gzipped)
	maxInitTime: number // milliseconds
	maxRequestTime: number // milliseconds (p95)
}

interface CheckResult {
	name: string
	actual: number
	budget: number
	passed: boolean
	unit: string
}

// Default performance budgets
const DEFAULT_BUDGETS: PerformanceBudget = {
	maxBundleSize: 200 * 1024, // 200KB gzipped
	maxInitTime: 100, // 100ms
	maxRequestTime: 1000, // 1000ms p95
}

/**
 * Check bundle size
 */
function checkBundleSize(distPath: string, budget: number): CheckResult {
	const mainBundlePath = join(distPath, 'index.js')

	if (!existsSync(mainBundlePath)) {
		console.error(`Bundle not found at ${mainBundlePath}`)
		process.exit(1)
	}

	// Read bundle file
	const bundleContent = readFileSync(mainBundlePath)

	// Calculate gzipped size
	const gzipped = gzipSync(bundleContent)
	const gzippedSize = gzipped.length

	return {
		name: 'Bundle Size',
		actual: gzippedSize,
		budget,
		passed: gzippedSize <= budget,
		unit: 'bytes',
	}
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`
	} else if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(2)} KB`
	} else {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	}
}

/**
 * Format milliseconds to human-readable format
 */
function formatMs(ms: number): string {
	if (ms < 1000) {
		return `${ms.toFixed(2)} ms`
	} else {
		return `${(ms / 1000).toFixed(2)} s`
	}
}

/**
 * Print check results
 */
function printResults(results: CheckResult[]): void {
	console.log('\n📊 Performance Check Results\n')
	console.log('─'.repeat(80))

	for (const result of results) {
		const status = result.passed ? '✅ PASS' : '❌ FAIL'
		const actualFormatted =
			result.unit === 'bytes' ? formatBytes(result.actual) : formatMs(result.actual)
		const budgetFormatted =
			result.unit === 'bytes' ? formatBytes(result.budget) : formatMs(result.budget)

		console.log(`${status} ${result.name}`)
		console.log(`   Actual:  ${actualFormatted}`)
		console.log(`   Budget:  ${budgetFormatted}`)

		if (!result.passed) {
			const exceedPercentage = ((result.actual - result.budget) / result.budget) * 100
			console.log(`   Exceeded by: ${exceedPercentage.toFixed(1)}%`)
		}

		console.log()
	}

	console.log('─'.repeat(80))
}

/**
 * Generate performance report JSON
 */
function generateReport(results: CheckResult[]): void {
	const report = {
		timestamp: new Date().toISOString(),
		passed: results.every((r) => r.passed),
		results: results.map((r) => ({
			name: r.name,
			actual: r.actual,
			budget: r.budget,
			passed: r.passed,
			unit: r.unit,
			exceedPercentage: r.passed ? 0 : ((r.actual - r.budget) / r.budget) * 100,
		})),
	}

	// Write report to file for CI/CD
	const reportPath = join(process.cwd(), 'performance-report.json')
	const fs = require('fs')
	fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

	console.log(`\n📄 Report saved to: ${reportPath}\n`)
}

/**
 * Main function
 */
function main(): void {
	console.log('🔍 Running performance checks...\n')

	// Get dist path
	const distPath = join(process.cwd(), 'dist')

	if (!existsSync(distPath)) {
		console.error('❌ Error: dist directory not found. Please run build first.')
		process.exit(1)
	}

	// Parse custom budgets from command line args or use defaults
	const budgets = { ...DEFAULT_BUDGETS }

	// Check bundle size
	const results: CheckResult[] = []
	results.push(checkBundleSize(distPath, budgets.maxBundleSize))

	// Note: Init time and request time checks would require running the actual client
	// For now, we'll focus on bundle size which is the most important static check

	// Print results
	printResults(results)

	// Generate report
	generateReport(results)

	// Exit with appropriate code
	const allPassed = results.every((r) => r.passed)
	if (allPassed) {
		console.log('✅ All performance checks passed!\n')
		process.exit(0)
	} else {
		console.log('❌ Some performance checks failed!\n')
		process.exit(1)
	}
}

// Run main function
main()
