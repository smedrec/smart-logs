/**
 * Context for sharing alert announcements across components
 */ import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface AlertAriaLiveRegionProps {
	message: string
	politeness?: 'polite' | 'assertive' | 'off'
	clearOnUnmount?: boolean
	clearDelay?: number
}

/**
 * ARIA live region component specifically for alert announcements
 * Announces dynamic content changes to screen readers
 */
export function AlertAriaLiveRegion({
	message,
	politeness = 'polite',
	clearOnUnmount = true,
	clearDelay = 1000,
}: AlertAriaLiveRegionProps) {
	const [currentMessage, setCurrentMessage] = useState('')
	const timeoutRef = useRef<NodeJS.Timeout>()

	useEffect(() => {
		if (message) {
			setCurrentMessage(message)

			// Clear the message after a delay to allow for re-announcements
			if (clearDelay > 0) {
				timeoutRef.current = setTimeout(() => {
					setCurrentMessage('')
				}, clearDelay)
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [message, clearDelay])

	useEffect(() => {
		return () => {
			if (clearOnUnmount && timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [clearOnUnmount])

	// Create a portal to render the live region at the document level
	return createPortal(
		<div
			aria-live={politeness}
			aria-atomic="true"
			className="sr-only"
			role="status"
			id="alert-live-region"
		>
			{currentMessage}
		</div>,
		document.body
	)
}

/**
 * Hook for managing ARIA live announcements for alerts
 */
export function useAlertAriaLiveAnnouncer() {
	const [announcement, setAnnouncement] = useState('')
	const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite')

	const announce = (message: string, level: 'polite' | 'assertive' = 'polite') => {
		setPoliteness(level)
		setAnnouncement(message)
	}

	const announcePolite = (message: string) => announce(message, 'polite')
	const announceAssertive = (message: string) => announce(message, 'assertive')

	// Specific alert announcement methods
	const announceAlertCreated = (alertTitle: string, severity: string) => {
		announceAssertive(`New ${severity} alert created: ${alertTitle}`)
	}

	const announceAlertUpdated = (alertTitle: string, newStatus: string) => {
		announcePolite(`Alert "${alertTitle}" status changed to ${newStatus}`)
	}

	const announceAlertAction = (action: string, alertTitle: string) => {
		announcePolite(`Alert "${alertTitle}" has been ${action}`)
	}

	const announceFilterChange = (filterType: string, value: string, resultCount: number) => {
		announcePolite(`Filtered by ${filterType}: ${value}. Showing ${resultCount} alerts`)
	}

	const announceViewChange = (viewName: string) => {
		announcePolite(`Switched to ${viewName} view`)
	}

	const announceSearchResults = (query: string, resultCount: number) => {
		announcePolite(`Search for "${query}" returned ${resultCount} results`)
	}

	const announceBulkAction = (action: string, count: number) => {
		announcePolite(`${action} applied to ${count} alerts`)
	}

	return {
		announcement,
		politeness,
		announce,
		announcePolite,
		announceAssertive,
		announceAlertCreated,
		announceAlertUpdated,
		announceAlertAction,
		announceFilterChange,
		announceViewChange,
		announceSearchResults,
		announceBulkAction,
		LiveRegion: () => <AlertAriaLiveRegion message={announcement} politeness={politeness} />,
	}
}

interface AlertAnnouncementContextType {
	announce: (message: string, level?: 'polite' | 'assertive') => void
	announceAlertCreated: (alertTitle: string, severity: string) => void
	announceAlertUpdated: (alertTitle: string, newStatus: string) => void
	announceAlertAction: (action: string, alertTitle: string) => void
	announceFilterChange: (filterType: string, value: string, resultCount: number) => void
	announceViewChange: (viewName: string) => void
	announceSearchResults: (query: string, resultCount: number) => void
	announceBulkAction: (action: string, count: number) => void
}

const AlertAnnouncementContext = createContext<AlertAnnouncementContextType | null>(null)

export function AlertAnnouncementProvider({ children }: { children: React.ReactNode }) {
	const announcer = useAlertAriaLiveAnnouncer()

	return (
		<AlertAnnouncementContext.Provider value={announcer}>
			{children}
			<announcer.LiveRegion />
		</AlertAnnouncementContext.Provider>
	)
}

export function useAlertAnnouncement() {
	const context = useContext(AlertAnnouncementContext)
	if (!context) {
		throw new Error('useAlertAnnouncement must be used within an AlertAnnouncementProvider')
	}
	return context
}

export default AlertAriaLiveRegion
