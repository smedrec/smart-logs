/**
 * Streaming Infrastructure for Audit Client Library
 *
 * Provides comprehensive streaming capabilities including:
 * - Large data export streaming with backpressure management
 * - WebSocket/SSE connection management with automatic reconnection
 * - Stream processing utilities and transformers
 * - Connection pooling and lifecycle management
 *
 * Requirements: 4.5, 5.4, 10.4
 */

import { AuditLogger } from './logger'

import type { Logger } from './logger'

/**
 * Stream configuration options
 */
export interface StreamConfig {
	// Backpressure management
	highWaterMark: number
	lowWaterMark: number
	maxBufferSize: number

	// Connection settings
	maxConcurrentStreams: number
	connectionTimeout: number
	readTimeout: number

	// Retry and reconnection
	maxReconnectAttempts: number
	reconnectDelay: number
	reconnectBackoffMultiplier: number
	maxReconnectDelay: number
	heartbeatInterval: number

	// Performance optimization
	enableCompression: boolean
	chunkSize: number
	batchSize: number

	// Monitoring
	enableMetrics: boolean
	metricsInterval: number
}

/**
 * Default streaming configuration
 */
export const DEFAULT_STREAM_CONFIG: StreamConfig = {
	highWaterMark: 16 * 1024, // 16KB
	lowWaterMark: 8 * 1024, // 8KB
	maxBufferSize: 1024 * 1024, // 1MB
	maxConcurrentStreams: 10,
	connectionTimeout: 30000,
	readTimeout: 60000,
	maxReconnectAttempts: 5,
	reconnectDelay: 1000,
	reconnectBackoffMultiplier: 2,
	maxReconnectDelay: 30000,
	heartbeatInterval: 30000,
	enableCompression: true,
	chunkSize: 8192,
	batchSize: 100,
	enableMetrics: true,
	metricsInterval: 5000,
}

/**
 * Stream event types
 */
export type StreamEventType =
	| 'data'
	| 'end'
	| 'error'
	| 'close'
	| 'connect'
	| 'disconnect'
	| 'reconnect'
	| 'backpressure'
	| 'drain'

/**
 * Stream event handler interface
 */
export interface StreamEventHandler<T = any> {
	(event: StreamEventType, data?: T): void
}

/**
 * Stream metrics interface
 */
export interface StreamMetrics {
	bytesRead: number
	bytesWritten: number
	chunksProcessed: number
	errorsCount: number
	reconnectCount: number
	averageLatency: number
	currentConnections: number
	backpressureEvents: number
	throughputBytesPerSecond: number
	lastActivity: number
}

/**
 * Stream connection state
 */
export type StreamConnectionState =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'reconnecting'
	| 'error'
	| 'closed'

/**
 * Backpressure strategy
 */
export type BackpressureStrategy = 'drop' | 'buffer' | 'pause' | 'error'

/**
 * Stream transformer function
 */
export interface StreamTransformer<TInput, TOutput> {
	(chunk: TInput): TOutput | Promise<TOutput>
}

/**
 * Stream filter function
 */
export interface StreamFilter<T> {
	(chunk: T): boolean | Promise<boolean>
}

/**
 * Enhanced readable stream with backpressure management
 */
export class ManagedReadableStream<T> extends ReadableStream<T> {
	private metrics: StreamMetrics
	private config: StreamConfig
	private logger: Logger
	private eventHandlers: Map<StreamEventType, Set<StreamEventHandler>> = new Map()
	private buffer: T[] = []
	private isBackpressured = false
	private controller?: ReadableStreamDefaultController<T>

