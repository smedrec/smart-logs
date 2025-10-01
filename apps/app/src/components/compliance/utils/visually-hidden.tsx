import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

export interface VisuallyHiddenProps {
	children: ReactNode
	className?: string
	asChild?: boolean
	focusable?: boolean
}

/**
 * Component that hides content visually but keeps it available to screen readers
 * Uses the sr-only class from Tailwind CSS
 */
export function VisuallyHidden({
	children,
	className,
	asChild = false,
	focusable = false,
}: VisuallyHiddenProps) {
	const classes = cn(
		'sr-only',
		focusable &&
			'focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-2 focus:bg-background focus:border focus:border-border focus:rounded-md',
		className
	)

	if (asChild) {
		// If asChild is true, we expect children to be a single React element
		// and we'll clone it with our className
		const child = children as React.ReactElement
		return {
			...child,
			props: {
				...child.props,
				className: cn(child.props.className, classes),
			},
		}
	}

	return <span className={classes}>{children}</span>
}

/**
 * Hook to conditionally render content for screen readers only
 */
export function useScreenReaderOnly() {
	return {
		VisuallyHidden,
		srOnly: (content: ReactNode) => <VisuallyHidden>{content}</VisuallyHidden>,
	}
}
