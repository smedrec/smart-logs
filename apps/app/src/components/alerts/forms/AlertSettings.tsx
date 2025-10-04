'use client'

import { AlertSeverity, AlertType } from '@/components/alerts/types/alert-types'
import {
	NotificationChannel,
	NotificationFrequency,
} from '@/components/alerts/types/settings-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bell, Filter, Keyboard, Monitor, Save, Settings, Volume2 } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import type { AlertPreferences } from '@/components/alerts/types/settings-types'

// Validation schema for alert preferences
const alertPreferencesSchema = z.object({
	notifications: z.object({
		enabled: z.boolean(),
		frequency: z.enum(NotificationFrequency),
		severityThreshold: z.enum(AlertSeverity),
		types: z.array(z.enum(AlertType)),
		channels: z.array(z.enum(NotificationChannel)),
		quietHours: z
			.object({
				enabled: z.boolean(),
				start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
				end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
				timezone: z.string(),
			})
			.optional(),
	}),
	display: z.object({
		theme: z.enum(['light', 'dark', 'system']),
		density: z.enum(['compact', 'comfortable', 'spacious']),
		defaultView: z.enum(['list', 'board', 'statistics']),
		itemsPerPage: z.number().min(10).max(100),
		showMetadata: z.boolean(),
		showTags: z.boolean(),
		autoRefresh: z.boolean(),
		refreshInterval: z.number().min(5).max(300),
	}),
	filters: z.object({
		defaultFilters: z.record(z.string(), z.any()),
		savedFilters: z.array(z.string()),
		rememberLastFilters: z.boolean(),
	}),
	advanced: z.object({
		enableKeyboardShortcuts: z.boolean(),
		enableSounds: z.boolean(),
		enableDesktopNotifications: z.boolean(),
		maxNotifications: z.number().min(1).max(50),
		autoAcknowledgeResolved: z.boolean(),
	}),
})

type AlertPreferencesForm = z.infer<typeof alertPreferencesSchema>

interface AlertSettingsProps {
	/** Current user preferences */
	preferences?: Partial<AlertPreferences>
	/** Callback when preferences are saved */
	onSave: (preferences: Partial<AlertPreferences>) => Promise<void>
	/** Whether the form is in a loading state */
	loading?: boolean
	/** Whether the user can modify settings */
	readonly?: boolean
	/** Additional CSS classes */
	className?: string
}

/**
 * Comprehensive settings interface for alert preferences and configuration
 * Supports notification settings, display preferences, and advanced options
 */
