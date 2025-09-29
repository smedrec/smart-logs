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
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { TagsInput } from '@/components/ui/tags-input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { AuditPreset } from '@smedrec/audit-client'

const formSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	action: z.string().min(1),
	dataClassification: z.string(),
	requiredFields: z.array(z.string()).min(1, {
		error: 'Please select at least one item',
	}),
})

interface PresetFormProps {
	onSubmit: (data: AuditPreset) => void
	initialData?: AuditPreset | null
}

export default function PresetForm({ onSubmit, initialData }: PresetFormProps) {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: initialData || {
			requiredFields: [],
		},
	})

	function handleSubmit(values: z.infer<typeof formSchema>) {
		try {
			onSubmit(values as AuditPreset)
			form.reset()
			toast.success('Audit preset data submitted successfully!')
		} catch (error) {
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
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input placeholder="authentication" type="" {...field} />
							</FormControl>
							<FormDescription>This is your public audit preset name.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Description</FormLabel>
							<FormControl>
								<Textarea placeholder="Placeholder" className="resize-none" {...field} />
							</FormControl>
							<FormDescription>Audit preset description</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="action"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Action</FormLabel>
							<FormControl>
								<Input placeholder="data.read" type="" {...field} />
							</FormControl>
							<FormDescription>Audit preset action</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dataClassification"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Classification</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a data classification to preset" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="PUBLIC">PUBLIC</SelectItem>
									<SelectItem value="INTERNAL">INTERNAL</SelectItem>
									<SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
									<SelectItem value="PHI">PHI</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>Select a data classification to preset.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="requiredFields"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Enter required fields</FormLabel>
							<FormControl>
								<TagsInput
									value={field.value}
									onValueChange={field.onChange}
									placeholder="Enter your fields"
								/>
							</FormControl>
							<FormDescription>Add required fields.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit">{initialData ? 'Update' : 'Create'}</Button>
			</form>
		</Form>
	)
}
