'use client'

import { DeleteAlert } from '@/components/event-calendar/ui/delete-alert'
import { FormFooter } from '@/components/event-calendar/ui/form-footer'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useEventCalendarStore } from '@/hooks/use-event'
import { ensureDate } from '@/lib/date'
import { getLocaleFromCode } from '@/lib/event'
import { eventFormSchema } from '@/lib/validations'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useShallow } from 'zustand/shallow'

import { EventDetailsForm } from './event-detail-form'

const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '10:00'
const DEFAULT_COLOR = 'bg-red-600'
const DEFAULT_CATEGORY = 'workshop'

type EventFormValues = z.infer<typeof eventFormSchema>

const DEFAULT_FORM_VALUES: EventFormValues = {
	title: '',
	description: '',
	startDate: new Date(),
	endDate: new Date(),
	category: DEFAULT_CATEGORY,
	startTime: DEFAULT_START_TIME,
	endTime: DEFAULT_END_TIME,
	location: '',
	color: DEFAULT_COLOR,
}

function useIsMounted() {
	const [isMounted, setIsMounted] = useState<boolean>(false)

	useEffect(() => {
		setIsMounted(true)
		return () => setIsMounted(false)
	}, [])

	return isMounted
}

export default function EventDialog() {
	const { locale, selectedEvent, isDialogOpen, closeEventDialog, isSubmitting } =
		useEventCalendarStore(
			useShallow((state) => ({
				locale: state.locale,
				selectedEvent: state.selectedEvent,
				isDialogOpen: state.isDialogOpen,
				closeEventDialog: state.closeEventDialog,
				isSubmitting: state.isSubmitting,
			}))
		)
	const localeObj = getLocaleFromCode(locale)

	const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState<boolean>(false)
	const isMounted = useIsMounted()

	const form = useForm<EventFormValues>({
		resolver: zodResolver(eventFormSchema),
		defaultValues: DEFAULT_FORM_VALUES,
		mode: 'onChange',
	})

	useEffect(() => {
		if (selectedEvent) {
			try {
				const startDate = ensureDate(selectedEvent.startDate)
				const endDate = ensureDate(selectedEvent.endDate)

				form.reset({
					title: selectedEvent.title || '',
					description: selectedEvent.description || '',
					startDate,
					endDate,
					category: selectedEvent.category || DEFAULT_CATEGORY,
					startTime: selectedEvent.startTime || DEFAULT_START_TIME,
					endTime: selectedEvent.endTime || DEFAULT_END_TIME,
					location: selectedEvent.location || '',
					color: selectedEvent.color,
				})
			} catch (error) {
				console.error('Error resetting form with event data:', error)
			}
		}
	}, [selectedEvent, form])

	const handleUpdate = async (values: EventFormValues) => {
		if (!selectedEvent?.id) return

		toast.success('DEMO: Update event UI triggered', {
			description:
				'Override this handler with your actual update logic. Requires connection to your data source.',
		})
	}

	const handleDeleteEvent = async () => {
		toast.success('DEMO: Delete event UI triggered', {
			description:
				'Replace this placeholder with real deletion logic. Ensure proper data persistence.',
		})
	}

	if (!isMounted) return null

	return (
		<Dialog open={isDialogOpen} onOpenChange={closeEventDialog} modal={false}>
			<DialogContent className="sm:max-w-[550px]">
				<DialogHeader>
					<DialogTitle>Event Details</DialogTitle>
					<DialogDescription>Event details {selectedEvent?.title}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="h-[350px] w-full sm:h-[500px]">
					<EventDetailsForm form={form} onSubmit={handleUpdate} locale={localeObj} />
				</ScrollArea>
				<DialogFooter className="mt-2 flex flex-row">
					<DeleteAlert
						isOpen={isDeleteAlertOpen}
						onOpenChange={setIsDeleteAlertOpen}
						onConfirm={handleDeleteEvent}
					/>
					<FormFooter
						onCancel={closeEventDialog}
						onSave={form.handleSubmit(handleUpdate)}
						isSubmitting={isSubmitting}
					/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