export function AlertSettings({
	preferences = {},
	onSave,
	loading = false,
	readonly = false,
	className,
}: AlertSettingsProps) {
	const [activeTab, setActiveTab] = useState('notifications')
	const [isDirty, setIsDirty] = useState(false)

	// Default preferences
	const defaultPreferences: AlertPreferencesForm = {
		notifications: {
			enabled: true,
			frequency: NotificationFrequency.IMMEDIATE,
			severityThreshold: AlertSeverity.MEDIUM,
			types: Object.values(AlertType),
			channels: [NotificationChannel.IN_APP],
			quietHours: {
				enabled: false,
				start: '22:00',
				end: '08:00',
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
		},
		display: {
			theme: 'system',
			density: 'comfortable',
			defaultView: 'list',
			itemsPerPage: 25,
			showMetadata: true,
			showTags: true,
			autoRefresh: true,
			refreshInterval: 30,
		},
		filters: {
			defaultFilters: {},
			savedFilters: [],
			rememberLastFilters: true,
		},
		advanced: {
			enableKeyboardShortcuts: true,
			enableSounds: false,
			enableDesktopNotifications: true,
			maxNotifications: 10,
			autoAcknowledgeResolved: false,
		},
	}

	const form = useForm<AlertPreferencesForm>({
		resolver: zodResolver(alertPreferencesSchema),
		defaultValues: {
			...defaultPreferences,
			...preferences,
		},
	})

	// Watch for form changes to track dirty state
	useEffect(() => {
		const subscription = form.watch(() => {
			setIsDirty(true)
		})
		return () => subscription.unsubscribe()
	}, [form])

	const handleSave = useCallback(
		async (data: AlertPreferencesForm) => {
			try {
				await onSave(data)
				setIsDirty(false)
				toast.success('Settings saved successfully')
			} catch (error) {
				console.error('Failed to save settings:', error)
				toast.error('Failed to save settings. Please try again.')
			}
		},
		[onSave]
	)

	const handleReset = useCallback(() => {
		form.reset(defaultPreferences)
		setIsDirty(false)
		toast.info('Settings reset to defaults')
	}, [form])

	const handleExport = useCallback(() => {
		const data = form.getValues()
		const exportData = {
			version: '1.0',
			exportedAt: new Date().toISOString(),
			preferences: data,
		}

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `alert-settings-${new Date().toISOString().split('T')[0]}.json`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)

		toast.success('Settings exported successfully')
	}, [form])

	const handleImport = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0]
			if (!file) return

			const reader = new FileReader()
			reader.onload = (e) => {
				try {
					const importData = JSON.parse(e.target?.result as string)
					if (importData.preferences) {
						form.reset(importData.preferences)
						setIsDirty(true)
						toast.success('Settings imported successfully')
					} else {
						toast.error('Invalid settings file format')
					}
				} catch (error) {
					console.error('Failed to import settings:', error)
					toast.error('Failed to import settings. Please check the file format.')
				}
			}
			reader.readAsText(file)
		},
		[form]
	)

	return (
		<div className={className}>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
					{/* Header */}
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-2xl font-bold tracking-tight">Alert Settings</h2>
							<p className="text-muted-foreground">
								Configure your alert preferences and notification settings
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button type="button" variant="outline" onClick={handleExport} disabled={loading}>
								Export
							</Button>
							<div className="relative">
								<input
									type="file"
									accept=".json"
									onChange={handleImport}
									className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
									disabled={loading || readonly}
								/>
								<Button type="button" variant="outline" disabled={loading || readonly}>
									Import
								</Button>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={handleReset}
								disabled={loading || readonly}
							>
								Reset
							</Button>
							<Button
								type="submit"
								disabled={!isDirty || loading || readonly}
								className="min-w-[100px]"
							>
								{loading ? (
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
										Saving...
									</div>
								) : (
									<div className="flex items-center gap-2">
										<Save className="h-4 w-4" />
										Save
									</div>
								)}
							</Button>
						</div>
					</div>

					<Separator />

					{/* Settings Tabs */}
					<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="notifications" className="flex items-center gap-2">
								<Bell className="h-4 w-4" />
								Notifications
							</TabsTrigger>
							<TabsTrigger value="display" className="flex items-center gap-2">
								<Monitor className="h-4 w-4" />
								Display
							</TabsTrigger>
							<TabsTrigger value="filters" className="flex items-center gap-2">
								<Filter className="h-4 w-4" />
								Filters
							</TabsTrigger>
							<TabsTrigger value="advanced" className="flex items-center gap-2">
								<Settings className="h-4 w-4" />
								Advanced
							</TabsTrigger>
						</TabsList>

						{/* Notifications Tab */}
						<TabsContent value="notifications" className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Notification Settings</CardTitle>
									<CardDescription>
										Configure how and when you receive alert notifications
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<FormField
										control={form.control}
										name="notifications.enabled"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">Enable Notifications</FormLabel>
													<FormDescription>
														Receive notifications for new alerts and status changes
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="notifications.frequency"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Notification Frequency</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													disabled={readonly}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select frequency" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="immediate">Immediate</SelectItem>
														<SelectItem value="every_5_minutes">Every 5 minutes</SelectItem>
														<SelectItem value="every_15_minutes">Every 15 minutes</SelectItem>
														<SelectItem value="every_30_minutes">Every 30 minutes</SelectItem>
														<SelectItem value="hourly">Hourly</SelectItem>
														<SelectItem value="daily">Daily</SelectItem>
														<SelectItem value="disabled">Disabled</SelectItem>
													</SelectContent>
												</Select>
												<FormDescription>
													How often to receive notification summaries
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="notifications.severityThreshold"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Minimum Severity</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													disabled={readonly}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select minimum severity" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{Object.values(AlertSeverity).map((severity) => (
															<SelectItem key={severity} value={severity}>
																{severity.charAt(0).toUpperCase() + severity.slice(1)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormDescription>
													Only receive notifications for alerts at or above this severity level
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									{/* Quiet Hours */}
									<div className="space-y-4">
										<FormField
											control={form.control}
											name="notifications.quietHours.enabled"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">Quiet Hours</FormLabel>
														<FormDescription>
															Disable notifications during specified hours
														</FormDescription>
													</div>
													<FormControl>
														<Switch
															checked={field.value}
															onCheckedChange={field.onChange}
															disabled={readonly}
														/>
													</FormControl>
												</FormItem>
											)}
										/>

										{form.watch('notifications.quietHours.enabled') && (
											<div className="grid grid-cols-2 gap-4 pl-4">
												<FormField
													control={form.control}
													name="notifications.quietHours.start"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Start Time</FormLabel>
															<FormControl>
																<Input type="time" {...field} disabled={readonly} />
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name="notifications.quietHours.end"
													render={({ field }) => (
														<FormItem>
															<FormLabel>End Time</FormLabel>
															<FormControl>
																<Input type="time" {...field} disabled={readonly} />
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						{/* Display Tab */}
						<TabsContent value="display" className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Display Preferences</CardTitle>
									<CardDescription>
										Customize how alerts are displayed in the interface
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<FormField
										control={form.control}
										name="display.theme"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Theme</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													disabled={readonly}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select theme" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="light">Light</SelectItem>
														<SelectItem value="dark">Dark</SelectItem>
														<SelectItem value="system">System</SelectItem>
													</SelectContent>
												</Select>
												<FormDescription>Choose your preferred color theme</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="display.density"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Display Density</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													disabled={readonly}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select density" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="compact">Compact</SelectItem>
														<SelectItem value="comfortable">Comfortable</SelectItem>
														<SelectItem value="spacious">Spacious</SelectItem>
													</SelectContent>
												</Select>
												<FormDescription>
													How much space to use for displaying alerts
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="display.defaultView"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Default View</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
													disabled={readonly}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select default view" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="list">List View</SelectItem>
														<SelectItem value="board">Board View</SelectItem>
														<SelectItem value="statistics">Statistics View</SelectItem>
													</SelectContent>
												</Select>
												<FormDescription>
													The view to show when opening the alerts page
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="display.itemsPerPage"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Items Per Page</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={10}
														max={100}
														{...field}
														onChange={(e) => field.onChange(parseInt(e.target.value))}
														disabled={readonly}
													/>
												</FormControl>
												<FormDescription>
													Number of alerts to display per page (10-100)
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<div className="space-y-4">
										<FormField
											control={form.control}
											name="display.showMetadata"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">Show Metadata</FormLabel>
														<FormDescription>
															Display additional metadata in alert cards
														</FormDescription>
													</div>
													<FormControl>
														<Switch
															checked={field.value}
															onCheckedChange={field.onChange}
															disabled={readonly}
														/>
													</FormControl>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="display.showTags"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">Show Tags</FormLabel>
														<FormDescription>Display tags in alert listings</FormDescription>
													</div>
													<FormControl>
														<Switch
															checked={field.value}
															onCheckedChange={field.onChange}
															disabled={readonly}
														/>
													</FormControl>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="display.autoRefresh"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">Auto Refresh</FormLabel>
														<FormDescription>Automatically refresh alert data</FormDescription>
													</div>
													<FormControl>
														<Switch
															checked={field.value}
															onCheckedChange={field.onChange}
															disabled={readonly}
														/>
													</FormControl>
												</FormItem>
											)}
										/>
									</div>

									{form.watch('display.autoRefresh') && (
										<FormField
											control={form.control}
											name="display.refreshInterval"
											render={({ field }) => (
												<FormItem className="pl-4">
													<FormLabel>Refresh Interval (seconds)</FormLabel>
													<FormControl>
														<Input
															type="number"
															min={5}
															max={300}
															{...field}
															onChange={(e) => field.onChange(parseInt(e.target.value))}
															disabled={readonly}
														/>
													</FormControl>
													<FormDescription>
														How often to refresh data (5-300 seconds)
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Filters Tab */}
						<TabsContent value="filters" className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Filter Preferences</CardTitle>
									<CardDescription>
										Configure default filters and saved filter behavior
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<FormField
										control={form.control}
										name="filters.rememberLastFilters"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">Remember Last Filters</FormLabel>
													<FormDescription>
														Restore your last used filters when returning to the alerts page
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									<div className="space-y-4">
										<Label className="text-base font-medium">Default Filters</Label>
										<p className="text-sm text-muted-foreground">
											Set filters that will be applied by default when viewing alerts
										</p>
										{/* This would integrate with the AlertFilters component */}
										<div className="rounded-lg border p-4 text-center text-muted-foreground">
											Default filter configuration will be integrated with the AlertFilters
											component
										</div>
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						{/* Advanced Tab */}
						<TabsContent value="advanced" className="space-y-6">
							<Card>
								<CardHeader>
									<CardTitle>Advanced Settings</CardTitle>
									<CardDescription>Configure advanced features and behavior</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<FormField
										control={form.control}
										name="advanced.enableKeyboardShortcuts"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base flex items-center gap-2">
														<Keyboard className="h-4 w-4" />
														Keyboard Shortcuts
													</FormLabel>
													<FormDescription>
														Enable keyboard shortcuts for common actions
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="advanced.enableSounds"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base flex items-center gap-2">
														<Volume2 className="h-4 w-4" />
														Sound Notifications
													</FormLabel>
													<FormDescription>
														Play sounds for new alerts and status changes
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="advanced.enableDesktopNotifications"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">Desktop Notifications</FormLabel>
													<FormDescription>
														Show browser notifications for critical alerts
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="advanced.maxNotifications"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Maximum Notifications</FormLabel>
												<FormControl>
													<Input
														type="number"
														min={1}
														max={50}
														{...field}
														onChange={(e) => field.onChange(parseInt(e.target.value))}
														disabled={readonly}
													/>
												</FormControl>
												<FormDescription>
													Maximum number of notifications to show at once (1-50)
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="advanced.autoAcknowledgeResolved"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">Auto-acknowledge Resolved</FormLabel>
													<FormDescription>
														Automatically acknowledge alerts when they are resolved
													</FormDescription>
												</div>
												<FormControl>
													<Switch
														checked={field.value}
														onCheckedChange={field.onChange}
														disabled={readonly}
													/>
												</FormControl>
											</FormItem>
										)}
									/>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</form>
			</Form>
		</div>
	)
}
