import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuditContext } from '@/contexts/audit-provider'
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, Wifi, XCircle } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { SystemHealthStatus } from '../types'

interface SystemHealthProps {
	className?: string
}

export function SystemHealth({ className }: SystemHealthProps) {
	const { client, isConnected, error: contextError, reconnect } = useAuditContext()
	const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null)
	const [loading, setLoading] = useState(true)
	const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date())

	const performHealthCheck = async () => {
		setLoading(true)
		const checkStartTime = Date.now()

		try {
			if (!client) {
				setHealthStatus({
					isConnected: false,
					lastCheck: new Date().toISOString(),
					status: 'down',
					message: 'Audit client not initialized',
				})
				return
			}

			// Perform a simple health check by trying to fetch a small amount of data
			const startTime = Date.now()
			await client.scheduledReports.list({ limit: 1, offset: 0 })
			const responseTime = Date.now() - startTime

			setHealthStatus({
				isConnected: true,
				responseTime,
				lastCheck: new Date().toISOString(),
				status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'down',
				message:
					responseTime < 1000
						? 'All systems operational'
						: responseTime < 3000
							? 'Slower than usual response times'
							: 'High response times detected',
			})
		} catch (err) {
			console.error('Health check failed:', err)
			setHealthStatus({
				isConnected: false,
				lastCheck: new Date().toISOString(),
				status: 'down',
				message: err instanceof Error ? err.message : 'Connection failed',
			})
		} finally {
			setLoading(false)
			setLastCheckTime(new Date())
		}
	}

	useEffect(() => {
		performHealthCheck()

		// Perform health checks every 30 seconds
		const interval = setInterval(performHealthCheck, 30000)

		return () => clearInterval(interval)
	}, [client, isConnected])

	const getStatusIcon = (status: SystemHealthStatus['status']) => {
		switch (status) {
			case 'healthy':
				return <CheckCircle className="h-5 w-5 text-green-600" />
			case 'degraded':
				return <AlertTriangle className="h-5 w-5 text-yellow-600" />
			case 'down':
				return <XCircle className="h-5 w-5 text-red-600" />
			default:
				return <Clock className="h-5 w-5 text-gray-600" />
		}
	}

	const getStatusBadge = (status: SystemHealthStatus['status']) => {
		const variants = {
			healthy: { variant: 'default' as const, text: 'Healthy' },
			degraded: { variant: 'secondary' as const, text: 'Degraded' },
			down: { variant: 'destructive' as const, text: 'Down' },
		}

		const config = variants[status] || { variant: 'outline' as const, text: 'Unknown' }

		return (
			<Badge variant={config.variant} className="text-xs">
				{config.text}
			</Badge>
		)
	}

	const getStatusColor = (status: SystemHealthStatus['status']) => {
		switch (status) {
			case 'healthy':
				return 'text-green-600'
			case 'degraded':
				return 'text-yellow-600'
			case 'down':
				return 'text-red-600'
			default:
				return 'text-gray-600'
		}
	}

	const handleReconnect = async () => {
		setLoading(true)
		try {
			await reconnect()
			await performHealthCheck()
		} catch (err) {
			console.error('Reconnection failed:', err)
		}
	}

	if (loading && !healthStatus) {
		return (
			<Card className={className}>
				<CardHeader>
					<CardTitle>System Health</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<Skeleton className="h-5 w-5 rounded-full" />
								<Skeleton className="h-4 w-24" />
							</div>
							<Skeleton className="h-6 w-16" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-40" />
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-base font-medium">System Health</CardTitle>
				<Button
					variant="ghost"
					size="sm"
					onClick={performHealthCheck}
					disabled={loading}
					className="h-8 w-8 p-0"
				>
					<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
				</Button>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Connection Status */}
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							{healthStatus ? (
								getStatusIcon(healthStatus.status)
							) : (
								<Clock className="h-5 w-5 text-gray-600" />
							)}
							<div>
								<p className="text-sm font-medium">Audit System</p>
								<p className="text-xs text-muted-foreground">
									{healthStatus?.message || 'Checking connection...'}
								</p>
							</div>
						</div>
						{healthStatus && getStatusBadge(healthStatus.status)}
					</div>

					{/* Connection Details */}
					{healthStatus && (
						<div className="space-y-3 pt-2 border-t">
							{/* Response Time */}
							{healthStatus.responseTime && (
								<div className="flex items-center justify-between text-sm">
									<div className="flex items-center space-x-2">
										<Activity className="h-4 w-4 text-muted-foreground" />
										<span className="text-muted-foreground">Response Time</span>
									</div>
									<span
										className={`font-medium ${
											healthStatus.responseTime < 1000
												? 'text-green-600'
												: healthStatus.responseTime < 3000
													? 'text-yellow-600'
													: 'text-red-600'
										}`}
									>
										{healthStatus.responseTime}ms
									</span>
								</div>
							)}

							{/* Connection Status */}
							<div className="flex items-center justify-between text-sm">
								<div className="flex items-center space-x-2">
									<Wifi className="h-4 w-4 text-muted-foreground" />
									<span className="text-muted-foreground">Connection</span>
								</div>
								<span
									className={`font-medium ${healthStatus.isConnected ? 'text-green-600' : 'text-red-600'}`}
								>
									{healthStatus.isConnected ? 'Connected' : 'Disconnected'}
								</span>
							</div>

							{/* Last Check */}
							<div className="flex items-center justify-between text-sm">
								<div className="flex items-center space-x-2">
									<Clock className="h-4 w-4 text-muted-foreground" />
									<span className="text-muted-foreground">Last Check</span>
								</div>
								<span className="text-muted-foreground">
									{new Date(healthStatus.lastCheck).toLocaleTimeString()}
								</span>
							</div>
						</div>
					)}

					{/* Action Buttons */}
					{healthStatus && !healthStatus.isConnected && (
						<div className="pt-2 border-t">
							<Button
								variant="outline"
								size="sm"
								onClick={handleReconnect}
								disabled={loading}
								className="w-full"
							>
								{loading ? (
									<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								Reconnect
							</Button>
						</div>
					)}

					{/* Context Error Display */}
					{contextError && (
						<div className="pt-2 border-t">
							<div className="flex items-start space-x-2 p-2 bg-destructive/10 rounded-md">
								<XCircle className="h-4 w-4 text-destructive mt-0.5" />
								<div className="text-xs">
									<p className="font-medium text-destructive">Connection Error</p>
									<p className="text-muted-foreground">{contextError}</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
