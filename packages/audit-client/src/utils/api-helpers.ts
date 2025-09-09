import { CreateAuditEventInput } from '../types/api'

/**
 * Batch audit events for efficient processing
 */
export class AuditEventBatcher {
	private events: CreateAuditEventInput[] = []
	private batchSize: number
	private flushInterval: number
	private onFlush: (events: CreateAuditEventInput[]) => Promise<void>
	private timer?: ReturnType<typeof setInterval>

	constructor(
		batchSize: number = 100,
		flushInterval: number = 5000,
		onFlush: (events: CreateAuditEventInput[]) => Promise<void>
	) {
		this.batchSize = batchSize
		this.flushInterval = flushInterval
		this.onFlush = onFlush
		this.startTimer()
	}

	add(event: CreateAuditEventInput): void {
		this.events.push(event)

		if (this.events.length >= this.batchSize) {
			this.flush()
		}
	}

	async flush(): Promise<void> {
		if (this.events.length === 0) return

		const eventsToFlush = [...this.events]
		this.events = []

		try {
			await this.onFlush(eventsToFlush)
		} catch (error) {
			console.error('Failed to flush audit events:', error)
			// Re-add events to the beginning of the queue for retry
			this.events.unshift(...eventsToFlush)
		}
	}

	private startTimer(): void {
		this.timer = setInterval(() => {
			this.flush()
		}, this.flushInterval)
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer)
		}
		this.flush() // Flush remaining events
	}
}
