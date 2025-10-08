'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Check, CheckCircle, Loader2, XCircle } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

type ActionType = 'view' | 'acknowledge' | 'resolve' | 'dismiss'

interface AlertActionDialogProps {
	/** Whether the dialog is open */
	open: boolean
	/** Callback when dialog open state changes */
	onOpenChange: (open: boolean) => void
	/** The action being performed */
	action: ActionType | null
	/** Number of alerts being acted upon */
	alertCount: number
	/** Callback when action is confirmed */
	onConfirm: (notes: string) => void
	/** Callback when action is cancelled */
	onCancel: () => void
	/** Whether the action is currently loading */
	isLoading?: boolean
}

// Form schema for resolution notes
const resolveFormSchema = z.object({
	notes: z
		.string()
		.min(1, 'Resolution notes are required')
		.max(1000, 'Notes must be less than 1000 characters'),
})

type ResolveFormValues = z.infer<typeof resolveFormSchema>

/**
 * Modal dialogs for alert state changes with form validation
 * Handles acknowledge, resolve, and dismiss operations with appropriate confirmations
 */
export function AlertActionDialog({
	open,
	onOpenChange,
	action,
	alertCount,
	onConfirm,
	onCancel,
	isLoading = false,
}: AlertActionDialogProps) {
	const form = useForm<ResolveFormValues>({
		resolver: zodResolver(resolveFormSchema),
		defaultValues: {
			notes: '',
		},
	})

	const handleConfirm = (values?: ResolveFormValues) => {
		if (action === 'resolve' && values) {
			onConfirm(values.notes)
		} else {
			onConfirm('')
		}
	}

	const handleCancel = () => {
		form.reset()
		onCancel()
	}

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen && !isLoading) {
			handleCancel()
		}
		onOpenChange(newOpen)
	}

	const getActionConfig = (actionType: ActionType | null) => {
		switch (actionType) {
			case 'acknowledge':
				return {
					title: 'Acknowledge Alerts',
					description:
						'Mark the selected alerts as acknowledged. This indicates that you are aware of the alerts and are taking action.',
					icon: <Check className="h-5 w-5 text-blue-500" />,
					confirmText: 'Acknowledge',
					confirmVariant: 'default' as const,
					requiresNotes: false,
				}
			case 'resolve':
				return {
					title: 'Resolve Alerts',
					description:
						'Mark the selected alerts as resolved. Please provide notes explaining how the issue was resolved.',
					icon: <CheckCircle className="h-5 w-5 text-green-500" />,
					confirmText: 'Resolve',
					confirmVariant: 'default' as const,
					requiresNotes: true,
				}
			case 'dismiss':
				return {
					title: 'Dismiss Alerts',
					description:
						'Dismiss the selected alerts. This action indicates that the alerts are not relevant or actionable.',
					icon: <XCircle className="h-5 w-5 text-red-500" />,
					confirmText: 'Dismiss',
					confirmVariant: 'destructive' as const,
					requiresNotes: false,
				}
			default:
				return {
					title: 'Confirm Action',
					description: 'Please confirm this action.',
					icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
					confirmText: 'Confirm',
					confirmVariant: 'default' as const,
					requiresNotes: false,
				}
		}
	}

	const config = getActionConfig(action)
	const alertText = alertCount === 1 ? 'alert' : 'alerts'

	if (!action) return null

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						{config.icon}
						<DialogTitle>{config.title}</DialogTitle>
					</div>
					<DialogDescription className="space-y-2">
						<p>{config.description}</p>
						<p className="font-medium">
							This action will affect {alertCount} {alertText}.
						</p>
					</DialogDescription>
				</DialogHeader>

				{config.requiresNotes ? (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4">
							<FormField
								control={form.control}
								name="notes"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Resolution Notes *</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Describe how the issue was resolved..."
												className="min-h-[100px]"
												disabled={isLoading}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<DialogFooter className="gap-2">
								<Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
									Cancel
								</Button>
								<Button type="submit" variant={config.confirmVariant} disabled={isLoading}>
									{isLoading ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Processing...
										</>
									) : (
										<>
											{config.icon}
											{config.confirmText}
										</>
									)}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				) : (
					<DialogFooter className="gap-2">
						<Button variant="outline" onClick={handleCancel} disabled={isLoading}>
							Cancel
						</Button>
						<Button
							variant={config.confirmVariant}
							onClick={() => handleConfirm()}
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Processing...
								</>
							) : (
								<>
									{config.icon}
									{config.confirmText}
								</>
							)}
						</Button>
					</DialogFooter>
				)}

				{/* Warning for destructive actions */}
				{action === 'dismiss' && (
					<div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
						<AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
						<div className="text-sm">
							<p className="font-medium text-destructive">Warning</p>
							<p className="text-destructive/80">
								Dismissed alerts will be removed from active monitoring. This action cannot be
								undone.
							</p>
						</div>
					</div>
				)}

				{/* Loading overlay */}
				{isLoading && (
					<div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
						<div className="flex items-center gap-2 text-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							Processing {alertCount} {alertText}...
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
