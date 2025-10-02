/**
 * Compliance Page Header Component
 *
 * Provides a consistent page header for compliance pages with breadcrumbs,
 * title, description, and action buttons.
 */

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { ComplianceBreadcrumbs } from './ComplianceBreadcrumbs'
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog'

import type { KeyboardShortcut } from '../hooks/use-keyboard-navigation'

interface PageAction {
	label: string
	onClick?: () => void
	href?: string
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
	icon?: React.ComponentType<{ className?: string }>
	disabled?: boolean
}

interface CompliancePageHeaderProps {
	title: string
	description?: string
	actions?: PageAction[]
	shortcuts?: KeyboardShortcut[]
	showBreadcrumbs?: boolean
	showBackButton?: boolean
	backButtonHref?: string
	backButtonLabel?: string
	className?: string
	children?: React.ReactNode
}

export function CompliancePageHeader({
	title,
	description,
	actions = [],
	shortcuts = [],
	showBreadcrumbs = true,
	showBackButton = false,
	backButtonHref,
	backButtonLabel = 'Back',
	className,
	children,
}: CompliancePageHeaderProps) {
	return (
		<div className={cn('space-y-4', className)}>
			{/* Breadcrumbs */}
			<div className="flex items-center justify-between">
				{showBreadcrumbs && <ComplianceBreadcrumbs className="text-sm text-muted-foreground" />}
				{shortcuts.length > 0 && <KeyboardShortcutsDialog shortcuts={shortcuts} />}
			</div>
			{/* Header content */}
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1 flex-1">
					{/* Back button */}
					{showBackButton && (
						<div className="mb-2">
							{backButtonHref ? (
								<Link to={backButtonHref}>
									<Button variant="ghost" size="sm" className="gap-2 px-2">
										<ArrowLeft className="h-4 w-4" />
										{backButtonLabel}
									</Button>
								</Link>
							) : (
								<Button
									variant="ghost"
									size="sm"
									className="gap-2 px-2"
									onClick={() => window.history.back()}
								>
									<ArrowLeft className="h-4 w-4" />
									{backButtonLabel}
								</Button>
							)}
						</div>
					)}

					{/* Title and description */}
					<div>
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
						{description && <p className="text-muted-foreground mt-1">{description}</p>}
					</div>
				</div>

				{/* Actions */}
				{actions.length > 0 && (
					<div className="flex items-center gap-2">
						{actions.map((action, index) => {
							const ActionButton = (
								<Button
									key={index}
									variant={action.variant || 'default'}
									onClick={action.onClick}
									disabled={action.disabled}
									className="gap-2"
								>
									{action.icon && <action.icon className="h-4 w-4" />}
									{action.label}
								</Button>
							)

							return action.href ? (
								<Link key={index} to={action.href}>
									{ActionButton}
								</Link>
							) : (
								ActionButton
							)
						})}
					</div>
				)}
			</div>

			{/* Custom children content */}
			{children}

			{/* Separator */}
			<Separator />
		</div>
	)
}

/**
 * Compliance Section Header
 *
 * A smaller header component for sections within compliance pages
 */
interface ComplianceSectionHeaderProps {
	title: string
	description?: string
	actions?: PageAction[]
	className?: string
	children?: React.ReactNode
}

export function ComplianceSectionHeader({
	title,
	description,
	actions = [],
	className,
	children,
}: ComplianceSectionHeaderProps) {
	return (
		<div className={cn('space-y-3', className)}>
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1 flex-1">
					<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>

				{actions.length > 0 && (
					<div className="flex items-center gap-2">
						{actions.map((action, index) => {
							const ActionButton = (
								<Button
									key={index}
									variant={action.variant || 'outline'}
									size="sm"
									onClick={action.onClick}
									disabled={action.disabled}
									className="gap-2"
								>
									{action.icon && <action.icon className="h-4 w-4" />}
									{action.label}
								</Button>
							)

							return action.href ? (
								<Link key={index} to={action.href}>
									{ActionButton}
								</Link>
							) : (
								ActionButton
							)
						})}
					</div>
				)}
			</div>

			{children}
		</div>
	)
}
