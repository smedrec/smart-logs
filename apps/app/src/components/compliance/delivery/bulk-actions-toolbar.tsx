import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, Copy, MoreHorizontal, Power, PowerOff, Trash2, X } from 'lucide-react'
import * as React from 'react'

interface BulkActionsToolbarProps {
	selectedCount: number
	onClearSelection: () => void
	onEnable: () => void
	onDisable: () => void
	onDuplicate?: () => void
	onDelete: () => void
	loading?: boolean
	className?: string
}

export function BulkActionsToolbar({
	selectedCount,
	onClearSelection,
	onEnable,
	onDisable,
	onDuplicate,
	onDelete,
	loading = false,
	className,
}: BulkActionsToolbarProps) {
	if (selectedCount === 0) return null

	return (
		<div
			className={`flex items-center justify-between gap-4 rounded-md border bg-muted/50 p-3 ${className || ''}`}
		>
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<CheckCircle2 className="h-4 w-4 text-primary" />
					<span className="text-sm font-medium">
						{selectedCount} {selectedCount === 1 ? 'destination' : 'destinations'} selected
					</span>
				</div>

				<Separator orientation="vertical" className="h-6" />

				<div className="flex items-center gap-2">
					{/* Enable */}
					<Button variant="outline" size="sm" onClick={onEnable} disabled={loading} className="h-8">
						<Power className="mr-2 h-4 w-4" />
						Enable
					</Button>

					{/* Disable */}
					<Button
						variant="outline"
						size="sm"
						onClick={onDisable}
						disabled={loading}
						className="h-8"
					>
						<PowerOff className="mr-2 h-4 w-4" />
						Disable
					</Button>

					{/* More Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" disabled={loading} className="h-8">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{onDuplicate && (
								<>
									<DropdownMenuItem onClick={onDuplicate} disabled={selectedCount !== 1}>
										<Copy className="mr-2 h-4 w-4" />
										Duplicate
										{selectedCount !== 1 && (
											<span className="ml-auto text-xs text-muted-foreground">(Select 1)</span>
										)}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem onClick={onDelete} className="text-destructive">
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Clear Selection */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onClearSelection}
				disabled={loading}
				className="h-8"
			>
				<X className="mr-2 h-4 w-4" />
				Clear
			</Button>
		</div>
	)
}
