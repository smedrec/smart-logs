import { describe, expect, it } from 'vitest'

import { InputSanitizer } from '../../utils/sanitization'
import { ValidationError } from '../../utils/validation'

describe('InputSanitizer', () => {
	describe('sanitizeString', () => {
		it('should remove HTML tags from strings', () => {
			const input = 'Hello <script>alert("xss")</script> World'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).toBe('Hello alert("xss") World')
			expect(result).not.toContain('<script>')
			expect(result).not.toContain('</script>')
		})

		it('should remove multiple HTML tags', () => {
			const input = '<div><span>Text</span></div>'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).toBe('Text')
		})

		it('should remove iframe tags', () => {
			const input = 'Content <iframe src="evil.com"></iframe> more content'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('<iframe')
			expect(result).not.toContain('</iframe>')
		})

		it('should remove JavaScript protocols', () => {
			const input = 'javascript:alert("xss")'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('javascript:')
		})

		it('should remove data protocols', () => {
			const input = 'data:text/html,<script>alert("xss")</script>'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('data:')
		})

		it('should remove vbscript protocols', () => {
			const input = 'vbscript:msgbox("xss")'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('vbscript:')
		})

		it('should remove event handlers', () => {
			const input = '<img src="x" onerror="alert(1)">'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('onerror')
		})

		it('should remove onclick handlers', () => {
			const input = '<button onclick="malicious()">Click</button>'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('onclick')
		})

		it('should remove onload handlers', () => {
			const input = '<body onload="steal()">'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).not.toContain('onload')
		})

		it('should preserve legitimate special characters', () => {
			const input = 'Price: $100.50 & Tax: 10%'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).toBe('Price: $100.50 & Tax: 10%')
		})

		it('should preserve unicode characters', () => {
			const input = 'Hello 世界 🌍'
			const result = InputSanitizer.sanitizeString(input)
			expect(result).toBe('Hello 世界 🌍')
		})

		it('should handle empty strings', () => {
			const result = InputSanitizer.sanitizeString('')
			expect(result).toBe('')
		})

		it('should handle strings with only whitespace', () => {
			const input = '   \n\t  '
			const result = InputSanitizer.sanitizeString(input)
			expect(result).toBe('   \n\t  ')
		})

		it('should return non-string values unchanged', () => {
			expect(InputSanitizer.sanitizeString(123 as any)).toBe(123)
			expect(InputSanitizer.sanitizeString(null as any)).toBe(null)
			expect(InputSanitizer.sanitizeString(undefined as any)).toBe(undefined)
		})
	})

	describe('sanitizeObject', () => {
		it('should recursively sanitize string values in objects', () => {
			const input = {
				name: 'John <script>alert(1)</script>',
				description: 'Test <b>bold</b> text',
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.name).not.toContain('<script>')
			expect(result.description).not.toContain('<b>')
		})

		it('should handle nested objects', () => {
			const input = {
				user: {
					name: 'Alice <script>xss</script>',
					profile: {
						bio: 'Developer <iframe>evil</iframe>',
					},
				},
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.user.name).not.toContain('<script>')
			expect(result.user.profile.bio).not.toContain('<iframe>')
		})

		it('should handle arrays of strings', () => {
			const input = {
				tags: ['<script>xss</script>', 'normal', '<b>bold</b>'],
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.tags[0]).not.toContain('<script>')
			expect(result.tags[1]).toBe('normal')
			expect(result.tags[2]).not.toContain('<b>')
		})

		it('should handle arrays of objects', () => {
			const input = {
				items: [{ name: '<script>xss</script>' }, { name: 'safe' }],
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.items[0].name).not.toContain('<script>')
			expect(result.items[1].name).toBe('safe')
		})

		it('should preserve non-string values', () => {
			const input = {
				count: 42,
				active: true,
				price: 99.99,
				tags: null,
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.count).toBe(42)
			expect(result.active).toBe(true)
			expect(result.price).toBe(99.99)
			expect(result.tags).toBe(null)
		})

		it('should handle deeply nested structures', () => {
			const input = {
				level1: {
					level2: {
						level3: {
							value: '<script>deep xss</script>',
						},
					},
				},
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.level1.level2.level3.value).not.toContain('<script>')
		})

		it('should handle mixed arrays', () => {
			const input = {
				mixed: ['string <b>bold</b>', 123, true, { nested: '<i>italic</i>' }],
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.mixed[0]).not.toContain('<b>')
			expect(result.mixed[1]).toBe(123)
			expect(result.mixed[2]).toBe(true)
			expect(result.mixed[3].nested).not.toContain('<i>')
		})

		it('should handle null and undefined', () => {
			expect(InputSanitizer.sanitizeObject(null as any)).toBe(null)
			expect(InputSanitizer.sanitizeObject(undefined as any)).toBe(undefined)
		})

		it('should handle empty objects', () => {
			const result = InputSanitizer.sanitizeObject({})
			expect(result).toEqual({})
		})

		it('should handle empty arrays', () => {
			const input = { items: [] }
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.items).toEqual([])
		})
	})

	describe('sanitizeUrl', () => {
		it('should validate and return valid HTTP URLs', () => {
			const input = 'http://example.com/path'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toBe('http://example.com/path')
		})

		it('should validate and return valid HTTPS URLs', () => {
			const input = 'https://secure.example.com/api'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toBe('https://secure.example.com/api')
		})

		it('should throw ValidationError for javascript: protocol', () => {
			const input = 'javascript:alert("xss")'
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(/Invalid URL protocol/)
		})

		it('should throw ValidationError for data: protocol', () => {
			const input = 'data:text/html,<script>alert(1)</script>'
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(/Invalid URL protocol/)
		})

		it('should throw ValidationError for vbscript: protocol', () => {
			const input = 'vbscript:msgbox("xss")'
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(/Invalid URL protocol/)
		})

		it('should throw ValidationError for ftp: protocol', () => {
			const input = 'ftp://files.example.com'
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(/Invalid URL protocol/)
		})

		it('should throw ValidationError for file: protocol', () => {
			const input = 'file:///etc/passwd'
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl(input)).toThrow(/Invalid URL protocol/)
		})

		it('should handle URLs with query parameters', () => {
			const input = 'https://example.com/search?q=test&page=1'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toContain('https://example.com/search')
			expect(result).toContain('q=test')
		})

		it('should handle URLs with fragments', () => {
			const input = 'https://example.com/page#section'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toContain('https://example.com/page')
			expect(result).toContain('#section')
		})

		it('should handle relative URLs', () => {
			const input = '/api/v1/users'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toBe('/api/v1/users')
		})

		it('should throw ValidationError for empty strings', () => {
			expect(() => InputSanitizer.sanitizeUrl('')).toThrow(ValidationError)
			expect(() => InputSanitizer.sanitizeUrl('')).toThrow(/non-empty string/)
		})

		it('should throw ValidationError for whitespace-only strings', () => {
			expect(() => InputSanitizer.sanitizeUrl('   ')).toThrow(ValidationError)
		})

		it('should remove event handlers from URLs', () => {
			const input = 'https://example.com/path onclick="alert(1)"'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).not.toContain('onclick')
		})

		it('should handle URLs with ports', () => {
			const input = 'https://example.com:8080/api'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toBe('https://example.com:8080/api')
		})

		it('should handle URLs with authentication', () => {
			const input = 'https://user:pass@example.com/api'
			const result = InputSanitizer.sanitizeUrl(input)
			expect(result).toContain('https://')
			expect(result).toContain('example.com/api')
		})
	})

	describe('maskSensitiveFields', () => {
		it('should mask password fields', () => {
			const input = {
				username: 'john',
				password: 'secret123',
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['password'])
			expect(result.username).toBe('john')
			expect(result.password).toBe('***REDACTED***')
		})

		it('should mask multiple sensitive fields', () => {
			const input = {
				apiKey: 'key123',
				token: 'token456',
				secret: 'secret789',
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['apiKey', 'token', 'secret'])
			expect(result.apiKey).toBe('***REDACTED***')
			expect(result.token).toBe('***REDACTED***')
			expect(result.secret).toBe('***REDACTED***')
		})

		it('should mask fields case-insensitively', () => {
			const input = {
				Password: 'secret',
				API_KEY: 'key',
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['password', 'api_key'])
			expect(result.Password).toBe('***REDACTED***')
			expect(result.API_KEY).toBe('***REDACTED***')
		})

		it('should mask nested sensitive fields', () => {
			const input = {
				user: {
					name: 'john',
					credentials: {
						password: 'secret',
					},
				},
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['password'])
			expect(result.user.name).toBe('john')
			expect(result.user.credentials.password).toBe('***REDACTED***')
		})

		it('should mask sensitive fields in arrays', () => {
			const input = {
				users: [
					{ name: 'john', password: 'secret1' },
					{ name: 'jane', password: 'secret2' },
				],
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['password'])
			expect(result.users[0].name).toBe('john')
			expect(result.users[0].password).toBe('***REDACTED***')
			expect(result.users[1].name).toBe('jane')
			expect(result.users[1].password).toBe('***REDACTED***')
		})

		it('should handle null and undefined', () => {
			expect(InputSanitizer.maskSensitiveFields(null, ['password'])).toBe(null)
			expect(InputSanitizer.maskSensitiveFields(undefined, ['password'])).toBe(undefined)
		})

		it('should preserve non-sensitive fields', () => {
			const input = {
				username: 'john',
				email: 'john@example.com',
				password: 'secret',
			}
			const result = InputSanitizer.maskSensitiveFields(input, ['password'])
			expect(result.username).toBe('john')
			expect(result.email).toBe('john@example.com')
			expect(result.password).toBe('***REDACTED***')
		})
	})

	describe('Integration scenarios', () => {
		it('should sanitize complex audit event data', () => {
			const input = {
				action: 'user.login <script>xss</script>',
				principalId: 'user123',
				metadata: {
					userAgent: 'Mozilla <iframe>evil</iframe>',
					ipAddress: '192.168.1.1',
					tags: ['<b>tag1</b>', 'tag2'],
				},
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.action).not.toContain('<script>')
			expect(result.metadata.userAgent).not.toContain('<iframe>')
			expect(result.metadata.tags[0]).not.toContain('<b>')
			expect(result.metadata.ipAddress).toBe('192.168.1.1')
		})

		it('should sanitize report criteria with date ranges', () => {
			const input = {
				dateRange: {
					startDate: '2024-01-01 <script>xss</script>',
					endDate: '2024-12-31',
				},
				organizationId: 'org123 <b>bold</b>',
			}
			const result = InputSanitizer.sanitizeObject(input)
			expect(result.dateRange.startDate).not.toContain('<script>')
			expect(result.organizationId).not.toContain('<b>')
		})

		it('should handle real-world XSS attack vectors', () => {
			const attacks = [
				'<img src=x onerror=alert(1)>',
				'<svg onload=alert(1)>',
				'<body onload=alert(1)>',
				'javascript:alert(1)',
				'<script>alert(String.fromCharCode(88,83,83))</script>',
			]

			attacks.forEach((attack) => {
				const result = InputSanitizer.sanitizeString(attack)
				expect(result).not.toContain('<script>')
				expect(result).not.toContain('javascript:')
				expect(result).not.toContain('onerror')
				expect(result).not.toContain('onload')
			})
		})
	})
})
