import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import React from 'react'

import type { JSX } from 'react'

export interface AlertSkipLinksProps {
	/** Skip link targets with their labels */
	targets?: Array<{
		id: string
		label: string
	}>
	/** Additional CSS classes */
	className?: string
}

/**
 * Skip links component for alert interfaces
 * Provides keyboard navigation aids for screen readers and keyboard users
 */
export function AlertSkipLinks({ targets, className }: AlertSkipLinksProps) {
	const defaultTargets = [
		{ id: 'alert-main-content', label: 'Skip to main alert content' },
		{ id: 'alert-filters', label: 'Skip to alert filters' },
		{ id: 'alert-list', label: 'Skip to alert list' },
		{ id: 'alert-actions', label: 'Skip to alert actions' },
	]

	const skipTargets = targets || defaultTargets

	const handleSkipToTarget = (targetId: string) => {
		const target = document.getElementById(targetId)
		if (target) {
			target.focus()
			target.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	return (
		<div
			className={cn(
				'sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-4 focus-within:left-4 focus-within:z-50',
				className
			)}
		>
			<nav aria-label="Skip navigation links" className="flex flex-col gap-2">
				{skipTargets.map((target) => (
					<Button
						key={target.id}
						variant="outline"
						size="sm"
						className="bg-background border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
						onClick={() => handleSkipToTarget(target.id)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								handleSkipToTarget(target.id)
							}
						}}
					>
						{target.label}
					</Button>
				))}
			</nav>
		</div>
	)
}

/**
 * Skip target component to mark focusable sections
 */
export interface AlertSkipTargetProps {
	id: string
	children: React.ReactNode
	className?: string
	as?: keyof JSX.IntrinsicElements
}

export function AlertSkipTarget({
	id,
	children,
	className,
	as: Component = 'div',
}: AlertSkipTargetProps) {
	return (
		<Component
			id={id}
			tabIndex={-1}
			className={cn(
				'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				className
			)}
		>
			{children}
		</Component>
	)
}

export default AlertSkipLinks
