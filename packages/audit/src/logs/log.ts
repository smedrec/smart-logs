import { z } from 'zod'

const commonFields = z.object({
	environment: z.enum(['VITEST', 'development', 'staging', 'production']),
	module: z.string(),
	version: z.string().optional(),
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
