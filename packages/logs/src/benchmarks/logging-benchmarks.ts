#!/usr/bin/env node

/**
 * Comprehensive logging system benchmarks
 * Run with: npm run benchmark or node dist/benchmarks/logging-benchmarks.js
 */
import { performance } from 'node:perf_hooks'

import { CorrelationManager } from '../core/correlation-manager.js'
import { IdGenerator } from '../utils/id-generator.js'
import { PerformanceMonitor } from '../utils/performance-monitor.js'

interface BenchmarkResult {
	name: string
	iterations: number
	totalTime: number
	averageTime: number
	operationsPerSecond: number
	memoryUsed?: number
}

class BenchmarkRunner {
	private results: BenchmarkResult[] = []

	async runBenchmark(
		name: string,
		iterations: number,
		operation: () => void | Promise<void>
	): Promise<BenchmarkResult> {
		// Warm up
		for (let i = 0; i < Math.min(100, iterations / 10); i++) {
			await operation()
		}

		// Force garbage collection if available
		if (global.gc) {
			global.gc()
		}

		const initialMemory = process.memoryUsage().heapUsed
		const startTime = performance.now()

		for (let i = 0; i < iterations; i++) {
			await operation()
		}

		const endTime = performance.now()
		const finalMemory = process.memoryUsage().heapUsed

		const totalTime = endTime - startTime
		const averageTime = totalTime / iterations
		const operationsPerSecond = (iterations / totalTime) * 1000
		const memoryUsed = finalMemory - initialMemory

		const result: BenchmarkResult = {
			name,
			iterations,
			totalTime,
			averageTime,
			operationsPerSecond,
			memoryUsed,
		}

		this.results.push(result)
		return result
	}