	constructor(
		source: UnderlyingDefaultSource<T>,
		config: Partial<StreamConfig> = {},
		logger?: Logger
	) {
		const streamConfig = { ...DEFAULT_STREAM_CONFIG, ...config }

		super(
			{
				start: (controller) => {
					// Use a closure to access the instance after construction
					setTimeout(() => {
						if (this.controller === undefined) {
							this.controller = controller
						}
					}, 0)
					if (source.start) {
						return source.start(controller)
					}
				},
				pull: async (controller) => {
					try {
						// Check backpressure
						if (this.isBackpressured && this.buffer.length > streamConfig.lowWaterMark) {
							return
						}

						if (this.isBackpressured && this.buffer.length <= streamConfig.lowWaterMark) {
							this.isBackpressured = false
							this.emit('drain')
						}

						// Process buffered data first
						if (this.buffer.length > 0) {
							const chunk = this.buffer.shift()!
							controller.enqueue(chunk)
							this.updateMetrics('chunk', chunk)
							return
						}

						// Pull from source
						if (source.pull) {
							await source.pull(controller)
						}
					} catch (error) {
						this.emit('error', error)
						controller.error(error)
					}
				},
				cancel: (reason) => {
					this.emit('close', reason)
					if (source.cancel) {
						return source.cancel(reason)
					}
				},
			},
			{
				highWaterMark: streamConfig.highWaterMark,
			}
		)

		this.config = streamConfig
		this.logger = logger || new AuditLogger({ level: 'info' })
		this.metrics = this.initializeMetrics()
		this.initializeEventHandlers()
	}

	/**
	 * Add event listener
	 */
	on(event: StreamEventType, handler: StreamEventHandler): void {
		const handlers = this.eventHandlers.get(event) || new Set()
		handlers.add(handler)
		this.eventHandlers.set(event, handlers)
	}

	/**
	 * Remove event listener
	 */
	off(event: StreamEventType, handler: StreamEventHandler): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.delete(handler)
		}
	}

	/**
	 * Emit event to all listeners
	 */
	private emit(event: StreamEventType, data?: any): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(event, data)
				} catch (error) {
					this.logger.error('Stream event handler error', { event, error })
				}
			})
		}
	}

	/**
	 * Enqueue data with backpressure management
	 */
	enqueue(chunk: T): boolean {
		if (!this.controller) {
			return false
		}

		// Check buffer size for backpressure
		if (this.buffer.length >= this.config.maxBufferSize) {
			this.isBackpressured = true
			this.emit('backpressure', { bufferSize: this.buffer.length })

			// Handle backpressure based on strategy
			switch (this.getBackpressureStrategy()) {
				case 'drop':
					this.logger.warn('Dropping chunk due to backpressure')
					return false
				case 'buffer':
					this.buffer.push(chunk)
					return false
				case 'pause':
					this.buffer.push(chunk)
					return false
				case 'error':
					const error = new Error('Stream backpressure limit exceeded')
					this.emit('error', error)
					this.controller.error(error)
					return false
			}
		}

		try {
			this.controller.enqueue(chunk)
			this.updateMetrics('chunk', chunk)
			this.emit('data', chunk)
			return true
		} catch (error) {
			this.emit('error', error)
			return false
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): StreamMetrics {
		return { ...this.metrics }
	}

	/**
	 * Transform stream with custom transformer
	 */
	transform<TOutput>(transformer: StreamTransformer<T, TOutput>): ManagedReadableStream<TOutput> {
		const transformedSource: UnderlyingDefaultSource<TOutput> = {
			start: async (controller) => {
				try {
					const reader = this.getReader()

					const processChunk = async () => {
						try {
							const { done, value } = await reader.read()

							if (done) {
								controller.close()
								return
							}

							const transformed = await transformer(value)
							controller.enqueue(transformed)

							// Continue processing
							processChunk()
						} catch (error) {
							controller.error(error)
						}
					}

					processChunk()
				} catch (error) {
					controller.error(error)
				}
			},
		}

		return new ManagedReadableStream(transformedSource, this.config, this.logger)
	}

	/**
	 * Filter stream with custom filter
	 */
	filter(filter: StreamFilter<T>): ManagedReadableStream<T> {
		const filteredSource: UnderlyingDefaultSource<T> = {
			start: async (controller) => {
				try {
					const reader = this.getReader()

					const processChunk = async () => {
						try {
							const { done, value } = await reader.read()

							if (done) {
								controller.close()
								return
							}

							const shouldInclude = await filter(value)
							if (shouldInclude) {
								controller.enqueue(value)
							}

							// Continue processing
							processChunk()
						} catch (error) {
							controller.error(error)
						}
					}

					processChunk()
				} catch (error) {
					controller.error(error)
				}
			},
		}

		return new ManagedReadableStream(filteredSource, this.config, this.logger)
	}

	private initializeMetrics(): StreamMetrics {
		return {
			bytesRead: 0,
			bytesWritten: 0,
			chunksProcessed: 0,
			errorsCount: 0,
			reconnectCount: 0,
			averageLatency: 0,
			currentConnections: 0,
			backpressureEvents: 0,
			throughputBytesPerSecond: 0,
			lastActivity: Date.now(),
		}
	}

	private initializeEventHandlers(): void {
		const events: StreamEventType[] = [
			'data',
			'end',
			'error',
			'close',
			'connect',
			'disconnect',
			'reconnect',
			'backpressure',
			'drain',
		]

		events.forEach((event) => {
			this.eventHandlers.set(event, new Set())
		})
	}

	private updateMetrics(type: 'chunk' | 'error' | 'reconnect', data?: any): void {
		this.metrics.lastActivity = Date.now()

		switch (type) {
			case 'chunk':
				this.metrics.chunksProcessed++
				if (data && typeof data === 'string') {
					this.metrics.bytesRead += new Blob([data]).size
				} else if (data && data.byteLength) {
					this.metrics.bytesRead += data.byteLength
				}
				break
			case 'error':
				this.metrics.errorsCount++
				break
			case 'reconnect':
				this.metrics.reconnectCount++
				break
		}

		// Calculate throughput
		const now = Date.now()
		const timeDiff = (now - (this.metrics.lastActivity || now)) / 1000
		if (timeDiff > 0) {
			this.metrics.throughputBytesPerSecond = this.metrics.bytesRead / timeDiff
		}
	}

	private getBackpressureStrategy(): BackpressureStrategy {
		// This could be configurable, defaulting to buffer
		return 'buffer'
	}
}

