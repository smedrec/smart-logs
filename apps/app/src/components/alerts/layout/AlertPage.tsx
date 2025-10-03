/**
 * AlertPage - Page wrapper component for alert pages
 * Provides consistent page structure with title, description, and actions
 */

import { cn } from '@/lib/utils'

import type { ReactNode } from 'react'

interface AlertPageProps {
	title: string
	description?: string
	children: ReactNode
	actions?: ReactNode
	className?: string
	loading?: boolean
}

export function AlertPage({
	title,
	description,
	children,
	actions,
	className,
	loading = false,
}: AlertPageProps) {
	return (
		<div className={cn('space-y-6', className)}>
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
				{actions && !loading && <div className="flex items-center space-x-2">{actions}</div>}
			</div>

			{/* Page Content */}
			<div className="space-y-4">
				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
					</div>
				) : (
					children
				)}
			</div>
		</div>
	)
}
