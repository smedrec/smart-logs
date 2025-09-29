import { useAuditContext } from '@/contexts/audit-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Hook for audit presets
export function useAuditPresets() {
	const { client, isConnected } = useAuditContext()
	const queryClient = useQueryClient()

	const presetsQuery = useQuery({
		queryKey: ['auditPresets'],
		queryFn: async () => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.list()
		},
		enabled: isConnected && !!client,
		staleTime: 300000, // 5 minutes
	})

	const applyPreset = useMutation({
		mutationFn: async ({ name, context }: { name: string; context: any }) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.apply(name, context)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['auditEvents'] })
		},
	})

	const presetDelete = useMutation({
		mutationFn: async (name: string) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.delete(name)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['auditPresets'] })
		},
	})

	const presetCreate = useMutation({
		mutationFn: async (preset: any) => {
			if (!client) throw new Error('Audit client not initialized')
			return client.presets.create(preset)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['auditPresets'] })
		},
	})

	return {
		data: presetsQuery.data?.presets || [],
		loading: presetsQuery.isLoading,
		error: presetsQuery.error,
		presetCreate: presetCreate.mutateAsync,
		presetCreatePending: presetCreate.isPending,
		presetCreateError: presetCreate.error,
		presetDelete: presetDelete.mutateAsync,
		presetDeletePending: presetDelete.isPending,
		presetDeleteError: presetDelete.error,
	}
}
