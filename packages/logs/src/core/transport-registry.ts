// Global registry for transport instances used by tests and advanced wiring.
// To avoid unbounded growth across test runs we deduplicate transports by a
// stable key (prefer filename when available). This keeps registry size
// bounded even if many tests create transports without explicitly unregistering.
const transports = new Map<string | symbol, any>()

function transportKeyFor(t: any): string | symbol {
	try {
		if (t?.config?.filename) return String(t.config.filename)
		if (typeof t.getCurrentFilePath === 'function') return String(t.getCurrentFilePath())
		if (t?.filename) return String(t.filename)
		if (t?.name) return `transport:${t.name}`
	} catch {
		// fallthrough
	}
	return Symbol('transport')
}

export function registerGlobalTransport(t: any): void {
	const key = transportKeyFor(t)
	transports.set(key, t)
}

export function unregisterGlobalTransport(t: any): void {
	const key = transportKeyFor(t)
	transports.delete(key)
}

export function getGlobalTransports(): any[] {
	return Array.from(transports.values())
}

export default { registerGlobalTransport, unregisterGlobalTransport, getGlobalTransports }
