import { Button } from '@/components/ui/button'
import { AlertSeverity } from '@/lib/types/alert'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Check, X } from 'lucide-react'
import { useState } from 'react'

import type { Notification } from '@/lib/types/alert'

export interface NotificationItemProps {
	/** The notification to display */
	notification: Notification
	/** Callback when notification is clicked */
	onClick?: (notification: Notification) => void
	/** Callback when notification is marked as read */
	onMarkRead?: (notificationId: string) => void
	/** Callback when notification is dismissed */
	onDismiss?: (notificationId: string) => void
	/** Additional CSS classes */
	className?: string
}

/**
 * NotificationItem component displays individual notification with actions.
 *
 * Features:
 * - Shows notification content with severity indicators
 * - Provides read/unread state management
 * - Includes dismiss and mark-as-read functionality
 * - Displays relative timestamps
 * - Supports keyboard navigation
 *
 * Requirements: 2.1, 2.4, 2.5
 */
export function NotificationItem({
	notification,
	onClick,
	onMarkRead,
	onDismiss,
	className,
}: NotificationItemProps) {
	const [isHovered, setIsHovered] = useState(false)

	const handleClick = () => {
		onClick?.(notification)
	}

	const handleMarkRead = (e: React.MouseEvent) => {
		e.stopPropagation()
		onMarkRead?.(notification.id)
	}

	const handleDismiss = (e: React.MouseEvent) => {
		e.stopPropagation()
		onDismiss?.(notification.id)
	}

	const getSeverityColor = (severity: AlertSeverity) => {
		switch (severity) {
			case AlertSeverity.CRITICAL:
				return 'bg-red-500'
			case AlertSeverity.HIGH:
				return 'bg-orange-500'
			case AlertSeverity.MEDIUM:
				return 'bg-yellow-500'
			case AlertSeverity.LOW:
				return 'bg-blue-500'
			case AlertSeverity.INFO:
				return 'bg-gray-500'
			default:
				return 'bg-gray-500'
		}
	}

	const getSeverityTextColor = (severity: AlertSeverity) => {
		switch (severity) {
			case AlertSeverity.CRITICAL:
				return 'text-red-600'
			case AlertSeverity.HIGH:
				return 'text-orange-600'
			case AlertSeverity.MEDIUM:
				return 'text-yellow-600'
			case AlertSeverity.LOW:
				return 'text-blue-600'
			case AlertSeverity.INFO:
				return 'text-gray-600'
			default:
				return 'text-gray-600'
		}
	}

	const relativeTime = formatDistanceToNow(notification.timestamp, { addSuffix: true })

	return (
		<div
			className={cn(
				'relative p-3 cursor-pointer transition-colors',
				'hover:bg-muted/50 focus:bg-muted/50',
				!notification.read && 'bg-blue-50/50 dark:bg-blue-950/20',
				className
			)}
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					handleClick()
				}
			}}
			aria-label={`Notification: ${notification.title}. ${notification.read ? 'Read' : 'Unread'}`}
		>
			{/* Unread indicator */}
			{!notification.read && (
				<div
					className={cn(
						'absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full',
						getSeverityColor(notification.severity)
					)}
					aria-hidden="true"
				/>
			)}

			<div className={cn('flex flex-col gap-1', !notification.read && 'ml-4')}>
				{/* Header with title and actions */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<h4
							className={cn('text-sm font-medium truncate', !notification.read && 'font-semibold')}
						>
							{notification.title}
						</h4>
						<p className={cn('text-xs capitalize', getSeverityTextColor(notification.severity))}>
							{notification.severity}
						</p>
					</div>

					{/* Action buttons - show on hover or focus */}
					{(isHovered || !notification.read) && (
						<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							{!notification.read && onMarkRead && (
								<Button
									variant="ghost"
									size="icon"
									onClick={handleMarkRead}
									className="h-6 w-6 text-muted-foreground hover:text-foreground"
									aria-label="Mark as read"
								>
									<Check className="h-3 w-3" />
								</Button>
							)}
							{onDismiss && (
								<Button
									variant="ghost"
									size="icon"
									onClick={handleDismiss}
									className="h-6 w-6 text-muted-foreground hover:text-foreground"
									aria-label="Dismiss notification"
								>
									<X className="h-3 w-3" />
								</Button>
							)}
						</div>
					)}
				</div>

				{/* Message content */}
				<p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>

				{/* Timestamp */}
				<p className="text-xs text-muted-foreground">{relativeTime}</p>
			</div>
		</div>
	)
}
