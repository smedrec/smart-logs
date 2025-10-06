/**
 * Compliance History Manager Component
 *
 * Manages browser history and provides navigation history features
 * for compliance pages.
 */

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUrlStateHistory } from '@/lib/url-state-management'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronDown, Clock, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'

interface HistoryEntry {
	url: string
	timestamp: number
	title?: string
	routeName?: string
}

interface HistoryManagerProps {
	className?: string
	maxHistoryItems?: number
}

export function HistoryManager({ className, maxHistoryItems = 10 }: HistoryManagerProps) {
	const { getHistory, getRecentUrls } = useUrlStateHistory()
	const navigate = useNavigate()
	const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])

	// Update history entries when component mounts or history changes
	useEffect(() => {
		const updateHistory = () => {
			const history = getHistory()
			const complianceHistory = history.slice(0, maxHistoryItems).map((entry) => ({
				...entry,
				routeName: getRouteNameFromUrl(entry.url),
			}))

			setHistoryEntries(complianceHistory)
		}

		updateHistory()

		// Update history periodically
		const interval = setInterval(updateHistory, 5000)
		return () => clearInterval(interval)
	}, [getHistory, maxHistoryItems])

	const getRouteNameFromUrl = (url: string): string => {
		try {
			const urlObj = new URL(url)
			const pathname = urlObj.pathname

			if (pathname === '/compliance') {
				return 'Compliance Dashboard'
			} else if (pathname === '/compliance/scheduled-reports') {
				return 'Scheduled Reports'
			} else if (pathname === '/compliance/scheduled-reports/create') {
				return 'Create Report'
			} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)$/)) {
				const reportId = pathname.split('/')[3]
				return `Report ${reportId}`
			} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)\/edit$/)) {
				const reportId = pathname.split('/')[3]
				return `Edit Report ${reportId}`
			} else if (pathname.match(/^\/compliance\/scheduled-reports\/([^/]+)\/executions$/)) {
				const reportId = pathname.split('/')[3]
				return `Executions - ${reportId}`
			} else if (pathname === '/compliance/execution-history') {
				return 'Execution History'
			} else if (pathname === '/compliance/report-templates') {
				return 'Report Templates'
			} else if (pathname === '/alerts') {
				return 'Alerts Board'
			} else if (pathname === '/alerts/active') {
				return 'Active Alerts'
			} else if (pathname === '/alerts/acknowledged') {
				return 'Acknowledged Alerts'
			} else if (pathname === '/alerts/resolved') {
				return 'Resolved Alerts'
			}

			return 'Home'
		} catch {
			return 'Unknown Page'
		}
	}

	const formatTimestamp = (timestamp: number): string => {
		const now = Date.now()
		const diff = now - timestamp
		const minutes = Math.floor(diff / (1000 * 60))
		const hours = Math.floor(diff / (1000 * 60 * 60))
		const days = Math.floor(diff / (1000 * 60 * 60 * 24))

		if (minutes < 1) {
			return 'Just now'
		} else if (minutes < 60) {
			return `${minutes}m ago`
		} else if (hours < 24) {
			return `${hours}h ago`
		} else {
			return `${days}d ago`
		}
	}

	const handleNavigateToHistoryItem = (entry: HistoryEntry) => {
		try {
			const urlObj = new URL(entry.url)
			const pathname = urlObj.pathname
			const search = Object.fromEntries(urlObj.searchParams.entries())

			navigate({
				to: pathname as any,
				search,
			})
		} catch (error) {
			console.error('Failed to navigate to history item:', error)
		}
	}

	if (historyEntries.length === 0) {
		return null
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className={className}>
					<Clock className="h-4 w-4 mr-2" />
					History
					<ChevronDown className="h-4 w-4 ml-2" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<DropdownMenuLabel>Recent Compliance Pages</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{historyEntries.map((entry, index) => (
					<DropdownMenuItem
						key={`${entry.url}-${index}`}
						className="flex items-center justify-between p-3 cursor-pointer"
						onClick={() => handleNavigateToHistoryItem(entry)}
					>
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm truncate">
								{entry.routeName || entry.title || 'Unknown Page'}
							</div>
							<div className="text-xs text-muted-foreground truncate">
								{formatTimestamp(entry.timestamp)}
							</div>
						</div>
						<ExternalLink className="h-3 w-3 ml-2 flex-shrink-0" />
					</DropdownMenuItem>
				))}

				{historyEntries.length === 0 && (
					<DropdownMenuItem disabled>
						<div className="text-sm text-muted-foreground">No recent compliance pages</div>
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/**
 * Shareable URL Component
 *
 * Provides functionality to copy and share current page URL
 */
interface ShareableUrlProps {
	className?: string
	title?: string
	description?: string
}

export function ShareableUrl({ className, title, description }: ShareableUrlProps) {
	const [copied, setCopied] = useState(false)

	const handleCopyUrl = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			console.error('Failed to copy URL:', error)
		}
	}

	const handleShare = async () => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: title || document.title,
					text: description,
					url: window.location.href,
				})
			} catch (error) {
				console.error('Failed to share:', error)
				// Fallback to copying URL
				handleCopyUrl()
			}
		} else {
			// Fallback to copying URL
			handleCopyUrl()
		}
	}

	return (
		<Button variant="ghost" size="sm" className={className} onClick={handleShare}>
			<ExternalLink className="h-4 w-4 mr-2" />
			{copied ? 'Copied!' : 'Share'}
		</Button>
	)
}

/**
 * Browser Navigation Controls
 *
 * Provides back/forward navigation controls
 */
interface BrowserNavigationProps {
	className?: string
	showLabels?: boolean
}

export function BrowserNavigation({ className, showLabels = false }: BrowserNavigationProps) {
	const [canGoBack, setCanGoBack] = useState(false)
	const [canGoForward, setCanGoForward] = useState(false)

	useEffect(() => {
		const updateNavigationState = () => {
			setCanGoBack(window.history.length > 1)
			// Note: There's no reliable way to detect if forward navigation is available
			// This is a limitation of the browser history API
			setCanGoForward(false)
		}

		updateNavigationState()

		// Listen for popstate events to update navigation state
		window.addEventListener('popstate', updateNavigationState)
		return () => window.removeEventListener('popstate', updateNavigationState)
	}, [])

	const handleGoBack = () => {
		window.history.back()
	}

	const handleGoForward = () => {
		window.history.forward()
	}

	return (
		<div className={`flex items-center gap-1 ${className}`}>
			<Button
				variant="ghost"
				size="sm"
				onClick={handleGoBack}
				disabled={!canGoBack}
				title="Go back"
			>
				<ChevronDown className="h-4 w-4 rotate-90" />
				{showLabels && <span className="ml-1">Back</span>}
			</Button>

			<Button
				variant="ghost"
				size="sm"
				onClick={handleGoForward}
				disabled={!canGoForward}
				title="Go forward"
			>
				<ChevronDown className="h-4 w-4 -rotate-90" />
				{showLabels && <span className="ml-1">Forward</span>}
			</Button>
		</div>
	)
}
