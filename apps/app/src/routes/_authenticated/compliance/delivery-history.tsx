import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy } from 'react'
import { toast } from 'sonner'

// Lazy load the delivery history page component
const DeliveryHistoryPage = lazy(() =>
	import('@/components/compliance/delivery').then((module) => ({
		default: module.DeliveryHistoryPage,
	}))
)

export const Route = createFileRoute('/_authenticated/compliance/delivery-history')({
	component: RouteComponent,
})

function RouteComponent() {
	const navigate = useNavigate()

	const handleRetryDelivery = async (deliveryId: string) => {
		try {
			// TODO: Replace with real API call
			// await auditClient.delivery.retryDelivery(deliveryId)
			console.log('Retrying delivery:', deliveryId)

			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 1000))

			toast.success('Delivery retry initiated')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to retry delivery')
			throw error
		}
	}

	const handleViewDelivery = (deliveryId: string) => {
		// TODO: Create delivery details route if needed
		console.log('View delivery:', deliveryId)
		toast.info('Delivery details view coming soon')
	}

	const handleViewDestination = (destinationId: string) => {
		navigate({ to: '/compliance/delivery-destinations/$destinationId', params: { destinationId } })
	}

	return (
		<DeliveryHistoryPage
			onRetryDelivery={handleRetryDelivery}
			onViewDelivery={handleViewDelivery}
			onViewDestination={handleViewDestination}
		/>
	)
}
