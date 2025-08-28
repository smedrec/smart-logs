import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

import { parseZodErrorMessage } from './zod-error.js'

import type { Context } from 'hono'
import type { StatusCode } from 'hono/utils/http-status'
import type { ZodError } from 'zod'
import type { HonoEnv } from '../hono/context.js'

const ErrorCode = z.enum([
	'BAD_REQUEST',
	'FORBIDDEN',
	'INTERNAL_SERVER_ERROR',
	'USAGE_EXCEEDED',
	'DISABLED',
	'NOT_FOUND',
	'NOT_UNIQUE',
	'RATE_LIMITED',
	'UNAUTHORIZED',
	'PRECONDITION_FAILED',
	'INSUFFICIENT_PERMISSIONS',
	'METHOD_NOT_ALLOWED',
	'EXPIRED',
	'DELETE_PROTECTED',
])

export function errorSchemaFactory(code: z.ZodEnum<any>) {
	return z.object({
		error: z.object({
			code: code,
			docs: z.string(),
			message: z.string(),
			details: z.record(z.string(), z.any()).optional(),
			requestId: z.string(),
		}),
	})
}

export const ErrorSchema = z.object({
	error: z.object({
		code: ErrorCode,
		docs: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.any()).optional(),
		requestId: z.string(),
	}),
})

export type ErrorResponse = z.infer<typeof ErrorSchema>

function codeToStatus(code: z.infer<typeof ErrorCode>): StatusCode {
	switch (code) {
		case 'BAD_REQUEST':
			return 400
		case 'FORBIDDEN':
		case 'DISABLED':
		case 'UNAUTHORIZED':
		case 'INSUFFICIENT_PERMISSIONS':
		case 'USAGE_EXCEEDED':
		case 'EXPIRED':
			return 403
		case 'NOT_FOUND':
			return 404
		case 'METHOD_NOT_ALLOWED':
			return 405
		case 'NOT_UNIQUE':
			return 409
		case 'DELETE_PROTECTED':
		case 'PRECONDITION_FAILED':
			return 412
		case 'RATE_LIMITED':
			return 429
		case 'INTERNAL_SERVER_ERROR':
			return 500
	}
}

function statusToCode(status: StatusCode): z.infer<typeof ErrorCode> {
	switch (status) {
		case 400:
			return 'BAD_REQUEST'
		case 401:
			return 'UNAUTHORIZED'
		case 403:
			return 'FORBIDDEN'

		case 404:
			return 'NOT_FOUND'

		case 405:
			return 'METHOD_NOT_ALLOWED'
		case 500:
			return 'INTERNAL_SERVER_ERROR'
		default:
			return 'INTERNAL_SERVER_ERROR'
	}
}

export class ApiError extends HTTPException {
	public readonly code: z.infer<typeof ErrorCode>
	public readonly details: Record<string, any> | undefined

	constructor({
		code,
		message,
		details,
	}: {
		code: z.infer<typeof ErrorCode>
		message: string
		details?: Record<string, any>
	}) {
		super(codeToStatus(code) as any, { message })
		this.code = code
		this.details = details
	}
}

export class PrismaError extends HTTPException {
	public readonly code: z.infer<typeof ErrorCode>

	constructor({ code, message }: { code: z.infer<typeof ErrorCode>; message: string }) {
		super(codeToStatus(code) as any, { message })
		this.code = code
	}
}

export function handleZodError(
	result:
		| {
				success: true
				data: any
		  }
		| {
				success: false
				error: ZodError
		  },
	c: Context
) {
	if (!result.success) {
		return c.json<z.infer<typeof ErrorSchema>>(
			{
				error: {
					code: 'BAD_REQUEST',
					docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/BAD_REQUEST`,
					message: parseZodErrorMessage(result.error),
					requestId: c.get('requestId'),
				},
			},
			{ status: 400 }
		)
	}
}

export async function handleError(err: Error, c: Context<HonoEnv>): Promise<Response> {
	const { logger, error } = c.get('services')
	const requestId = c.get('requestId')
	const session = c.get('session')

	/**
	 * We can handle this very well, as it is something we threw ourselves
	 */
	if (err instanceof ApiError) {
		if (err.status >= 500) {
			logger.error('returning 5XX', {
				message: err.message,
				name: err.name,
				code: err.code,
				status: err.status,
				stack: err.stack,
			})
			await error.handleError(
				err,
				{
					requestId: requestId,
					userId: session?.session.userId,
					sessionId: session?.session.id,
					metadata: {
						organizationId: session?.session.activeOrganizationId,
						message: err.message,
						name: err.name,
						code: err.code,
						status: err.status,
						cause: err.cause,
						stack: err.stack,
					},
				},
				'server-api',
				`${c.req.path}`
			)
		}
		return c.json<z.infer<typeof ErrorSchema>>(
			{
				error: {
					code: err.code,
					docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/${err.code}`,
					message: err.message,
					requestId: c.get('requestId'),
				},
			},
			{ status: err.status }
		)
	}

	/**
	 * HTTPExceptions from hono at least give us some idea of what to do as they provide a status and
	 * message
	 */
	if (err instanceof HTTPException) {
		if (err.status >= 500) {
			logger.error('HTTPException', {
				message: err.message,
				status: err.status,
				requestId: c.get('requestId'),
			})
			await error.handleError(
				err,
				{
					requestId: requestId,
					userId: session?.session.userId,
					sessionId: session?.session.id,
					metadata: {
						organizationId: session?.session.activeOrganizationId,
						message: err.message,
						name: err.name,
						status: err.status,
						cause: err.cause,
						stack: err.stack,
					},
				},
				'server-api',
				`${c.req.path}`
			)
		}
		const code = statusToCode(err.status)
		return c.json<z.infer<typeof ErrorSchema>>(
			{
				error: {
					code,
					docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/${code}`,
					message: err.message,
					requestId: c.get('requestId'),
				},
			},
			{ status: err.status }
		)
	}

	/**
	 * We're lost here, all we can do is return a 500 and log it to investigate
	 */
	logger.error('unhandled exception', {
		name: err.name,
		message: err.message,
		cause: err.cause,
		stack: err.stack,
		requestId: c.get('requestId'),
	})
	await error.handleError(
		err,
		{
			requestId: requestId,
			userId: session?.session.userId,
			sessionId: session?.session.id,
			metadata: {
				organizationId: session?.session.activeOrganizationId,
				name: err.name,
				message: err.message,
				cause: err.cause,
				stack: err.stack,
			},
		},
		'server-api',
		`${c.req.path}`
	)
	return c.json<z.infer<typeof ErrorSchema>>(
		{
			error: {
				code: 'INTERNAL_SERVER_ERROR',
				docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/INTERNAL_SERVER_ERROR`,
				message: err.message ?? 'something unexpected happened',
				requestId: c.get('requestId'),
			},
		},
		{ status: 500 }
	)
}

export function errorResponse(c: Context, code: z.infer<typeof ErrorCode>, message: string) {
	return c.json<z.infer<typeof ErrorSchema>>(
		{
			error: {
				code: code,
				docs: `${process.env.APP_PUBLIC_URL}/docs/api-reference/errors/code/${code}`,
				message,
				requestId: c.get('requestId'),
			},
		},
		{ status: codeToStatus(code) as any }
	)
}
