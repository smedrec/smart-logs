/**
 * AlertLayout - Base layout component for alert pages
 * Provides consistent structure and styling for all alert-related pages
 */

import { cn } from '@/lib/utils'

import type { ReactNode } from 'react'

interface AlertLayoutProps {
	children: ReactNode
	className?: string
	sidebar?: ReactNode
	header?: ReactNode
	footer?: ReactNode
}

export function AlertLayout({ children, className, sidebar, header, footer }: AlertLayoutProps) {
	return (
		<div className={cn('flex h-full flex-col', className)}>
			{header && (
				<div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{header}
				</div>
			)}

			<div className="flex flex-1 overflow-hidden">
				{sidebar && <div className="flex-shrink-0 border-r bg-muted/50">{sidebar}</div>}

				<main className="flex-1 overflow-auto">
					<div className="container mx-auto p-6">{children}</div>
				</main>
			</div>

			{footer && (
				<div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{footer}
				</div>
			)}
		</div>
	)
}
