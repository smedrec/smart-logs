/**
 * Template Version Manager Component
 *
 * Manages template versioning, history, and version comparison
 */

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
	Clock,
	Copy,
	Download,
	Eye,
	FileText,
	GitBranch,
	History,
	MoreHorizontal,
	RotateCcw,
	Trash2,
	User,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import type { ReportTemplate, TemplateVersion } from './template-types'

interface TemplateVersionManagerProps {
	template: ReportTemplate
	onVersionRestore?: (version: string) => Promise<void>
	onVersionDelete?: (version: string) => Promise<void>
	onVersionCompare?: (version1: string, version2: string) => void
	onVersionExport?: (version: string) => Promise<void>
	loading?: boolean
}

interface VersionComparisonProps {
	template: ReportTemplate
	version1: TemplateVersion
	version2: TemplateVersion
	onClose: () => void
}

function VersionComparison({ template, version1, version2, onClose }: VersionComparisonProps) {
	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date)
	}

	const getConfigurationDiff = () => {
		// Simple diff implementation - in a real app, you'd use a proper diff library
		const changes: Array<{
			field: string
			old: any
			new: any
			type: 'added' | 'removed' | 'modified'
		}> = []

		// Compare output formats
		if (version1.configuration.output.format !== version2.configuration.output.format) {
			changes.push({
				field: 'Output Format',
				old: version1.configuration.output.format,
				new: version2.configuration.output.format,
				type: 'modified',
			})
		}

		// Compare date range settings
		const v1DateRange = version1.configuration.criteria.dateRange
		const v2DateRange = version2.configuration.criteria.dateRange

		if (v1DateRange?.type !== v2DateRange?.type) {
			changes.push({
				field: 'Date Range Type',
				old: v1DateRange?.type,
				new: v2DateRange?.type,
				type: 'modified',
			})
		}

		if (v1DateRange?.value !== v2DateRange?.value) {
			changes.push({
				field: 'Date Range Value',
				old: v1DateRange?.value,
				new: v2DateRange?.value,
				type: 'modified',
			})
		}

		// Compare chart inclusion
		if (
			version1.configuration.output.includeCharts !== version2.configuration.output.includeCharts
		) {
			changes.push({
				field: 'Include Charts',
				old: version1.configuration.output.includeCharts,
				new: version2.configuration.output.includeCharts,
				type: 'modified',
			})
		}

		return changes
	}

	const configDiff = getConfigurationDiff()

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-4xl max-h-[80vh]">
				<DialogHeader>
					<DialogTitle>Compare Template Versions</DialogTitle>
					<DialogDescription>
						Comparing changes between version {version1.version} and {version2.version}
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 gap-6">
					{/* Version 1 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<GitBranch className="h-4 w-4" />
								Version {version1.version}
							</CardTitle>
							<CardDescription>
								<div className="flex items-center gap-2 text-sm">
									<User className="h-3 w-3" />
									{version1.createdBy}
								</div>
								<div className="flex items-center gap-2 text-sm">
									<Clock className="h-3 w-3" />
									{formatDate(version1.createdAt)}
								</div>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div>
									<p className="text-sm font-medium">Output Format</p>
									<p className="text-sm text-muted-foreground">
										{version1.configuration.output.format}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Date Range</p>
									<p className="text-sm text-muted-foreground">
										{version1.configuration.criteria.dateRange?.type} -{' '}
										{version1.configuration.criteria.dateRange?.value}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Include Charts</p>
									<p className="text-sm text-muted-foreground">
										{version1.configuration.output.includeCharts ? 'Yes' : 'No'}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Version 2 */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<GitBranch className="h-4 w-4" />
								Version {version2.version}
								{version2.isActive && <Badge variant="default">Current</Badge>}
							</CardTitle>
							<CardDescription>
								<div className="flex items-center gap-2 text-sm">
									<User className="h-3 w-3" />
									{version2.createdBy}
								</div>
								<div className="flex items-center gap-2 text-sm">
									<Clock className="h-3 w-3" />
									{formatDate(version2.createdAt)}
								</div>
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								<div>
									<p className="text-sm font-medium">Output Format</p>
									<p className="text-sm text-muted-foreground">
										{version2.configuration.output.format}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Date Range</p>
									<p className="text-sm text-muted-foreground">
										{version2.configuration.criteria.dateRange?.type} -{' '}
										{version2.configuration.criteria.dateRange?.value}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium">Include Charts</p>
									<p className="text-sm text-muted-foreground">
										{version2.configuration.output.includeCharts ? 'Yes' : 'No'}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Changes Summary */}
				{configDiff.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Changes Summary</CardTitle>
							<CardDescription>{configDiff.length} changes detected</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								{configDiff.map((change, index) => (
									<div key={index} className="flex items-center justify-between p-2 rounded border">
										<span className="font-medium">{change.field}</span>
										<div className="flex items-center gap-2">
											<Badge variant="outline" className="text-red-600">
												{String(change.old)}
											</Badge>
											<span>→</span>
											<Badge variant="outline" className="text-green-600">
												{String(change.new)}
											</Badge>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{configDiff.length === 0 && (
					<Card>
						<CardContent className="pt-6">
							<div className="text-center text-muted-foreground">
								<FileText className="h-8 w-8 mx-auto mb-2" />
								<p>No configuration changes detected between these versions</p>
							</div>
						</CardContent>
					</Card>
				)}
			</DialogContent>
		</Dialog>
	)
}

export function TemplateVersionManager({
	template,
	onVersionRestore,
	onVersionDelete,
	onVersionCompare,
	onVersionExport,
	loading,
}: TemplateVersionManagerProps) {
	const [selectedVersions, setSelectedVersions] = useState<string[]>([])
	const [showComparison, setShowComparison] = useState(false)

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date)
	}

	const handleVersionSelect = useCallback((version: string) => {
		setSelectedVersions((prev) => {
			if (prev.includes(version)) {
				return prev.filter((v) => v !== version)
			} else if (prev.length < 2) {
				return [...prev, version]
			} else {
				return [prev[1], version]
			}
		})
	}, [])

	const handleCompareVersions = useCallback(() => {
		if (selectedVersions.length === 2) {
			setShowComparison(true)
		}
	}, [selectedVersions])

	const handleVersionRestore = useCallback(
		async (version: string) => {
			if (onVersionRestore) {
				await onVersionRestore(version)
			}
		},
		[onVersionRestore]
	)

	const handleVersionDelete = useCallback(
		async (version: string) => {
			if (onVersionDelete) {
				await onVersionDelete(version)
			}
		},
		[onVersionDelete]
	)

	const handleVersionExport = useCallback(
		async (version: string) => {
			if (onVersionExport) {
				await onVersionExport(version)
			}
		},
		[onVersionExport]
	)

	const versions = template.versionHistory || []
	const currentVersion = versions.find((v) => v.isActive)
	const otherVersions = versions
		.filter((v) => !v.isActive)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

	const getVersionForComparison = (version: string) => {
		return versions.find((v) => v.version === version)
	}

	return (
		<div className="space-y-6">
			{/* Current Version */}
			{currentVersion && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<GitBranch className="h-5 w-5" />
									Current Version {currentVersion.version}
								</CardTitle>
								<CardDescription>
									Created by {currentVersion.createdBy} on {formatDate(currentVersion.createdAt)}
								</CardDescription>
							</div>
							<Badge variant="default">Active</Badge>
						</div>
					</CardHeader>
					<CardContent>
						{currentVersion.changes.length > 0 && (
							<div>
								<p className="text-sm font-medium mb-2">Recent Changes:</p>
								<ul className="text-sm text-muted-foreground space-y-1">
									{currentVersion.changes.map((change, index) => (
										<li key={index} className="flex items-center gap-2">
											<div className="w-1 h-1 bg-muted-foreground rounded-full" />
											{change}
										</li>
									))}
								</ul>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Version History */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<History className="h-5 w-5" />
								Version History
							</CardTitle>
							<CardDescription>
								{versions.length} versions • Select up to 2 versions to compare
							</CardDescription>
						</div>
						{selectedVersions.length === 2 && (
							<Button onClick={handleCompareVersions} variant="outline">
								<Eye className="h-4 w-4 mr-2" />
								Compare Selected
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{otherVersions.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">
							<History className="h-8 w-8 mx-auto mb-2" />
							<p>No previous versions available</p>
						</div>
					) : (
						<ScrollArea className="h-96">
							<div className="space-y-4">
								{otherVersions.map((version) => (
									<Card
										key={version.version}
										className={`cursor-pointer transition-colors ${
											selectedVersions.includes(version.version) ? 'ring-2 ring-primary' : ''
										}`}
									>
										<CardContent className="pt-4">
											<div className="flex items-center justify-between">
												<div
													className="flex-1"
													onClick={() => handleVersionSelect(version.version)}
												>
													<div className="flex items-center gap-2 mb-2">
														<Badge variant="outline">v{version.version}</Badge>
														<div className="flex items-center gap-1 text-sm text-muted-foreground">
															<User className="h-3 w-3" />
															{version.createdBy}
														</div>
														<div className="flex items-center gap-1 text-sm text-muted-foreground">
															<Clock className="h-3 w-3" />
															{formatDate(version.createdAt)}
														</div>
													</div>

													{version.changes.length > 0 && (
														<div>
															<p className="text-sm font-medium mb-1">Changes:</p>
															<ul className="text-sm text-muted-foreground space-y-1">
																{version.changes.slice(0, 2).map((change, index) => (
																	<li key={index} className="flex items-center gap-2">
																		<div className="w-1 h-1 bg-muted-foreground rounded-full" />
																		{change}
																	</li>
																))}
																{version.changes.length > 2 && (
																	<li className="text-xs">
																		+{version.changes.length - 2} more changes
																	</li>
																)}
															</ul>
														</div>
													)}
												</div>

												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="sm">
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuLabel>Version Actions</DropdownMenuLabel>
														<DropdownMenuItem onClick={() => handleVersionExport(version.version)}>
															<Download className="h-4 w-4 mr-2" />
															Export Configuration
														</DropdownMenuItem>
														<DropdownMenuItem onClick={() => handleVersionSelect(version.version)}>
															<Copy className="h-4 w-4 mr-2" />
															{selectedVersions.includes(version.version)
																? 'Deselect'
																: 'Select for Comparison'}
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem onClick={() => handleVersionRestore(version.version)}>
															<RotateCcw className="h-4 w-4 mr-2" />
															Restore This Version
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<DropdownMenuItem
																	className="text-red-600"
																	onSelect={(e) => e.preventDefault()}
																>
																	<Trash2 className="h-4 w-4 mr-2" />
																	Delete Version
																</DropdownMenuItem>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>Delete Version</AlertDialogTitle>
																	<AlertDialogDescription>
																		Are you sure you want to delete version {version.version}? This
																		action cannot be undone.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() => handleVersionDelete(version.version)}
																		className="bg-red-600 hover:bg-red-700"
																	>
																		Delete Version
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</ScrollArea>
					)}
				</CardContent>
			</Card>

			{/* Version Comparison Dialog */}
			{showComparison && selectedVersions.length === 2 && (
				<VersionComparison
					template={template}
					version1={getVersionForComparison(selectedVersions[0])!}
					version2={getVersionForComparison(selectedVersions[1])!}
					onClose={() => setShowComparison(false)}
				/>
			)}
		</div>
	)
}
