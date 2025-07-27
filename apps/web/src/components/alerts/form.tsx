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
		defaultValues: {
			resolutionNotes: '',
		},
	})

	async function handleSubmit(values: z.infer<typeof formSchema>) {
		try {
			await onSubmit(values.resolutionNotes)
			form.reset()
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
				<div className="grid grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="resolutionNotes"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Resolution Note</FormLabel>
									<FormControl>
										<Textarea placeholder="Resolution note" {...field} />
									</FormControl>
									<FormDescription>This is your resolved notes.</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
				<Button type="submit">Resolve</Button>
			</form>
		</Form>
	)
}
