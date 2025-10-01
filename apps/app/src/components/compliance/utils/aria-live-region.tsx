import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface AriaLiveRegionProps {
	message: string
	politeness?: 'polite' | 'assertive' | 'off'
	clearOnUnmount?: boolean
	clearDelay?: number
}

/**
 * ARIA live region component for announcing dynamic content changes to screen readers
 */
export function AriaLiveRegion({
	message,
	politeness = 'polite',
	clearOnUnmount = true,
	clearDelay = 1000,
}: AriaLiveRegionProps) {
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
		<div aria-live={politeness} aria-atomic="true" className="sr-only" role="status">
			{currentMessage}
		</div>,
		document.body
	)
}

/**
 * Hook for managing ARIA live announcements
 */
export function useAriaLiveAnnouncer() {
	const [announcement, setAnnouncement] = useState('')
	const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite')

	const announce = (message: string, level: 'polite' | 'assertive' = 'polite') => {
		setPoliteness(level)
		setAnnouncement(message)
	}

	const announcePolite = (message: string) => announce(message, 'polite')
	const announceAssertive = (message: string) => announce(message, 'assertive')

	return {
		announcement,
		politeness,
		announce,
		announcePolite,
		announceAssertive,
		LiveRegion: () => <AriaLiveRegion message={announcement} politeness={politeness} />,
	}
}
