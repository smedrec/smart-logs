import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAuditStore } from '../stores/audit'

import type {
	AuditEvent,
	CreateAuditEventInput,
	QueryAuditEventsParams,
} from '@smedrec/audit-client'

// Composable for creating audit events
export function useCreateAuditEvent() {
	const auditStore = useAuditStore()
	const creating = ref(false)
	const error = ref<string | null>(null)
	const success = ref(false)

	const createEvent = async (eventData: CreateAuditEventInput) => {
		try {
			creating.value = true
			error.value = null
			success.value = false

			await auditStore.createEvent(eventData)
			success.value = true

			// Auto-clear success after 3 seconds
			setTimeout(() => {
				success.value = false
			}, 3000)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to create event'
			success.value = false
		} finally {
			creating.value = false
		}
	}

	const reset = () => {
		error.value = null
		success.value = false
	}

	return {
		createEvent,
		creating: readonly(creating),
		error: readonly(error),
		success: readonly(success),
		reset,
	}
}

// Composable for bulk creating audit events
export function useBulkCreateAuditEvents() {
	const auditStore = useAuditStore()
	const creating = ref(false)
	const error = ref<string | null>(null)
	const success = ref(false)

	const bulkCreate = async (events: CreateAuditEventInput[]) => {
		try {
			creating.value = true
			error.value = null
			success.value = false

			await auditStore.bulkCreateEvents(events)
			success.value = true

			setTimeout(() => {
				success.value = false
			}, 3000)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to bulk create events'
			success.value = false
		} finally {
			creating.value = false
		}
	}

	return {
		bulkCreate,
		creating: readonly(creating),
		error: readonly(error),
		success: readonly(success),
	}
}

// Composable for querying audit events
export function useAuditEvents(params: QueryAuditEventsParams = {}) {
	const auditStore = useAuditStore()
	const refreshing = ref(false)

	const events = computed(() => auditStore.allEvents)
	const pagination = computed(() => auditStore.pagination)
	const loading = computed(() => auditStore.loading)
	const error = computed(() => auditStore.error)

	const fetchEvents = async (newParams?: QueryAuditEventsParams) => {
		try {
			refreshing.value = true
			await auditStore.fetchEvents(newParams || params)
		} finally {
			refreshing.value = false
		}
	}

	const refetch = () => fetchEvents()

	// Auto-fetch on mount if store is ready
	onMounted(() => {
		if (auditStore.isReady) {
			fetchEvents()
		}
	})

	// Watch for store readiness
	watch(
		() => auditStore.isReady,
		(isReady) => {
			if (isReady && events.value.length === 0) {
				fetchEvents()
			}
		}
	)

	return {
		events,
		pagination,
		loading,
		error,
		refreshing: readonly(refreshing),
		fetchEvents,
		refetch,
	}
}

// Composable for getting a specific audit event
export function useAuditEvent(id: string) {
	const auditStore = useAuditStore()
	const event = ref<AuditEvent | null>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)

	const fetchEvent = async () => {
		if (!id) return

		try {
			loading.value = true
			error.value = null
			event.value = await auditStore.getEventById(id)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to fetch event'
		} finally {
			loading.value = false
		}
	}

	onMounted(() => {
		if (auditStore.isReady) {
			fetchEvent()
		}
	})

	watch(
		() => auditStore.isReady,
		(isReady) => {
			if (isReady) {
				fetchEvent()
			}
		}
	)

	watch(
		() => id,
		() => {
			if (auditStore.isReady) {
				fetchEvent()
			}
		}
	)

	return {
		event: readonly(event),
		loading: readonly(loading),
		error: readonly(error),
		refetch: fetchEvent,
	}
}

// Composable for real-time audit events streaming
export function useAuditEventsStream(params: any = {}) {
	const auditStore = useAuditStore()
	const error = ref<string | null>(null)

	const events = computed(() => auditStore.streamEvents)
	const isStreaming = computed(() => auditStore.isStreaming)

	const startStream = () => {
		try {
			error.value = null
			auditStore.startEventStream(params)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to start stream'
		}
	}

	const stopStream = () => {
		auditStore.stopEventStream()
	}

	const clearEvents = () => {
		auditStore.clearStreamEvents()
	}

	// Auto-cleanup on unmount
	onUnmounted(() => {
		if (isStreaming.value) {
			stopStream()
		}
	})

	return {
		events,
		isStreaming,
		error: readonly(error),
		startStream,
		stopStream,
		clearEvents,
	}
}

