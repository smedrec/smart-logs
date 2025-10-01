import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
	AlertCircle,
	Bell,
	BellRing,
	Check,
	CheckCircle,
	Download,
	Info,
	MoreHorizontal,
	Trash2,
	X,
	XCircle,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { NotificationAction, NotificationItem } from '../types/ui-types'

interface NotificationCenterProps {
	className?: string
	maxNotifications?: number
	autoMarkAsRead?: boolean
	onNotificationAction?: (notificationId: string, action: string) => void
}

const NOTIFICATION_ICONS = {
	success: CheckCircle,
	error: XCircle,
	warning: AlertCircle,
	info: Info,
}

const NOTIFICATION_COLORS = {
	success: {
		icon: 'text-green-600',
		bg: 'bg-green-50',
		border: 'border-green-200',
		badge: 'bg-green-100 text-green-800',
	},
	error: {
		icon: 'text-red-600',
		bg: 'bg-red-50',
		border: 'border-red-200',
		badge: 'bg-red-100 text-red-800',
	},
	warning: {
		icon: 'text-yellow-600',
		bg: 'bg-yellow-50',
		border: 'border-yellow-200',
		badge: 'bg-yellow-100 text-yellow-800',
	},
	info: {
		icon: 'text-blue-600',
		bg: 'bg-blue-50',
		border: 'border-blue-200',
		badge: 'bg-blue-100 text-blue-800',
	},
}

