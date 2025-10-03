import { Link } from '@tanstack/react-router'

import { NavUser } from './auth/nav-user'
import { ModeToggle } from './mode-toggle'

export default function Header() {
	return (
		<div className="flex grow justify-end gap-2 p-3">
			<ModeToggle />
			<NavUser />
		</div>
	)
}
