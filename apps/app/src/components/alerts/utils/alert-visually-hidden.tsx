import { cn } from '@/lib/utils'
import React from 'react'

export interface AlertVisuallyHiddenProps {
	/** Content to hide visually but keep for screen readers */
	children: React.ReactNode
	/** Whether the content should be focusable */
	focusable?: boolean
	/** Additional CSS classes */
	className?: string
	/** HTML element to render as */
	as?: keyof JSX.IntrinsicElements
}

/**
 * Component that hides content visually but keeps it accessible to screen readers
 * Specifically designed for alert-related accessibility content
 */
export function AlertVisuallyHidden({
	children,
	focusable = false,
	className,
	as: Component = 'span',
}: AlertVisuallyHiddenProps) {
	return (
		<Component
			className={cn(
				'sr-only',
				focusable &&
					'focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-background focus:border focus:border-primary',
				className
			)}
			tabIndex={focusable ? 0 : undefined}
		>
			{children}
		</Component>
	)
}

/**
 * Screen reader only text for alert severity descriptions
 */
export function AlertSeverityDescription({ severity }: { severity: string }) {
	const descriptions = {
		critical: 'Critical severity alert requiring immediate attention',
		high: 'High severity alert requiring urgent attention',
		medium: 'Medium severity alert requiring attention',
		low: 'Low severity informational alert',
		info: 'Informational alert, no action required',
	}

	const description =
		descriptions[severity as keyof typeof descriptions] || `${severity} severity alert`

	return <AlertVisuallyHidden>{description}</AlertVisuallyHidden>
}

/**
 * Screen reader only text for alert status descriptions
 */
export function AlertStatusDescription({ status }: { status: string }) {
	const descriptions = {
		active: 'Active status, requires attention',
		acknowledged: 'Acknowledged status, being handled',
		resolved: 'Resolved status, issue has been fixed',
		dismissed: 'Dismissed status, no action needed',
	}

	const description = descriptions[status as keyof typeof descriptions] || `Status: ${status}`

	return <AlertVisuallyHidden>{description}</AlertVisuallyHidden>
}

/**
 * Screen reader only instructions for alert interactions
 */
export function AlertInteractionInstructions() {
	return (
		<AlertVisuallyHidden>
			Use arrow keys to navigate between alerts, Enter or Space to select, A to acknowledge, R to
			resolve, D to dismiss. Press ? for more keyboard shortcuts.
		</AlertVisuallyHidden>
	)
}

/**
 * Screen reader only count information
 */
export function AlertCountAnnouncement({
	total,
	filtered,
	selected,
}: {
	total: number
	filtered?: number
	selected?: number
}) {
	let announcement = `${total} total alerts`

	if (filtered !== undefined && filtered !== total) {
		announcement += `, ${filtered} shown after filtering`
	}

	if (selected !== undefined && selected > 0) {
		announcement += `, ${selected} selected`
	}

	return <AlertVisuallyHidden>{announcement}</AlertVisuallyHidden>
}

/**
 * Screen reader only loading announcement
 */
export function AlertLoadingAnnouncement({ context }: { context: string }) {
	return <AlertVisuallyHidden>Loading {context}, please wait</AlertVisuallyHidden>
}

/**
 * Screen reader only error announcement
 */
export function AlertErrorAnnouncement({ error }: { error: string }) {
	return <AlertVisuallyHidden>Error: {error}</AlertVisuallyHidden>
}

export default AlertVisuallyHidden
