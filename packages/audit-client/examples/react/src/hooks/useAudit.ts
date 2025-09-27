import {
	AuditClientError,
	AuditEvent,
	CreateAuditEventInput,
	PaginatedAuditEvents,
	QueryAuditEventsParams,
} from '@smedrec/audit-client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'

import { useAuditContext } from '../providers/AuditProvider'

// Hook for creating audit events
export function useCreateAuditEvent() {
	const { client } = useAuditContext()
	const queryClient = useQueryClient()

	const mutation = useMutation<AuditEvent, AuditClientError, CreateAuditEventInput>(
		async (eventData) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.events.create(eventData)
		},
		{
			onSuccess: () => {
				// Invalidate and refetch audit events
				queryClient.invalidateQueries(['auditEvents'])
			},
			onError: (error) => {
				console.error('Failed to create audit event:', error)
			},
		}
	)

	return {
		createEvent: mutation.mutate,
		createEventAsync: mutation.mutateAsync,
		creating: mutation.isLoading,
		error: mutation.error,
		success: mutation.isSuccess,
		reset: mutation.reset,
	}
}

// Hook for bulk creating audit events
export function useBulkCreateAuditEvents() {
	const { client } = useAuditContext()
	const queryClient = useQueryClient()

	const mutation = useMutation<any, AuditClientError, CreateAuditEventInput[]>(
		async (events) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.events.bulkCreate(events)
		},
		{
			onSuccess: () => {
				queryClient.invalidateQueries(['auditEvents'])
			},
		}
	)

	return {
		bulkCreate: mutation.mutate,
		bulkCreateAsync: mutation.mutateAsync,
		creating: mutation.isLoading,
		error: mutation.error,
		success: mutation.isSuccess,
		reset: mutation.reset,
	}
}

// Hook for querying audit events
export function useAuditEvents(params: QueryAuditEventsParams = {}) {
	const { client, isConnected } = useAuditContext()

	const query = useQuery<PaginatedAuditEvents, AuditClientError>(
		['auditEvents', params],
		async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.events.query(params)
		},
		{
			enabled: isConnected && !!client,
			staleTime: 30000, // 30 seconds
			cacheTime: 300000, // 5 minutes
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				// Don't retry on authentication errors
				if (error instanceof AuditClientError && error.message.includes('authentication')) {
					return false
				}
				return failureCount < 3
			},
		}
	)

	return {
		events: query.data?.events || [],
		pagination: query.data?.pagination,
		metadata: query.data?.metadata,
		loading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
		isStale: query.isStale,
	}
}

// Hook for getting a specific audit event
export function useAuditEvent(id: string) {
	const { client, isConnected } = useAuditContext()

	const query = useQuery<AuditEvent | null, AuditClientError>(
		['auditEvent', id],
		async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.events.getById(id)
		},
		{
			enabled: isConnected && !!client && !!id,
			staleTime: 60000, // 1 minute
			cacheTime: 300000, // 5 minutes
		}
	)

	return {
		event: query.data,
		loading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	}
}

// Hook for real-time audit events streaming
export function useAuditEventsStream(params: any = {}) {
	const { client, isConnected } = useAuditContext()
	const [events, setEvents] = useState<AuditEvent[]>([])
	const [isStreaming, setIsStreaming] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const startStream = useCallback(async () => {
		if (!client || !isConnected) return

		try {
			setIsStreaming(true)
			setError(null)

			// Note: This would use the actual streaming API
			const subscription = client.events.subscribe({
				...params,
				onEvent: (event: AuditEvent) => {
					setEvents((prev) => [event, ...prev.slice(0, 99)]) // Keep last 100 events
				},
				onError: (err: Error) => {
					setError(err.message)
					setIsStreaming(false)
				},
				onClose: () => {
					setIsStreaming(false)
				},
			})

			return subscription
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Streaming failed')
			setIsStreaming(false)
		}
	}, [client, isConnected, params])

	const stopStream = useCallback(() => {
		setIsStreaming(false)
		// subscription?.close()
	}, [])

	useEffect(() => {
		return () => {
			stopStream()
		}
	}, [stopStream])

	return {
		events,
		isStreaming,
		error,
		startStream,
		stopStream,
		clearEvents: () => setEvents([]),
	}
}

// Hook for compliance reports
export function useComplianceReports() {
	const { client } = useAuditContext()

	const generateHipaaReport = useMutation(async (criteria: any) => {
		if (!client) throw new Error('Audit client not initialized')
		return client.compliance.generateHipaaReport(criteria)
	})

	const generateGdprReport = useMutation(async (criteria: any) => {
		if (!client) throw new Error('Audit client not initialized')
		return client.compliance.generateGdprReport(criteria)
	})

	return {
		generateHipaaReport: generateHipaaReport.mutate,
		generateGdprReport: generateGdprReport.mutate,
		hipaaLoading: generateHipaaReport.isLoading,
		gdprLoading: generateGdprReport.isLoading,
		hipaaError: generateHipaaReport.error,
		gdprError: generateGdprReport.error,
	}
}

// Hook for system health monitoring
export function useSystemHealth() {
	const { client, isConnected } = useAuditContext()

	const query = useQuery(
		['systemHealth'],
		async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.health.detailed()
		},
		{
			enabled: isConnected && !!client,
			refetchInterval: 30000, // Refetch every 30 seconds
			staleTime: 15000, // 15 seconds
		}
	)

	return {
		health: query.data,
		loading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	}
}

// Hook for audit presets
export function useAuditPresets() {
	const { client, isConnected } = useAuditContext()
	const queryClient = useQueryClient()

	const presetsQuery = useQuery(
		['auditPresets'],
		async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.list()
		},
		{
			enabled: isConnected && !!client,
			staleTime: 300000, // 5 minutes
		}
	)

	const applyPreset = useMutation(
		async ({ name, context }: { name: string; context: any }) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.apply(name, context)
		},
		{
			onSuccess: () => {
				queryClient.invalidateQueries(['auditEvents'])
			},
		}
	)

	return {
		presets: presetsQuery.data || [],
		loading: presetsQuery.isLoading,
		error: presetsQuery.error,
		applyPreset: applyPreset.mutate,
		applying: applyPreset.isLoading,
		applyError: applyPreset.error,
	}
}

// Custom hook for form audit logging
export function useFormAudit(formName: string) {
	const { createEvent } = useCreateAuditEvent()

	const logFormEvent = useCallback(
		(action: string, details?: Record<string, any>) => {
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
		},
		[createEvent, formName]
	)

	return {
		logFormSubmit: (data?: any) => logFormEvent('submit', { data }),
		logFormValidation: (errors?: any) => logFormEvent('validation', { errors }),
		logFormFieldChange: (field: string, value: any) =>
			logFormEvent('field_change', { field, value }),
		logFormError: (error: string) => logFormEvent('error', { error }),
	}
}

// Performance monitoring hook
export function useAuditPerformance() {
	const { client } = useAuditContext()
	const [metrics, setMetrics] = useState<any>(null)

	useEffect(() => {
		if (!client) return

		const interval = setInterval(async () => {
			try {
				const performanceMetrics = await client.metrics.getPerformanceMetrics()
				setMetrics(performanceMetrics)
			} catch (error) {
				console.error('Failed to fetch performance metrics:', error)
			}
		}, 10000) // Update every 10 seconds

		return () => clearInterval(interval)
	}, [client])

	return metrics
}
