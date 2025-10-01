import { cn } from '@/lib/utils'

import type { BaseComponentProps } from '../types'

interface CompliancePageProps extends BaseComponentProps {
	title?: string
	description?: string
	actions?: React.ReactNode
	loading?: boolean
	error?: string
	maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

/**
 * Standard page wrapper for compliance pages
 * Provides consistent spacing, typography, and layout patterns
 */
export function CompliancePage({
	children,
	title,
	description,
	actions,
	loading,
	error,
	maxWidth = 'full',
	className,
}: CompliancePageProps) {
	const maxWidthClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		full: 'max-w-full',
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="flex items-center space-x-2">
					<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
					<span className="text-muted-foreground">Loading...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center space-y-2">
					<div className="text-destructive font-medium">Error</div>
					<div className="text-muted-foreground">{error}</div>
				</div>
			</div>
		)
	}

	return (
		<div className={cn('p-6', className)}>
			<div className={cn('mx-auto', maxWidthClasses[maxWidth])}>
				{/* Page header */}
				{(title || description || actions) && (
					<div className="mb-6">
						<div className="flex items-start justify-between">
							<div className="space-y-1">
								{title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
								{description && <p className="text-muted-foreground">{description}</p>}
							</div>
							{actions && <div className="flex items-center space-x-2">{actions}</div>}
						</div>
					</div>
				)}

				{/* Page content */}
				<div>{children}</div>
			</div>
		</div>
	)
}