/**
 * Connection manager for WebSocket and SSE connections
 */
export class ConnectionManager {
	private connections: Map<string, ManagedConnection> = new Map()
	private config: StreamConfig
	private logger: Logger
	private metrics: StreamMetrics

	constructor(config: Partial<StreamConfig> = {}, logger?: Logger) {
		this.config = { ...DEFAULT_STREAM_CONFIG, ...config }
		this.logger = logger || new AuditLogger({ level: 'info' })
		this.metrics = this.initializeMetrics()
	}

	/**
	 * Create a new managed connection
	 */
	async createConnection(
		id: string,
		url: string,
		type: 'websocket' | 'sse' | 'polling',
		options: ConnectionOptions = {}
	): Promise<ManagedConnection> {
		if (this.connections.has(id)) {
			throw new Error(`Connection with id '${id}' already exists`)
		}

		if (this.connections.size >= this.config.maxConcurrentStreams) {
			throw new Error(
				`Maximum concurrent connections (${this.config.maxConcurrentStreams}) reached`
			)
		}

		const connection = new ManagedConnection(
			id,
			url,
			type,
			{ ...this.config, ...options },
			this.logger
		)

		this.connections.set(id, connection)
		this.metrics.currentConnections = this.connections.size

		// Set up connection event handlers
		connection.on('connect', () => {
			this.logger.info('Connection established', { connectionId: id, url, type })
		})

		connection.on('disconnect', () => {
			this.logger.info('Connection closed', { connectionId: id })
		})

		connection.on('error', (_, error) => {
			this.logger.error('Connection error', { connectionId: id, error })
			this.metrics.errorsCount++
		})

		connection.on('reconnect', () => {
			this.metrics.reconnectCount++
		})

		return connection
	}

	/**
	 * Get connection by ID
	 */
	getConnection(id: string): ManagedConnection | undefined {
		return this.connections.get(id)
	}

	/**
	 * Remove connection
	 */
	async removeConnection(id: string): Promise<boolean> {
		const connection = this.connections.get(id)
		if (!connection) {
			return false
		}

		await connection.disconnect()
		this.connections.delete(id)
		this.metrics.currentConnections = this.connections.size
		return true
	}

	/**
	 * Get all active connections
	 */
	getActiveConnections(): ManagedConnection[] {
		return Array.from(this.connections.values()).filter((conn) => conn.getState() === 'connected')
	}

	/**
	 * Get connection metrics
	 */
	getMetrics(): StreamMetrics {
		return { ...this.metrics }
	}

	/**
	 * Close all connections
	 */
	async closeAll(): Promise<void> {
		const closePromises = Array.from(this.connections.values()).map((conn) => conn.disconnect())

		await Promise.allSettled(closePromises)
		this.connections.clear()
		this.metrics.currentConnections = 0
	}

