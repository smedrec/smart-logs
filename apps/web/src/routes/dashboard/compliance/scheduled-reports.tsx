import { EventCalendar } from '@/components/event-calendar/event-calendar'
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb'
import { createFileRoute } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/react'

import type { Events } from '@/types/event'
import type { SearchParams } from 'nuqs'

export const Route = createFileRoute('/dashboard/compliance/scheduled-reports')({
	component: RouteComponent,
})

interface ComponentProps {
	searchParams: Promise<SearchParams>
}

function RouteComponent() {
	const now = new Date()
	const eventsResponse = {
		events: dummyEvents,
	}
	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<PageBreadcrumb link="Compliance" page="Scheduled Reports" />
			<NuqsAdapter>
				<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
					<EventCalendar events={eventsResponse.events} initialDate={now} />
				</div>
			</NuqsAdapter>
		</div>
	)
}

const dummyEvents: Events[] = [
	{
		id: '1',
		title: 'Daily Team Standup',
		description: 'Daily sync to discuss progress and blockers.',
		startDate: new Date(),
		endDate: new Date(),
		startTime: '09:00',
		endTime: '09:30',
		isRepeating: true,
		repeatingType: 'daily',
		location: 'Virtual - Google Meet',
		category: 'Work',
		color: 'red',
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: '2',
		title: 'Project Alpha Deadline',
		description: 'Final submission for Project Alpha.',
		startDate: new Date(new Date().setDate(new Date().getDate() + 2)),
		endDate: new Date(new Date().setDate(new Date().getDate() + 2)),
		startTime: '17:00',
		endTime: '17:30',
		isRepeating: false,
		repeatingType: null,
		location: 'Project Management Platform',
		category: 'Project',
		color: 'blue',
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: '3',
		title: 'Weekly Review',
		description: 'Review of the past week and planning for the next.',
		startDate: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 5)),
		endDate: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + 5)),
		startTime: '15:00',
		endTime: '16:00',
		isRepeating: true,
		repeatingType: 'weekly',
		location: 'Conference Room B',
		category: 'Work',
		color: 'yellow',
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: '4',
		title: 'Dentist Appointment',
		description: 'Annual check-up.',
		startDate: new Date(new Date().setDate(new Date().getDate() + 10)),
		endDate: new Date(new Date().setDate(new Date().getDate() + 10)),
		startTime: '11:00',
		endTime: '12:00',
		isRepeating: false,
		repeatingType: null,
		location: 'City Dental Clinic',
		category: 'Personal',
		color: 'purple',
		createdAt: new Date(),
		updatedAt: new Date(),
	},
]
