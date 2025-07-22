import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
	component: HomeComponent,
})

function HomeComponent() {
	const navigate = Route.useNavigate()

	return (
		<div>
			<h1>Dashboard</h1>
		</div>
	)
}
