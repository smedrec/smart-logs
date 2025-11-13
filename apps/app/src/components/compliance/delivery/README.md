# Delivery Destination Components

This directory contains components for managing delivery destinations in the compliance reporting system.

## Components

### Testing and Validation

#### TestDestinationDialog

A dialog component for testing delivery destination connections with real-time progress tracking and detailed result display.

**Features:**

- Real-time connection testing with progress indicators
- Success/failure result display with detailed metrics
- Retry functionality for failed tests
- Troubleshooting tips for common issues
- Response time and status code display
- Additional details from test results

**Usage:**

```tsx
import { TestDestinationDialog } from '@/components/compliance/delivery'

function MyComponent() {
	const [testDialogOpen, setTestDialogOpen] = useState(false)

	const handleTest = async (destinationId: string): Promise<ConnectionTestResult> => {
		return await auditClient.delivery.testConnection(destinationId)
	}

	return (
		<TestDestinationDialog
			open={testDialogOpen}
			onOpenChange={setTestDialogOpen}
			destinationId="dest-123"
			destinationLabel="Production Email"
			onTest={handleTest}
		/>
	)
}
```

**Props:**

- `open` (boolean): Controls dialog visibility
- `onOpenChange` (function): Callback when dialog open state changes
- `destinationId` (string): ID of the destination to test
- `destinationLabel` (string): Display name of the destination
- `onTest` (function): Async function that performs the connection test

**Test States:**

1. **Idle**: Initial state, shows "Start Test" button
2. **Testing**: Shows progress bar and loading indicator
3. **Success**: Shows success message with test details
4. **Error**: Shows error message with troubleshooting tips

#### ValidationFeedback

A component for displaying validation results with errors, warnings, and suggestions.

**Features:**

- Displays validation errors with field-level details
- Collapsible warnings section
- Suggestions for fixing issues
- Color-coded severity indicators
- Accessible markup with ARIA labels

**Usage:**

```tsx
import { ValidationFeedback } from '@/components/compliance/delivery'

function MyComponent() {
	const [validation, setValidation] = useState<ValidationResult | null>(null)

	const handleValidate = async () => {
		const result = await auditClient.delivery.validateDestination(destinationId)
		setValidation(result)
	}

	return (
		<>
			<Button onClick={handleValidate}>Validate</Button>
			{validation && <ValidationFeedback validation={validation} />}
		</>
	)
}
```

**Props:**

- `validation` (ValidationResult): Validation result object
- `className` (string, optional): Additional CSS classes

**Validation Result Structure:**

```typescript
interface ValidationResult {
	isValid: boolean
	errors?: Array<string | { message: string; field?: string }>
	warnings?: Array<string | { message: string; field?: string }>
	suggestions?: string[]
}
```

#### InlineValidationError

A small inline component for displaying field-level validation errors.

**Usage:**

```tsx
import { InlineValidationError } from '@/components/compliance/delivery'

<Input
  id="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
<InlineValidationError error={errors.email} />
```

#### ValidationSummary

A compact summary component for displaying validation status.

**Usage:**

```tsx
import { ValidationSummary } from '@/components/compliance/delivery'

;<ValidationSummary validation={validation} onDismiss={() => setValidation(null)} />
```

### Integration with DeliveryDestinationForm

The form component now supports validation and testing for existing destinations:

```tsx
import { DeliveryDestinationForm } from '@/components/compliance/delivery'

function EditDestinationPage() {
	const handleValidate = async (destinationId: string): Promise<ValidationResult> => {
		return await auditClient.delivery.validateDestination(destinationId)
	}

	const handleTestConnection = async (destinationId: string): Promise<ConnectionTestResult> => {
		return await auditClient.delivery.testConnection(destinationId)
	}

	return (
		<DeliveryDestinationForm
			initialData={existingDestination}
			destinationId={existingDestination.id}
			organizationId={organizationId}
			onSubmit={handleSubmit}
			onValidate={handleValidate}
			onTestConnection={handleTestConnection}
		/>
	)
}
```

**New Form Features:**

- "Validate Configuration" button for existing destinations
- "Test Connection" button for existing destinations
- Real-time validation feedback display
- Test dialog integration

### Integration with DeliveryDestinationsPage

The page component now includes test dialog integration:

```tsx
import { DeliveryDestinationsPage } from '@/components/compliance/delivery'

function DeliveryDestinationsRoute() {
	return (
		<DeliveryDestinationsPage
			onCreateDestination={() => navigate('/compliance/delivery-destinations/create')}
			onEditDestination={(id) => navigate(`/compliance/delivery-destinations/${id}/edit`)}
			onTestDestination={(id) => console.log('Testing:', id)}
			onDeleteDestination={(id) => handleDelete(id)}
			onViewDestination={(id) => navigate(`/compliance/delivery-destinations/${id}`)}
		/>
	)
}
```

The test functionality is automatically handled by the page component, which:

1. Opens the test dialog when a destination test is triggered
2. Performs the connection test via the audit client
3. Displays results in the dialog
4. Allows retry on failure

## API Integration

### Connection Testing

The connection test API returns a `ConnectionTestResult`:

```typescript
interface ConnectionTestResult {
	success: boolean
	responseTime?: number
	statusCode?: number
	error?: string
	details?: Record<string, any>
}
```

**Example API Call:**

```typescript
const result = await auditClient.delivery.testConnection(destinationId)

if (result.success) {
	console.log('Connection successful!')
	console.log('Response time:', result.responseTime, 'ms')
} else {
	console.error('Connection failed:', result.error)
}
```

### Validation

The validation API returns a `ValidationResult`:

```typescript
interface ValidationResult {
	isValid: boolean
	errors?: Array<string | { message: string; field?: string }>
	warnings?: Array<string | { message: string; field?: string }>
	suggestions?: string[]
}
```

**Example API Call:**

```typescript
const result = await auditClient.delivery.validateDestination(destinationId)

if (result.isValid) {
	console.log('Configuration is valid!')
} else {
	console.error('Validation errors:', result.errors)
	console.warn('Warnings:', result.warnings)
}
```

## Accessibility

All testing and validation components follow WCAG 2.1 AA guidelines:

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader Support**: Proper ARIA labels and live regions for status updates
- **Focus Management**: Logical focus order and visible focus indicators
- **Color Contrast**: High contrast colors for better visibility
- **Progress Indicators**: Accessible progress announcements

## Error Handling

The components handle various error scenarios:

1. **Network Errors**: Connection timeouts and network failures
2. **API Errors**: Server-side validation and processing errors
3. **Configuration Errors**: Invalid destination configurations
4. **Permission Errors**: Insufficient permissions for testing

Each error type is displayed with:

- Clear error message
- Suggested remediation steps
- Retry functionality where applicable
- Technical details for debugging

## Testing

To test these components:

```bash
# Run unit tests
npm test -- delivery

# Run integration tests
npm test -- delivery.integration

# Run accessibility tests
npm test -- delivery.a11y
```

## Future Enhancements

Planned improvements for task 13.3:

- ✅ Test destination dialog with progress tracking
- ✅ Validation feedback components
- ✅ Integration with form and page components
- ✅ Retry functionality for failed tests
- ✅ Detailed error display with troubleshooting tips

## Related Components

- `DeliveryDestinationsPage`: Main page for managing destinations
- `DeliveryDestinationForm`: Form for creating/editing destinations
- `DeliveryDestinationsDataTable`: Table for displaying destinations
- All destination type configuration components (Email, Webhook, Storage, SFTP, Download)
