import {
	AuditClient,
	AuditClientConfig,
	AuditClientError,
	AuditEvent,
	CreateAuditEventInput,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
} from '@smedrec/audit-client'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAuditStore = defineStore('audit', () => {
	// State
	const client = ref<AuditClient | null>(null)
	const isConnected = ref(false)
	const connectionError = ref<string | null>(null)
	const events = ref<AuditEvent[]>([])
	const pagination = ref<any>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)
	const streamEvents = ref<AuditEvent[]>([])
	const isStreaming = ref(false)

	// Getters
	const allEvents = computed(() => {
		if (streamEvents.value.length > 0) {
			// Merge and deduplicate events
			const eventMap = new Map<string, AuditEvent>()

			// Add stream events first (most recent)
			streamEvents.value.forEach((event) => eventMap.set(event.id, event))

			// Add regular events
			events.value.forEach((event) => {
				if (!eventMap.has(event.id)) {
					eventMap.set(event.id, event)
				}
			})

			return Array.from(eventMap.values()).sort(
				(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
			)
		}

		return events.value
	})

	const isReady = computed(() => isConnected.value && client.value !== null)

	// Actions
	async function initializeClient(config?: Partial<AuditClientConfig>) {
		try {
			connectionError.value = null

			const defaultConfig: AuditClientConfig = {
				baseUrl: import.meta.env.VITE_AUDIT_API_URL || 'http://localhost:3001',
				apiVersion: 'v1',
				timeout: 30000,
				authentication: {
					type: 'apiKey',
					apiKey: import.meta.env.VITE_AUDIT_API_KEY,
					autoRefresh: true,
				},
				retry: {
					enabled: true,
					maxAttempts: 3,
					initialDelayMs: 1000,
					maxDelayMs: 10000,
					backoffMultiplier: 2,
					retryableStatusCodes: [408, 429, 500, 502, 503, 504],
					retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
				},
				cache: {
					enabled: true,
					defaultTtlMs: 300000, // 5 minutes
					maxSize: 100,
					storage: 'localStorage',
					keyPrefix: 'audit-cache-vue',
					compressionEnabled: false,
				},
				batching: {
					enabled: true,
					maxBatchSize: 10,
					batchTimeoutMs: 1000,
					batchableEndpoints: ['/audit/events'],
				},
				performance: {
					enableCompression: true,
					enableStreaming: true,
					maxConcurrentRequests: 5,
					requestDeduplication: true,
					responseTransformation: true,
				},
				logging: {
					enabled: import.meta.env.DEV,
					level: 'info',
					includeRequestBody: false,
					includeResponseBody: false,
					maskSensitiveData: true,
				},
				errorHandling: {
					throwOnError: false,
					includeStackTrace: import.meta.env.DEV,
					errorTransformation: true,
				},
				environment: import.meta.env.DEV ? 'development' : 'production',
				...config,
			}

			const auditClient = new AuditClient(defaultConfig)

			// Test connection
			await auditClient.health.check()

			client.value = auditClient
			isConnected.value = true
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError ? err.message : 'Failed to initialize audit client'
			connectionError.value = errorMessage
			isConnected.value = false
			console.error('Audit client initialization failed:', err)
			throw err
		}
	}

	async function reconnect() {
		isConnected.value = false
		await initializeClient()
	}

	async function createEvent(eventData: CreateAuditEventInput): Promise<AuditEvent> {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			error.value = null
			const event = await client.value.events.create(eventData)

			// Add to local events list
			events.value.unshift(event)

			return event
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError ? err.message : 'Failed to create audit event'
			error.value = errorMessage
			throw err
		}
	}

	async function bulkCreateEvents(eventsData: CreateAuditEventInput[]) {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			error.value = null
			const result = await client.value.events.bulkCreate(eventsData)

			// Refresh events list
			await fetchEvents()

			return result
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError ? err.message : 'Failed to bulk create audit events'
			error.value = errorMessage
			throw err
		}
	}

	async function fetchEvents(params: QueryAuditEventsParams = {}) {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			loading.value = true
			error.value = null

			const result: PaginatedAuditEvents = await client.value.events.query({
				pagination: { limit: 20, offset: 0 },
				sort: { field: 'timestamp', direction: 'desc' },
				...params,
			})

			events.value = result.events
			pagination.value = result.pagination

			return result
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError ? err.message : 'Failed to fetch audit events'
			error.value = errorMessage
			throw err
		} finally {
			loading.value = false
		}
	}

	async function getEventById(id: string): Promise<AuditEvent | null> {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			return await client.value.events.getById(id)
		} catch (err) {
			console.error('Failed to fetch audit event:', err)
			return null
		}
	}

	function startEventStream(params: any = {}) {
		if (!client.value || isStreaming.value) return

		try {
			isStreaming.value = true

			// Note: This would use the actual streaming API
			const subscription = client.value.events.subscribe({
				...params,
				onEvent: (event: AuditEvent) => {
					streamEvents.value.unshift(event)
					// Keep only last 100 stream events
					if (streamEvents.value.length > 100) {
						streamEvents.value = streamEvents.value.slice(0, 100)
					}
				},
				onError: (err: Error) => {
					error.value = err.message
					isStreaming.value = false
				},
				onClose: () => {
					isStreaming.value = false
				},
			})

			return subscription
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Streaming failed'
			isStreaming.value = false
		}
	}

	function stopEventStream() {
		isStreaming.value = false
		// subscription?.close()
	}

	function clearStreamEvents() {
		streamEvents.value = []
	}

	async function generateComplianceReport(type: 'hipaa' | 'gdpr', criteria: any) {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			if (type === 'hipaa') {
				return await client.value.compliance.generateHipaaReport(criteria)
			} else {
				return await client.value.compliance.generateGdprReport(criteria)
			}
		} catch (err) {
			const errorMessage =
				err instanceof AuditClientError
					? err.message
					: `Failed to generate ${type.toUpperCase()} report`
			error.value = errorMessage
			throw err
		}
	}

	async function getSystemHealth() {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			return await client.value.health.detailed()
		} catch (err) {
			console.error('Failed to fetch system health:', err)
			return null
		}
	}

	async function getAuditPresets() {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			return await client.value.presets.list()
		} catch (err) {
			console.error('Failed to fetch audit presets:', err)
			return []
		}
	}

	async function applyPreset(name: string, context: any) {
		if (!client.value) {
			throw new Error('Audit client not initialized')
		}

		try {
			const event = await client.value.presets.apply(name, context)

			// Add to local events list
			events.value.unshift(event)

			return event
		} catch (err) {
			const errorMessage = err instanceof AuditClientError ? err.message : 'Failed to apply preset'
			error.value = errorMessage
			throw err
		}
	}

	function clearError() {
		error.value = null
		connectionError.value = null
	}

	function clearEvents() {
		events.value = []
		pagination.value = null
	}

	// Return store interface
	return {
		// State
		client: readonly(client),
		isConnected: readonly(isConnected),
		connectionError: readonly(connectionError),
		events: readonly(events),
		pagination: readonly(pagination),
		loading: readonly(loading),
		error: readonly(error),
		streamEvents: readonly(streamEvents),
		isStreaming: readonly(isStreaming),

		// Getters
		allEvents,
		isReady,

		// Actions
		initializeClient,
		reconnect,
		createEvent,
		bulkCreateEvents,
		fetchEvents,
		getEventById,
		startEventStream,
		stopEventStream,
		clearStreamEvents,
		generateComplianceReport,
		getSystemHealth,
		getAuditPresets,
		applyPreset,
		clearError,
		clearEvents,
	}
})
