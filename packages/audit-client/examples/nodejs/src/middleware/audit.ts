import { NextFunction, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { AuditService } from '../services/audit-service'
import { logger } from '../utils/logger'

// Extend Express Request type to include audit context
declare global {
	namespace Express {
		interface Request {
			auditContext?: {
				requestId: string
				startTime: number
				principalId?: string
				organizationId?: string
			}
		}
	}
}

export function auditMiddleware(auditService: AuditService) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const requestId = uuidv4()
		const startTime = Date.now()

		// Add audit context to request
		req.auditContext = {
			requestId,
			startTime,
			principalId: extractPrincipalId(req),
			organizationId: extractOrganizationId(req),
		}

		// Add request ID to response headers
		res.setHeader('X-Request-ID', requestId)

		// Log request start
		try {
			await auditService.logEvent({
				action: 'http.request.start',
				targetResourceType: 'http_endpoint',
				targetResourceId: `${req.method} ${req.path}`,
				principalId: req.auditContext.principalId || 'anonymous',
				organizationId: req.auditContext.organizationId || 'default',
				status: 'attempt',
				dataClassification: getDataClassification(req.path),
				details: {
					method: req.method,
					path: req.path,
					query: req.query,
					userAgent: req.get('User-Agent'),
					ip: getClientIP(req),
					requestId,
				},
			})
		} catch (error) {
			logger.error('Failed to log request start:', error)
		}

		// Override res.end to capture response
		const originalEnd = res.end
		res.end = function (chunk?: any, encoding?: any) {
			const duration = Date.now() - startTime
			const status = res.statusCode >= 400 ? 'failure' : 'success'

			// Log request completion
			auditService
				.logEvent({
					action: 'http.request.complete',
					targetResourceType: 'http_endpoint',
					targetResourceId: `${req.method} ${req.path}`,
					principalId: req.auditContext?.principalId || 'anonymous',
					organizationId: req.auditContext?.organizationId || 'default',
					status,
					outcomeDescription: status === 'failure' ? `HTTP ${res.statusCode}` : undefined,
					dataClassification: getDataClassification(req.path),
					details: {
						method: req.method,
						path: req.path,
						statusCode: res.statusCode,
						duration,
						responseSize: chunk ? Buffer.byteLength(chunk) : 0,
						requestId,
					},
				})
				.catch((error) => {
					logger.error('Failed to log request completion:', error)
				})

			// Call original end method
			originalEnd.call(this, chunk, encoding)
		}

		next()
	}
}

// Middleware for specific route auditing
export function auditRoute(action: string, resourceType: string) {
	return (auditService: AuditService) => {
		return async (req: Request, res: Response, next: NextFunction) => {
			try {
				await auditService.logEvent({
					action,
					targetResourceType: resourceType,
					targetResourceId: req.params.id || req.path,
					principalId: req.auditContext?.principalId || 'anonymous',
					organizationId: req.auditContext?.organizationId || 'default',
					status: 'attempt',
					dataClassification: getDataClassification(req.path),
					details: {
						method: req.method,
						path: req.path,
						params: req.params,
						body: sanitizeRequestBody(req.body),
						requestId: req.auditContext?.requestId,
					},
				})
			} catch (error) {
				logger.error(`Failed to log ${action}:`, error)
			}

			next()
		}
	}
}

// Middleware for auditing successful operations
export function auditSuccess(action: string, resourceType: string) {
	return (auditService: AuditService) => {
		return async (req: Request, res: Response, next: NextFunction) => {
			// Store original json method
			const originalJson = res.json

			res.json = function (body: any) {
				// Log successful operation
				auditService
					.logEvent({
						action,
						targetResourceType: resourceType,
						targetResourceId: body?.id || req.params.id || req.path,
						principalId: req.auditContext?.principalId || 'anonymous',
						organizationId: req.auditContext?.organizationId || 'default',
						status: 'success',
						dataClassification: getDataClassification(req.path),
						details: {
							method: req.method,
							path: req.path,
							result: sanitizeResponseBody(body),
							requestId: req.auditContext?.requestId,
						},
					})
					.catch((error) => {
						logger.error(`Failed to log ${action} success:`, error)
					})

				// Call original json method
				return originalJson.call(this, body)
			}

			next()
		}
	}
}

