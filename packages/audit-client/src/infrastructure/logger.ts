// Logger interface and placeholder implementation
// This will be enhanced in task 16

export interface Logger {
	debug(message: string, meta?: any): void
	info(message: string, meta?: any): void
	warn(message: string, meta?: any): void
	error(message: string, meta?: any): void
}

export class DefaultLogger implements Logger {
	debug(message: string, meta?: any): void {
		console.debug(message, meta)
	}

	info(message: string, meta?: any): void {
		console.info(message, meta)
	}

	warn(message: string, meta?: any): void {
		console.warn(message, meta)
	}

	error(message: string, meta?: any): void {
		console.error(message, meta)
	}
}
