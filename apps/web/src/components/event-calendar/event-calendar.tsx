'use client'

import { useEventCalendarStore } from '@/hooks/use-event'
import { Events } from '@/types/event'
import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'

import { MonthDayEventsDialog } from './day-events-dialog'
import { EventCalendarDay } from './event-calendar-day'
import { EventCalendarDays } from './event-calendar-days'
import { EventCalendarMonth } from './event-calendar-month'
import CalendarToolbar from './event-calendar-toolbar'
import { EventCalendarWeek } from './event-calendar-week'
import { EventCalendarYear } from './event-calendar-year'
import EventCreateDialog from './event-create-dialog'
import EventDialog from './event-dialog'
import { EventsList } from './event-list'

interface EventCalendarProps {
	events: Events[]
	initialDate: Date
}

export function EventCalendar({ initialDate, events }: EventCalendarProps) {
	const { viewMode, currentView, daysCount } = useEventCalendarStore(
		useShallow((state) => ({
			viewMode: state.viewMode,
			currentView: state.currentView,
			daysCount: state.daysCount,
		}))
	)

	const renderCalendarView = useMemo(() => {
		if (viewMode === 'list') {
			return <EventsList events={events} currentDate={initialDate} />
		}
		switch (currentView) {
			case 'day':
				return <EventCalendarDay events={events} currentDate={initialDate} />
			case 'days':
				return <EventCalendarDays events={events} daysCount={daysCount} currentDate={initialDate} />
			case 'week':
				return <EventCalendarWeek events={events} currentDate={initialDate} />
			case 'month':
				return <EventCalendarMonth events={events} baseDate={initialDate} />
			case 'year':
				return <EventCalendarYear events={events} currentDate={initialDate} />
			default:
				return <EventCalendarDay events={events} currentDate={initialDate} />
		}
	}, [currentView, daysCount, events, initialDate, viewMode])

	return (
		<>
			<EventDialog />
			<MonthDayEventsDialog />
			<EventCreateDialog />
			<div className="bg-background overflow-hidden rounded-xl border shadow-sm">
				<CalendarToolbar />
				<div className="overflow-hidden p-0">{renderCalendarView}</div>
			</div>
		</>
	)
}
