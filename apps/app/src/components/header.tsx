import { useNotifications } from '@/hooks/useNotifications'

import { NotificationBell } from './alerts/notifications/NotificationBell'
import { NavUser } from './auth/nav-user'
import { ModeToggle } from './mode-toggle'

export default function Header() {
	const { unreadCount } = useNotifications()

	return (
		<div className="flex grow justify-end gap-2 p-3">
			<NotificationBell unreadCount={unreadCount} />
			<ModeToggle />
			<NavUser />
		</div>
	)
}
