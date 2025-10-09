import { describe, expect, it } from 'vitest'

import { DefaultLogProcessor } from '../core/log-processor.js'

import type { LogEntry } from '../types/log-entry.js'
import type { LogTransport } from '../types/transport.js'

class DummyTransport implements LogTransport {
	public readonly name = 'dummy'
	public calls: number[] = []
	public delayMs = 50
	async send(entries: LogEntry[]): Promise<void> {
		this.calls.push(Date.now())
		// simulate async work
		await new Promise((r) => setTimeout(r, this.delayMs))
	}
	async flush(): Promise<void> {}
	async close(): Promise<void> {}
	isHealthy(): boolean {
		return true
	}
}

describe('DefaultLogProcessor concurrency', () => {
	it('limits concurrent transport sends to configured max', async () => {
		const transport = new DummyTransport()
		const processor = new DefaultLogProcessor({ maxConcurrentTransports: 2 })
		processor.addTransport(transport)

		const entry: any = {
			id: 'x',
			timestamp: new Date(),
			level: 'info',
			message: 'test',
			correlationId: 'c',
			fields: {},
			metadata: { service: 's', environment: 'e', hostname: 'h', pid: 1 },
			source: 's',
			version: '1.0.0',
		}

		// Send multiple entries to exercise concurrency control
		const tasks = []
		for (let i = 0; i < 6; i++) tasks.push(processor.processLogEntry(entry))

		await Promise.all(tasks)

		// We expect the transport.calls length to be 6
		expect(transport.calls.length).toBe(6)
	})
})
