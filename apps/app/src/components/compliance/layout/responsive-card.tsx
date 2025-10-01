import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { useResponsive, useTouchFriendly } from '../hooks/use-responsive'

import type { ReactNode } from 'react'

export interface ResponsiveCardProps {
	children?: ReactNode
	className?: string
	title?: string
	description?: string
	badge?: {
		text: string
		variant?: 'default' | 'secondary' | 'destructive' | 'outline'
	}
	actions?: Array<{
		label: string
		onClick: () => void
		icon?: ReactNode
		variant?: 'default' | 'secondary' | 'ghost' | 'outline'
		disabled?: boolean
	}>
	expandable?: boolean
	expanded?: boolean
	onExpandToggle?: () => void
	touchOptimized?: boolean
}

/**
 * Responsive card component optimized for mobile and touch interactions
 */
export function ResponsiveCard({
	children,
	className,
	title,
	description,
	badge,
	actions = [],
	expandable = false,
	expanded = false,
	onExpandToggle,
	touchOptimized = true,
}: ResponsiveCardProps) {
	const { isMobile } = useResponsive()
	const { getTouchTargetSize, getTouchSpacing, shouldUseTouchOptimizations } = useTouchFriendly()

	const useTouchOptimizations = touchOptimized && shouldUseTouchOptimizations

	return (
		<Card
			className={cn(
				'transition-all duration-200',
				isMobile && 'shadow-sm hover:shadow-md',
				useTouchOptimizations && 'active:scale-[0.98]',
				className
			)}
		>
			<CardHeader className={cn('pb-3', useTouchOptimizations && 'p-4')}>
				<div className="flex items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						{title && (
							<CardTitle className={cn('text-base leading-6', isMobile && 'text-sm')}>
								{title}
							</CardTitle>
						)}
						{description && (
							<CardDescription className={cn('mt-1 text-sm', isMobile && 'text-xs')}>
								{description}
							</CardDescription>
						)}
					</div>

					{badge && (
						<Badge
							variant={badge.variant || 'default'}
							className={cn('shrink-0', isMobile && 'text-xs px-2 py-1')}
						>
							{badge.text}
						</Badge>
					)}
				</div>
			</CardHeader>

			{(children || expandable) && (
				<CardContent
					className={cn(
						'pt-0',
						useTouchOptimizations && 'px-4 pb-4',
						expandable && !expanded && 'hidden'
					)}
				>
					{children}
				</CardContent>
			)}

			{actions.length > 0 && (
				<div
					className={cn(
						'flex items-center justify-end border-t bg-muted/50 px-4 py-3',
						useTouchOptimizations && getTouchSpacing(),
						isMobile && 'flex-col items-stretch gap-2'
					)}
				>
					{isMobile
						? // Mobile: Stack buttons vertically
							actions.map((action, index) => (
								<Button
									key={index}
									variant={action.variant || 'outline'}
									onClick={action.onClick}
									disabled={action.disabled}
									className={cn(
										'w-full justify-center',
										useTouchOptimizations && getTouchTargetSize('md')
									)}
								>
									{action.icon && (
										<span className="mr-2" aria-hidden="true">
											{action.icon}
										</span>
									)}
									{action.label}
								</Button>
							))
						: // Desktop: Horizontal layout
							actions.map((action, index) => (
								<Button
									key={index}
									variant={action.variant || 'outline'}
									size="sm"
									onClick={action.onClick}
									disabled={action.disabled}
									className={cn(
										'ml-2 first:ml-0',
										useTouchOptimizations && getTouchTargetSize('sm')
									)}
								>
									{action.icon && (
										<span className="mr-1" aria-hidden="true">
											{action.icon}
										</span>
									)}
									{action.label}
								</Button>
							))}

					{expandable && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onExpandToggle}
							className={cn(
								isMobile ? 'w-full mt-2' : 'ml-2',
								useTouchOptimizations && getTouchTargetSize('sm')
							)}
							aria-expanded={expanded}
							aria-label={expanded ? 'Collapse details' : 'Expand details'}
						>
							{expanded ? 'Show Less' : 'Show More'}
						</Button>
					)}
				</div>
			)}
		</Card>
	)
}

export interface ResponsiveCardGridProps {
	children: ReactNode
	className?: string
	minCardWidth?: string
	gap?: string
}

/**
 * Responsive grid container for cards
 */
export function ResponsiveCardGrid({
	children,
	className,
	minCardWidth = '280px',
	gap = 'gap-4',
}: ResponsiveCardGridProps) {
	const { isMobile } = useResponsive()

	return (
		<div
			className={cn(
				'grid',
				isMobile ? 'grid-cols-1' : `grid-cols-[repeat(auto-fill,minmax(${minCardWidth},1fr))]`,
				gap,
				className
			)}
		>
			{children}
		</div>
	)
}
