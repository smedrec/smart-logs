import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'
import { useState } from 'react'

import { NotificationPanel } from './NotificationPanel'

export interface NotificationBellProps {
	/** Number of unread notifications */
	unreadCount: number
	/** Callback when notification bell is clicked */
	onNotificationClick?: () => void
	/** Maximum count to display in badge (defaults to 99) */
	maxDisplayCount?: number
	/** Whether the notification panel is disabled */
	disabled?: boolean
	/** Additional CSS classes */
	className?: string
}

/**
 * NotificationBell component displays a bell icon with unread count badge
 * and manages the notification panel dropdown state.
 *
 * Features:
 * - Displays unread notification count with badge
 * - Handles click events to toggle notification panel
 * - Integrates with real-time updates for new alerts
 * - Provides accessible keyboard navigation
 *
 * Requirements: 2.1, 2.2, 2.4
 */
export function NotificationBell({
	unreadCount,
	onNotificationClick,
	maxDisplayCount = 99,
	disabled = false,
	className,
}: NotificationBellProps) {
	const [isOpen, setIsOpen] = useState(false)

	const displayCount =
		unreadCount > maxDisplayCount ? `${maxDisplayCount}+` : unreadCount.toString()
	const hasUnread = unreadCount > 0

	const handleClick = () => {
		if (disabled) return

		setIsOpen(!isOpen)
		onNotificationClick?.()
	}

	const handleClose = () => {
		setIsOpen(false)
	}

	return (
		<div className="relative">
			<Button
				variant="ghost"
				size="icon"
				onClick={handleClick}
				disabled={disabled}
				className={cn(
					'relative h-9 w-9 rounded-md',
					hasUnread && 'text-orange-600 hover:text-orange-700',
					className
				)}
				aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
				aria-expanded={isOpen}
				aria-haspopup="dialog"
			>
				<Bell className="h-4 w-4" />
				{hasUnread && (
					<span
						className={cn(
							'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center',
							'rounded-full bg-red-500 text-xs font-medium text-white',
							'ring-2 ring-background',
							// Animation for new notifications
							'animate-in zoom-in-50 duration-200'
						)}
						aria-hidden="true"
					>
						{displayCount}
					</span>
				)}
			</Button>

			{isOpen && (
				<NotificationPanel
					isOpen={isOpen}
					onClose={handleClose}
					className="absolute right-0 top-full mt-2 z-50"
				/>
			)}
		</div>
	)
}
