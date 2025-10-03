import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { HelpCircle, Keyboard } from 'lucide-react'
import React, { useState } from 'react'

import { ALERT_SHORTCUTS } from '../hooks/use-alert-keyboard-navigation'

import type { AlertKeyboardShortcut } from '../hooks/use-alert-keyboard-navigation'

export interface AlertKeyboardShortcutsDialogProps {
	/** Additional shortcuts to display */
	additionalShortcuts?: AlertKeyboardShortcut[]
	/** Trigger button variant */
	triggerVariant?: 'default' | 'outline' | 'ghost'
	/** Trigger button size */
	triggerSize?: 'sm' | 'md' | 'lg'
	/** Custom trigger element */
	trigger?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

interface ShortcutGroup {
	title: string
	shortcuts: Array<{
		keys: string
		description: string
	}>
}

/**
 * Dialog component displaying available keyboard shortcuts for alert management
 */
export function AlertKeyboardShortcutsDialog({
	additionalShortcuts = [],
	triggerVariant = 'outline',
	triggerSize = 'sm',
	trigger,
	className,
}: AlertKeyboardShortcutsDialogProps) {
	const [isOpen, setIsOpen] = useState(false)

	const formatShortcutKeys = (shortcut: AlertKeyboardShortcut) => {
		const keys = []

		if (shortcut.ctrlKey) keys.push('Ctrl')
		if (shortcut.altKey) keys.push('Alt')
		if (shortcut.shiftKey) keys.push('Shift')
		if (shortcut.metaKey) keys.push('Cmd')

		keys.push(shortcut.key === ' ' ? 'Space' : shortcut.key)

		return keys.join(' + ')
	}

	const shortcutGroups: ShortcutGroup[] = [
		{
			title: 'Navigation',
			shortcuts: [
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.REFRESH_ALERTS),
					description: ALERT_SHORTCUTS.REFRESH_ALERTS.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.SEARCH_ALERTS),
					description: ALERT_SHORTCUTS.SEARCH_ALERTS.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.FILTER_ALERTS),
					description: ALERT_SHORTCUTS.FILTER_ALERTS.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.NEXT_ALERT),
					description: ALERT_SHORTCUTS.NEXT_ALERT.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.PREVIOUS_ALERT),
					description: ALERT_SHORTCUTS.PREVIOUS_ALERT.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.FIRST_ALERT),
					description: ALERT_SHORTCUTS.FIRST_ALERT.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.LAST_ALERT),
					description: ALERT_SHORTCUTS.LAST_ALERT.description,
				},
			],
		},
		{
			title: 'Views',
			shortcuts: [
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.LIST_VIEW),
					description: ALERT_SHORTCUTS.LIST_VIEW.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.BOARD_VIEW),
					description: ALERT_SHORTCUTS.BOARD_VIEW.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.STATISTICS_VIEW),
					description: ALERT_SHORTCUTS.STATISTICS_VIEW.description,
				},
			],
		},
		{
			title: 'Alert Actions',
			shortcuts: [
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.ACKNOWLEDGE_ALERT),
					description: ALERT_SHORTCUTS.ACKNOWLEDGE_ALERT.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.RESOLVE_ALERT),
					description: ALERT_SHORTCUTS.RESOLVE_ALERT.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.DISMISS_ALERT),
					description: ALERT_SHORTCUTS.DISMISS_ALERT.description,
				},
			],
		},
		{
			title: 'Selection',
			shortcuts: [
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.SELECT_ALL),
					description: ALERT_SHORTCUTS.SELECT_ALL.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.CLEAR_SELECTION),
					description: ALERT_SHORTCUTS.CLEAR_SELECTION.description,
				},
			],
		},
		{
			title: 'General',
			shortcuts: [
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.CLOSE_MODAL),
					description: ALERT_SHORTCUTS.CLOSE_MODAL.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.CONFIRM_ACTION),
					description: ALERT_SHORTCUTS.CONFIRM_ACTION.description,
				},
				{
					keys: formatShortcutKeys(ALERT_SHORTCUTS.SHOW_SHORTCUTS),
					description: ALERT_SHORTCUTS.SHOW_SHORTCUTS.description,
				},
			],
		},
	]

	// Add additional shortcuts if provided
	if (additionalShortcuts.length > 0) {
		shortcutGroups.push({
			title: 'Additional Shortcuts',
			shortcuts: additionalShortcuts.map((shortcut) => ({
				keys: formatShortcutKeys(shortcut),
				description: shortcut.description,
			})),
		})
	}

	const defaultTrigger = (
		<Button
			variant={triggerVariant}
			size={triggerSize}
			className="flex items-center gap-2"
			aria-label="Show keyboard shortcuts"
		>
			<Keyboard className="h-4 w-4" />
			<span className="hidden sm:inline">Shortcuts</span>
		</Button>
	)

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
			<DialogContent className={cn('max-w-2xl max-h-[80vh]', className)}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HelpCircle className="h-5 w-5" />
						Alert Management Keyboard Shortcuts
					</DialogTitle>
					<DialogDescription>
						Use these keyboard shortcuts to navigate and manage alerts more efficiently.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[60vh] pr-4">
					<div className="space-y-6">
						{shortcutGroups.map((group, groupIndex) => (
							<div key={group.title}>
								<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
									{group.title}
								</h3>
								<div className="space-y-2">
									{group.shortcuts.map((shortcut, index) => (
										<div
											key={`${group.title}-${index}`}
											className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
										>
											<span className="text-sm">{shortcut.description}</span>
											<kbd className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted rounded border">
												{shortcut.keys}
											</kbd>
										</div>
									))}
								</div>
								{groupIndex < shortcutGroups.length - 1 && <Separator className="mt-4" />}
							</div>
						))}
					</div>
				</ScrollArea>

				<div className="flex justify-end pt-4 border-t">
					<Button variant="outline" onClick={() => setIsOpen(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default AlertKeyboardShortcutsDialog