	private initializeMetrics(): StreamMetrics {
		return {
			bytesRead: 0,
			bytesWritten: 0,
			chunksProcessed: 0,
			errorsCount: 0,
			reconnectCount: 0,
			averageLatency: 0,
			currentConnections: 0,
			backpressureEvents: 0,
			throughputBytesPerSecond: 0,
			lastActivity: Date.now(),
		}
	}
}

/**
 * Connection options interface
 */
export interface ConnectionOptions extends Partial<StreamConfig> {
	headers?: Record<string, string>
	protocols?: string[]
	reconnect?: boolean
	heartbeatInterval?: number
}

/**
 * Managed connection class for WebSocket and SSE
 */
export class ManagedConnection {
	private id: string
	private url: string
	private type: 'websocket' | 'sse' | 'polling'
	private config: StreamConfig & ConnectionOptions
	private logger: Logger
	private connection: WebSocket | EventSource | null = null
	private state: StreamConnectionState = 'disconnected'
	private reconnectAttempts = 0
	private heartbeatTimer: NodeJS.Timeout | null = null
	private eventHandlers: Map<StreamEventType, Set<StreamEventHandler>> = new Map()
	private metrics: StreamMetrics

	constructor(
		id: string,
		url: string,
		type: 'websocket' | 'sse' | 'polling',
		config: StreamConfig & ConnectionOptions,
		logger: Logger
	) {
		this.id = id
		this.url = url
		this.type = type
		this.config = config
		this.logger = logger
		this.metrics = this.initializeMetrics()
		this.initializeEventHandlers()
	}

	/**
	 * Connect to the remote endpoint
	 */
	async connect(): Promise<void> {
		if (this.state === 'connected' || this.state === 'connecting') {
			return
		}

		this.setState('connecting')

		try {
			if (this.type === 'websocket') {
				await this.connectWebSocket()
			} else {
				await this.connectSSE()
			}

			this.setState('connected')
			this.reconnectAttempts = 0
			this.startHeartbeat()
			this.emit('connect')
		} catch (error) {
			this.setState('error')
			this.emit('error', error)

			if (this.config.reconnect && this.shouldReconnect()) {
				this.scheduleReconnect()
			}
		}
	}

	/**
	 * Disconnect from the remote endpoint
	 */
	async disconnect(): Promise<void> {
		this.setState('disconnected')
		this.stopHeartbeat()

		if (this.connection) {
			if (this.connection instanceof WebSocket) {
				this.connection.close()
			} else if (this.connection instanceof EventSource) {
				this.connection.close()
			}
			this.connection = null
		}

		this.emit('disconnect')
	}

	/**
	 * Send data through the connection (WebSocket only)
	 */
	send(data: string | ArrayBuffer | Blob): boolean {
		if (this.type !== 'websocket' || !this.connection || this.state !== 'connected') {
			return false
		}

		try {
			;(this.connection as WebSocket).send(data)
			this.updateMetrics('send', data)
			return true
		} catch (error) {
			this.emit('error', error)
			return false
		}
	}

	/**
	 * Get connection state
	 */
	getState(): StreamConnectionState {
		return this.state
	}

	/**
	 * Get connection ID
	 */
	getId(): string {
		return this.id
	}

	/**
	 * Get connection metrics
	 */
	getMetrics(): StreamMetrics {
		return { ...this.metrics }
	}

	/**
	 * Add event listener
	 */
	on(event: StreamEventType, handler: StreamEventHandler): void {
		const handlers = this.eventHandlers.get(event) || new Set()
		handlers.add(handler)
		this.eventHandlers.set(event, handlers)
	}

