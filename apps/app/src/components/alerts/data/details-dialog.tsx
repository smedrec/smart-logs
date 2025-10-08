import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Eye } from 'lucide-react'

import AlertDetails from '../core/AlertDetails'

import type { Alert } from '@/lib/collections'

interface AlertDetailsDialogProps {
	/** Whether the dialog is open */
	open: boolean
	/** Callback when dialog open state changes */
	onOpenChange: (open: boolean) => void
	/** Alert details to display */
	alert: Alert | null
	/** Callback when action is cancelled */
	onCancel: () => void
	/** Whether the action is currently loading */
	isLoading?: boolean
}

export function AlertDetailsDialog({
	open,
	onOpenChange,
	alert,
	onCancel,
	isLoading = false,
}: AlertDetailsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[80rem]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<Eye className="h-5 w-5" />
					</div>
				</DialogHeader>
				{alert && <AlertDetails alert={alert} />}
			</DialogContent>
			<DialogFooter className="gap-2">
				<Button variant="outline" onClick={onCancel} disabled={isLoading}>
					Cancel
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
