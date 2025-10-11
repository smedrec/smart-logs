/**
 * Unit tests for EmailTemplateEngine
 * Requirements 2.1, 2.2: Template processing and attachment handling testing
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { EmailTemplateEngine } from '../email-template-engine.js'

import type { DeliveryPayload, EmailTemplateContext } from '../email-template-engine.js'

describe('EmailTemplateEngine', () => {
	let templateEngine: EmailTemplateEngine
	let mockPayload: DeliveryPayload
	let mockContext: EmailTemplateContext

	beforeEach(() => {
		templateEngine = new EmailTemplateEngine()

		mockPayload = {
			deliveryId: 'test-delivery-123',
			organizationId: 'org-456',
			type: 'report',
			data: {
				reportId: 'report-789',
				title: 'Test Report',
				content: 'This is test report content',
				items: ['item1', 'item2', 'item3'],
				stats: {
					count: 42,
					percentage: 0.85,
				},
			},
			metadata: {
				source: 'test',
				version: '1.0',
				tags: ['important', 'quarterly'],
			},
			correlationId: 'corr-123',
			idempotencyKey: 'idem-456',
		}

		mockContext = templateEngine.createTemplateContext(mockPayload)
	})

	describe('createTemplateContext', () => {
		it('should create context from payload', () => {
			const context = templateEngine.createTemplateContext(mockPayload)

			expect(context.deliveryId).toBe('test-delivery-123')
			expect(context.organizationId).toBe('org-456')
			expect(context.data).toEqual(mockPayload.data)
			expect(context.metadata).toEqual(mockPayload.metadata)
			expect(context.correlationId).toBe('corr-123')
			expect(context.idempotencyKey).toBe('idem-456')
			expect(context.timestamp).toBeDefined()
		})
	})

	describe('processTemplate', () => {
		it('should process simple variable substitution', () => {
			const template = 'Hello {{data.title}}, ID: {{deliveryId}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Hello Test Report, ID: test-delivery-123')
		})

		it('should handle nested object access', () => {
			const template = 'Count: {{data.stats.count}}, Percentage: {{data.stats.percentage}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Count: 42, Percentage: 0.85')
		})

		it('should leave undefined variables unchanged', () => {
			const template = 'Value: {{data.nonexistent}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Value: {{data.nonexistent}}')
		})

		it('should escape HTML by default', () => {
			const contextWithHtml = {
				...mockContext,
				data: { ...mockContext.data, title: '<script>alert("xss")</script>' },
			}

			const template = 'Title: {{data.title}}'
			const result = templateEngine.processTemplate(template, contextWithHtml)

			expect(result).toBe('Title: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
		})

		it('should allow unsafe HTML when configured', () => {
			const contextWithHtml = {
				...mockContext,
				data: { ...mockContext.data, title: '<b>Bold Title</b>' },
			}

			const template = 'Title: {{data.title}}'
			const result = templateEngine.processTemplate(template, contextWithHtml, {
				escapeHtml: false,
			})

			expect(result).toBe('Title: <b>Bold Title</b>')
		})

		it('should process conditional blocks', () => {
			const template = '{{#if correlationId}}Correlation: {{correlationId}}{{/if}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Correlation: corr-123')
		})

		it('should handle false conditionals', () => {
			const contextWithoutCorrelation = { ...mockContext, correlationId: undefined }
			const template = '{{#if correlationId}}Correlation: {{correlationId}}{{/if}}'
			const result = templateEngine.processTemplate(template, contextWithoutCorrelation)

			expect(result).toBe('')
		})

		it('should process loops', () => {
			const template = 'Items: {{#each data.items}}{{this}}, {{/each}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Items: item1, item2, item3, ')
		})

		it('should handle loop with index', () => {
			const template = '{{#each data.items}}{{@index}}: {{this}}\n{{/each}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('0: item1\n1: item2\n2: item3\n')
		})

		it('should process built-in helpers', () => {
			const template = 'JSON: {{json data.stats}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toContain('"count": 42')
			expect(result).toContain('"percentage": 0.85')
		})

		it('should process string helpers', () => {
			const template = 'Upper: {{upper data.title}}, Lower: {{lower data.title}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toBe('Upper: TEST REPORT, Lower: test report')
		})

		it('should process date formatting', () => {
			const contextWithDate = {
				...mockContext,
				timestamp: '2023-12-25T10:30:00.000Z',
			}

			const template = 'Date: {{date timestamp "YYYY-MM-DD HH:mm:ss UTC"}}'
			const result = templateEngine.processTemplate(template, contextWithDate)

			expect(result).toBe('Date: 2023-12-25 10:30:00 UTC')
		})

		it('should process number formatting', () => {
			const template =
				'Currency: {{number data.stats.count "currency"}}, Percent: {{number data.stats.percentage "percent"}}'
			const result = templateEngine.processTemplate(template, mockContext)

			expect(result).toContain('$42.00')
			expect(result).toContain('85%')
		})

		it('should handle custom helpers', () => {
			const customHelpers = {
				reverse: (value: any) => String(value).split('').reverse().join(''),
			}

			const template = 'Reversed: {{reverse data.title}}'
			const result = templateEngine.processTemplate(template, mockContext, { customHelpers })

			expect(result).toBe('Reversed: tropeR tseT')
		})

		it('should enforce template size limits', () => {
			const largeTemplate = 'x'.repeat(2000000) // 2MB template

			expect(() => {
				templateEngine.processTemplate(largeTemplate, mockContext)
			}).toThrow('Template size exceeds limit')
		})
	})

	describe('generateDefaultHtmlTemplate', () => {
		it('should generate valid HTML template', () => {
			const template = templateEngine.generateDefaultHtmlTemplate(mockContext)

			expect(template).toContain('<!DOCTYPE html>')
			expect(template).toContain('{{deliveryId}}')
			expect(template).toContain('{{organizationId}}')
			expect(template).toContain('{{data.type}}')
		})
	})

	describe('generateDefaultTextTemplate', () => {
		it('should generate valid text template', () => {
			const template = templateEngine.generateDefaultTextTemplate(mockContext)

			expect(template).toContain('DELIVERY NOTIFICATION')
			expect(template).toContain('{{deliveryId}}')
			expect(template).toContain('{{organizationId}}')
		})
	})

	describe('processAttachments', () => {
		it('should create attachment from payload data', () => {
			const payloadWithFile = {
				...mockPayload,
				data: {
					...mockPayload.data,
					content: 'file content here',
					filename: 'report.txt',
					contentType: 'text/plain',
				},
			}

			const result = templateEngine.processAttachments(payloadWithFile)

			expect(result.attachments).toHaveLength(1)
			expect(result.attachments[0].filename).toBe('report.txt')
			expect(result.attachments[0].contentType).toBe('text/plain')
			expect(result.errors).toHaveLength(0)
		})

		it('should create JSON attachment from payload data', () => {
			// Use payload without content field to trigger JSON attachment creation
			const payloadWithoutContent = {
				...mockPayload,
				data: {
					reportId: 'report-789',
					title: 'Test Report',
					// No content field here
				},
			}

			const result = templateEngine.processAttachments(payloadWithoutContent)

			expect(result.attachments).toHaveLength(1)
			expect(result.attachments[0].filename).toBe('report-test-delivery-123.json')
			expect(result.attachments[0].contentType).toBe('application/json')
		})

		it('should use custom attachment name', () => {
			const result = templateEngine.processAttachments(mockPayload, 'custom-report.json')

			expect(result.attachments).toHaveLength(1)
			expect(result.attachments[0].filename).toBe('custom-report.json')
		})

		it('should process multiple attachments from metadata', () => {
			const payloadWithAttachments = {
				...mockPayload,
				metadata: {
					...mockPayload.metadata,
					attachments: [
						{
							filename: 'file1.txt',
							content: 'content1',
							contentType: 'text/plain',
						},
						{
							filename: 'file2.csv',
							content: 'col1,col2\nval1,val2',
							contentType: 'text/csv',
						},
					],
				},
			}

			const result = templateEngine.processAttachments(payloadWithAttachments)

			expect(result.attachments).toHaveLength(3) // 1 from data + 2 from metadata
			expect(result.attachments.map((a) => a.filename)).toContain('file1.txt')
			expect(result.attachments.map((a) => a.filename)).toContain('file2.csv')
		})

		it('should validate attachment size limits', () => {
			const largeContent = 'x'.repeat(20 * 1024 * 1024) // 20MB content
			const payloadWithLargeFile = {
				...mockPayload,
				data: {
					...mockPayload.data,
					content: largeContent,
					filename: 'large-file.txt',
				},
			}

			const result = templateEngine.processAttachments(payloadWithLargeFile)

			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('size')
			expect(result.errors[0]).toContain('exceeds limit')
		})

		it('should validate unsafe filenames', () => {
			const payloadWithUnsafeFile = {
				...mockPayload,
				data: {
					...mockPayload.data,
					content: 'content',
					filename: '../../../etc/passwd',
				},
			}

			const result = templateEngine.processAttachments(payloadWithUnsafeFile)

			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('unsafe characters')
		})

		it('should detect content types from file extensions', () => {
			const testCases = [
				{ filename: 'test.pdf', expectedType: 'application/pdf' },
				{ filename: 'test.csv', expectedType: 'text/csv' },
				{
					filename: 'test.xlsx',
					expectedType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				},
				{ filename: 'test.unknown', expectedType: 'application/octet-stream' },
			]

			for (const testCase of testCases) {
				const payloadWithFile = {
					...mockPayload,
					data: {
						...mockPayload.data,
						content: 'content',
						filename: testCase.filename,
					},
				}

				const result = templateEngine.processAttachments(payloadWithFile)

				expect(result.attachments[0].contentType).toBe(testCase.expectedType)
			}
		})
	})

	describe('validateRecipients', () => {
		it('should validate valid recipients', () => {
			const recipients = ['user1@example.com', 'user2@test.com']
			const result = templateEngine.validateRecipients(recipients)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should reject empty recipient list', () => {
			const result = templateEngine.validateRecipients([])

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('At least one recipient is required')
		})

		it('should reject non-array recipients', () => {
			const result = templateEngine.validateRecipients('not-an-array' as any)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('Recipients must be an array')
		})

		it('should reject invalid email addresses', () => {
			const recipients = ['valid@example.com', 'invalid-email', 'another@valid.com']
			const result = templateEngine.validateRecipients(recipients)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((error) => error.includes('Invalid email addresses'))).toBe(true)
		})

		it('should warn about duplicate recipients', () => {
			const recipients = ['user@example.com', 'user@example.com', 'other@test.com']
			const result = templateEngine.validateRecipients(recipients)

			expect(result.isValid).toBe(true)
			expect(result.warnings.some((warning) => warning.includes('Duplicate email addresses'))).toBe(
				true
			)
		})

		it('should reject too many recipients', () => {
			const recipients = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`)
			const result = templateEngine.validateRecipients(recipients)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((error) => error.includes('Recipient count'))).toBe(true)
		})

		it('should reject non-string recipients', () => {
			const recipients = ['valid@example.com', 123, 'another@valid.com'] as any
			const result = templateEngine.validateRecipients(recipients)

			expect(result.isValid).toBe(false)
			expect(result.errors).toContain('All recipients must be strings')
		})
	})

	describe('size limits configuration', () => {
		it('should use custom size limits', () => {
			const customEngine = new EmailTemplateEngine({
				maxAttachmentSize: 1024, // 1KB limit
				maxAttachmentCount: 2,
			})

			const largeContent = 'x'.repeat(2048) // 2KB content
			const payloadWithLargeFile = {
				...mockPayload,
				data: {
					...mockPayload.data,
					content: largeContent,
					filename: 'large-file.txt',
				},
			}

			const result = customEngine.processAttachments(payloadWithLargeFile)

			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('exceeds limit')
		})
	})

	describe('template options configuration', () => {
		it('should use custom template options', () => {
			const customEngine = new EmailTemplateEngine(
				{}, // default size limits
				{
					escapeHtml: false,
					customHelpers: {
						shout: (value: any) => String(value).toUpperCase() + '!!!',
					},
				}
			)

			const template = 'Message: {{shout data.title}}'
			const result = customEngine.processTemplate(template, mockContext)

			expect(result).toBe('Message: TEST REPORT!!!')
		})
	})

	describe('edge cases', () => {
		it('should handle null and undefined values gracefully', () => {
			const contextWithNulls = {
				...mockContext,
				data: {
					...mockContext.data,
					nullValue: null,
					undefinedValue: undefined,
				},
			}

			const template = 'Null: {{data.nullValue}}, Undefined: {{data.undefinedValue}}'
			const result = templateEngine.processTemplate(template, contextWithNulls)

			expect(result).toBe('Null: {{data.nullValue}}, Undefined: {{data.undefinedValue}}')
		})

		it('should handle empty arrays in loops', () => {
			const contextWithEmptyArray = {
				...mockContext,
				data: { ...mockContext.data, items: [] },
			}

			const template = 'Items: {{#each data.items}}{{this}}{{/each}}'
			const result = templateEngine.processTemplate(template, contextWithEmptyArray)

			expect(result).toBe('Items: ')
		})

		it('should handle malformed template syntax gracefully', () => {
			const template = 'Malformed: {{#if}} incomplete {{/if}}'
			const result = templateEngine.processTemplate(template, mockContext)

			// Should not throw, just leave malformed syntax as-is
			expect(result).toContain('{{#if}}')
		})
	})
})
