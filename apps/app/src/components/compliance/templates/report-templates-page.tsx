/**
 * Report Templates Page Component
 *
 * Enhanced template management with creation, versioning, and sharing
 */

import { CompliancePageHeader } from '@/components/compliance/navigation'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReportTemplatesUrlState } from '@/hooks/useComplianceUrlState'
import { Link } from '@tanstack/react-router'
import {
	Copy,
	Edit,
	Eye,
	FileText,
	GitBranch,
	History,
	MoreHorizontal,
	Plus,
	Search,
	Settings,
	Share2,
	Trash2,
	Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { ExportButton } from '../export'
import { TemplateForm } from './template-form'
import { TemplateSharingManager } from './template-sharing-manager'
import { TemplateVersionManager } from './template-version-manager'

import type { CreateTemplateInput, ReportTemplate, UpdateTemplateInput } from './template-types'

interface ReportTemplatesPageProps {
	searchParams: {
		page?: number
		limit?: number
		search?: string
		reportType?: 'hipaa' | 'gdpr' | 'custom'
		category?: string
		sortBy?: 'name' | 'reportType' | 'category' | 'createdAt' | 'updatedAt'
		sortOrder?: 'asc' | 'desc'
	}
}

export function ReportTemplatesPage({ searchParams }: ReportTemplatesPageProps) {
	const { state, setParam } = useReportTemplatesUrlState()
	const [templates, setTemplates] = useState<ReportTemplate[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [showEditDialog, setShowEditDialog] = useState(false)
	const [showVersionDialog, setShowVersionDialog] = useState(false)
	const [showSharingDialog, setShowSharingDialog] = useState(false)

	// Mock data - in real implementation, this would come from API
	useEffect(() => {
		const mockTemplates: ReportTemplate[] = [
			{
				id: 'template-1',
				name: 'Standard HIPAA Audit',
				description: 'Comprehensive HIPAA compliance audit template with all required sections',
				reportType: 'HIPAA_AUDIT_TRAIL',
				category: 'healthcare',
				isPublic: true,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
				createdBy: 'admin@example.com',
				organizationId: 'org-1',
				usageCount: 45,
				tags: ['hipaa', 'healthcare', 'audit', 'standard'],
				version: '2.1.0',
				isActive: true,
				configuration: {
					criteria: {
						dateRange: { type: 'relative', value: '30d' },
						includeFields: ['timestamp', 'userId', 'action', 'resourceType'],
						groupBy: ['action'],
						sortBy: ['timestamp'],
					},
					output: {
						format: 'pdf',
						includeCharts: true,
						includeRawData: false,
					},
				},
				shareSettings: {
					isPublic: true,
					allowPublicUse: true,
					allowPublicEdit: false,
					requireApproval: false,
				},
				versionHistory: [
					{
						version: '2.1.0',
						createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
						createdBy: 'admin@example.com',
						changes: ['Updated date range options', 'Added new chart types'],
						configuration: {
							criteria: {
								dateRange: { type: 'relative', value: '30d' },
								includeFields: ['timestamp', 'userId', 'action', 'resourceType'],
								groupBy: ['action'],
								sortBy: ['timestamp'],
							},
							output: {
								format: 'pdf',
								includeCharts: true,
								includeRawData: false,
							},
						},
						isActive: true,
					},
					{
						version: '2.0.0',
						createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
						createdBy: 'admin@example.com',
						changes: ['Major configuration update', 'Improved field selection'],
						configuration: {
							criteria: {
								dateRange: { type: 'relative', value: '7d' },
								includeFields: ['timestamp', 'userId', 'action'],
								groupBy: ['action'],
								sortBy: ['timestamp'],
							},
							output: {
								format: 'csv',
								includeCharts: false,
								includeRawData: true,
							},
						},
						isActive: false,
					},
				],
				sharedWith: [
					{
						id: 'share-1',
						sharedWith: 'user@example.com',
						sharedBy: 'admin@example.com',
						sharedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
						permissions: [
							{ action: 'view', granted: true },
							{ action: 'use', granted: true },
							{ action: 'edit', granted: false },
							{ action: 'share', granted: false },
						],
					},
				],
			},
			{
				id: 'template-2',
				name: 'GDPR Data Processing Report',
				description: 'Template for GDPR data processing activities reporting',
				reportType: 'GDPR_PROCESSING_ACTIVITIES',
				category: 'privacy',
				isPublic: true,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
				createdBy: 'privacy@example.com',
				organizationId: 'org-1',
				usageCount: 32,
				tags: ['gdpr', 'privacy', 'data-processing', 'eu'],
				version: '1.0.0',
				isActive: true,
				configuration: {
					criteria: {
						dateRange: { type: 'relative', value: '90d' },
						includeFields: ['timestamp', 'dataSubjectId', 'processingPurpose'],
						groupBy: ['processingPurpose'],
						sortBy: ['timestamp'],
					},
					output: {
						format: 'pdf',
						includeCharts: true,
						includeRawData: true,
					},
				},
				shareSettings: {
					isPublic: true,
					allowPublicUse: true,
					allowPublicEdit: false,
					requireApproval: true,
				},
				versionHistory: [
					{
						version: '1.0.0',
						createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
						createdBy: 'privacy@example.com',
						changes: ['Initial template creation'],
						configuration: {
							criteria: {
								dateRange: { type: 'relative', value: '90d' },
								includeFields: ['timestamp', 'dataSubjectId', 'processingPurpose'],
								groupBy: ['processingPurpose'],
								sortBy: ['timestamp'],
							},
							output: {
								format: 'pdf',
								includeCharts: true,
								includeRawData: true,
							},
						},
						isActive: true,
					},
				],
				sharedWith: [],
			},
			{
				id: 'template-3',
				name: 'Custom Integrity Check',
				description: 'Custom template for data integrity verification with advanced parameters',
				reportType: 'INTEGRITY_VERIFICATION',
				category: 'security',
				isPublic: false,
				createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
				updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
				createdBy: 'security@example.com',
				organizationId: 'org-1',
				usageCount: 18,
				tags: ['integrity', 'security', 'verification', 'custom'],
				version: '1.2.0',
				isActive: true,
				configuration: {
					criteria: {
						dateRange: { type: 'relative', value: '7d' },
						includeFields: ['timestamp', 'recordId', 'checksum'],
						groupBy: ['verificationStatus'],
						sortBy: ['timestamp'],
					},
					output: {
						format: 'json',
						includeCharts: false,
						includeRawData: true,
					},
				},
				shareSettings: {
					isPublic: false,
					allowPublicUse: false,
					allowPublicEdit: false,
					requireApproval: true,
				},
				versionHistory: [
					{
						version: '1.2.0',
						createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
						createdBy: 'security@example.com',
						changes: ['Added checksum verification', 'Improved anomaly detection'],
						configuration: {
							criteria: {
								dateRange: { type: 'relative', value: '7d' },
								includeFields: ['timestamp', 'recordId', 'checksum'],
								groupBy: ['verificationStatus'],
								sortBy: ['timestamp'],
							},
							output: {
								format: 'json',
								includeCharts: false,
								includeRawData: true,
							},
						},
						isActive: true,
					},
				],
				sharedWith: [],
			},
		]

		// Simulate API call
		setTimeout(() => {
			setTemplates(mockTemplates)
			setLoading(false)
		}, 1000)
	}, [])

	const getReportTypeLabel = (type: ReportTemplate['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'HIPAA Audit'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'GDPR Processing'
			case 'INTEGRITY_VERIFICATION':
				return 'Integrity Check'
			default:
				return type
		}
	}

	const getReportTypeBadgeVariant = (type: ReportTemplate['reportType']) => {
		switch (type) {
			case 'HIPAA_AUDIT_TRAIL':
				return 'default'
			case 'GDPR_PROCESSING_ACTIVITIES':
				return 'secondary'
			case 'INTEGRITY_VERIFICATION':
				return 'outline'
			default:
				return 'default'
		}
	}

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(date)
	}

	const handleSearch = (value: string) => {
		setParam('search', value || undefined)
		setParam('page', 1) // Reset to first page when searching
	}

	const handleReportTypeFilter = (value: string) => {
		setParam('reportType', value === 'all' ? undefined : (value as any))
		setParam('page', 1)
	}

	const handleCategoryFilter = (value: string) => {
		setParam('category', value === 'all' ? undefined : value)
		setParam('page', 1)
	}

	const handleCreateFromTemplate = (templateId: string) => {
		// TODO: Navigate to create report with template pre-selected
		console.log('Creating report from template:', templateId)
	}

	const handleDuplicateTemplate = (templateId: string) => {
		// TODO: Implement template duplication
		console.log('Duplicating template:', templateId)
	}

	const handleDeleteTemplate = (templateId: string) => {
		// TODO: Implement template deletion
		console.log('Deleting template:', templateId)
	}

	const handleCreateTemplate = async (data: CreateTemplateInput) => {
		// TODO: Implement template creation API call
		console.log('Creating template:', data)
		setShowCreateDialog(false)
	}

	const handleUpdateTemplate = async (data: UpdateTemplateInput) => {
		// TODO: Implement template update API call
		console.log('Updating template:', data)
		setShowEditDialog(false)
		setSelectedTemplate(null)
	}

	const handleViewTemplate = (template: ReportTemplate) => {
		setSelectedTemplate(template)
	}

	const handleEditTemplate = (template: ReportTemplate) => {
		setSelectedTemplate(template)
		setShowEditDialog(true)
	}

	const handleVersionManagement = (template: ReportTemplate) => {
		setSelectedTemplate(template)
		setShowVersionDialog(true)
	}

	const handleSharingManagement = (template: ReportTemplate) => {
		setSelectedTemplate(template)
		setShowSharingDialog(true)
	}

	if (loading) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Report Templates" description="Loading templates..." />
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex flex-col gap-6 p-6">
				<CompliancePageHeader title="Report Templates" description="Error loading templates" />
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-red-600">
							<p>Error: {error}</p>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex items-center justify-between">
				<CompliancePageHeader
					title="Report Templates"
					description="Manage and create report templates for automated compliance reporting"
					actions={[
						{
							label: 'Create Template',
							onClick: () => setShowCreateDialog(true),
							icon: Plus,
						},
					]}
				/>
				<ExportButton
					type="templates"
					data={templates}
					availableColumns={[
						{ key: 'name', label: 'Template Name', description: 'Name of the template' },
						{ key: 'reportType', label: 'Report Type', description: 'Type of compliance report' },
						{ key: 'category', label: 'Category', description: 'Template category' },
						{ key: 'createdBy', label: 'Created By', description: 'User who created the template' },
						{
							key: 'createdAt',
							label: 'Created Date',
							description: 'When the template was created',
						},
						{
							key: 'updatedAt',
							label: 'Updated Date',
							description: 'When the template was last updated',
						},
						{
							key: 'usageCount',
							label: 'Usage Count',
							description: 'Number of times template was used',
						},
						{ key: 'version', label: 'Version', description: 'Current template version' },
						{ key: 'isPublic', label: 'Public', description: 'Whether template is public' },
						{ key: 'tags', label: 'Tags', description: 'Template tags' },
					]}
					onExport={async (options) => {
						console.log('Exporting templates with options:', options)
						// TODO: Implement actual export logic
					}}
				/>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4 md:flex-row md:items-center">
						<div className="flex-1">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search templates..."
									value={state.search || ''}
									onChange={(e) => handleSearch(e.target.value)}
									className="pl-10"
								/>
							</div>
						</div>

						<Select value={state.reportType || 'all'} onValueChange={handleReportTypeFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Report Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="hipaa">HIPAA Audit</SelectItem>
								<SelectItem value="gdpr">GDPR Processing</SelectItem>
								<SelectItem value="custom">Integrity Check</SelectItem>
							</SelectContent>
						</Select>

						<Select value={state.category || 'all'} onValueChange={handleCategoryFilter}>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Categories</SelectItem>
								<SelectItem value="Healthcare">Healthcare</SelectItem>
								<SelectItem value="Privacy">Privacy</SelectItem>
								<SelectItem value="Security">Security</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Templates Table */}
			<Card>
				<CardHeader>
					<CardTitle>Templates ({templates.length})</CardTitle>
					<CardDescription>
						Available report templates for creating scheduled reports
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Category</TableHead>
								<TableHead>Visibility</TableHead>
								<TableHead>Usage</TableHead>
								<TableHead>Updated</TableHead>
								<TableHead className="w-[70px]">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{templates.map((template) => (
								<TableRow key={template.id}>
									<TableCell>
										<div>
											<div className="font-medium">{template.name}</div>
											{template.description && (
												<p className="text-sm text-muted-foreground">{template.description}</p>
											)}
											{template.tags.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1">
													{template.tags.slice(0, 3).map((tag) => (
														<Badge key={tag} variant="outline" className="text-xs">
															{tag}
														</Badge>
													))}
													{template.tags.length > 3 && (
														<Badge variant="outline" className="text-xs">
															+{template.tags.length - 3}
														</Badge>
													)}
												</div>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant={getReportTypeBadgeVariant(template.reportType)}>
											{getReportTypeLabel(template.reportType)}
										</Badge>
									</TableCell>
									<TableCell>{template.category}</TableCell>
									<TableCell>
										<Badge variant={template.isPublic ? 'default' : 'secondary'}>
											{template.isPublic ? 'Public' : 'Private'}
										</Badge>
									</TableCell>
									<TableCell>{template.usageCount} uses</TableCell>
									<TableCell>{formatDate(template.updatedAt)}</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" className="h-8 w-8 p-0">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuItem
													onClick={() => handleCreateFromTemplate(template.id)}
													className="flex items-center gap-2"
												>
													<FileText className="h-4 w-4" />
													Create Report
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleViewTemplate(template)}
													className="flex items-center gap-2"
												>
													<Eye className="h-4 w-4" />
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleEditTemplate(template)}
													className="flex items-center gap-2"
												>
													<Edit className="h-4 w-4" />
													Edit Template
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleDuplicateTemplate(template.id)}
													className="flex items-center gap-2"
												>
													<Copy className="h-4 w-4" />
													Duplicate
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleVersionManagement(template)}
													className="flex items-center gap-2"
												>
													<History className="h-4 w-4" />
													Version History
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleSharingManagement(template)}
													className="flex items-center gap-2"
												>
													<Share2 className="h-4 w-4" />
													Manage Sharing
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleDeleteTemplate(template.id)}
													className="flex items-center gap-2 text-red-600"
												>
													<Trash2 className="h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					{templates.length === 0 && (
						<div className="text-center py-8">
							<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground mb-4">No templates found</p>
							<Button onClick={() => setShowCreateDialog(true)}>
								<Plus className="h-4 w-4 mr-2" />
								Create Your First Template
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
					<CardDescription>Common template management tasks</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 md:grid-cols-3">
						<Button
							variant="outline"
							className="h-auto p-4 flex flex-col items-start gap-2"
							onClick={() => setShowCreateDialog(true)}
						>
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Create HIPAA Template</div>
								<div className="text-sm text-muted-foreground">Start with HIPAA audit template</div>
							</div>
						</Button>

						<Button
							variant="outline"
							className="h-auto p-4 flex flex-col items-start gap-2"
							onClick={() => setShowCreateDialog(true)}
						>
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Create GDPR Template</div>
								<div className="text-sm text-muted-foreground">
									Start with GDPR processing template
								</div>
							</div>
						</Button>

						<Button
							variant="outline"
							className="h-auto p-4 flex flex-col items-start gap-2"
							onClick={() => setShowCreateDialog(true)}
						>
							<FileText className="h-6 w-6" />
							<div className="text-left">
								<div className="font-medium">Custom Template</div>
								<div className="text-sm text-muted-foreground">Create a custom report template</div>
							</div>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Create Template Dialog */}
			{showCreateDialog && (
				<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
					<DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
						<TemplateForm
							mode="create"
							onSubmit={handleCreateTemplate}
							onCancel={() => setShowCreateDialog(false)}
							loading={loading}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Edit Template Dialog */}
			{showEditDialog && selectedTemplate && (
				<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
					<DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
						<TemplateForm
							mode="edit"
							initialData={selectedTemplate}
							onSubmit={handleUpdateTemplate}
							onCancel={() => {
								setShowEditDialog(false)
								setSelectedTemplate(null)
							}}
							loading={loading}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Template Details Dialog */}
			{selectedTemplate && !showEditDialog && !showVersionDialog && !showSharingDialog && (
				<Dialog open onOpenChange={() => setSelectedTemplate(null)}>
					<DialogContent className="max-w-4xl max-h-[90vh]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<FileText className="h-5 w-5" />
								{selectedTemplate.name}
								<Badge variant="outline">v{selectedTemplate.version}</Badge>
							</DialogTitle>
							<DialogDescription>{selectedTemplate.description}</DialogDescription>
						</DialogHeader>

						<Tabs defaultValue="details" className="w-full">
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger value="details">Details</TabsTrigger>
								<TabsTrigger value="versions">Versions</TabsTrigger>
								<TabsTrigger value="sharing">Sharing</TabsTrigger>
							</TabsList>

							<TabsContent value="details" className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label className="text-sm font-medium">Report Type</Label>
										<p className="text-sm text-muted-foreground">{selectedTemplate.reportType}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Category</Label>
										<p className="text-sm text-muted-foreground">{selectedTemplate.category}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Created By</Label>
										<p className="text-sm text-muted-foreground">{selectedTemplate.createdBy}</p>
									</div>
									<div>
										<Label className="text-sm font-medium">Usage Count</Label>
										<p className="text-sm text-muted-foreground">
											{selectedTemplate.usageCount} times
										</p>
									</div>
								</div>

								{selectedTemplate.tags.length > 0 && (
									<div>
										<Label className="text-sm font-medium">Tags</Label>
										<div className="flex flex-wrap gap-1 mt-1">
											{selectedTemplate.tags.map((tag) => (
												<Badge key={tag} variant="outline">
													{tag}
												</Badge>
											))}
										</div>
									</div>
								)}

								<div>
									<Label className="text-sm font-medium">Configuration</Label>
									<Card className="mt-2">
										<CardContent className="pt-4">
											<div className="space-y-2 text-sm">
												<div>
													<span className="font-medium">Output Format:</span>{' '}
													{selectedTemplate.configuration.output.format}
												</div>
												<div>
													<span className="font-medium">Date Range:</span>{' '}
													{selectedTemplate.configuration.criteria.dateRange?.type} -{' '}
													{selectedTemplate.configuration.criteria.dateRange?.value}
												</div>
												<div>
													<span className="font-medium">Include Charts:</span>{' '}
													{selectedTemplate.configuration.output.includeCharts ? 'Yes' : 'No'}
												</div>
											</div>
										</CardContent>
									</Card>
								</div>
							</TabsContent>

							<TabsContent value="versions">
								<TemplateVersionManager
									template={selectedTemplate}
									onVersionRestore={async (version) => {
										console.log('Restore version:', version)
									}}
									onVersionDelete={async (version) => {
										console.log('Delete version:', version)
									}}
									onVersionExport={async (version) => {
										console.log('Export version:', version)
									}}
									loading={loading}
								/>
							</TabsContent>

							<TabsContent value="sharing">
								<TemplateSharingManager
									template={selectedTemplate}
									onShareTemplate={async (shareData) => {
										console.log('Share template:', shareData)
									}}
									onUpdateShare={async (shareId, permissions) => {
										console.log('Update share:', shareId, permissions)
									}}
									onRevokeShare={async (shareId) => {
										console.log('Revoke share:', shareId)
									}}
									onUpdateShareSettings={async (settings) => {
										console.log('Update share settings:', settings)
									}}
									loading={loading}
								/>
							</TabsContent>
						</Tabs>
					</DialogContent>
				</Dialog>
			)}

			{/* Version Management Dialog */}
			{showVersionDialog && selectedTemplate && (
				<Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
					<DialogContent className="max-w-6xl max-h-[90vh]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<History className="h-5 w-5" />
								Version History - {selectedTemplate.name}
							</DialogTitle>
							<DialogDescription>
								Manage template versions and view changes over time
							</DialogDescription>
						</DialogHeader>

						<TemplateVersionManager
							template={selectedTemplate}
							onVersionRestore={async (version) => {
								console.log('Restore version:', version)
								setShowVersionDialog(false)
								setSelectedTemplate(null)
							}}
							onVersionDelete={async (version) => {
								console.log('Delete version:', version)
							}}
							onVersionExport={async (version) => {
								console.log('Export version:', version)
							}}
							loading={loading}
						/>
					</DialogContent>
				</Dialog>
			)}

			{/* Sharing Management Dialog */}
			{showSharingDialog && selectedTemplate && (
				<Dialog open={showSharingDialog} onOpenChange={setShowSharingDialog}>
					<DialogContent className="max-w-4xl max-h-[90vh]">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Share2 className="h-5 w-5" />
								Sharing - {selectedTemplate.name}
							</DialogTitle>
							<DialogDescription>Manage template sharing and permissions</DialogDescription>
						</DialogHeader>

						<TemplateSharingManager
							template={selectedTemplate}
							onShareTemplate={async (shareData) => {
								console.log('Share template:', shareData)
							}}
							onUpdateShare={async (shareId, permissions) => {
								console.log('Update share:', shareId, permissions)
							}}
							onRevokeShare={async (shareId) => {
								console.log('Revoke share:', shareId)
							}}
							onUpdateShareSettings={async (settings) => {
								console.log('Update share settings:', settings)
								setShowSharingDialog(false)
								setSelectedTemplate(null)
							}}
							loading={loading}
						/>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
