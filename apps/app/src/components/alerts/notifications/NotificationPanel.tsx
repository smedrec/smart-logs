import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { NotificationItem } from './NotificationItem'

import type { Notification } from '@/lib/types/alert'

export interface NotificationPanelProps {
	/** Whether the panel is open */
	isOpen: boolean
	/** Callback when panel should be closed */
	onClose: () => void
	/** Maximum number of notifications to show */
	maxNotifications?: number
	/** Additional CSS classes */
	className?: string
}

/**
 * NotificationPanel component displays a dropdown panel with notification list.
 *
 * Features:
 * - Displays notifications with severity indicators
 * - Provides click-through navigation to alert details
 * - Handles loading and error states
 * - Supports keyboard navigation and accessibility
 * - Auto-closes when clicking outside
 *
 * Requirements: 2.1, 2.3, 2.4
 */
export function NotificationPanel({
	isOpen,
	onClose,
	maxNotifications = 10,
	className,
}: NotificationPanelProps) {
	const navigate = useNavigate()
	const panelRef = useRef<HTMLDivElement>(null)
	const { notifications, loading, error, markAsRead, markAllAsRead, dismissNotification } =
		useNotifications()

	// Handle click outside to close panel
	useEffect(() => {
		if (!isOpen) return

		const handleClickOutside = (event: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
				onClose()
			}
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [isOpen, onClose])

	// Focus management
	useEffect(() => {
		if (isOpen && panelRef.current) {
			panelRef.current.focus()
		}
	}, [isOpen])

	const handleNotificationClick = (notification: Notification) => {
		// Navigate to alert details if actionUrl is provided
		if (notification.actionUrl) {
			navigate({ to: notification.actionUrl })
		} else {
			// Default navigation to alert details
			navigate({
				to: '/alerts/active',
				search: { alertId: notification.alertId },
			})
		}
		onClose()
	}

	const handleMarkAllRead = () => {
		markAllAsRead()
	}

	const displayNotifications = notifications.slice(0, maxNotifications)
	const hasMore = notifications.length > maxNotifications
	const unreadCount = notifications.filter((n) => !n.read).length

	if (!isOpen) return null

	return (
		<Card
			ref={panelRef}
			className={cn(
				'w-80 shadow-lg border',
				'animate-in slide-in-from-top-2 duration-200',
				className
			)}
			tabIndex={-1}
			role="dialog"
			aria-label="Notifications panel"
		>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium">
						Notifications
						{unreadCount > 0 && (
							<span className="ml-2 text-xs text-muted-foreground">({unreadCount} unread)</span>
						)}
					</CardTitle>
					<div className="flex items-center gap-1">
						{unreadCount > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleMarkAllRead}
								className="h-6 px-2 text-xs"
							>
								Mark all read
							</Button>
						)}
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="h-6 w-6"
							aria-label="Close notifications"
						>
							<X className="h-3 w-3" />
						</Button>
					</div>
				</div>
			</CardHeader>

			<Separator />

			<CardContent className="p-0">
				{loading ? (
					<div className="p-4 text-center text-sm text-muted-foreground">
						Loading notifications...
					</div>
				) : error ? (
					<div className="p-4 text-center text-sm text-red-600">{error}</div>
				) : displayNotifications.length === 0 ? (
					<div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
				) : (
					<ScrollArea className="max-h-96">
						<div className="divide-y">
							{displayNotifications.map((notification, index) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onClick={() => handleNotificationClick(notification)}
									onMarkRead={markAsRead}
									onDismiss={dismissNotification}
									className={cn('border-0', index === 0 && 'rounded-t-none')}
								/>
							))}
						</div>
						{hasMore && (
							<div className="p-3 text-center border-t">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => navigate({ to: '/alerts/active' })}
									className="text-xs"
								>
									View all alerts ({notifications.length - maxNotifications} more)
								</Button>
							</div>
						)}
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	)
}
