import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Copy, Loader2 } from 'lucide-react'
import * as React from 'react'

import type { CreateDeliveryDestination, DeliveryDestination } from '@smedrec/audit-client'

interface DuplicateDestinationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	destination: DeliveryDestination | null
	onConfirm: (data: CreateDeliveryDestination) => Promise<void>
	loading?: boolean
}

export function DuplicateDestinationDialog({
	open,
	onOpenChange,
	destination,
	onConfirm,
	loading = false,
}: DuplicateDestinationDialogProps) {
	const [label, setLabel] = React.useState('')
	const [description, setDescription] = React.useState('')
	const [error, setError] = React.useState<string | null>(null)

	// Initialize form when destination changes
	React.useEffect(() => {
		if (destination && open) {
			setLabel(`${destination.label} (Copy)`)
			setDescription(destination.description || '')
			setError(null)
		}
	}, [destination, open])

	const handleConfirm = async () => {
		if (!destination) return

		// Validate
		if (!label.trim()) {
			setError('Label is required')
			return
		}

		setError(null)

		try {
			const duplicateData: CreateDeliveryDestination = {
				organizationId: destination.organizationId,
				label: label.trim(),
				type: destination.type,
				description: description.trim() || undefined,
				config: destination.config,
			}

			await onConfirm(duplicateData)
			onOpenChange(false)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to duplicate destination')
		}
	}

	const handleCancel = () => {
		onOpenChange(false)
		setError(null)
	}

	if (!destination) return null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Copy className="h-5 w-5" />
						Duplicate Destination
					</DialogTitle>
					<DialogDescription>
						Create a copy of <span className="font-medium">{destination.label}</span> with the same
						configuration
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Original Destination Info */}
					<div className="rounded-md bg-muted p-3 space-y-1 text-sm">
						<div className="font-medium">Original Destination</div>
						<div className="text-muted-foreground">
							<div>Type: {destination.type}</div>
							<div>Usage: {destination.countUsage.toLocaleString()}</div>
						</div>
					</div>

					{/* New Label */}
					<div className="space-y-2">
						<Label htmlFor="duplicate-label">
							New Label <span className="text-destructive">*</span>
						</Label>
						<Input
							id="duplicate-label"
							value={label}
							onChange={(e) => {
								setLabel(e.target.value)
								setError(null)
							}}
							placeholder="Enter a unique label"
							disabled={loading}
							autoFocus
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>

					{/* New Description */}
					<div className="space-y-2">
						<Label htmlFor="duplicate-description">Description</Label>
						<Textarea
							id="duplicate-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description"
							disabled={loading}
							rows={3}
						/>
					</div>

					{/* Info */}
					<div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
						<p>
							The new destination will have the same configuration as the original, but will be
							created as a separate entity with its own usage tracking.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel} disabled={loading}>
						Cancel
					</Button>
					<Button onClick={handleConfirm} disabled={loading || !label.trim()}>
						{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						<Copy className="mr-2 h-4 w-4" />
						Create Duplicate
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
