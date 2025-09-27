import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, Observable, Subject, throwError, timer } from 'rxjs'
import { catchError, map, retry, shareReplay, takeUntil, tap } from 'rxjs/operators'
import {
	AuditClient,
	AuditClientConfig,
	AuditEvent,
	CreateAuditEventInput,
	QueryAuditEventsParams,
	PaginatedAuditEvents,
	AuditClientError,
} from '@smedrec/audit-client'
import { AuditConfigService } from './audit-config.service'

export interface AuditServiceState {
	isConnected: boolean
	isLoading: boolean
	error: string | null
	events: AuditEvent[]
	pagination: any
	streamEvents: AuditEvent[]
	isStreaming: boolean
}

@Injectable({
	providedIn: 'root',
})
export class AuditService implements OnDestroy {
	private client: AuditClient | null = null
	private destroy$ = new Subject<void>()

	// State management
	private stateSubject = new BehaviorSubject<AuditServiceState>({
		isConnected: false,
		isLoading: false,
		error: null,
		events: [],
		pagination: null,
		streamEvents: [],
		isStreaming: false,
	})

	// Public observables
	public readonly state$ = this.stateSubject.asObservable()
	public readonly isConnected$ = this.state$.pipe(map((state) => state.isConnected))
	public readonly isLoading$ = this.state$.pipe(map((state) => state.isLoading))
	public readonly error$ = this.state$.pipe(map((state) => state.error))
	public readonly events$ = this.state$.pipe(
		map((state) => [...state.streamEvents, ...state.events])
	)
	public readonly pagination$ = this.state$.pipe(map((state) => state.pagination))
	public readonly isStreaming$ = this.state$.pipe(map((state) => state.isStreaming))

	constructor(private configService: AuditConfigService) {
		this.initializeClient()
	}

	ngOnDestroy() {
		this.destroy$.next()
		this.destroy$.complete()
		this.stopEventStream()
	}

	private updateState(updates: Partial<AuditServiceState>) {
		const currentState = this.stateSubject.value
		this.stateSubject.next({ ...currentState, ...updates })
	}

	private async initializeClient(): Promise<void> {
		try {
			this.updateState({ isLoading: true, error: null })

			const config = this.configService.getConfig()
			this.client = new AuditClient(config)

			// Test connection
			await this.client.health.check()

			this.updateState({
				isConnected: true,
				isLoading: false,
				error: null,
			})
		} catch (error) {
			const errorMessage =
				error instanceof AuditClientError ? error.message : 'Failed to initialize audit client'

			this.updateState({
				isConnected: false,
				isLoading: false,
				error: errorMessage,
			})

			console.error('Audit client initialization failed:', error)
		}
	}

	public reconnect(): Observable<void> {
		return new Observable((observer) => {
			this.initializeClient()
				.then(() => {
					observer.next()
					observer.complete()
				})
				.catch((error) => observer.error(error))
		})
	}

	public createEvent(eventData: CreateAuditEventInput): Observable<AuditEvent> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable<AuditEvent>((observer) => {
			this.client!.events.create(eventData)
				.then((event) => {
					// Add to local events
					const currentState = this.stateSubject.value
					this.updateState({
						events: [event, ...currentState.events],
					})

					observer.next(event)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to create audit event'
				this.updateState({ error: errorMessage })
				return throwError(() => error)
			})
		)
	}

	public bulkCreateEvents(events: CreateAuditEventInput[]): Observable<any> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable((observer) => {
			this.client!.events.bulkCreate(events)
				.then((result) => {
					// Refresh events list
					this.fetchEvents().subscribe()
					observer.next(result)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to bulk create events'
				this.updateState({ error: errorMessage })
				return throwError(() => error)
			})
		)
	}

	public fetchEvents(params: QueryAuditEventsParams = {}): Observable<PaginatedAuditEvents> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		this.updateState({ isLoading: true, error: null })

		return new Observable<PaginatedAuditEvents>((observer) => {
			const queryParams = {
				pagination: { limit: 20, offset: 0 },
				sort: { field: 'timestamp' as const, direction: 'desc' as const },
				...params,
			}

			this.client!.events.query(queryParams)
				.then((result) => {
					this.updateState({
						events: result.events,
						pagination: result.pagination,
						isLoading: false,
					})

					observer.next(result)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to fetch events'
				this.updateState({
					isLoading: false,
					error: errorMessage,
				})
				return throwError(() => error)
			}),
			shareReplay(1)
		)
	}

