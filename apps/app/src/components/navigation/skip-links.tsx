import { cn } from '@/lib/utils'

export interface SkipLink {
	href: string
	label: string
}

export interface SkipLinksProps {
	links?: SkipLink[]
	className?: string
}

const DEFAULT_SKIP_LINKS: SkipLink[] = [
	{ href: '#main-content', label: 'Skip to main content' },
	{ href: '#navigation', label: 'Skip to navigation' },
	{ href: '#search', label: 'Skip to search' },
]

/**
 * Skip links component for keyboard navigation accessibility
 * Provides quick navigation to main page sections
 */
export function SkipLinks({ links = DEFAULT_SKIP_LINKS, className }: SkipLinksProps) {
	return (
		<div
			className={cn(
				'sr-only focus-within:not-sr-only',
				'fixed top-0 left-0 z-50 bg-background border border-border rounded-md shadow-lg',
				'p-2 m-2',
				className
			)}
		>
			<nav aria-label="Skip navigation links">
				<ul className="flex flex-col gap-1">
					{links.map((link) => (
						<li key={link.href}>
							<a
								href={link.href}
								className={cn(
									'inline-flex items-center px-3 py-2 text-sm font-medium',
									'text-foreground bg-background',
									'border border-border rounded-md',
									'hover:bg-accent hover:text-accent-foreground',
									'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
									'transition-colors'
								)}
							>
								{link.label}
							</a>
						</li>
					))}
				</ul>
			</nav>
		</div>
	)
}

/**
 * Hook to register skip link targets
 */
export function useSkipLinkTarget(id: string) {
	return {
		id,
		tabIndex: -1,
		'data-skip-target': id,
	}
}
