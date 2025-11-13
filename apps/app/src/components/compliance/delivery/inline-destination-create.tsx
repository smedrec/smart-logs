import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { DeliveryDestinationForm } from './delivery-destination-form'

import type { CreateDeliveryDestination, DeliveryDestination } from '@smedrec/audit-client'

interface InlineDestinationCreateProps {
	organizationId: string
	onCreate: (data: CreateDeliveryDestination) => Promise<DeliveryDestination>
	onSuccess?: (destination: DeliveryDestination) => void
	trigger?: React.ReactNode
}

export function InlineDestinationCreate({
	organizationId,
	onCreate,
	onSuccess,
	trigger,
}: InlineDestinationCreateProps) {
	const [open, setOpen] = React.useState(false)
	const [loading, setLoading] = React.useState(false)

	const handleSubmit = async (data: CreateDeliveryDestination) => {
		setLoading(true)
		try {
			const destination = await onCreate(data)
			toast.success('Destination created successfully')
			setOpen(false)
			onSuccess?.(destination)
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create destination')
			throw err
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			{trigger ? (
				<div onClick={() => setOpen(true)}>{trigger}</div>
			) : (
				<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Create Destination
				</Button>
			)}

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Create Delivery Destination</DialogTitle>
						<DialogDescription>
							Create a new destination to deliver compliance reports
						</DialogDescription>
					</DialogHeader>

					<DeliveryDestinationForm
						organizationId={organizationId}
						onSubmit={handleSubmit}
						onCancel={() => setOpen(false)}
						loading={loading}
					/>
				</DialogContent>
			</Dialog>
		</>
	)
}