	public getEventById(id: string): Observable<AuditEvent | null> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable<AuditEvent | null>((observer) => {
			this.client!.events.getById(id)
				.then((event) => {
					observer.next(event)
					observer.complete()
				})
				.catch((error) => {
					if (error instanceof AuditClientError && error.message.includes('404')) {
						observer.next(null)
						observer.complete()
					} else {
						observer.error(error)
					}
				})
		}).pipe(
			retry(2),
			catchError((error) => {
				console.error('Failed to fetch event:', error)
				return throwError(() => error)
			})
		)
	}

	public startEventStream(params: any = {}): Observable<AuditEvent> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		if (this.stateSubject.value.isStreaming) {
			return throwError(() => new Error('Stream already active'))
		}

		this.updateState({ isStreaming: true })

		return new Observable<AuditEvent>((observer) => {
			try {
				// Note: This would use the actual streaming API
				const subscription = this.client!.events.subscribe({
					...params,
					onEvent: (event: AuditEvent) => {
						// Add to stream events
						const currentState = this.stateSubject.value
						const newStreamEvents = [event, ...currentState.streamEvents.slice(0, 99)]
						this.updateState({ streamEvents: newStreamEvents })

						observer.next(event)
					},
					onError: (error: Error) => {
						this.updateState({
							isStreaming: false,
							error: error.message,
						})
						observer.error(error)
					},
					onClose: () => {
						this.updateState({ isStreaming: false })
						observer.complete()
					},
				})

				// Return cleanup function
				return () => {
					this.updateState({ isStreaming: false })
					// subscription?.close()
				}
			} catch (error) {
				this.updateState({
					isStreaming: false,
					error: error instanceof Error ? error.message : 'Streaming failed',
				})
				observer.error(error)
			}
		}).pipe(takeUntil(this.destroy$), shareReplay(1))
	}

	public stopEventStream(): void {
		this.updateState({
			isStreaming: false,
			streamEvents: [],
		})
	}

	public clearStreamEvents(): void {
		this.updateState({ streamEvents: [] })
	}

	public generateComplianceReport(type: 'hipaa' | 'gdpr', criteria: any): Observable<any> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable((observer) => {
			const reportPromise =
				type === 'hipaa'
					? this.client!.compliance.generateHipaaReport(criteria)
					: this.client!.compliance.generateGdprReport(criteria)

			reportPromise
				.then((report) => {
					observer.next(report)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(1),
			catchError((error) => {
				const errorMessage =
					error instanceof AuditClientError
						? error.message
						: `Failed to generate ${type.toUpperCase()} report`
				this.updateState({ error: errorMessage })
				return throwError(() => error)
			})
		)
	}

	public getSystemHealth(): Observable<any> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable((observer) => {
			this.client!.health.detailed()
				.then((health) => {
					observer.next(health)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				console.error('Failed to fetch system health:', error)
				return throwError(() => error)
			})
		)
	}

	public getAuditPresets(): Observable<any[]> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable<any[]>((observer) => {
			this.client!.presets.list()
				.then((presets) => {
					observer.next(presets)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				console.error('Failed to fetch presets:', error)
				return throwError(() => error)
			}),
			shareReplay(1)
		)
	}

	public applyPreset(name: string, context: any): Observable<AuditEvent> {
		if (!this.client) {
			return throwError(() => new Error('Audit client not initialized'))
		}

		return new Observable<AuditEvent>((observer) => {
			this.client!.presets.apply(name, context)
				.then((event) => {
					// Add to local events
					const currentState = this.stateSubject.value
					this.updateState({
						events: [event, ...currentState.events],
					})

					observer.next(event)
					observer.complete()
				})
				.catch((error) => observer.error(error))
		}).pipe(
			retry(2),
			catchError((error) => {
				const errorMessage =
					error instanceof AuditClientError ? error.message : 'Failed to apply preset'
				this.updateState({ error: errorMessage })
				return throwError(() => error)
			})
		)
	}

	public clearError(): void {
		this.updateState({ error: null })
	}

	public clearEvents(): void {
		this.updateState({
			events: [],
			pagination: null,
		})
	}

	// Health monitoring with auto-refresh
	public startHealthMonitoring(intervalMs = 30000): Observable<any> {
		return timer(0, intervalMs).pipe(
			switchMap(() => this.getSystemHealth()),
			takeUntil(this.destroy$),
			shareReplay(1)
		)
	}

	// Form audit logging helper
	public logFormEvent(
		formName: string,
		action: string,
		details?: Record<string, any>
	): Observable<AuditEvent> {
		return this.createEvent({
			action: `form.${action}`,
			targetResourceType: 'form',
			targetResourceId: formName,
			principalId: 'current-user', // Replace with actual user ID
			organizationId: 'current-org', // Replace with actual org ID
			status: 'success',
			dataClassification: 'INTERNAL',
			details: {
				formName,
				...details,
			},
		})
	}
}
