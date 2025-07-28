'use client'

import { Button } from '@/components/ui/button'
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Textarea } from '../ui/textarea'

const formSchema = z.object({
	resolutionNotes: z.string(),
})

interface FormProps {
	onSubmit: (data: string) => Promise<void>
}

export default function ResolveAlertForm({ onSubmit }: FormProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
	})

	async function handleSubmit(values: z.infer<typeof formSchema>) {
		try {
			await onSubmit(values.resolutionNotes)
			// Don't reset here - let the parent handle cleanup
		} catch (error) {
			console.error('Form submission error', error)
			toast.error('Failed to submit the form. Please try again.')
		}
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="space-y-8 max-w-3xl mx-auto py-10"
			>
				<FormField
					control={form.control}
					name="resolutionNotes"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Resolution note</FormLabel>
							<FormControl>
								<Textarea placeholder="" className="resize-none" {...field} />
							</FormControl>
							<FormDescription>This is your resolution notes.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit">Submit</Button>
			</form>
		</Form>
	)
}
