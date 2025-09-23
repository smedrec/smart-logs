import { Button } from '@/components/ui/button'
import {
	Announcement,
	AnnouncementTag,
	AnnouncementTitle,
} from '@/components/ui/kibo-ui/announcement'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
	component: HomeComponent,
})

function HomeComponent() {
	const navigate = Route.useNavigate()

	return (
		<div className="flex flex-col gap-16 px-8 py-24 text-center">
			<div className="flex flex-col items-center justify-center gap-8">
				<a href="https://github.com/joseantcordeiro/smart-logs" target="_blank" rel="noreferrer">
					<Announcement>
						<AnnouncementTag>MIT License</AnnouncementTag>
						<AnnouncementTitle>See the repository for more details.</AnnouncementTitle>
					</Announcement>
				</a>
				<h1 className="mb-0 text-balance font-medium text-6xl md:text-7xl xl:text-[5.25rem]">
					Smart Logs
				</h1>
				<p className="mt-0 mb-0 text-balance text-lg text-muted-foreground">
					Audit System provides comprehensive audit logging capabilities for healthcare
					applications, ensuring compliance with HIPAA, GDPR, and other regulatory requirements.
				</p>
				<div className="flex items-center gap-2">
					<Button asChild>
						<Link to="/dashboard">Get started</Link>
					</Button>
					<Button asChild variant="outline">
						<a
							className="no-underline"
							href="https://github.com/joseantcordeiro/smart-logs"
							target="_blank"
							rel="noreferrer"
						>
							Learn more
						</a>
					</Button>
				</div>
			</div>
		</div>
	)
}
