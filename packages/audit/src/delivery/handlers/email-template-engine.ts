/**
 * Email template engine for dynamic content processing
 * Requirements 2.1, 2.2: Template processing and attachment handling
 */

import type { DeliveryPayload } from '../types.js'

/**
 * Email template context for dynamic content
 */
export interface EmailTemplateContext {
	deliveryId: string
	organizationId: string
	timestamp: string
	data: any
	metadata: Record<string, any>
	correlationId?: string
	idempotencyKey?: string
}

/**
 * Email attachment interface
 */
export interface EmailAttachment {
	filename: string
	content: Buffer | string
	contentType?: string
	encoding?: string
	cid?: string // Content-ID for inline attachments
	size?: number
}

/**
 * Template processing options
 */
export interface TemplateOptions {
	escapeHtml?: boolean
	allowUnsafeHtml?: boolean
	maxTemplateSize?: number
	customHelpers?: Record<string, (value: any) => string>
}

/**
 * Email size limits configuration
 */
export interface EmailSizeLimits {
	maxTotalSize: number // Total email size in bytes
	maxAttachmentSize: number // Individual attachment size in bytes
	maxAttachmentCount: number // Maximum number of attachments
	maxRecipientCount: number // Maximum number of recipients
}

/**
 * Email template engine for processing dynamic content
 * Requirements 2.1, 2.2: Template engine for dynamic content and attachments
 */
export class EmailTemplateEngine {
	private readonly defaultSizeLimits: EmailSizeLimits = {
		maxTotalSize: 25 * 1024 * 1024, // 25MB (most email providers limit)
		maxAttachmentSize: 10 * 1024 * 1024, // 10MB per attachment
		maxAttachmentCount: 10,
		maxRecipientCount: 50,
	}

	private readonly defaultTemplateOptions: TemplateOptions = {
		escapeHtml: true,
		allowUnsafeHtml: false,
		maxTemplateSize: 1024 * 1024, // 1MB template size limit
		customHelpers: {},
	}

	constructor(
		private readonly sizeLimits: EmailSizeLimits = this.defaultSizeLimits,
		private readonly templateOptions: TemplateOptions = {}
	) {
		this.sizeLimits = { ...this.defaultSizeLimits, ...sizeLimits }
		this.templateOptions = { ...this.defaultTemplateOptions, ...templateOptions }
	}

	/**
	 * Create template context from delivery payload
	 * Requirements 2.1: Template context creation
	 */
	createTemplateContext(payload: DeliveryPayload): EmailTemplateContext {
		return {
			deliveryId: payload.deliveryId,
			organizationId: payload.organizationId,
			timestamp: new Date().toISOString(),
			data: payload.data,
			metadata: payload.metadata,
			correlationId: payload.correlationId,
			idempotencyKey: payload.idempotencyKey,
		}
	}

