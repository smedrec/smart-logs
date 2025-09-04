# Events Service

The Events Service provides comprehensive audit event management capabilities for the Smart Logs Audit Client Library. It implements all requirements for creating, querying, verifying, and managing audit events with advanced features like real-time subscriptions, streaming, and export functionality.

## Features

### Core Operations

- ✅ **Create single audit events** - Validate and submit individual events
- ✅ **Bulk create audit events** - Process multiple events in a single request
- ✅ **Query with advanced filtering** - Support for complex filters, pagination, and sorting
- ✅ **Retrieve events by ID** - Get specific audit events
- ✅ **Verify event integrity** - Cryptographic verification of event data

### Advanced Capabilities

- ✅ **Export functionality** - Export events in multiple formats (JSON, CSV, XML)
- ✅ **Streaming support** - Handle large datasets with streaming responses
- ✅ **Real-time subscriptions** - WebSocket and Server-Sent Events support
- ✅ **Statistics and analytics** - Get comprehensive event statistics
- ✅ **Compression and encryption** - Support for data compression and encryption

## Requirements Compliance

This implementation satisfies all requirements from the specification:

- **4.1** - WHEN creating audit events THEN the client SHALL validate event data and submit to the server API
- **4.2** - WHEN querying audit events THEN the client SHALL support filtering, pagination, and sorting options
- **4.3** - WHEN retrieving specific events THEN the client SHALL provide methods to get events by ID
- **4.4** - WHEN verifying event integrity THEN the client SHALL provide cryptographic verification methods
- **4.5** - WHEN handling large result sets THEN the client SHALL support pagination and streaming responses

## Usage Examples

### Basic Usage

```typescript
import { EventsService } from '@smart-logs/audit-client'

const eventsService = new EventsService(config)

// Create a single audit event
const event = await eventsService.create({
	action: 'user.login',
	targetResourceType: 'User',
	targetResourceId: 'user-123',
	principalId: 'user-123',
	organizationId: 'org-456',
	status: 'success',
	dataClassification: 'INTERNAL',
	outcomeDescription: 'User logged in successfully',
})
```

### Advanced Querying

```typescript
// Query with complex filters
const results = await eventsService.query({
	filter: {
		dateRange: {
			startDate: '2023-10-01T00:00:00.000Z',
			endDate: '2023-10-31T23:59:59.999Z',
		},
		principalIds: ['user-123', 'user-456'],
		actions: ['user.login', 'data.read'],
		statuses: ['success'],
		dataClassifications: ['PHI', 'CONFIDENTIAL'],
		verifiedOnly: true,
	},
	pagination: {
		limit: 50,
		offset: 0,
	},
	sort: {
		field: 'timestamp',
		direction: 'desc',
	},
})
```

### Bulk Operations

```typescript
// Create multiple events at once
const bulkResult = await eventsService.bulkCreate([
	{
		action: 'data.read',
		targetResourceType: 'Patient',
		principalId: 'doctor-123',
		organizationId: 'hospital-456',
		status: 'success',
		dataClassification: 'PHI',
	},
	{
		action: 'data.update',
		targetResourceType: 'Patient',
		principalId: 'doctor-123',
		organizationId: 'hospital-456',
		status: 'success',
		dataClassification: 'PHI',
	},
])

console.log(`${bulkResult.successful}/${bulkResult.total} events created successfully`)
```

### Event Verification

```typescript
// Verify event integrity
const verification = await eventsService.verify('event-123')

if (verification.isValid) {
	console.log('Event integrity verified')
} else {
	console.log('Event integrity check failed')
	console.log('Computed hash:', verification.computedHash)
	console.log('Stored hash:', verification.storedHash)
}
```

### Export and Download

```typescript
// Export events
const exportResult = await eventsService.export({
	format: 'json',
	filter: {
		dateRange: {
			startDate: '2023-10-01T00:00:00.000Z',
			endDate: '2023-10-31T23:59:59.999Z',
		},
	},
	compression: 'gzip',
	encryption: {
		enabled: true,
		algorithm: 'AES-256-GCM',
	},
})

// Download the exported file
const blob = await eventsService.downloadExport(exportResult.exportId, 'json')
```

### Streaming Large Datasets

```typescript
// Stream events for large datasets
const stream = await eventsService.stream({
	filter: {
		dateRange: {
			startDate: '2023-01-01T00:00:00.000Z',
			endDate: '2023-12-31T23:59:59.999Z',
		},
	},
	batchSize: 1000,
	format: 'ndjson',
})

const reader = stream.getReader()
let eventCount = 0

while (true) {
	const { done, value } = await reader.read()
	if (done) break

	eventCount++
	// Process each event
}

console.log(`Processed ${eventCount} events`)
```