// Helper functions
function extractPrincipalId(req: Request): string | undefined {
	// Extract from JWT token, session, or API key
	const authHeader = req.get('Authorization')
	if (authHeader?.startsWith('Bearer ')) {
		// In a real app, you'd decode the JWT token
		return 'user-from-jwt'
	}

	const apiKey = req.get('X-API-Key')
	if (apiKey) {
		// In a real app, you'd look up the user associated with the API key
		return 'user-from-api-key'
	}

	return undefined
}

function extractOrganizationId(req: Request): string | undefined {
	// Extract from headers, JWT claims, or request context
	return req.get('X-Organization-ID') || 'default-org'
}

function getDataClassification(path: string): 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PHI' {
	if (path.includes('/health') || path.includes('/status')) {
		return 'PUBLIC'
	}

	if (path.includes('/patient') || path.includes('/medical')) {
		return 'PHI'
	}

	if (path.includes('/admin') || path.includes('/internal')) {
		return 'CONFIDENTIAL'
	}

	return 'INTERNAL'
}

function getClientIP(req: Request): string {
	return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
}

function sanitizeRequestBody(body: any): any {
	if (!body || typeof body !== 'object') {
		return body
	}

	const sanitized = { ...body }

	// Remove sensitive fields
	const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard']
	sensitiveFields.forEach((field) => {
		if (sanitized[field]) {
			sanitized[field] = '[REDACTED]'
		}
	})

	return sanitized
}

function sanitizeResponseBody(body: any): any {
	if (!body || typeof body !== 'object') {
		return body
	}

	// For arrays, only include count and first item structure
	if (Array.isArray(body)) {
		return {
			count: body.length,
			sample: body.length > 0 ? sanitizeResponseBody(body[0]) : null,
		}
	}

	const sanitized = { ...body }

	// Remove sensitive fields from response
	const sensitiveFields = ['password', 'token', 'secret', 'key']
	sensitiveFields.forEach((field) => {
		if (sanitized[field]) {
			sanitized[field] = '[REDACTED]'
		}
	})

	return sanitized
}

// Audit decorator for service methods
export function auditMethod(action: string, resourceType: string) {
	return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
		const method = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const auditService: AuditService = this.auditService

			if (!auditService) {
				return method.apply(this, args)
			}

			try {
				// Log method start
				await auditService.logEvent({
					action: `${action}.attempt`,
					targetResourceType: resourceType,
					targetResourceId: args[0]?.id || 'unknown',
					principalId: 'system',
					organizationId: 'default',
					status: 'attempt',
					dataClassification: 'INTERNAL',
					details: {
						method: propertyName,
						args: sanitizeRequestBody(args),
					},
				})

				// Execute method
				const result = await method.apply(this, args)

				// Log method success
				await auditService.logEvent({
					action: `${action}.success`,
					targetResourceType: resourceType,
					targetResourceId: result?.id || args[0]?.id || 'unknown',
					principalId: 'system',
					organizationId: 'default',
					status: 'success',
					dataClassification: 'INTERNAL',
					details: {
						method: propertyName,
						result: sanitizeResponseBody(result),
					},
				})

				return result
			} catch (error) {
				// Log method failure
				await auditService
					.logEvent({
						action: `${action}.failure`,
						targetResourceType: resourceType,
						targetResourceId: args[0]?.id || 'unknown',
						principalId: 'system',
						organizationId: 'default',
						status: 'failure',
						outcomeDescription: error instanceof Error ? error.message : 'Unknown error',
						dataClassification: 'INTERNAL',
						details: {
							method: propertyName,
							error: error instanceof Error ? error.message : 'Unknown error',
						},
					})
					.catch((auditError) => {
						logger.error('Failed to log method failure:', auditError)
					})

				throw error
			}
		}

		return descriptor
	}
}
