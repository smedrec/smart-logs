import { version } from 'os'
import { z } from 'zod'

export const logContext = z.object({
	requestId: z.string(),
	environment: z.enum(['VITEST', 'development', 'staging', 'production']),
	application: z.enum(['api', 'inngest', 'web', 'docs', 'worker']),
	module: z.string(),
	version: z.string().optional(),
	time: z.number(),
})

const commonFields = z.object({
	environment: z.enum(['VITEST', 'development', 'staging', 'production']),
	application: z.enum(['api', 'inngest', 'web', 'docs', 'worker']),
	module: z.string(),
	version: z.string().optional(),
	isolateId: z.string().optional(),
	requestId: z.string().optional(),
	time: z.number(),
})

export const logSchema = z.discriminatedUnion('type', [
	commonFields.merge(
		z.object({
			type: z.literal('log'),
			level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
			message: z.string(),
			context: z.record(z.string(), z.any()),
		})
	),
])
export type LogSchema = z.infer<typeof logSchema>
export class Log<TLog extends LogSchema = LogSchema> {
	public readonly log: TLog

	constructor(log: TLog) {
		this.log = log
	}

	public toString(): string {
		return JSON.stringify(this.log)
	}
}
