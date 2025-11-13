import { CompliancePage } from '@/components/compliance/layout/compliance-page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { lazy, useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { CreateDeliveryDestination, DeliveryDestination } from '@smedrec/audit-client'

// Lazy load the form component
const DeliveryDestinationForm = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DeliveryDestinationForm,
	}))
)

const ErrorAlert = lazy(() =>
	import('@/components/compliance/error').then((module) => ({
		default: module.ErrorAlert,
	}))
)

export const Route = createFileRoute(
	'/_authenticated/compliance/delivery-destinations/$destinationId/edit'
)({
	component: RouteComponent,
})

function RouteComponent() {
	const { destinationId } = Route.useParams()
	const navigate = useNavigate()

	const [destination, setDestination] = useState<DeliveryDestination | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | undefined>()

	// TODO: Get organization ID from context or auth
	const organizationId = 'org-123'

	useEffect(() => {
		loadDestination()
	}, [destinationId])

	const loadDestination = async () => {
		setLoading(true)
		setError(undefined)

		try {
			// TODO: Replace with real API call
			// const dest = await auditClient.delivery.getDestination(destinationId)
			console.log('Loading destination:', destinationId)

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 500))

			// Mock data - replace with real data
			setDestination(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load destination')
		} finally {
			setLoading(false)
		}
	}

	const handleSubmit = async (data: CreateDeliveryDestination) => {
		try {
			// TODO: Replace with real API call
			// await auditClient.delivery.updateDestination(destinationId, data)
			console.log('Updating destination:', destinationId, data)

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000))

			toast.success('Delivery destination updated successfully')
			navigate({ to: '/compliance/delivery-destinations' })
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update destination')
			throw error
		}
	}

	const handleCancel = () => {
		navigate({ to: '/compliance/delivery-destinations' })
	}

	if (loading) {
		return (
			<CompliancePage
				title="Edit Delivery Destination"
				description="Update destination configuration"
				actions={
					<Button variant="outline" onClick={handleCancel}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Destinations
					</Button>
				}
			>
				<div className="max-w-4xl space-y-6">
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-48 w-full" />
				</div>
			</CompliancePage>
		)
	}

	if (error) {
		return (
			<CompliancePage
				title="Edit Delivery Destination"
				description="Update destination configuration"
				actions={
					<Button variant="outline" onClick={handleCancel}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Destinations
					</Button>
				}
			>
				<div className="max-w-4xl">
					<ErrorAlert
						error={{ code: 'LOAD_ERROR', message: error }}
						dismissible
						onDismiss={() => setError(undefined)}
						actions={[
							{
								label: 'Retry',
								onClick: loadDestination,
							},
							{
								label: 'Go Back',
								onClick: handleCancel,
							},
						]}
					/>
				</div>
			</CompliancePage>
		)
	}

	if (!destination) {
		return (
			<CompliancePage
				title="Edit Delivery Destination"
				description="Update destination configuration"
				actions={
					<Button variant="outline" onClick={handleCancel}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Destinations
					</Button>
				}
			>
				<div className="max-w-4xl">
					<ErrorAlert
						error={{ code: 'NOT_FOUND', message: 'Destination not found' }}
						actions={[
							{
								label: 'Go Back',
								onClick: handleCancel,
							},
						]}
					/>
				</div>
			</CompliancePage>
		)
	}

	return (
		<CompliancePage
			title={`Edit: ${destination.label}`}
			description="Update destination configuration"
			actions={
				<Button variant="outline" onClick={handleCancel}>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Destinations
				</Button>
			}
		>
			<div className="max-w-4xl">
				<DeliveryDestinationForm
					organizationId={organizationId}
					initialData={destination}
					destinationId={destinationId}
					onSubmit={handleSubmit}
					onCancel={handleCancel}
				/>
			</div>
		</CompliancePage>
	)
}
