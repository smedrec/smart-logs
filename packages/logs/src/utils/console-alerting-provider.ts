/**
 * Console-based alerting provider for development and testing
 * Addresses requirement 9.4: Alerting integration
 */

import type { AlertingProvider, CategorizedError, ErrorMetrics } from '../types/error.js'

export class ConsoleAlertingProvider implements AlertingProvider {
	constructor(private enableColors = true) {}

	async sendAlert(error: CategorizedError, metrics: ErrorMetrics): Promise<void> {
		const timestamp = new Date().toISOString()
		const colorize = this.enableColors && process.stdout.isTTY

		const severityColor = this.getSeverityColor(error.severity)
		const resetColor = '\x1b[0m'

		const alertMessage = [
			colorize ? severityColor : '',
			`[ALERT] ${timestamp}`,
			`Category: ${error.category}`,
			`Severity: ${error.severity}`,
			`Transport: ${error.context.transportName || 'unknown'}`,
			`Operation: ${error.context.operation}`,
			`Error: ${error.originalError.message}`,
			`Count: ${metrics.count}`,
			`Recovery Rate: ${
				metrics.recoveryAttempts > 0
					? Math.round((metrics.successfulRecoveries / metrics.recoveryAttempts) * 100)
					: 0
			}%`,
			colorize ? resetColor : '',
		].join(' | ')

		console.error(alertMessage)

		// Also log the stack trace for critical errors
		if (error.severity === 'critical' && error.context.stackTrace) {
			console.error('Stack Trace:', error.context.stackTrace)
		}
	}

	private getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical':
				return '\x1b[41m\x1b[37m' // Red background, white text
			case 'high':
				return '\x1b[31m' // Red text
			case 'medium':
				return '\x1b[33m' // Yellow text
			case 'low':
				return '\x1b[36m' // Cyan text
			default:
				return '\x1b[37m' // White text
		}
	}
}