export function NotificationCenter({
	className,
	maxNotifications = 50,
	autoMarkAsRead = false,
	onNotificationAction,
}: NotificationCenterProps) {
	const [notifications, setNotifications] = useState<NotificationItem[]>([])
	const [isOpen, setIsOpen] = useState(false)
	const [soundEnabled, setSoundEnabled] = useState(true)
	const [showOnlyUnread, setShowOnlyUnread] = useState(false)

	// Mock notifications for demonstration
	useEffect(() => {
		const mockNotifications: NotificationItem[] = [
			{
				id: '1',
				type: 'success',
				title: 'Report Execution Completed',
				message: 'HIPAA Audit Trail report has been generated successfully.',
				timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
				read: false,
				actions: [
					{
						label: 'Download',
						action: () => console.log('Download report'),
					},
					{
						label: 'View Details',
						action: () => console.log('View details'),
					},
				],
			},
			{
				id: '2',
				type: 'error',
				title: 'Report Execution Failed',
				message: 'GDPR Processing Activities report failed due to insufficient permissions.',
				timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
				read: false,
				actions: [
					{
						label: 'Retry',
						action: () => console.log('Retry execution'),
					},
					{
						label: 'View Logs',
						action: () => console.log('View logs'),
					},
				],
			},
			{
				id: '3',
				type: 'warning',
				title: 'System Performance Alert',
				message: 'Audit system response time is above normal thresholds.',
				timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
				read: true,
			},
			{
				id: '4',
				type: 'info',
				title: 'Scheduled Maintenance',
				message: 'System maintenance is scheduled for tonight at 2:00 AM UTC.',
				timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				read: true,
			},
		]

		setNotifications(mockNotifications)
	}, [])

	// Add new notification (would be called from parent components)
	const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
		const newNotification: NotificationItem = {
			...notification,
			id: Date.now().toString(),
			timestamp: new Date().toISOString(),
		}

		setNotifications((prev) => {
			const updated = [newNotification, ...prev].slice(0, maxNotifications)
			return updated
		})

		// Play notification sound
		if (soundEnabled && notification.type === 'error') {
			// In a real implementation, you would play a sound
			console.log('🔊 Notification sound played')
		}
	}

	// Mark notification as read
	const markAsRead = (notificationId: string) => {
		setNotifications((prev) =>
			prev.map((notification) =>
				notification.id === notificationId ? { ...notification, read: true } : notification
			)
		)
	}

	// Mark all notifications as read
	const markAllAsRead = () => {
		setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
	}

	// Delete notification
	const deleteNotification = (notificationId: string) => {
		setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId))
	}

	// Clear all notifications
	const clearAllNotifications = () => {
		setNotifications([])
	}

	// Handle notification action
	const handleNotificationAction = (notificationId: string, action: NotificationAction) => {
		action.action()
		onNotificationAction?.(notificationId, action.label)

		if (autoMarkAsRead) {
			markAsRead(notificationId)
		}
	}

	// Format relative time
	const formatRelativeTime = (timestamp: string) => {
		const now = Date.now()
		const time = new Date(timestamp).getTime()
		const diff = now - time

		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(diff / (1000 * 60 * 60))
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (minutes < 1) return 'Just now'
		if (minutes < 60) return `${minutes}m ago`
		if (hours < 24) return `${hours}h ago`
		return `${days}d ago`
	}

	const unreadCount = notifications.filter((n) => !n.read).length
	const displayedNotifications = showOnlyUnread
		? notifications.filter((n) => !n.read)
		: notifications

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={`relative ${className}`}
					onClick={() => setIsOpen(!isOpen)}
				>
					{unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
					{unreadCount > 0 && (
						<Badge
							variant="destructive"
							className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
						>
							{unreadCount > 99 ? '99+' : unreadCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-96 p-0" align="end">
				<Card className="border-0 shadow-lg">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Bell className="h-5 w-5" />
								<span>Notifications</span>
								{unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm">
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={markAllAsRead} disabled={unreadCount === 0}>
										<Check className="h-4 w-4 mr-2" />
										Mark all as read
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={clearAllNotifications}
										disabled={notifications.length === 0}
									>
										<Trash2 className="h-4 w-4 mr-2" />
										Clear all
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<div className="flex items-center justify-between px-2 py-1.5">
										<span className="text-sm">Sound alerts</span>
										<Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
									</div>
								</DropdownMenuContent>
							</DropdownMenu>
						</CardTitle>

						{/* Filter Toggle */}
						{unreadCount > 0 && (
							<div className="flex items-center gap-2 text-sm">
								<Switch checked={showOnlyUnread} onCheckedChange={setShowOnlyUnread} />
								<span className="text-muted-foreground">Show only unread</span>
							</div>
						)}
					</CardHeader>

					<CardContent className="p-0">
						{displayedNotifications.length === 0 ? (
							<div className="p-6 text-center text-muted-foreground">
								<Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p>No notifications</p>
								<p className="text-xs mt-1">
									{showOnlyUnread ? 'All notifications have been read' : "You're all caught up!"}
								</p>
							</div>
						) : (
							<ScrollArea className="h-96">
								<div className="space-y-1">
									{displayedNotifications.map((notification, index) => {
										const colors = NOTIFICATION_COLORS[notification.type]
										const IconComponent = NOTIFICATION_ICONS[notification.type]

										return (
											<div key={notification.id}>
												<div
													className={`p-4 hover:bg-gray-50 transition-colors ${
														!notification.read ? 'bg-blue-50/50' : ''
													}`}
												>
													<div className="flex items-start gap-3">
														<div
															className={`p-1 rounded-full ${colors.bg} ${colors.border} border`}
														>
															<IconComponent className={`h-4 w-4 ${colors.icon}`} />
														</div>

														<div className="flex-1 min-w-0">
															<div className="flex items-start justify-between gap-2">
																<div className="flex-1">
																	<h4 className="text-sm font-medium leading-tight">
																		{notification.title}
																		{!notification.read && (
																			<span className="ml-2 h-2 w-2 bg-blue-600 rounded-full inline-block" />
																		)}
																	</h4>
																	<p className="text-sm text-muted-foreground mt-1 leading-relaxed">
																		{notification.message}
																	</p>
																</div>

																<div className="flex items-center gap-1">
																	<span className="text-xs text-muted-foreground whitespace-nowrap">
																		{formatRelativeTime(notification.timestamp)}
																	</span>
																	<DropdownMenu>
																		<DropdownMenuTrigger asChild>
																			<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
																				<MoreHorizontal className="h-3 w-3" />
																			</Button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent align="end">
																			{!notification.read && (
																				<DropdownMenuItem
																					onClick={() => markAsRead(notification.id)}
																				>
																					<Check className="h-4 w-4 mr-2" />
																					Mark as read
																				</DropdownMenuItem>
																			)}
																			<DropdownMenuItem
																				onClick={() => deleteNotification(notification.id)}
																				className="text-red-600"
																			>
																				<Trash2 className="h-4 w-4 mr-2" />
																				Delete
																			</DropdownMenuItem>
																		</DropdownMenuContent>
																	</DropdownMenu>
																</div>
															</div>

															{/* Notification Actions */}
															{notification.actions && notification.actions.length > 0 && (
																<div className="flex gap-2 mt-3">
																	{notification.actions.map((action, actionIndex) => (
																		<Button
																			key={actionIndex}
																			variant={action.variant || 'outline'}
																			size="sm"
																			onClick={() =>
																				handleNotificationAction(notification.id, action)
																			}
																			className="text-xs"
																		>
																			{action.label === 'Download' && (
																				<Download className="h-3 w-3 mr-1" />
																			)}
																			{action.label}
																		</Button>
																	))}
																</div>
															)}
														</div>
													</div>
												</div>
												{index < displayedNotifications.length - 1 && <Separator />}
											</div>
										)
									})}
								</div>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
			</PopoverContent>
		</Popover>
	)
}

// Hook for adding notifications from other components
export function useNotifications() {
	// In a real implementation, this would use a global state management solution
	// like Zustand, Redux, or React Context to manage notifications across components

	const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
		// In a real implementation, this would use a global state management solution
		// like Zustand, Redux, or React Context to manage notifications across components
		console.log('Adding notification:', notification)
	}

	const addSuccessNotification = (
		title: string,
		message: string,
		actions?: NotificationAction[]
	) => {
		addNotification({ type: 'success', title, message, read: false, actions })
	}

	const addErrorNotification = (title: string, message: string, actions?: NotificationAction[]) => {
		addNotification({ type: 'error', title, message, read: false, actions })
	}

	const addWarningNotification = (
		title: string,
		message: string,
		actions?: NotificationAction[]
	) => {
		addNotification({ type: 'warning', title, message, read: false, actions })
	}

	const addInfoNotification = (title: string, message: string, actions?: NotificationAction[]) => {
		addNotification({ type: 'info', title, message, read: false, actions })
	}

	return {
		addNotification,
		addSuccessNotification,
		addErrorNotification,
		addWarningNotification,
		addInfoNotification,
	}
}
