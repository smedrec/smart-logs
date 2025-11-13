import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy } from 'react'
import { toast } from 'sonner'

import type { CreateDeliveryDestination } from '@smedrec/audit-client'

// Lazy load the delivery destinations page component for code splitting
const DeliveryDestinationsPage = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DeliveryDestinationsPage,
	}))
)

export const Route = createFileRoute('/_authenticated/compliance/delivery-destinations')({
	component: RouteComponent,
})

function RouteComponent() {
	const navigate = useNavigate()

	const handleCreateDestination = () => {
		navigate({ to: '/compliance/delivery-destinations/create' })
	}

	const handleEditDestination = (destinationId: string) => {
		navigate({
			to: '/compliance/delivery-destinations/$destinationId/edit',
			params: { destinationId },
		})
	}

	const handleTestDestination = (destinationId: string) => {
		// Test is handled by the page component with dialog
		console.log('Test destination:', destinationId)
	}

	const handleDeleteDestination = async (destinationId: string) => {
		// TODO: Implement with real API call
		// await auditClient.delivery.deleteDestination(destinationId)
		console.log('Delete destination:', destinationId)
	}

	const handleDuplicateDestination = async (data: CreateDeliveryDestination) => {
		// TODO: Implement with real API call
		// await auditClient.delivery.createDestination(data)
		console.log('Duplicate destination:', data)
	}

	const handleEnableDestination = async (destinationId: string) => {
		// TODO: Implement with real API call
		// await auditClient.delivery.updateDestination(destinationId, { disabled: false })
		console.log('Enable destination:', destinationId)
	}

	const handleDisableDestination = async (destinationId: string) => {
		// TODO: Implement with real API call
		// await auditClient.delivery.updateDestination(destinationId, { disabled: true })
		console.log('Disable destination:', destinationId)
	}

	const handleViewDestination = (destinationId: string) => {
		navigate({ to: '/compliance/delivery-destinations/$destinationId', params: { destinationId } })
	}

	return (
		<DeliveryDestinationsPage
			onCreateDestination={handleCreateDestination}
			onEditDestination={handleEditDestination}
			onTestDestination={handleTestDestination}
			onDeleteDestination={handleDeleteDestination}
			onDuplicateDestination={handleDuplicateDestination}
			onEnableDestination={handleEnableDestination}
			onDisableDestination={handleDisableDestination}
			onViewDestination={handleViewDestination}
		/>
	)
}