	/**
	 * Remove event listener
	 */
	off(event: StreamEventType, handler: StreamEventHandler): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.delete(handler)
		}
	}

	private async connectWebSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('WebSocket connection timeout'))
			}, this.config.connectionTimeout)

			try {
				const wsUrl = this.url.replace(/^https?/, 'wss').replace(/^http/, 'ws')
				this.connection = new WebSocket(wsUrl, this.config.protocols)

				this.connection.onopen = () => {
					clearTimeout(timeout)
					resolve()
				}

				this.connection.onmessage = (event) => {
					this.handleMessage(event.data)
				}

				this.connection.onerror = (error) => {
					clearTimeout(timeout)
					reject(error)
				}

				this.connection.onclose = (event) => {
					this.handleClose(event.code, event.reason)
				}
			} catch (error) {
				clearTimeout(timeout)
				reject(error)
			}
		})
	}

	private async connectSSE(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('SSE connection timeout'))
			}, this.config.connectionTimeout)

			try {
				this.connection = new EventSource(this.url)

				this.connection.onopen = () => {
					clearTimeout(timeout)
					resolve()
				}

				this.connection.onmessage = (event) => {
					this.handleMessage(event.data)
				}

				this.connection.onerror = (error) => {
					clearTimeout(timeout)
					this.handleClose(0, 'SSE error')
					reject(error)
				}
			} catch (error) {
				clearTimeout(timeout)
				reject(error)
			}
		})
	}

	private handleMessage(data: any): void {
		try {
			const parsed = typeof data === 'string' ? JSON.parse(data) : data
			this.emit('data', parsed)
			this.updateMetrics('receive', data)
		} catch (error) {
			this.logger.warn('Failed to parse message', { data, error })
			this.emit('data', data) // Emit raw data if parsing fails
		}
	}

	private handleClose(code: number, reason: string): void {
		this.setState('disconnected')
		this.stopHeartbeat()
		this.emit('disconnect', { code, reason })

		if (this.config.reconnect && this.shouldReconnect()) {
			this.scheduleReconnect()
		}
	}

	private shouldReconnect(): boolean {
		return this.reconnectAttempts < this.config.maxReconnectAttempts
	}

	private scheduleReconnect(): void {
		this.setState('reconnecting')

		const delay = Math.min(
			this.config.reconnectDelay *
				Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempts),
			this.config.maxReconnectDelay
		)

		setTimeout(() => {
			this.reconnectAttempts++
			this.emit('reconnect', { attempt: this.reconnectAttempts })
			this.connect()
		}, delay)
	}

	private startHeartbeat(): void {
		if (!this.config.heartbeatInterval) {
			return
		}

		this.heartbeatTimer = setInterval(() => {
			if (this.type === 'websocket' && this.connection instanceof WebSocket) {
				if (this.connection.readyState === WebSocket.OPEN) {
					this.connection.send(JSON.stringify({ type: 'ping' }))
				}
			}
		}, this.config.heartbeatInterval)
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
	}

	private setState(newState: StreamConnectionState): void {
		const oldState = this.state
		this.state = newState
		this.logger.debug('Connection state changed', {
			connectionId: this.id,
			from: oldState,
			to: newState,
		})
	}

	private emit(event: StreamEventType, data?: any): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(event, data)
				} catch (error) {
					this.logger.error('Connection event handler error', { event, error })
				}
			})
		}
	}

	private initializeEventHandlers(): void {
		const events: StreamEventType[] = [
			'data',
			'end',
			'error',
			'close',
			'connect',
			'disconnect',
			'reconnect',
			'backpressure',
			'drain',
		]

		events.forEach((event) => {
			this.eventHandlers.set(event, new Set())
		})
	}

	private initializeMetrics(): StreamMetrics {
		return {
			bytesRead: 0,
			bytesWritten: 0,
			chunksProcessed: 0,
			errorsCount: 0,
			reconnectCount: 0,
			averageLatency: 0,
			currentConnections: 1,
			backpressureEvents: 0,
			throughputBytesPerSecond: 0,
			lastActivity: Date.now(),
		}
	}

	private updateMetrics(type: 'send' | 'receive', data?: any): void {
		this.metrics.lastActivity = Date.now()

		if (data) {
			const size = typeof data === 'string' ? new Blob([data]).size : data.byteLength || 0

			if (type === 'send') {
				this.metrics.bytesWritten += size
			} else {
				this.metrics.bytesRead += size
				this.metrics.chunksProcessed++
			}
		}
	}
}

/**
 * Stream processing utilities
 */
export class StreamProcessor {
	private config: StreamConfig
	private logger: Logger

	constructor(config: Partial<StreamConfig> = {}, logger?: Logger) {
		this.config = { ...DEFAULT_STREAM_CONFIG, ...config }
		this.logger = logger || new AuditLogger({ level: 'info' })
	}

	/**
	 * Create a batching transformer that groups chunks
	 */
	createBatchTransformer<T>(batchSize?: number): StreamTransformer<T, T[]> {
		const size = batchSize || this.config.batchSize
		let batch: T[] = []

		return (chunk: T): T[] | Promise<T[]> => {
			batch.push(chunk)

			if (batch.length >= size) {
				const result = [...batch]
				batch = []
				return result
			}

			return []
		}
	}

