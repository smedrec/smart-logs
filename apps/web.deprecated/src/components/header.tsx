import { UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'

import { ApiStatus } from './api-status'
import { ModeToggle } from './mode-toggle'
import UserMenu from './user-menu'

export default function Header() {
	const links = [
		{ to: '/', label: 'Home' },
		{ to: '/dashboard', label: 'Dashboard' },
	]

	return (
		<div>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav className="flex gap-4 text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link key={to} to={to}>
								{label}
							</Link>
						)
					})}
				</nav>
				<div className="flex items-center gap-2">
					<ApiStatus />
					<ModeToggle />
					<UserButton
						className="text-accent-foreground bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
						classNames={{
							content: {
								avatar: {
									fallback: 'bg-destructive text-white',
								},
							},
						}}
						size="sm"
					/>
				</div>
			</div>
			<hr />
		</div>
	)
}
