import { trpc } from '@/utils/trpc'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { createColumns } from '../presets/column'
import { DataTable } from '../presets/data-table'
import PresetForm from '../presets/form'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Spinner } from '../ui/kibo-ui/spinner'

import type { AuditPreset } from '@repo/audit'

function AuditPresets() {
	const { data: presets, isLoading } = useQuery(trpc.presets.all.queryOptions())
	const queryClient = useQueryClient()
	const queryKey = trpc.presets.all.queryKey()
	const [data, setData] = useState<AuditPreset[]>([])
	const [editingPreset, setEditingPreset] = useState<AuditPreset | null>(null)
	const [isDialogOpen, setIsDialogOpen] = useState(false)
	const columns = createColumns()
	const presetDelete = useMutation(trpc.presets.delete.mutationOptions())
	const presetCreate = useMutation(trpc.presets.create.mutationOptions())

	const handleCreate = (newRecord: AuditPreset) => {
		const record = { ...newRecord }
		setData([...data, record])
		setIsDialogOpen(false)
	}

	const handleUpdate = (updatedPreset: AuditPreset) => {
		setData(data.map((record) => (record.name === updatedPreset.name ? updatedPreset : record)))
		setIsDialogOpen(false)
		setEditingPreset(null)
	}

	const handleDelete = async (name: string) => {
		const result = await presetDelete.mutateAsync({ name })
		if (result.success) {
			toast.success(result.message)
			queryClient.invalidateQueries({ queryKey })
		} else {
			toast.error(result.message)
		}
	}

	const handlemultiDelete = (presets: AuditPreset[]) => {
		for (const preset of presets) {
			handleDelete(preset.name)
		}
	}

	const handleEdit = (record: AuditPreset) => {
		setEditingPreset(record)
		setIsDialogOpen(true)
	}

	const openCreateDialog = () => {
		setEditingPreset(null)
		setIsDialogOpen(true)
	}

	return (
		<div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingPreset ? 'Edit Preset' : 'Create New Preset'}</DialogTitle>
						<DialogDescription>
							Please fill out the form below to{' '}
							{editingPreset ? 'update the preset' : 'create a new preset'}.
						</DialogDescription>
					</DialogHeader>
					<div>
						<PresetForm
							onSubmit={editingPreset ? handleUpdate : handleCreate}
							initialData={editingPreset}
						/>
					</div>
				</DialogContent>
			</Dialog>
			{isLoading ? (
				<div className="flex flex-1 items-center justify-center">
					<Spinner variant="bars" size={64} />
				</div>
			) : (
				<DataTable
					columns={columns}
					data={presets ? presets : []}
					onAdd={openCreateDialog}
					onEdit={handleEdit}
					onDelete={handleDelete}
					onmultiDelete={handlemultiDelete}
				/>
			)}
		</div>
	)
}

export { AuditPresets }
