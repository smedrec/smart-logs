/**
 * AlertSection - Section wrapper component for organizing alert page content
 * Provides consistent spacing and styling for page sections
 */

import { cn } from '@/lib/utils'

import type { ReactNode } from 'react'

interface AlertSectionProps {
	title?: string
	description?: string
	children: ReactNode
	className?: string
	headerActions?: ReactNode
	collapsible?: boolean
	defaultCollapsed?: boolean
}

export function AlertSection({
	title,
	description,
	children,
	className,
	headerActions,
	collapsible = false,
	defaultCollapsed = false,
}: AlertSectionProps) {
	return (
		<section className={cn('space-y-4', className)}>
			{(title || description || headerActions) && (
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						{title && <h2 className="text-lg font-medium tracking-tight">{title}</h2>}
						{description && <p className="text-sm text-muted-foreground">{description}</p>}
					</div>
					{headerActions && <div className="flex items-center space-x-2">{headerActions}</div>}
				</div>
			)}

			<div className="space-y-4">{children}</div>
		</section>
	)
}