	printResults(): void {
		console.log('\n🚀 Logging System Performance Benchmarks')
		console.log('='.repeat(80))

		for (const result of this.results) {
			console.log(`\n📊 ${result.name}`)
			console.log(`   Iterations: ${result.iterations.toLocaleString()}`)
			console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`)
			console.log(`   Average Time: ${result.averageTime.toFixed(4)}ms`)
			console.log(`   Operations/sec: ${Math.round(result.operationsPerSecond).toLocaleString()}`)
			if (result.memoryUsed !== undefined) {
				const memoryMB = result.memoryUsed / (1024 * 1024)
				console.log(`   Memory Used: ${memoryMB.toFixed(2)}MB`)
			}
		}

		console.log('\n' + '='.repeat(80))
		console.log('✅ Benchmark completed successfully!')
	}

	getResults(): BenchmarkResult[] {
		return [...this.results]
	}
}

async function runAllBenchmarks(): Promise<void> {
	const runner = new BenchmarkRunner()
	const idGenerator = new IdGenerator()
	const correlationManager = CorrelationManager.getInstance()

	console.log('🔥 Starting comprehensive logging system benchmarks...')

	// ID Generation Benchmarks
	console.log('\n🆔 Running ID Generation benchmarks...')

	await runner.runBenchmark('Correlation ID Generation', 100000, () => {
		idGenerator.generateCorrelationId()
	})

	await runner.runBenchmark('Request ID Generation', 100000, () => {
		idGenerator.generateRequestId()
	})

	await runner.runBenchmark('Trace Context Generation', 50000, () => {
		idGenerator.generateTraceContext()
	})

	await runner.runBenchmark('UUID Validation', 200000, () => {
		idGenerator.isValidUuid('550e8400-e29b-41d4-a716-446655440000')
	})

	await runner.runBenchmark('W3C Trace Context Parsing', 100000, () => {
		idGenerator.parseTraceContext('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
	})

	// Performance Monitor Benchmarks
	console.log('\n📈 Running Performance Monitor benchmarks...')

	const highSamplingMonitor = new PerformanceMonitor({
		enabled: true,
		sampleRate: 1.0,
		maxSamples: 10000,
	})

	await runner.runBenchmark('Performance Timing (100% sampling)', 50000, () => {
		const endTiming = highSamplingMonitor.startTiming()
		// Simulate minimal work
		Math.random()
		endTiming()
	})

	const lowSamplingMonitor = new PerformanceMonitor({
		enabled: true,
		sampleRate: 0.1,
		maxSamples: 10000,
	})

	await runner.runBenchmark('Performance Timing (10% sampling)', 100000, () => {
		const endTiming = lowSamplingMonitor.startTiming()
		// Simulate minimal work
		Math.random()
		endTiming()
	})

	const disabledMonitor = new PerformanceMonitor({
		enabled: false,
	})

	await runner.runBenchmark('Performance Timing (disabled)', 200000, () => {
		const endTiming = disabledMonitor.startTiming()
		endTiming()
	})

	// Generate samples for aggregation benchmark
	for (let i = 0; i < 5000; i++) {
		const endTiming = highSamplingMonitor.startTiming()
		endTiming()
	}

	await runner.runBenchmark('Aggregated Metrics Calculation', 10000, () => {
		highSamplingMonitor.getAggregatedMetrics()
	})

	// Correlation Manager Benchmarks
	console.log('\n🔗 Running Correlation Manager benchmarks...')

	await runner.runBenchmark('Request Context Generation', 50000, () => {
		correlationManager.generateRequestContext()
	})

	await runner.runBenchmark('Context Switching', 25000, () => {
		const context = correlationManager.generateRequestContext()
		correlationManager.runWithContext(context, () => {
			correlationManager.getCorrelationId()
			correlationManager.getRequestId()
		})
	})

	await runner.runBenchmark('Nested Context Operations', 10000, () => {
		const parentContext = correlationManager.generateRequestContext()
		correlationManager.runWithContext(parentContext, () => {
			const childContext = correlationManager.generateRequestContext()
			correlationManager.runWithContext(childContext, () => {
				correlationManager.getCorrelationId()
				correlationManager.getTraceId()
			})
		})
	})

	// Memory and Concurrency Benchmarks
	console.log('\n🧠 Running Memory and Concurrency benchmarks...')

	await runner.runBenchmark('Concurrent ID Generation', 20000, async () => {
		const promises = []
		for (let i = 0; i < 10; i++) {
			promises.push(Promise.resolve(idGenerator.generateCorrelationId()))
		}
		await Promise.all(promises)
	})

	await runner.runBenchmark('High-Volume ID Generation', 500000, () => {
		idGenerator.generateCorrelationId()
		idGenerator.generateRequestId()
		idGenerator.generateSpanId()
	})

	// Cleanup
	highSamplingMonitor.stop()
	lowSamplingMonitor.stop()
	disabledMonitor.stop()

	// Print all results
	runner.printResults()

	// Performance analysis
	console.log('\n📋 Performance Analysis:')
	const results = runner.getResults()

	const correlationIdResult = results.find((r) => r.name === 'Correlation ID Generation')
	if (correlationIdResult && correlationIdResult.operationsPerSecond > 50000) {
		console.log('✅ Correlation ID generation meets performance requirements (>50k/sec)')
	} else {
		console.log('⚠️  Correlation ID generation may need optimization')
	}

	const timingResult = results.find((r) => r.name === 'Performance Timing (disabled)')
	if (timingResult && timingResult.operationsPerSecond > 100000) {
		console.log('✅ Disabled performance monitoring has minimal overhead')
	} else {
		console.log('⚠️  Disabled performance monitoring overhead is higher than expected')
	}

	const contextResult = results.find((r) => r.name === 'Context Switching')
	if (contextResult && contextResult.operationsPerSecond > 10000) {
		console.log('✅ Context switching performance is acceptable (>10k/sec)')
	} else {
		console.log('⚠️  Context switching may need optimization')
	}

	// Memory usage analysis
	const memoryResults = results.filter((r) => r.memoryUsed !== undefined)
	const totalMemoryUsed = memoryResults.reduce((sum, r) => sum + (r.memoryUsed || 0), 0)
	const totalMemoryMB = totalMemoryUsed / (1024 * 1024)

	console.log(`\n💾 Total Memory Usage: ${totalMemoryMB.toFixed(2)}MB`)
	if (totalMemoryMB < 50) {
		console.log('✅ Memory usage is within acceptable limits')
	} else {
		console.log('⚠️  Memory usage is higher than expected')
	}
}

// Run benchmarks if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAllBenchmarks().catch(console.error)
}

export { BenchmarkRunner, runAllBenchmarks }
export type { BenchmarkResult }