	/**
	 * Process template with variable substitution and helpers
	 * Requirements 2.1: Template processing for dynamic content
	 */
	processTemplate(
		template: string,
		context: EmailTemplateContext,
		options?: TemplateOptions
	): string {
		const opts = { ...this.templateOptions, ...options }

		// Check template size limit
		if (template.length > opts.maxTemplateSize!) {
			throw new Error(`Template size exceeds limit of ${opts.maxTemplateSize} characters`)
		}

		// Process template variables with enhanced syntax
		let processed = template

		// Handle simple variable substitution: {{variable}}
		processed = processed.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
			const value = this.getNestedValue(context, path)
			if (value === undefined || value === null) {
				return match // Keep original if not found
			}
			return opts.escapeHtml ? this.escapeHtml(String(value)) : String(value)
		})

		// Handle conditional blocks: {{#if condition}}...{{/if}}
		processed = this.processConditionals(processed, context)

		// Handle loops: {{#each array}}...{{/each}}
		processed = this.processLoops(processed, context)

		// Handle custom helpers: {{helper value}}
		processed = this.processHelpers(processed, context, opts.customHelpers!)

		// Handle date formatting: {{date timestamp format}}
		processed = this.processDateFormatting(processed, context)

		// Handle number formatting: {{number value format}}
		processed = this.processNumberFormatting(processed, context)

		return processed
	}

	/**
	 * Generate default HTML email template
	 * Requirements 2.1: Default template generation
	 */
	generateDefaultHtmlTemplate(context: EmailTemplateContext): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Delivery Notification</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
		.content { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
		.metadata { background-color: #f9f9f9; padding: 15px; border-radius: 3px; margin-top: 20px; }
		.code { background-color: #f4f4f4; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; }
		.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
	</style>
</head>
<body>
	<div class="header">
		<h2>📧 Delivery Notification</h2>
		<p><strong>Delivery ID:</strong> {{deliveryId}}</p>
		<p><strong>Organization:</strong> {{organizationId}}</p>
		<p><strong>Timestamp:</strong> {{date timestamp "YYYY-MM-DD HH:mm:ss UTC"}}</p>
	</div>
	
	<div class="content">
		<h3>📋 Delivery Details</h3>
		<p><strong>Type:</strong> {{data.type}}</p>
		{{#if correlationId}}
		<p><strong>Correlation ID:</strong> {{correlationId}}</p>
		{{/if}}
		
		<h3>📊 Data Content</h3>
		<div class="code">{{json data}}</div>
		
		{{#if metadata}}
		<div class="metadata">
			<h4>🏷️ Metadata</h4>
			<div class="code">{{json metadata}}</div>
		</div>
		{{/if}}
	</div>
	
	<div class="footer">
		<p>This is an automated delivery notification from the Audit Delivery Service.</p>
		{{#if idempotencyKey}}
		<p><small>Idempotency Key: {{idempotencyKey}}</small></p>
		{{/if}}
	</div>
</body>
</html>
		`.trim()
	}

	/**
	 * Generate default text email template
	 * Requirements 2.1: Default text template generation
	 */
	generateDefaultTextTemplate(context: EmailTemplateContext): string {
		return `
DELIVERY NOTIFICATION
=====================

Delivery ID: {{deliveryId}}
Organization: {{organizationId}}
Timestamp: {{date timestamp "YYYY-MM-DD HH:mm:ss UTC"}}
{{#if correlationId}}
Correlation ID: {{correlationId}}
{{/if}}

DELIVERY DETAILS
================
Type: {{data.type}}

DATA CONTENT
============
{{json data}}

{{#if metadata}}
METADATA
========
{{json metadata}}
{{/if}}

---
This is an automated delivery notification from the Audit Delivery Service.
{{#if idempotencyKey}}
Idempotency Key: {{idempotencyKey}}
{{/if}}
		`.trim()
	}

	/**
	 * Process email attachments with validation
	 * Requirements 2.2: Attachment handling for reports and exports
	 */
	processAttachments(
		payload: DeliveryPayload,
		attachmentName?: string
	): { attachments: EmailAttachment[]; totalSize: number; errors: string[] } {
		const attachments: EmailAttachment[] = []
		const errors: string[] = []
		let totalSize = 0

		// Process payload data as attachment if it contains file content
		if (payload.data && typeof payload.data === 'object') {
			const attachment = this.createAttachmentFromPayload(payload, attachmentName)
			if (attachment) {
				const validationResult = this.validateAttachment(attachment)
				if (validationResult.isValid) {
					attachments.push(attachment)
					totalSize += attachment.size || 0
				} else {
					errors.push(...validationResult.errors)
				}
			}
		}

		// Process additional attachments from metadata
		if (payload.metadata.attachments && Array.isArray(payload.metadata.attachments)) {
			for (const attachmentData of payload.metadata.attachments) {
				const attachment = this.createAttachmentFromData(attachmentData)
				if (attachment) {
					const validationResult = this.validateAttachment(attachment)
					if (validationResult.isValid) {
						attachments.push(attachment)
						totalSize += attachment.size || 0
					} else {
						errors.push(...validationResult.errors)
					}
				}
			}
		}

		// Validate total size and count
		if (totalSize > this.sizeLimits.maxTotalSize) {
			errors.push(
				`Total attachment size (${this.formatBytes(totalSize)}) exceeds limit (${this.formatBytes(this.sizeLimits.maxTotalSize)})`
			)
		}

		if (attachments.length > this.sizeLimits.maxAttachmentCount) {
			errors.push(
				`Attachment count (${attachments.length}) exceeds limit (${this.sizeLimits.maxAttachmentCount})`
			)
		}

		return { attachments, totalSize, errors }
	}

	/**
	 * Validate recipient list
	 * Requirements 2.2: Recipient list management and validation
	 */
	validateRecipients(recipients: string[]): {
		isValid: boolean
		errors: string[]
		warnings: string[]
	} {
		const errors: string[] = []
		const warnings: string[] = []

		if (!Array.isArray(recipients)) {
			errors.push('Recipients must be an array')
			return { isValid: false, errors, warnings }
		}

		if (recipients.length === 0) {
			errors.push('At least one recipient is required')
			return { isValid: false, errors, warnings }
		}

		if (recipients.length > this.sizeLimits.maxRecipientCount) {
			errors.push(
				`Recipient count (${recipients.length}) exceeds limit (${this.sizeLimits.maxRecipientCount})`
			)
		}

		// Validate each email address
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		const invalidEmails: string[] = []
		const duplicates = new Set<string>()
		const seen = new Set<string>()

		for (const email of recipients) {
			if (typeof email !== 'string') {
				errors.push('All recipients must be strings')
				continue
			}

			if (!emailRegex.test(email)) {
				invalidEmails.push(email)
				continue
			}

			if (seen.has(email.toLowerCase())) {
				duplicates.add(email)
			} else {
				seen.add(email.toLowerCase())
			}
		}

		if (invalidEmails.length > 0) {
			errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`)
		}

		if (duplicates.size > 0) {
			warnings.push(`Duplicate email addresses found: ${Array.from(duplicates).join(', ')}`)
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	// Private helper methods

	private getNestedValue(obj: any, path: string): any {
		return path.split('.').reduce((current, key) => current?.[key], obj)
	}

	private escapeHtml(text: string): string {
		const htmlEscapes: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		}
		return text.replace(/[&<>"']/g, (match) => htmlEscapes[match])
	}

	private processConditionals(template: string, context: EmailTemplateContext): string {
		return template.replace(
			/\{\{#if\s+(\w+(?:\.\w+)*)\}\}(.*?)\{\{\/if\}\}/gs,
			(match, condition, content) => {
				const value = this.getNestedValue(context, condition)
				return this.isTruthy(value) ? content : ''
			}
		)
	}

	private processLoops(template: string, context: EmailTemplateContext): string {
		return template.replace(
			/\{\{#each\s+(\w+(?:\.\w+)*)\}\}(.*?)\{\{\/each\}\}/gs,
			(match, arrayPath, content) => {
				const array = this.getNestedValue(context, arrayPath)
				if (!Array.isArray(array)) {
					return ''
				}

				return array
					.map((item, index) => {
						let itemContent = content
						// Replace {{this}} with current item
						itemContent = itemContent.replace(/\{\{this\}\}/g, String(item))
						// Replace {{@index}} with current index
						itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index))
						return itemContent
					})
					.join('')
			}
		)
	}

	private processHelpers(
		template: string,
		context: EmailTemplateContext,
		helpers: Record<string, (value: any) => string>
	): string {
		// Built-in helpers
		const builtInHelpers = {
			json: (value: any) => JSON.stringify(value, null, 2),
			upper: (value: any) => String(value).toUpperCase(),
			lower: (value: any) => String(value).toLowerCase(),
			capitalize: (value: any) =>
				String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase(),
		}

		const allHelpers = { ...builtInHelpers, ...helpers }

		return template.replace(/\{\{(\w+)\s+([^}]+)\}\}/g, (match, helperName: string, args) => {
			const helper = allHelpers[helperName as keyof typeof allHelpers]
			if (!helper) {
				return match
			}

			// Simple argument parsing (supports single values and paths)
			const value = this.getNestedValue(context, args.trim()) ?? args.trim()
			try {
				return helper(value)
			} catch {
				return match
			}
		})
	}

	private processDateFormatting(template: string, context: EmailTemplateContext): string {
		return template.replace(
			/\{\{date\s+(\w+(?:\.\w+)*)\s+"([^"]+)"\}\}/g,
			(match, datePath, format) => {
				const dateValue = this.getNestedValue(context, datePath)
				if (!dateValue) {
					return match
				}

				try {
					const date = new Date(dateValue)
					return this.formatDate(date, format)
				} catch {
					return match
				}
			}
		)
	}

	private processNumberFormatting(template: string, context: EmailTemplateContext): string {
		return template.replace(
			/\{\{number\s+(\w+(?:\.\w+)*)\s+"([^"]+)"\}\}/g,
			(match, numberPath, format) => {
				const numberValue = this.getNestedValue(context, numberPath)
				if (numberValue === undefined || numberValue === null) {
					return match
				}

				try {
					const num = Number(numberValue)
					return this.formatNumber(num, format)
				} catch {
					return match
				}
			}
		)
	}

	private formatDate(date: Date, format: string): string {
		// Simple date formatting (in production, consider using a library like date-fns)
		const year = date.getUTCFullYear()
		const month = String(date.getUTCMonth() + 1).padStart(2, '0')
		const day = String(date.getUTCDate()).padStart(2, '0')
		const hours = String(date.getUTCHours()).padStart(2, '0')
		const minutes = String(date.getUTCMinutes()).padStart(2, '0')
		const seconds = String(date.getUTCSeconds()).padStart(2, '0')

		return format
			.replace('YYYY', String(year))
			.replace('MM', month)
			.replace('DD', day)
			.replace('HH', hours)
			.replace('mm', minutes)
			.replace('ss', seconds)
	}

	private formatNumber(num: number, format: string): string {
		// Simple number formatting
		switch (format) {
			case 'currency':
				return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
			case 'percent':
				return new Intl.NumberFormat('en-US', { style: 'percent' }).format(num)
			case 'decimal':
				return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(num)
			default:
				return String(num)
		}
	}

	private isTruthy(value: any): boolean {
		if (value === null || value === undefined) return false
		if (typeof value === 'boolean') return value
		if (typeof value === 'number') return value !== 0
		if (typeof value === 'string') return value.length > 0
		if (Array.isArray(value)) return value.length > 0
		if (typeof value === 'object') return Object.keys(value).length > 0
		return Boolean(value)
	}

	private createAttachmentFromPayload(
		payload: DeliveryPayload,
		attachmentName?: string
	): EmailAttachment | null {
		if (!payload.data || typeof payload.data !== 'object') {
			return null
		}

		// Check if payload contains file content
		const content = payload.data.content || payload.data.buffer || payload.data.data
		if (!content) {
			// Create JSON attachment from the entire payload data
			const jsonContent = JSON.stringify(payload.data, null, 2)
			const filename = attachmentName || `${payload.type}-${payload.deliveryId}.json`

			return {
				filename,
				content: Buffer.from(jsonContent, 'utf8'),
				contentType: 'application/json',
				size: Buffer.byteLength(jsonContent, 'utf8'),
			}
		}

		const filename =
			attachmentName ||
			payload.data.filename ||
			payload.data.name ||
			`${payload.type}-${payload.deliveryId}`

		const contentType =
			payload.data.contentType || payload.data.mimeType || this.getContentTypeFromFilename(filename)

		const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')

		return {
			filename,
			content: buffer,
			contentType,
			size: buffer.length,
		}
	}

	private createAttachmentFromData(attachmentData: any): EmailAttachment | null {
		if (!attachmentData || typeof attachmentData !== 'object') {
			return null
		}

		const { filename, content, contentType, encoding } = attachmentData

		if (!filename || !content) {
			return null
		}

		const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, encoding || 'utf8')

		return {
			filename,
			content: buffer,
			contentType: contentType || this.getContentTypeFromFilename(filename),
			encoding,
			size: buffer.length,
		}
	}

	private validateAttachment(attachment: EmailAttachment): { isValid: boolean; errors: string[] } {
		const errors: string[] = []

		if (!attachment.filename) {
			errors.push('Attachment filename is required')
		}

		if (!attachment.content) {
			errors.push('Attachment content is required')
		}

		if (attachment.size && attachment.size > this.sizeLimits.maxAttachmentSize) {
			errors.push(
				`Attachment "${attachment.filename}" size (${this.formatBytes(attachment.size)}) exceeds limit (${this.formatBytes(this.sizeLimits.maxAttachmentSize)})`
			)
		}

		// Validate filename for security
		if (attachment.filename && this.isUnsafeFilename(attachment.filename)) {
			errors.push(`Attachment filename "${attachment.filename}" contains unsafe characters`)
		}

		return {
			isValid: errors.length === 0,
			errors,
		}
	}

	private getContentTypeFromFilename(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase()

		const contentTypes: Record<string, string> = {
			json: 'application/json',
			csv: 'text/csv',
			pdf: 'application/pdf',
			xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			xls: 'application/vnd.ms-excel',
			txt: 'text/plain',
			html: 'text/html',
			xml: 'application/xml',
			zip: 'application/zip',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
		}

		return contentTypes[ext || ''] || 'application/octet-stream'
	}

	private isUnsafeFilename(filename: string): boolean {
		// Check for path traversal and other unsafe patterns
		const unsafePatterns = [
			/\.\./, // Path traversal
			/[<>:"|?*]/, // Windows invalid characters
			/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
			/^\./, // Hidden files
		]

		return unsafePatterns.some((pattern) => pattern.test(filename))
	}

	private formatBytes(bytes: number): string {
		if (bytes === 0) return '0 Bytes'

		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))

		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}
}
