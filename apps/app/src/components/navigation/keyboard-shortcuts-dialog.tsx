import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { HelpCircle, Keyboard } from 'lucide-react'
import { useState } from 'react'

import type { KeyboardShortcut } from '@/hooks/use-keyboard-navigation'

export interface KeyboardShortcutsDialogProps {
	shortcuts: KeyboardShortcut[]
	trigger?: React.ReactNode
}

/**
 * Dialog displaying available keyboard shortcuts
 */
export function KeyboardShortcutsDialog({ shortcuts, trigger }: KeyboardShortcutsDialogProps) {
	const [open, setOpen] = useState(false)

	const formatShortcut = (shortcut: KeyboardShortcut) => {
		const keys = []

		if (shortcut.ctrlKey) keys.push('Ctrl')
		if (shortcut.altKey) keys.push('Alt')
		if (shortcut.shiftKey) keys.push('Shift')
		if (shortcut.metaKey) keys.push('Cmd')

		keys.push(shortcut.key === ' ' ? 'Space' : shortcut.key)

		return keys.join(' + ')
	}

	const groupedShortcuts = shortcuts.reduce(
		(groups, shortcut) => {
			// Group shortcuts by category (could be enhanced with categories)
			const category = 'General'
			if (!groups[category]) {
				groups[category] = []
			}
			groups[category].push(shortcut)
			return groups
		},
		{} as Record<string, KeyboardShortcut[]>
	)

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger || (
					<Button variant="ghost" size="sm" className="gap-2" aria-label="Show keyboard shortcuts">
						<Keyboard className="h-4 w-4" />
						<span className="sr-only sm:not-sr-only">Shortcuts</span>
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Keyboard className="h-5 w-5" />
						Keyboard Shortcuts
					</DialogTitle>
					<DialogDescription>
						Use these keyboard shortcuts to navigate and interact with the compliance interface more
						efficiently.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
						<div key={category}>
							<h3 className="text-lg font-semibold mb-3">{category}</h3>
							<div className="space-y-2">
								{categoryShortcuts.map((shortcut, index) => (
									<div
										key={index}
										className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
									>
										<span className="text-sm text-muted-foreground">{shortcut.description}</span>
										<Badge variant="outline" className="font-mono text-xs">
											{formatShortcut(shortcut)}
										</Badge>
									</div>
								))}
							</div>
						</div>
					))}
				</div>

				<div className="mt-6 p-4 bg-muted/50 rounded-md">
					<div className="flex items-start gap-2">
						<HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
						<div className="text-sm text-muted-foreground">
							<p className="font-medium mb-1">Tips:</p>
							<ul className="space-y-1 text-xs">
								<li>
									• Press{' '}
									<Badge variant="outline" className="font-mono text-xs mx-1">
										Tab
									</Badge>{' '}
									to navigate between interactive elements
								</li>
								<li>
									• Press{' '}
									<Badge variant="outline" className="font-mono text-xs mx-1">
										Shift + Tab
									</Badge>{' '}
									to navigate backwards
								</li>
								<li>
									• Press{' '}
									<Badge variant="outline" className="font-mono text-xs mx-1">
										Enter
									</Badge>{' '}
									or{' '}
									<Badge variant="outline" className="font-mono text-xs mx-1">
										Space
									</Badge>{' '}
									to activate buttons and links
								</li>
								<li>
									• Press{' '}
									<Badge variant="outline" className="font-mono text-xs mx-1">
										Escape
									</Badge>{' '}
									to close dialogs and menus
								</li>
							</ul>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
