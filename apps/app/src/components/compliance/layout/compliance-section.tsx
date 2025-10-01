import { cn } from '@/lib/utils'
import React from 'react'

import type { BaseComponentProps } from '../types'

interface ComplianceSectionProps extends BaseComponentProps {
	title?: string
	description?: string
	actions?: React.ReactNode
	variant?: 'default' | 'card' | 'bordered'
	collapsible?: boolean
	defaultCollapsed?: boolean
}

/**
 * Reusable section component for organizing content within compliance pages
 * Supports different visual variants and collapsible functionality
 */
export function ComplianceSection({
	children,
	title,
	description,
	actions,
	variant = 'default',
	collapsible = false,
	defaultCollapsed = false,
	className,
}: ComplianceSectionProps) {
	const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

	const sectionClasses = {
		default: 'space-y-4',
		card: 'bg-card border rounded-lg p-6 space-y-4',
		bordered: 'border-l-4 border-primary pl-4 space-y-4',
	}

	const toggleCollapsed = () => {
		if (collapsible) {
			setIsCollapsed(!isCollapsed)
		}
	}

	return (
		<section className={cn(sectionClasses[variant], className)}>
			{/* Section header */}
			{(title || description || actions) && (
				<div className="space-y-2">
					<div className="flex items-start justify-between">
						<div className="space-y-1">
							{title && (
								<div className="flex items-center space-x-2">
									<h2
										className={cn(
											'text-lg font-medium',
											collapsible && 'cursor-pointer hover:text-primary'
										)}
										onClick={toggleCollapsed}
									>
										{title}
									</h2>
									{collapsible && (
										<button
											onClick={toggleCollapsed}
											className="text-muted-foreground hover:text-foreground"
											aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
										>
											<svg
												className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</button>
									)}
								</div>
							)}
							{description && !isCollapsed && (
								<p className="text-sm text-muted-foreground">{description}</p>
							)}
						</div>
						{actions && !isCollapsed && (
							<div className="flex items-center space-x-2">{actions}</div>
						)}
					</div>
				</div>
			)}

			{/* Section content */}
			{!isCollapsed && <div>{children}</div>}
		</section>
	)
}
