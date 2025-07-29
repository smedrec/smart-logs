export interface DeliveryConfig {
	email?: {
		smtpConfig: {
			host: string
			port: number
			secure: boolean
			auth: {
				user: string
				pass: string
			}
		}
		from: string
		subject: string
		bodyTemplate: string
		attachmentName?: string
	}

	webhook?: {
		url: string
		method: 'POST' | 'PUT'
		headers: Record<string, string>
		timeout: number
		retryConfig: {
			maxRetries: number
			backoffMultiplier: number
			maxBackoffDelay: number
		}
	}

	storage?: {
		provider: 'local' | 's3' | 'azure' | 'gcp'
		config: Record<string, any>
		path: string
		retention: {
			days: number
			autoCleanup: boolean
		}
	}
}

/**
 * Report export format options
 */
export type ReportFormat = 'json' | 'csv' | 'xml' | 'pdf'

/**
 * Export configuration
 */
export interface ExportConfig {
	format: ReportFormat
	includeMetadata?: boolean
	includeIntegrityReport?: boolean
	compression?: 'none' | 'gzip' | 'zip'
	encryption?: {
		enabled: boolean
		algorithm?: string
		keyId?: string
	}
}
