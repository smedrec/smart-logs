import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { useAuditContext } from '@/contexts/audit-provider'
import { cn } from '@/lib/utils'
import { AlertCircle, Info } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

import { DestinationPreview, DestinationSelector, InlineDestinationCreate } from '../delivery'

import type {
	CreateDeliveryDestination,
	DeliveryDestination,
	DestinationHealth,
} from '@smedrec/audit-client'

interface DeliveryConfigurationProps {
	organizationId: string
	className?: string
}

export function DeliveryConfiguration({ organizationId, className }: DeliveryConfigurationProps) {
	const form = useFormContext()
	const { client, isConnected } = useAuditContext()

	const [destinations, setDestinations] = useState<DeliveryDestination[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | undefined>()

	// Watch the selected destination IDs from the form
	const selectedDestinationIds = form.watch('delivery.destinationIds') || []

	// Load available destinations
	useEffect(() => {
		loadDestinations()
	}, [])

	const loadDestinations = async () => {
		if (!client || !isConnected) {
			return
		}

		setLoading(true)
		setError(undefined)

		try {
			// TODO: Replace with real API call
			// const response = await client.delivery.listDestinations({
			//   organizationId,
			//   disabled: false,
			//   limit: 100,
			//   sortBy: 'label',
			//   sortOrder: 'asc',
			// })
			// setDestinations(response.data)

			// Mock data for demonstration
			await new Promise((resolve) => setTimeout(resolve, 500))
			setDestinations([])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load delivery destinations')
			toast.error('Failed to load delivery destinations')
		} finally {
			setLoading(false)
		}
	}

	const handleCreateDestination = async (
		data: CreateDeliveryDestination
	): Promise<DeliveryDestination> => {
		if (!client || !isConnected) {
			throw new Error('Audit client is not connected')
		}

		// TODO: Replace with real API call
		// return await client.delivery.createDestination(data)

		// Mock implementation
		await new Promise((resolve) => setTimeout(resolve, 1000))
		const newDestination: DeliveryDestination = {
			id: `dest-${Date.now()}`,
			organizationId: data.organizationId,
			label: data.label,
			type: data.type,
			description: data.description,
			config: data.config,
			disabled: false,
			countUsage: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}
		return newDestination
	}

	const handleDestinationCreated = (destination: DeliveryDestination) => {
		// Add to destinations list
		setDestinations([...destinations, destination])

		// Auto-select the newly created destination
		const currentIds = form.getValues('delivery.destinationIds') || []
		form.setValue('delivery.destinationIds', [...currentIds, destination.id])
	}

	const handleSelectionChange = (selectedIds: string[]) => {
		form.setValue('delivery.destinationIds', selectedIds, { shouldValidate: true })
	}

	// Get selected destinations for preview
	const selectedDestinations = destinations.filter((d) => selectedDestinationIds.includes(d.id))

	return (
		<div className={cn('space-y-6', className)}>
			{/* Info Alert */}
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					Select one or more delivery destinations for this report. Destinations are pre-configured
					and can be reused across multiple reports. You can also create new destinations inline.
				</AlertDescription>
			</Alert>

			{/* Error Alert */}
			{error && (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Destination Selector */}
			<FormField
				control={form.control}
				name="delivery.destinationIds"
				render={({ field }) => (
					<FormItem>
						<FormControl>
							<DestinationSelector
								destinations={destinations}
								selectedIds={field.value || []}
								onSelectionChange={handleSelectionChange}
								loading={loading}
								showHealthStatus
								allowMultiple
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			{/* Inline Destination Creation */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Need a New Destination?</CardTitle>
					<CardDescription>
						Create a new delivery destination without leaving this form
					</CardDescription>
				</CardHeader>
				<CardContent>
					<InlineDestinationCreate
						organizationId={organizationId}
						onCreate={handleCreateDestination}
						onSuccess={handleDestinationCreated}
					/>
				</CardContent>
			</Card>

			{/* Selected Destinations Preview */}
			{selectedDestinations.length > 0 && (
				<DestinationPreview destinations={selectedDestinations} />
			)}

			{/* Help Text */}
			{destinations.length === 0 && !loading && (
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">No Destinations Available</CardTitle>
						<CardDescription>
							You need to create at least one delivery destination before you can configure report
							delivery
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Delivery destinations define where and how compliance reports are sent. You can
								create destinations for:
							</p>
							<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
								<li>Email delivery to specific recipients</li>
								<li>Webhook integration with external systems</li>
								<li>File storage (local, S3, Azure, GCP)</li>
								<li>SFTP servers</li>
								<li>Download links with expiry</li>
							</ul>
							<InlineDestinationCreate
								organizationId={organizationId}
								onCreate={handleCreateDestination}
								onSuccess={handleDestinationCreated}
							/>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
