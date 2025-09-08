# Audit Client Validation & Type Guards

This directory contains comprehensive validation utilities and type guards for the audit-client package. The validation system is built on top of [Zod](https://zod.dev/) for schema validation and provides runtime type safety throughout the client.

## Overview

The validation system provides:

- **Input Validation**: All service methods validate input parameters using Zod schemas
- **Output Validation**: Responses are validated to ensure they match expected types
- **Type Safety**: TypeScript types are automatically inferred from Zod schemas
- **Error Handling**: Comprehensive error messages with field-level details
- **Runtime Safety**: Catches invalid data at runtime, not just compile time
- **Consistency**: All services use the same validation patterns and utilities

## Files

### `validation.ts`

Central validation utilities with Zod schema-based validators for all API types:

- **Generic Utilities**: `createValidator()`, `validateOrThrow()`, `validateSafely()`
- **API Validators**: Functions for validating audit events, queries, exports, etc.
- **Compliance Validators**: Functions for HIPAA, GDPR, and custom reports
- **Preset Validators**: Functions for audit preset management
- **Metrics Validators**: Functions for system metrics and alerts
- **Health Validators**: Functions for health check responses
- **Schema Registry**: Dynamic schema registration and validation
- **ValidationError**: Custom error class with detailed error information

### `type-guards.ts`

Runtime type checking utilities and type guards:

- **Basic Type Guards**: `isString()`, `isNumber()`, `isObject()`, etc.
- **Format Guards**: `isUUID()`, `isEmail()`, `isURL()`, `isISODateTime()`
- **Enum Guards**: `isDataClassification()`, `isAuditEventStatus()`, etc.
- **Complex Object Guards**: `isAuditEvent()`, `isPaginatedAuditEvents()`, etc.
- **Generic Utilities**: `isArrayOf()`, `hasProperties()`, `assertType()`
- **Utility Functions**: `filterByType()`, `mapAndFilter()`, `findByType()`

## Usage Examples

### Basic Validation

```typescript
import { validateCreateAuditEventInput, ValidationError } from '../utils/validation'

// Validate input data
const result = validateCreateAuditEventInput(inputData)
if (!result.success) {
	throw new ValidationError('Invalid input', {
		originalError: result.error,
	})
}

// Use validated data
const validatedData = result.data
```

### Service Integration

```typescript
import {
	assertType,
	isAuditEvent,
	validateCreateAuditEventInput,
	ValidationError,
} from '../utils/validation'

class EventsService {
	async create(event: CreateAuditEventInput): Promise<AuditEvent> {
		// Validate input
		const validationResult = validateCreateAuditEventInput(event)
		if (!validationResult.success) {
			throw new ValidationError('Invalid audit event data', {
				originalError: validationResult.error,
			})
		}

		// Make API request with validated data
		const response = await this.request('/audit/events', {
			method: 'POST',
			body: validationResult.data,
		})

		// Validate response
		assertType(response, isAuditEvent, 'Invalid audit event response from server')
		return response
	}
}
```

### Type Guards

```typescript
import { isAuditEvent, isValidCreateAuditEventInput } from '../utils/type-guards'

// Runtime type checking
if (isAuditEvent(data)) {
	// TypeScript knows data is AuditEvent
	console.log(data.id, data.timestamp)
}

// Array filtering with type guards
const validEvents = allData.filter(isAuditEvent)
// validEvents is now AuditEvent[]
```

### Error Handling

```typescript
import { ValidationError } from '../utils/validation'

try {
	await eventsService.create(invalidData)
} catch (error) {
	if (error instanceof ValidationError) {
		console.error('Validation failed:', error.getFormattedMessage())

		// Get all validation errors
		const allErrors = error.getAllErrors()
		allErrors.forEach((err) => {
			console.error(`Field ${err.path}: ${err.message} (${err.code})`)
		})
	}
}
```

### Schema Registry

```typescript
import { defaultSchemaRegistry } from '../utils/validation'

// Register custom schema
defaultSchemaRegistry.register('CustomType', CustomTypeSchema)

// Validate against registered schema
const result = defaultSchemaRegistry.validate('CustomType', data)
if (!result.success) {
	console.error('Validation failed:', result.error)
}

// List all registered schemas
console.log('Available schemas:', defaultSchemaRegistry.list())
```

## Integration with Services

All audit-client services are enhanced with validation:

### EventsService

- ✅ `create()` - Validates `CreateAuditEventInput`
- ✅ `bulkCreate()` - Validates `BulkCreateAuditEventsInput`
- ✅ `query()` - Validates `QueryAuditEventsParams`
- ✅ `export()` - Validates `ExportEventsParams`
- ✅ `stream()` - Validates `StreamEventsParams`
- ✅ `subscribe()` - Validates `SubscriptionParams`
- ✅ `getStatistics()` - Validates statistics parameters

### ComplianceService

- ✅ `generateHipaaReport()` - Validates `ReportCriteria`
- ✅ `generateGdprReport()` - Validates `ReportCriteria`
- ✅ `generateCustomReport()` - Validates `CustomReportParams`
- ✅ `exportGdprData()` - Validates `GdprExportParams`
- ✅ `pseudonymizeData()` - Validates `PseudonymizationParams`

### PresetsService

- ✅ `create()` - Validates `CreateAuditPresetInput`
- ✅ `update()` - Validates `UpdateAuditPresetInput`
- ✅ `validate()` - Validates `PresetContext`
- ✅ `apply()` - Validates `PresetContext`

### MetricsService

- ✅ `getSystemMetrics()` - Validates response structure
- ✅ `getAuditMetrics()` - Validates `AuditMetricsParams`
- ✅ `getUsageMetrics()` - Validates `UsageMetricsParams`
- ✅ `getAlerts()` - Validates `AlertsParams`

### ScheduledReportsService

- ✅ `list()` - Validates `ListScheduledReportsParams`
- ✅ `create()` - Validates `CreateScheduledReportInput`
- ✅ `update()` - Validates `UpdateScheduledReportInput`
- ✅ `getExecutionHistory()` - Validates `ExecutionHistoryParams`

### HealthService

- ✅ `check()` - Validates response structure
- ✅ `detailed()` - Validates response structure
- ✅ All methods validate responses using type guards

## Validation Patterns

### 1. Input Validation Pattern

```typescript
// Validate input parameters
const validationResult = validateInputFunction(inputData)
if (!validationResult.success) {
	throw new ValidationError('Invalid input', {
		originalError: validationResult.error,
	})
}

// Use validated data
const response = await this.request(endpoint, {
	body: validationResult.data,
})
```

### 2. Response Validation Pattern

```typescript
// Make API request
const response = await this.request(endpoint, options)

// Validate response structure
assertType(response, typeGuardFunction, 'Invalid response from server')
return response
```

### 3. ID Validation Pattern

```typescript
// Validate required ID parameters
assertDefined(id, 'ID is required')
if (!isNonEmptyString(id)) {
	throw new ValidationError('ID must be a non-empty string')
}
```

## Error Types

### ValidationError

Custom error class that extends `Error` with additional validation context:

```typescript
class ValidationError extends Error {
	public readonly path?: (string | number)[]
	public readonly code?: string
	public readonly originalError?: z.ZodError

	getFormattedMessage(): string
	getAllErrors(): Array<{ path: string; message: string; code: string }>
}
```

### Usage

```typescript
try {
	validateData(input)
} catch (error) {
	if (error instanceof ValidationError) {
		// Handle validation-specific errors
		console.log(error.getFormattedMessage())
		console.log(error.getAllErrors())
	}
}
```

## Benefits

1. **Type Safety**: Runtime validation ensures data matches TypeScript types
2. **Developer Experience**: Clear, detailed error messages help fix issues quickly
3. **Consistency**: All services use the same validation patterns
4. **Maintainability**: Centralized validation logic is easy to update
5. **Reliability**: Catches invalid data before it causes runtime errors
6. **Documentation**: Schemas serve as living documentation of data structures
7. **Testing**: Validation logic is easily testable in isolation

## Testing

The validation system includes comprehensive tests:

- **Unit Tests**: Test individual validation functions and type guards
- **Integration Tests**: Test validation integration in services
- **Error Handling Tests**: Verify proper error messages and handling
- **Type Safety Tests**: Ensure TypeScript types are correctly inferred

Run tests with:

```bash
npm test packages/audit-client/src/utils/__tests__/
```

## Contributing

When adding new validation:

1. **Define Zod Schema**: Create schema in appropriate types file
2. **Create Validator**: Add validator function in `validation.ts`
3. **Add Type Guard**: Create type guard in `type-guards.ts`
4. **Integrate in Service**: Use validation in service methods
5. **Add Tests**: Write tests for new validation logic
6. **Update Documentation**: Document new validation patterns

## Performance Considerations

- **Schema Caching**: Schemas are created once and reused
- **Lazy Validation**: Only validate when necessary
- **Error Short-Circuiting**: Stop validation on first error when appropriate
- **Type Guard Optimization**: Simple checks first, complex checks last
- **Memory Efficiency**: Avoid creating unnecessary objects during validation

## Migration Guide

If upgrading from a version without validation:

1. **Update Imports**: Import validation utilities where needed
2. **Handle ValidationError**: Add error handling for `ValidationError`
3. **Review Type Usage**: Ensure types match validated schemas
4. **Test Thoroughly**: Validate that existing code works with new validation
5. **Update Error Handling**: Use new error information for better UX
