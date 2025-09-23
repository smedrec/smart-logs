import { ComingSoon } from '@/components/pages/coming-soon'
/**import { createColumns } from '@/components/templates/column'
import { DataTable } from '@/components/templates/data-table'
import ReportTemplateForm from '@/components/templates/form'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/kibo-ui/spinner'
import { trpc } from '@/utils/trpc'
import { useQuery } from '@tanstack/react-query' */
import { createFileRoute } from '@tanstack/react-router'

/**import { useState } from 'react'

import type { ReportTemplate, ReportTemplateData } from '@/types/report-templates'*/

export const Route = createFileRoute('/dashboard/compliance/report-templates')({
	component: RouteComponent,
})

function RouteComponent() {
	return <ComingSoon />
}
/**
function RouteComponent() {
	const [data, setData] = useState<ReportTemplate[] | ReportTemplateData[]>([])
	const [editingTemplate, setEditingTemplate] = useState<ReportTemplateData | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const { data: templates, isLoading } = useQuery(trpc.templates.all.queryOptions({}))
	const columns = createColumns()

	const handleCreate = (newRecord: ReportTemplateData) => {
		setData([...data, newRecord])
		setIsDialogOpen(false)
	}

	const handleUpdate = (updatedTemplate: ReportTemplate) => {
		setData(data.map((record) => (record.id === updatedTemplate.id ? updatedTemplate : record)))
		setIsDialogOpen(false)
		setEditingTemplate(null)
	}

	const handleDelete = (id: string) => {
		setData(templates.filter((record) => record.id !== id))
	}

	const handleEdit = (record: ReportTemplate) => {
		setEditingTemplate(record)
		setIsDialogOpen(true)
	}

	const openCreateDialog = () => {
		setEditingTemplate(null)
		setIsDialogOpen(true)
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="#">Compliance</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Report Templates</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingTemplate ? 'Update' : 'Create New'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to{' '}
							{editingTemplate ? 'update the report template' : 'create a new report template'}.
						</DialogDescription>
					</DialogHeader>
					<div>
						<ReportTemplateForm
							onSubmit={editingTemplate ? handleUpdate : handleCreate}
							initialData={editingTemplate}
						/>
					</div>
				</DialogContent>
			</Dialog>
			<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
				{isLoading ? (
					<div className="flex flex-1 items-center justify-center">
						<Spinner variant="bars" size={64} />
					</div>
				) : (
					<DataTable
						columns={columns}
						data={templates}
						onAdd={openCreateDialog}
						onEdit={handleEdit}
						onDelete={handleDelete}
					/>
				)}
			</div>
		</div>
	)
}
 */
