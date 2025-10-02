/**
 * Template Sharing Manager Component
 *
 * Manages template sharing, permissions, and collaboration
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
	Calendar,
	CheckCircle,
	Clock,
	Copy,
	Edit,
	Eye,
	Globe,
	Lock,
	Mail,
	MoreHorizontal,
	Share2,
	Shield,
	Trash2,
	UserPlus,
	Users,
	XCircle,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import type { ReportTemplate, TemplatePermission, TemplateShare } from './template-types'

interface TemplateSharingManagerProps {
	template: ReportTemplate
	onShareTemplate?: (shareData: ShareTemplateData) => Promise<void>
	onUpdateShare?: (shareId: string, permissions: TemplatePermission[]) => Promise<void>
	onRevokeShare?: (shareId: string) => Promise<void>
	onUpdateShareSettings?: (settings: Partial<ReportTemplate['shareSettings']>) => Promise<void>
	loading?: boolean
}

interface ShareTemplateData {
	sharedWith: string // email or user ID
	permissions: TemplatePermission[]
	expiresAt?: Date
	message?: string
}

interface ShareTemplateDialogProps {
	template: ReportTemplate
	onShare: (shareData: ShareTemplateData) => Promise<void>
	onClose: () => void
	loading?: boolean
}

function ShareTemplateDialog({ template, onShare, onClose, loading }: ShareTemplateDialogProps) {
	const [shareData, setShareData] = useState<Partial<ShareTemplateData>>({
		sharedWith: '',
		permissions: [
			{ action: 'view', granted: true },
			{ action: 'use', granted: true },
			{ action: 'edit', granted: false },
			{ action: 'share', granted: false },
		],
		message: '',
	})

	const [expirationEnabled, setExpirationEnabled] = useState(false)
	const [expirationDays, setExpirationDays] = useState(30)

	const handlePermissionChange = useCallback((action: string, granted: boolean) => {
		setShareData((prev) => ({
			...prev,
			permissions:
				prev.permissions?.map((p) => (p.action === action ? { ...p, granted } : p)) || [],
		}))
	}, [])

	const handleShare = useCallback(async () => {
		if (!shareData.sharedWith?.trim()) return

		const finalShareData: ShareTemplateData = {
			sharedWith: shareData.sharedWith.trim(),
			permissions: shareData.permissions || [],
			message: shareData.message,
		}

		if (expirationEnabled) {
			finalShareData.expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
		}

		await onShare(finalShareData)
		onClose()
	}, [shareData, expirationEnabled, expirationDays, onShare, onClose])

	const getPermissionDescription = (action: string) => {
		switch (action) {
			case 'view':
				return 'Can view template details and configuration'
			case 'use':
				return 'Can create reports using this template'
			case 'edit':
				return 'Can modify template configuration'
			case 'share':
				return 'Can share template with others'
			default:
				return ''
		}
	}

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Share Template</DialogTitle>
					<DialogDescription>
						Share "{template.name}" with others in your organization
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="sharedWith">Email or Username</Label>
						<Input
							id="sharedWith"
							type="email"
							placeholder="user@example.com"
							value={shareData.sharedWith || ''}
							onChange={(e) => setShareData((prev) => ({ ...prev, sharedWith: e.target.value }))}
						/>
					</div>

					<div className="space-y-3">
						<Label>Permissions</Label>
						{shareData.permissions?.map((permission) => (
							<div key={permission.action} className="flex items-start space-x-3">
								<Checkbox
									id={permission.action}
									checked={permission.granted}
									onCheckedChange={(checked) =>
										handlePermissionChange(permission.action, !!checked)
									}
								/>
								<div className="space-y-1">
									<Label htmlFor={permission.action} className="text-sm font-medium capitalize">
										{permission.action}
									</Label>
									<p className="text-xs text-muted-foreground">
										{getPermissionDescription(permission.action)}
									</p>
								</div>
							</div>
						))}
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="flex items-center space-x-2">
							<Switch
								id="expiration"
								checked={expirationEnabled}
								onCheckedChange={setExpirationEnabled}
							/>
							<Label htmlFor="expiration">Set expiration date</Label>
						</div>

						{expirationEnabled && (
							<div className="space-y-2">
								<Label htmlFor="expirationDays">Expires in (days)</Label>
								<Select
									value={expirationDays.toString()}
									onValueChange={(value) => setExpirationDays(parseInt(value))}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="7">7 days</SelectItem>
										<SelectItem value="30">30 days</SelectItem>
										<SelectItem value="90">90 days</SelectItem>
										<SelectItem value="365">1 year</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="message">Message (optional)</Label>
						<Input
							id="message"
							placeholder="Add a message for the recipient"
							value={shareData.message || ''}
							onChange={(e) => setShareData((prev) => ({ ...prev, message: e.target.value }))}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleShare} disabled={!shareData.sharedWith?.trim() || loading}>
						{loading && (
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
						)}
						Share Template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export function TemplateSharingManager({
	template,
	onShareTemplate,
	onUpdateShare,
	onRevokeShare,
	onUpdateShareSettings,
	loading,
}: TemplateSharingManagerProps) {
	const [showShareDialog, setShowShareDialog] = useState(false)

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}).format(date)
	}

	const getPermissionBadges = (permissions: TemplatePermission[]) => {
		return permissions
			.filter((p) => p.granted)
			.map((p) => p.action)
			.join(', ')
	}

	const handleShareSettingChange = useCallback(
		async (setting: string, value: any) => {
			if (onUpdateShareSettings) {
				await onUpdateShareSettings({ [setting]: value })
			}
		},
		[onUpdateShareSettings]
	)

	const handleShareTemplate = useCallback(
		async (shareData: ShareTemplateData) => {
			if (onShareTemplate) {
				await onShareTemplate(shareData)
			}
		},
		[onShareTemplate]
	)

	const handleUpdateShare = useCallback(
		async (shareId: string, permissions: TemplatePermission[]) => {
			if (onUpdateShare) {
				await onUpdateShare(shareId, permissions)
			}
		},
		[onUpdateShare]
	)

	const handleRevokeShare = useCallback(
		async (shareId: string) => {
			if (onRevokeShare) {
				await onRevokeShare(shareId)
			}
		},
		[onRevokeShare]
	)

	const copyShareLink = useCallback(() => {
		const shareUrl = `${window.location.origin}/compliance/templates/${template.id}/shared`
		navigator.clipboard.writeText(shareUrl)
		// TODO: Show toast notification
	}, [template.id])

	const shares = template.sharedWith || []
	const activeShares = shares.filter(
		(share) => !share.expiresAt || new Date(share.expiresAt) > new Date()
	)
	const expiredShares = shares.filter(
		(share) => share.expiresAt && new Date(share.expiresAt) <= new Date()
	)

	return (
		<div className="space-y-6">
			{/* Share Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Share2 className="h-5 w-5" />
						Sharing Settings
					</CardTitle>
					<CardDescription>Control how this template can be shared and accessed</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<Label className="text-sm font-medium">Public Template</Label>
							<p className="text-sm text-muted-foreground">
								Make this template visible to all users in your organization
							</p>
						</div>
						<Switch
							checked={template.shareSettings.isPublic}
							onCheckedChange={(checked) => handleShareSettingChange('isPublic', checked)}
						/>
					</div>

					{template.shareSettings.isPublic && (
						<>
							<Separator />
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label className="text-sm font-medium">Allow Public Use</Label>
										<p className="text-sm text-muted-foreground">
											Allow anyone to create reports using this template
										</p>
									</div>
									<Switch
										checked={template.shareSettings.allowPublicUse}
										onCheckedChange={(checked) =>
											handleShareSettingChange('allowPublicUse', checked)
										}
									/>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label className="text-sm font-medium">Allow Public Edit</Label>
										<p className="text-sm text-muted-foreground">
											Allow anyone to modify this template
										</p>
									</div>
									<Switch
										checked={template.shareSettings.allowPublicEdit}
										onCheckedChange={(checked) =>
											handleShareSettingChange('allowPublicEdit', checked)
										}
									/>
								</div>

								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<Label className="text-sm font-medium">Require Approval</Label>
										<p className="text-sm text-muted-foreground">
											Require approval before sharing with external users
										</p>
									</div>
									<Switch
										checked={template.shareSettings.requireApproval}
										onCheckedChange={(checked) =>
											handleShareSettingChange('requireApproval', checked)
										}
									/>
								</div>
							</div>
						</>
					)}

					<Separator />

					<div className="flex items-center gap-2">
						<Button onClick={() => setShowShareDialog(true)} className="flex-1">
							<UserPlus className="h-4 w-4 mr-2" />
							Share with User
						</Button>
						<Button variant="outline" onClick={copyShareLink}>
							<Copy className="h-4 w-4 mr-2" />
							Copy Link
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Active Shares */}
			{activeShares.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Shared With ({activeShares.length})
						</CardTitle>
						<CardDescription>Users who currently have access to this template</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{activeShares.map((share) => (
								<div
									key={share.id}
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarImage src={`https://avatar.vercel.sh/${share.sharedWith}`} />
											<AvatarFallback>{share.sharedWith.slice(0, 2).toUpperCase()}</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-medium">{share.sharedWith}</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>{getPermissionBadges(share.permissions)}</span>
												{share.expiresAt && (
													<>
														<span>•</span>
														<div className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															Expires {formatDate(share.expiresAt)}
														</div>
													</>
												)}
											</div>
										</div>
									</div>

									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-green-600">
											<CheckCircle className="h-3 w-3 mr-1" />
											Active
										</Badge>

										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="sm">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Share Actions</DropdownMenuLabel>
												<DropdownMenuItem>
													<Eye className="h-4 w-4 mr-2" />
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem>
													<Edit className="h-4 w-4 mr-2" />
													Edit Permissions
												</DropdownMenuItem>
												<DropdownMenuItem>
													<Mail className="h-4 w-4 mr-2" />
													Send Reminder
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<DropdownMenuItem
															className="text-red-600"
															onSelect={(e) => e.preventDefault()}
														>
															<Trash2 className="h-4 w-4 mr-2" />
															Revoke Access
														</DropdownMenuItem>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Revoke Access</AlertDialogTitle>
															<AlertDialogDescription>
																Are you sure you want to revoke {share.sharedWith}'s access to this
																template?
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => handleRevokeShare(share.id)}
																className="bg-red-600 hover:bg-red-700"
															>
																Revoke Access
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Expired Shares */}
			{expiredShares.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Expired Shares ({expiredShares.length})
						</CardTitle>
						<CardDescription>Shares that have expired and no longer have access</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{expiredShares.map((share) => (
								<div
									key={share.id}
									className="flex items-center justify-between p-3 border rounded-lg opacity-60"
								>
									<div className="flex items-center gap-3">
										<Avatar className="h-8 w-8">
											<AvatarImage src={`https://avatar.vercel.sh/${share.sharedWith}`} />
											<AvatarFallback>{share.sharedWith.slice(0, 2).toUpperCase()}</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-medium">{share.sharedWith}</p>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>Expired {formatDate(share.expiresAt!)}</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-red-600">
											<XCircle className="h-3 w-3 mr-1" />
											Expired
										</Badge>

										<Button variant="ghost" size="sm" onClick={() => handleRevokeShare(share.id)}>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Empty State */}
			{activeShares.length === 0 && expiredShares.length === 0 && (
				<Card>
					<CardContent className="pt-6">
						<div className="text-center py-8">
							<Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
							<p className="text-muted-foreground mb-4">This template hasn't been shared yet</p>
							<Button onClick={() => setShowShareDialog(true)}>
								<UserPlus className="h-4 w-4 mr-2" />
								Share Template
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Share Dialog */}
			{showShareDialog && (
				<ShareTemplateDialog
					template={template}
					onShare={handleShareTemplate}
					onClose={() => setShowShareDialog(false)}
					loading={loading}
				/>
			)}
		</div>
	)
}
