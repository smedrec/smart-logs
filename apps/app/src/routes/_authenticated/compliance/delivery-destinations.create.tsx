import { CompliancePage } from '@/components/compliance/layout/compliance-page'
import { Button } from '@/components/ui/button'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { lazy } from 'react'
import { toast } from 'sonner'

import type { CreateDeliveryDestination } from '@smedrec/audit-client'

// Lazy load the form component
const DeliveryDestinationForm = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DeliveryDestinationForm,
	}))
)

export const Route = createFileRoute('/_authenticated/compliance/delivery-destinations/create')({
	component: RouteComponent,
})

function RouteComponent() {
	const navigate = useNavigate()

	// TODO: Get organization ID from context or auth
	const organizationId = 'org-123'

	const handleSubmit = async (data: CreateDeliveryDestination) => {
		try {
			// TODO: Replace with real API call
			// const destination = await auditClient.delivery.createDestination(data)
			console.log('Creating destination:', data)

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000))

			toast.success('Delivery destination created successfully')
			navigate({ to: '/compliance/delivery-destinations' })
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to create destination')
			throw error
		}
	}

	const handleCancel = () => {
		navigate({ to: '/compliance/delivery-destinations' })
	}

	return (
		<CompliancePage
			title="Create Delivery Destination"
			description="Configure a new destination for delivering compliance reports"
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
					onSubmit={handleSubmit}
					onCancel={handleCancel}
				/>
			</div>
		</CompliancePage>
	)
}