	/**
	 * Create a JSON lines parser transformer
	 */
	createJSONLinesParser<T>(): StreamTransformer<string, T> {
		return (chunk: string): T => {
			try {
				return JSON.parse(chunk.trim())
			} catch (error) {
				throw new Error(`Failed to parse JSON line: ${error}`)
			}
		}
	}

	/**
	 * Create a compression transformer
	 */
	createCompressionTransformer(): StreamTransformer<string, Uint8Array> {
		return async (chunk: string): Promise<Uint8Array> => {
			if (!this.config.enableCompression) {
				return new TextEncoder().encode(chunk)
			}

			// Simple compression using built-in compression
			const stream = new CompressionStream('gzip')
			const writer = stream.writable.getWriter()
			const reader = stream.readable.getReader()

			writer.write(new TextEncoder().encode(chunk))
			writer.close()

			const { value } = await reader.read()
			return value || new Uint8Array()
		}
	}

	/**
	 * Create a decompression transformer
	 */
	createDecompressionTransformer(): StreamTransformer<Uint8Array, string> {
		return async (chunk: Uint8Array): Promise<string> => {
			if (!this.config.enableCompression) {
				return new TextDecoder().decode(chunk)
			}

			// Simple decompression using built-in decompression
			const stream = new DecompressionStream('gzip')
			const writer = stream.writable.getWriter()
			const reader = stream.readable.getReader()

			// Ensure we have a proper Uint8Array with ArrayBuffer
			const normalizedChunk = chunk.buffer instanceof ArrayBuffer ? chunk : new Uint8Array(chunk)

			writer.write(normalizedChunk)
			writer.close()

			const { value } = await reader.read()
			return new TextDecoder().decode(value)
		}
	}

	/**
	 * Create a rate limiting transformer
	 */
	createRateLimitTransformer<T>(itemsPerSecond: number): StreamTransformer<T, T> {
		let lastEmit = 0
		const interval = 1000 / itemsPerSecond

		return async (chunk: T): Promise<T> => {
			const now = Date.now()
			const elapsed = now - lastEmit

			if (elapsed < interval) {
				await new Promise((resolve) => setTimeout(resolve, interval - elapsed))
			}

			lastEmit = Date.now()
			return chunk
		}
	}
}

/**
 * Export streaming manager that combines all streaming functionality
 */
export class StreamingManager {
	private connectionManager: ConnectionManager
	private processor: StreamProcessor
	private config: StreamConfig
	private logger: Logger

	constructor(config: Partial<StreamConfig> = {}, logger?: Logger) {
		this.config = { ...DEFAULT_STREAM_CONFIG, ...config }
		this.logger = logger || new AuditLogger({ level: 'info' })
		this.connectionManager = new ConnectionManager(this.config, this.logger)
		this.processor = new StreamProcessor(this.config, this.logger)
	}

	/**
	 * Create a managed readable stream for large data exports
	 */
	createExportStream<T>(
		source: UnderlyingDefaultSource<T>,
		options: Partial<StreamConfig> = {}
	): ManagedReadableStream<T> {
		return new ManagedReadableStream(source, { ...this.config, ...options }, this.logger)
	}

	/**
	 * Create a real-time connection
	 */
	async createRealtimeConnection(
		id: string,
		url: string,
		type: 'websocket' | 'sse' | 'polling',
		options: ConnectionOptions = {}
	): Promise<ManagedConnection> {
		return this.connectionManager.createConnection(id, url, type, options)
	}

	/**
	 * Get connection manager
	 */
	getConnectionManager(): ConnectionManager {
		return this.connectionManager
	}

	/**
	 * Get stream processor
	 */
	getProcessor(): StreamProcessor {
		return this.processor
	}

	/**
	 * Get combined metrics
	 */
	getMetrics(): {
		connections: StreamMetrics
		totalConnections: number
		activeConnections: number
	} {
		const connectionMetrics = this.connectionManager.getMetrics()
		const activeConnections = this.connectionManager.getActiveConnections()

		return {
			connections: connectionMetrics,
			totalConnections: connectionMetrics.currentConnections,
			activeConnections: activeConnections.length,
		}
	}

	/**
	 * Cleanup all resources
	 */
	async destroy(): Promise<void> {
		await this.connectionManager.closeAll()
	}
}
