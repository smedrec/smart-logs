import { AlertSeverity } from '@/lib/types/alert'
import { useEffect, useState } from 'react'

import type { Notification } from '@/lib/types/alert'

/**
 * Hook for managing notification state and real-time updates.
 * This is a temporary implementation that will be replaced with
 * proper API integration and WebSocket updates in future tasks.
 *
 * Requirements: 2.1, 2.2, 2.4
 */
export function useNotifications() {
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Mock data for development - will be replaced with real API calls
	useEffect(() => {
		// Simulate loading notifications
		setLoading(true)

		// Mock notifications for testing
		const mockNotifications: Notification[] = [
			{
				id: '1',
				alertId: 'alert-1',
				title: 'Critical System Alert',
				message: 'Database connection pool exhausted. Immediate attention required.',
				severity: AlertSeverity.CRITICAL,
				timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
				read: false,
				actionUrl: '/alerts/active?alertId=alert-1',
			},
			{
				id: '2',
				alertId: 'alert-2',
				title: 'High Memory Usage',
				message: 'Server memory usage has exceeded 85% threshold.',
				severity: AlertSeverity.HIGH,
				timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
				read: false,
				actionUrl: '/alerts/active?alertId=alert-2',
			},
			{
				id: '3',
				alertId: 'alert-3',
				title: 'Security Scan Complete',
				message: 'Weekly security scan completed successfully with no issues found.',
				severity: AlertSeverity.INFO,
				timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
				read: true,
				actionUrl: '/alerts/active?alertId=alert-3',
			},
		]

		// Simulate API delay
		setTimeout(() => {
			setNotifications(mockNotifications)
			setLoading(false)
		}, 500)
	}, [])

	const unreadCount = notifications.filter((n) => !n.read).length

	const markAsRead = (notificationId: string) => {
		setNotifications((prev) =>
			prev.map((notification) =>
				notification.id === notificationId ? { ...notification, read: true } : notification
			)
		)
	}

	const markAllAsRead = () => {
		setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
	}

	const dismissNotification = (notificationId: string) => {
		setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId))
	}

	return {
		notifications,
		unreadCount,
		loading,
		error,
		markAsRead,
		markAllAsRead,
		dismissNotification,
	}
}
