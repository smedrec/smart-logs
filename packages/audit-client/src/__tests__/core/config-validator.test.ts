import { describe, expect, it } from 'vitest'

import { ConfigValidator } from '../../core/config-validator'

import type { PartialAuditClientConfig } from '../../core/config'

describe('ConfigValidator', () => {
	describe('baseUrl validation', () => {
		it('should pass validation for valid baseUrl', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'https://api.example.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it('should fail validation when baseUrl is missing', () => {
			const config: PartialAuditClientConfig = {
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			} as any

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0].field).toBe('baseUrl')
			expect(result.errors[0].code).toBe('REQUIRED_FIELD')
			expect(result.errors[0].message).toContain('required')
		})

		it('should fail validation for invalid baseUrl format', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'not-a-valid-url',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0].field).toBe('baseUrl')
			expect(result.errors[0].code).toBe('INVALID_URL')
		})

		it('should fail validation for invalid protocol', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'ftp://api.example.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0].field).toBe('baseUrl')
			expect(result.errors[0].code).toBe('INVALID_PROTOCOL')
			expect(result.errors[0].message).toContain('ftp:')
		})

		it('should accept both http and https protocols', () => {
			const httpConfig: PartialAuditClientConfig = {
				baseUrl: 'http://api.example.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			}

			const httpsConfig: PartialAuditClientConfig = {
				baseUrl: 'https://api.example.com',
				authentication: {
					type: 'apiKey',
					apiKey: 'test-api-key',
				},
			}

			expect(ConfigValidator.validate(httpConfig).isValid).toBe(true)
			expect(ConfigValidator.validate(httpsConfig).isValid).toBe(true)
		})
	})

	describe('authentication validation', () => {
		it('should fail validation when authentication is missing', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'https://api.example.com',
			} as any

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'authentication')).toBe(true)
		})

		it('should fail validation when authentication type is missing', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'https://api.example.com',
				authentication: {} as any,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'authentication.type')).toBe(true)
		})

		it('should fail validation for invalid authentication type', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'https://api.example.com',
				authentication: {
					type: 'invalid' as any,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.code === 'INVALID_AUTH_TYPE')).toBe(true)
		})

		describe('apiKey authentication', () => {
			it('should fail validation when apiKey is missing', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'apiKey',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(false)
				expect(result.errors.some((e) => e.field === 'authentication.apiKey')).toBe(true)
				expect(result.errors.some((e) => e.code === 'REQUIRED_AUTH_FIELD')).toBe(true)
			})

			it('should warn when apiKey is too short', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'apiKey',
						apiKey: 'short',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(1)
				expect(result.warnings[0].field).toBe('authentication.apiKey')
				expect(result.warnings[0].code).toBe('WEAK_API_KEY')
			})

			it('should pass validation with valid apiKey', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'apiKey',
						apiKey: 'valid-api-key-12345',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})
		})

		describe('session authentication', () => {
			it('should fail validation when sessionToken is missing', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'session',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(false)
				expect(result.errors.some((e) => e.field === 'authentication.sessionToken')).toBe(true)
				expect(result.errors.some((e) => e.code === 'REQUIRED_AUTH_FIELD')).toBe(true)
			})

			it('should pass validation with valid sessionToken', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'session',
						sessionToken: 'valid-session-token',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})
		})

		describe('bearer authentication', () => {
			it('should fail validation when bearerToken is missing', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'bearer',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(false)
				expect(result.errors.some((e) => e.field === 'authentication.bearerToken')).toBe(true)
				expect(result.errors.some((e) => e.code === 'REQUIRED_AUTH_FIELD')).toBe(true)
			})

			it('should pass validation with valid bearerToken', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'bearer',
						bearerToken: 'valid-bearer-token',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.errors).toHaveLength(0)
			})
		})

		describe('cookie authentication', () => {
			it('should warn when no cookies are configured', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'cookie',
						includeBrowserCookies: false,
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(1)
				expect(result.warnings[0].code).toBe('NO_COOKIES_CONFIGURED')
			})

			it('should pass validation when cookies are provided', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'cookie',
						cookies: { sessionId: 'abc123' },
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(0)
			})

			it('should pass validation when includeBrowserCookies is true', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'cookie',
						includeBrowserCookies: true,
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(0)
			})
		})

		describe('custom authentication', () => {
			it('should warn when no custom headers are provided', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'custom',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(1)
				expect(result.warnings[0].code).toBe('NO_CUSTOM_HEADERS')
			})

			it('should pass validation when custom headers are provided', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'custom',
						customHeaders: { 'X-Custom-Auth': 'token' },
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(0)
			})
		})

		describe('autoRefresh configuration', () => {
			it('should warn when autoRefresh is enabled without refreshEndpoint', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'apiKey',
						apiKey: 'test-api-key',
						autoRefresh: true,
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(1)
				expect(result.warnings[0].code).toBe('MISSING_REFRESH_ENDPOINT')
			})

			it('should not warn when autoRefresh is enabled with refreshEndpoint', () => {
				const config: PartialAuditClientConfig = {
					baseUrl: 'https://api.example.com',
					authentication: {
						type: 'apiKey',
						apiKey: 'test-api-key',
						autoRefresh: true,
						refreshEndpoint: '/auth/refresh',
					},
				}

				const result = ConfigValidator.validate(config)

				expect(result.isValid).toBe(true)
				expect(result.warnings).toHaveLength(0)
			})
		})
	})

	describe('retry configuration validation', () => {
		const baseConfig: PartialAuditClientConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
		}

		it('should fail validation when maxAttempts is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxAttempts: 0,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.maxAttempts')).toBe(true)
			expect(result.errors.some((e) => e.code === 'VALUE_OUT_OF_RANGE')).toBe(true)
		})

		it('should fail validation when maxAttempts exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxAttempts: 15,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.maxAttempts')).toBe(true)
		})

		it('should warn when maxAttempts is high', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxAttempts: 8,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0].code).toBe('HIGH_RETRY_COUNT')
		})

		it('should fail validation when initialDelayMs is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					initialDelayMs: 50,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.initialDelayMs')).toBe(true)
		})

		it('should fail validation when initialDelayMs exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					initialDelayMs: 15000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.initialDelayMs')).toBe(true)
		})

		it('should fail validation when maxDelayMs is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxDelayMs: 500,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.maxDelayMs')).toBe(true)
		})

		it('should fail validation when maxDelayMs exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxDelayMs: 70000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.maxDelayMs')).toBe(true)
		})

		it('should fail validation when backoffMultiplier is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					backoffMultiplier: 0.5,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.backoffMultiplier')).toBe(true)
		})

		it('should fail validation when backoffMultiplier exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					backoffMultiplier: 6,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'retry.backoffMultiplier')).toBe(true)
		})

		it('should fail validation when initialDelayMs exceeds maxDelayMs', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					initialDelayMs: 5000,
					maxDelayMs: 3000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.code === 'INVALID_DELAY_RANGE')).toBe(true)
		})

		it('should pass validation with valid retry configuration', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				retry: {
					maxAttempts: 3,
					initialDelayMs: 1000,
					maxDelayMs: 10000,
					backoffMultiplier: 2,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})

	describe('cache configuration validation', () => {
		const baseConfig: PartialAuditClientConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
		}

		it('should fail validation when defaultTtlMs is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					defaultTtlMs: 500,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'cache.defaultTtlMs')).toBe(true)
		})

		it('should fail validation when defaultTtlMs exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					defaultTtlMs: 90000000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'cache.defaultTtlMs')).toBe(true)
		})

		it('should fail validation when maxSize is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					maxSize: 5,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'cache.maxSize')).toBe(true)
		})

		it('should fail validation when maxSize exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					maxSize: 15000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'cache.maxSize')).toBe(true)
		})

		it('should warn when maxSize is high', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					maxSize: 7000,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0].code).toBe('HIGH_CACHE_SIZE')
		})

		it('should fail validation for invalid storage type', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					storage: 'invalid' as any,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.code === 'INVALID_STORAGE_TYPE')).toBe(true)
		})

		it('should fail validation when custom storage is missing', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					storage: 'custom',
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'cache.customStorage')).toBe(true)
		})

		it('should pass validation with valid cache configuration', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				cache: {
					enabled: true,
					defaultTtlMs: 300000,
					maxSize: 1000,
					storage: 'memory',
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})

	describe('timeout validation', () => {
		const baseConfig: PartialAuditClientConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
		}

		it('should fail validation when timeout is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				timeout: 500,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'timeout')).toBe(true)
		})

		it('should fail validation when timeout exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				timeout: 400000,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'timeout')).toBe(true)
		})

		it('should warn when timeout is too low', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				timeout: 3000,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0].code).toBe('LOW_TIMEOUT')
		})

		it('should warn when timeout is too high', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				timeout: 150000,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0].code).toBe('HIGH_TIMEOUT')
		})

		it('should pass validation with reasonable timeout', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				timeout: 30000,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
			expect(result.warnings).toHaveLength(0)
		})
	})

	describe('performance configuration validation', () => {
		const baseConfig: PartialAuditClientConfig = {
			baseUrl: 'https://api.example.com',
			authentication: {
				type: 'apiKey',
				apiKey: 'test-api-key',
			},
		}

		it('should fail validation when maxConcurrentRequests is below minimum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				performance: {
					maxConcurrentRequests: 0,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'performance.maxConcurrentRequests')).toBe(true)
		})

		it('should fail validation when maxConcurrentRequests exceeds maximum', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				performance: {
					maxConcurrentRequests: 150,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.some((e) => e.field === 'performance.maxConcurrentRequests')).toBe(true)
		})

		it('should warn when maxConcurrentRequests is high', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				performance: {
					maxConcurrentRequests: 75,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0].code).toBe('HIGH_CONCURRENCY')
		})

		it('should pass validation with valid performance configuration', () => {
			const config: PartialAuditClientConfig = {
				...baseConfig,
				performance: {
					maxConcurrentRequests: 20,
					enableCompression: true,
					enableStreaming: true,
				},
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})

	describe('formatValidationResult', () => {
		it('should return success message for valid configuration', () => {
			const result = {
				isValid: true,
				errors: [],
				warnings: [],
			}

			const formatted = ConfigValidator.formatValidationResult(result)

			expect(formatted).toBe('Configuration is valid')
		})

		it('should format errors correctly', () => {
			const result = {
				isValid: false,
				errors: [
					{
						field: 'baseUrl',
						message: 'baseUrl is required',
						code: 'REQUIRED_FIELD',
						severity: 'error' as const,
					},
					{
						field: 'authentication.apiKey',
						message: 'apiKey is required',
						code: 'REQUIRED_AUTH_FIELD',
						severity: 'error' as const,
					},
				],
				warnings: [],
			}

			const formatted = ConfigValidator.formatValidationResult(result)

			expect(formatted).toContain('Configuration Errors:')
			expect(formatted).toContain('baseUrl: baseUrl is required')
			expect(formatted).toContain('authentication.apiKey: apiKey is required')
		})

		it('should format warnings correctly', () => {
			const result = {
				isValid: true,
				errors: [],
				warnings: [
					{
						field: 'retry.maxAttempts',
						message: 'maxAttempts is high',
						code: 'HIGH_RETRY_COUNT',
						severity: 'warning' as const,
					},
				],
			}

			const formatted = ConfigValidator.formatValidationResult(result)

			expect(formatted).toContain('Configuration Warnings:')
			expect(formatted).toContain('retry.maxAttempts: maxAttempts is high')
		})

		it('should format both errors and warnings', () => {
			const result = {
				isValid: false,
				errors: [
					{
						field: 'baseUrl',
						message: 'baseUrl is required',
						code: 'REQUIRED_FIELD',
						severity: 'error' as const,
					},
				],
				warnings: [
					{
						field: 'timeout',
						message: 'timeout is low',
						code: 'LOW_TIMEOUT',
						severity: 'warning' as const,
					},
				],
			}

			const formatted = ConfigValidator.formatValidationResult(result)

			expect(formatted).toContain('Configuration Errors:')
			expect(formatted).toContain('Configuration Warnings:')
			expect(formatted).toContain('baseUrl: baseUrl is required')
			expect(formatted).toContain('timeout: timeout is low')
		})
	})

	describe('multiple validation errors', () => {
		it('should collect all validation errors', () => {
			const config: PartialAuditClientConfig = {
				baseUrl: 'invalid-url',
				authentication: {
					type: 'apiKey',
				},
				retry: {
					maxAttempts: 0,
					initialDelayMs: 50,
				},
				cache: {
					maxSize: 5,
				},
				timeout: 500,
			}

			const result = ConfigValidator.validate(config)

			expect(result.isValid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(3)
			expect(result.errors.some((e) => e.field === 'baseUrl')).toBe(true)
			expect(result.errors.some((e) => e.field === 'authentication.apiKey')).toBe(true)
			expect(result.errors.some((e) => e.field === 'retry.maxAttempts')).toBe(true)
			expect(result.errors.some((e) => e.field === 'retry.initialDelayMs')).toBe(true)
			expect(result.errors.some((e) => e.field === 'cache.maxSize')).toBe(true)
			expect(result.errors.some((e) => e.field === 'timeout')).toBe(true)
		})
	})
})