// Composable for compliance reports
export function useComplianceReports() {
	const auditStore = useAuditStore()
	const generating = ref(false)
	const error = ref<string | null>(null)
	const report = ref<any>(null)

	const generateReport = async (type: 'hipaa' | 'gdpr', criteria: any) => {
		try {
			generating.value = true
			error.value = null
			report.value = await auditStore.generateComplianceReport(type, criteria)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to generate report'
		} finally {
			generating.value = false
		}
	}

	const reset = () => {
		error.value = null
		report.value = null
	}

	return {
		generateReport,
		generating: readonly(generating),
		error: readonly(error),
		report: readonly(report),
		reset,
	}
}

// Composable for system health monitoring
export function useSystemHealth(autoRefresh = true, interval = 30000) {
	const auditStore = useAuditStore()
	const health = ref<any>(null)
	const loading = ref(false)
	const error = ref<string | null>(null)
	let refreshTimer: NodeJS.Timeout | null = null

	const fetchHealth = async () => {
		try {
			loading.value = true
			error.value = null
			health.value = await auditStore.getSystemHealth()
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to fetch health'
		} finally {
			loading.value = false
		}
	}

	const startAutoRefresh = () => {
		if (refreshTimer) return

		refreshTimer = setInterval(fetchHealth, interval)
	}

	const stopAutoRefresh = () => {
		if (refreshTimer) {
			clearInterval(refreshTimer)
			refreshTimer = null
		}
	}

	onMounted(() => {
		if (auditStore.isReady) {
			fetchHealth()
			if (autoRefresh) {
				startAutoRefresh()
			}
		}
	})

	onUnmounted(() => {
		stopAutoRefresh()
	})

	watch(
		() => auditStore.isReady,
		(isReady) => {
			if (isReady) {
				fetchHealth()
				if (autoRefresh) {
					startAutoRefresh()
				}
			}
		}
	)

	return {
		health: readonly(health),
		loading: readonly(loading),
		error: readonly(error),
		refetch: fetchHealth,
		startAutoRefresh,
		stopAutoRefresh,
	}
}

// Composable for audit presets
export function useAuditPresets() {
	const auditStore = useAuditStore()
	const presets = ref<any[]>([])
	const loading = ref(false)
	const error = ref<string | null>(null)
	const applying = ref(false)

	const fetchPresets = async () => {
		try {
			loading.value = true
			error.value = null
			presets.value = await auditStore.getAuditPresets()
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to fetch presets'
		} finally {
			loading.value = false
		}
	}

	const applyPreset = async (name: string, context: any) => {
		try {
			applying.value = true
			error.value = null
			await auditStore.applyPreset(name, context)
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to apply preset'
		} finally {
			applying.value = false
		}
	}

	onMounted(() => {
		if (auditStore.isReady) {
			fetchPresets()
		}
	})

	watch(
		() => auditStore.isReady,
		(isReady) => {
			if (isReady) {
				fetchPresets()
			}
		}
	)

	return {
		presets: readonly(presets),
		loading: readonly(loading),
		error: readonly(error),
		applying: readonly(applying),
		fetchPresets,
		applyPreset,
	}
}

// Composable for form audit logging
export function useFormAudit(formName: string) {
	const { createEvent } = useCreateAuditEvent()

	const logFormEvent = (action: string, details?: Record<string, any>) => {
		createEvent({
			action: `form.${action}`,
			targetResourceType: 'form',
			targetResourceId: formName,
			principalId: 'current-user', // Replace with actual user ID
			organizationId: 'current-org', // Replace with actual org ID
			status: 'success',
			dataClassification: 'INTERNAL',
			details: {
				formName,
				...details,
			},
		})
	}

	return {
		logFormSubmit: (data?: any) => logFormEvent('submit', { data }),
		logFormValidation: (errors?: any) => logFormEvent('validation', { errors }),
		logFormFieldChange: (field: string, value: any) =>
			logFormEvent('field_change', { field, value }),
		logFormError: (error: string) => logFormEvent('error', { error }),
	}
}

// Composable for audit client connection management
export function useAuditConnection() {
	const auditStore = useAuditStore()

	const isConnected = computed(() => auditStore.isConnected)
	const connectionError = computed(() => auditStore.connectionError)
	const isReady = computed(() => auditStore.isReady)

	const connect = async (config?: any) => {
		await auditStore.initializeClient(config)
	}

	const reconnect = async () => {
		await auditStore.reconnect()
	}

	const clearError = () => {
		auditStore.clearError()
	}

	return {
		isConnected,
		connectionError,
		isReady,
		connect,
		reconnect,
		clearError,
	}
}
