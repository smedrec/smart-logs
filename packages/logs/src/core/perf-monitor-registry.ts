// Simple global registry for a PerformanceMonitor instance used in tests
let monitor: any = null

export function registerGlobalPerformanceMonitor(m: any): void {
	monitor = m
}

export function unregisterGlobalPerformanceMonitor(m: any): void {
	if (monitor === m) monitor = null
}

export function getGlobalPerformanceMonitor(): any | null {
	return monitor
}

export default {
	registerGlobalPerformanceMonitor,
	unregisterGlobalPerformanceMonitor,
	getGlobalPerformanceMonitor,
}
