import { cn } from '@/lib/utils'

import type { BaseComponentProps } from '../types'

interface ComplianceLayoutProps extends BaseComponentProps {
	sidebar?: React.ReactNode
	header?: React.ReactNode
	breadcrumbs?: React.ReactNode
}

/**
 * Main layout component for compliance pages
 * Provides consistent structure with sidebar, header, and content areas
 */
export function ComplianceLayout({
	children,
	sidebar,
	header,
	breadcrumbs,
	className,
}: ComplianceLayoutProps) {
	return (
		<div className={cn('flex h-full min-h-screen bg-background', className)}>
			{/* Sidebar */}
			{sidebar && <aside className="w-64 border-r bg-card">{sidebar}</aside>}

			{/* Main content area */}
			<div className="flex-1 flex flex-col">
				{/* Header */}
				{header && <header className="border-b bg-card px-6 py-4">{header}</header>}

				{/* Breadcrumbs */}
				{breadcrumbs && <nav className="border-b bg-muted/50 px-6 py-2">{breadcrumbs}</nav>}

				{/* Page content */}
				<main className="flex-1 overflow-auto">{children}</main>
			</div>
		</div>
	)
}