### Real-time Subscriptions

```typescript
// Subscribe to real-time events
const subscription = eventsService.subscribe({
	filter: {
		actions: ['user.login', 'data.access'],
		principalIds: ['doctor-123'],
	},
	transport: 'websocket',
	reconnect: true,
	maxReconnectAttempts: 5,
})

// Handle events
subscription.on('message', (event) => {
	console.log('Real-time event:', event)
})

subscription.on('error', (error) => {
	console.error('Subscription error:', error)
})

// Connect
await subscription.connect()

// Update filter dynamically
subscription.updateFilter({
	actions: ['data.read', 'data.write'],
})

// Disconnect when done
subscription.disconnect()
```

### Statistics and Analytics

```typescript
// Get event statistics
const stats = await eventsService.getStatistics({
	dateRange: {
		startDate: '2023-10-01T00:00:00.000Z',
		endDate: '2023-10-31T23:59:59.999Z',
	},
	groupBy: 'day',
	filters: {
		dataClassifications: ['PHI'],
	},
})

console.log('Total events:', stats.totalEvents)
console.log('Events by status:', stats.eventsByStatus)
console.log('Events by action:', stats.eventsByAction)
```

## API Reference

### EventsService Methods

#### `create(event: CreateAuditEventInput): Promise<AuditEvent>`

Creates a single audit event.

#### `bulkCreate(events: CreateAuditEventInput[]): Promise<BulkCreateResult>`

Creates multiple audit events in a single request.

#### `query(params?: QueryAuditEventsParams): Promise<PaginatedAuditEvents>`

Queries audit events with filtering, pagination, and sorting.

#### `getById(id: string): Promise<AuditEvent | null>`

Retrieves a specific audit event by ID.

#### `verify(id: string): Promise<IntegrityVerificationResult>`

Verifies the cryptographic integrity of an audit event.

#### `export(params: ExportEventsParams): Promise<ExportResult>`

Exports audit events in various formats.

#### `stream(params: StreamEventsParams): Promise<ReadableStream<AuditEvent>>`

Streams audit events for large datasets.

#### `subscribe(params: SubscriptionParams): EventSubscription`

Creates a real-time event subscription.

#### `downloadExport(exportId: string, format?: string): Promise<Blob>`

Downloads an exported audit events file.

#### `getExportStatus(exportId: string): Promise<ExportStatus>`

Gets the status of an export request.

#### `getStatistics(params: StatisticsParams): Promise<EventStatistics>`

Gets comprehensive audit event statistics.

### Type Definitions

#### `AuditEvent`

Complete audit event with all metadata.

#### `CreateAuditEventInput`

Input data for creating audit events.

#### `QueryAuditEventsParams`

Parameters for querying events with filters, pagination, and sorting.

#### `PaginatedAuditEvents`

Paginated response containing events and pagination metadata.

#### `IntegrityVerificationResult`

Result of cryptographic integrity verification.

#### `ExportResult`

Information about an export operation.

#### `EventSubscription`

Interface for managing real-time event subscriptions.

## Error Handling

The Events Service integrates with the comprehensive error handling system:

```typescript
try {
	const event = await eventsService.create(eventData)
} catch (error) {
	if (error.code === 'VALIDATION_ERROR') {
		console.log('Validation failed:', error.details)
	} else if (error.code === 'NETWORK_ERROR') {
		console.log('Network issue:', error.message)
	} else {
		console.log('Unexpected error:', error)
	}
}
```

## Performance Features

- **Caching**: Automatic response caching for GET requests
- **Retry Logic**: Exponential backoff for failed requests
- **Request Batching**: Optional batching for bulk operations
- **Compression**: Support for request/response compression
- **Streaming**: Efficient handling of large datasets

## Security Features

- **Authentication**: Automatic authentication header management
- **Encryption**: Support for data encryption in exports
- **Integrity Verification**: Cryptographic verification of events
- **Data Classification**: Support for PHI, CONFIDENTIAL, INTERNAL, PUBLIC classifications

## Testing

The Events Service includes comprehensive tests:

```bash
# Run integration tests
npm test src/services/__tests__/events.integration.test.ts

# Run all service tests
npm test src/services/__tests__/
```

## Examples

See the complete examples in:

- `src/services/__tests__/events.example.ts` - Comprehensive usage examples
- `src/services/__tests__/events.integration.test.ts` - Integration tests

## Next Steps

The Events Service is now fully implemented and ready for use. Future enhancements may include:

- Additional export formats
- Enhanced real-time filtering
- Advanced analytics capabilities
- Custom event validation rules
- Integration with external monitoring systems
