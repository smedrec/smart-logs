import { Alert, AlertDescription } from '@/components/ui/alert'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Loader2 } from 'lucide-react'
import * as React from 'react'

import type { DeliveryDestination } from '@smedrec/audit-client'

interface DeleteDestinationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	destination: DeliveryDestination | null
	onConfirm: (destinationId: string) => Promise<void>
	loading?: boolean
}

export function DeleteDestinationDialog({
	open,
	onOpenChange,
	destination,
	onConfirm,
	loading = false,
}: DeleteDestinationDialogProps) {
	const [confirmed, setConfirmed] = React.useState(false)

	// Reset confirmation when dialog opens/closes
	React.useEffect(() => {
		if (!open) {
			setConfirmed(false)
		}
	}, [open])

	const handleConfirm = async () => {
		if (!destination || !confirmed) return

		try {
			await onConfirm(destination.id)
			onOpenChange(false)
		} catch (err) {
			// Error handling is done by parent component
			console.error('Delete error:', err)
		}
	}

	if (!destination) return null

	const hasUsage = destination.countUsage > 0
	const isActive = !destination.disabled

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-destructive" />
						Delete Delivery Destination
					</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete this delivery destination? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="space-y-4 py-4">
					{/* Destination Info */}
					<div className="rounded-md border p-4 space-y-2">
						<div className="flex items-center justify-between">
							<span className="font-medium">{destination.label}</span>
							<Badge variant={isActive ? 'default' : 'secondary'}>
								{isActive ? 'Active' : 'Disabled'}
							</Badge>
						</div>
						{destination.description && (
							<p className="text-sm text-muted-foreground">{destination.description}</p>
						)}
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							<span>Type: {destination.type}</span>
							<span>Usage: {destination.countUsage.toLocaleString()}</span>
						</div>
					</div>

					{/* Warnings */}
					{hasUsage && (
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								This destination has been used {destination.countUsage.toLocaleString()}{' '}
								{destination.countUsage === 1 ? 'time' : 'times'}. Deleting it may affect historical
								delivery records.
							</AlertDescription>
						</Alert>
					)}

					{isActive && (
						<Alert>
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								This destination is currently active. Consider disabling it first before deletion.
							</AlertDescription>
						</Alert>
					)}

					{/* Confirmation Checkbox */}
					<div className="flex items-start space-x-2 pt-2">
						<Checkbox
							id="confirm-delete"
							checked={confirmed}
							onCheckedChange={(checked) => setConfirmed(checked === true)}
							disabled={loading}
						/>
						<Label
							htmlFor="confirm-delete"
							className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							I understand that this action cannot be undone and may affect historical records
						</Label>
					</div>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={!confirmed || loading}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Delete Destination
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
