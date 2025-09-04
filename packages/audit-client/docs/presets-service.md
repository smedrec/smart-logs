# Audit Presets Service

The Audit Presets Service provides comprehensive functionality for managing audit configuration templates. These presets allow you to standardize audit event creation by defining reusable templates with validation rules, default values, and metadata.

## Overview

Audit presets are configuration templates that define:

- **Template Structure**: Default values for audit events (action, resource type, classification, etc.)
- **Validation Rules**: Required and optional fields with type validation
- **Metadata**: Version information, tags, categories, and usage tracking
- **Versioning**: Complete version history with change tracking

## Key Features

- ✅ **CRUD Operations**: Create, read, update, and delete audit presets
- ✅ **Template-based Event Creation**: Apply presets to generate audit events
- ✅ **Validation System**: Comprehensive field validation with custom rules
- ✅ **Version Management**: Full version history and rollback capabilities
- ✅ **Usage Analytics**: Track preset usage and performance statistics
- ✅ **Import/Export**: Portable preset configurations for deployment
- ✅ **Duplication**: Clone presets with modifications
- ✅ **Categorization**: Organize presets with tags and categories

## Basic Usage

### Initialize the Service

```typescript
import { AuditClient } from '@your-org/audit-client'

const client = new AuditClient({
	baseUrl: 'https://api.example.com',
	authentication: {
		type: 'apiKey',
		apiKey: 'your-api-key',
	},
})

// Access the presets service
const presets = client.presets
```

### Create a New Preset

```typescript
import type { CreateAuditPresetInput } from '@your-org/audit-client'

const presetInput: CreateAuditPresetInput = {
	name: 'user-login-success',
	description: 'Template for successful user login events',
	template: {
		action: 'user.login',
		targetResourceType: 'user',
		dataClassification: 'INTERNAL',
		defaultStatus: 'success',
		defaultOutcomeDescription: 'User successfully authenticated',
	},
	validation: {
		requiredFields: ['principalId', 'organizationId'],
		optionalFields: ['targetResourceId', 'sessionContext'],
		fieldValidation: {
			principalId: {
				type: 'string',
				required: true,
				minLength: 1,
			},
			organizationId: {
				type: 'string',
				required: true,
				minLength: 1,
			},
		},
	},
	tags: ['authentication', 'login', 'success'],
	category: 'authentication',
}

const preset = await presets.create(presetInput)
console.log('Created preset:', preset.name)
```

### List and Filter Presets

```typescript
// List all presets
const allPresets = await presets.list()

// Filter by category and tags
const authPresets = await presets.list({
	category: 'authentication',
	tags: ['login'],
	sortBy: 'name',
	sortOrder: 'asc',
	limit: 20,
})

console.log(`Found ${authPresets.presets.length} authentication presets`)
```

### Get a Specific Preset

```typescript
const preset = await presets.get('user-login-success')

if (preset) {
	console.log('Preset found:', preset.name)
	console.log('Required fields:', preset.validation.requiredFields)
} else {
	console.log('Preset not found')
}
```

## Advanced Usage

### Apply Preset to Create Audit Event

```typescript
import type { PresetContext } from '@your-org/audit-client'

const context: PresetContext = {
	principalId: 'user123',
	organizationId: 'org456',
	targetResourceId: 'user123',
	sessionContext: {
		sessionId: 'sess789',
		ipAddress: '192.168.1.1',
		userAgent: 'Mozilla/5.0...',
	},
	customDetails: {
		loginMethod: 'password',
		mfaUsed: true,
		deviceTrusted: false,
	},
	overrides: {
		outcomeDescription: 'User successfully logged in with MFA',
	},
}

const result = await presets.apply('user-login-success', context)

if (result.success && result.auditEvent) {
	console.log('Audit event created:', result.auditEvent.id)
	console.log('Event timestamp:', result.auditEvent.timestamp)
} else {
	console.log('Failed to create audit event')
	result.errors?.forEach((error) => {
		console.log(`Error: ${error.message}`)
	})
}
```

### Validate Context Before Applying

```typescript
const validation = await presets.validate('user-login-success', context)

if (validation.isValid) {
	console.log('Context is valid')
	// Proceed with applying the preset
	const result = await presets.apply('user-login-success', context)
} else {
	console.log('Validation errors:')
	validation.errors.forEach((error) => {
		console.log(`- ${error.field}: ${error.message}`)
	})
}
```

### Update an Existing Preset

```typescript
import type { UpdateAuditPresetInput } from '@your-org/audit-client'

const updates: UpdateAuditPresetInput = {
	description: 'Enhanced template with MFA support',
	template: {
		defaultDetails: {
			mfaRequired: true,
			securityLevel: 'high',
		},
	},
	tags: ['authentication', 'login', 'success', 'mfa'],
}

const updatedPreset = await presets.update('user-login-success', updates)
console.log('Updated to version:', updatedPreset.metadata.version)
```

## Version Management

### Get Version History

```typescript
const history = await presets.getVersionHistory('user-login-success', 10)

console.log(`Preset has ${history.totalVersions} versions`)
console.log('Current version:', history.currentVersion)

history.versions.forEach((version) => {
	console.log(`Version ${version.version}:`)
	version.changes.forEach((change) => {
		console.log(`  - ${change}`)
	})
})
```

### Restore to Previous Version

```typescript
const restored = await presets.restoreVersion('user-login-success', '1.0.0')
console.log('Restored to version:', restored.metadata.version)
```

## Analytics and Monitoring

### Get Usage Statistics

```typescript
const stats = await presets.getUsageStats('user-login-success', 'month', 5)

console.log(`Usage Statistics:`)
console.log(`Total usage: ${stats.totalUsage}`)
console.log(`Success rate: ${stats.successRate}%`)
console.log(`Average execution time: ${stats.averageExecutionTime}ms`)

console.log('Top users:')
stats.topUsers.forEach((user) => {
	console.log(`  ${user.principalId}: ${user.count} uses`)
})
```

## Import/Export Operations

### Export Presets

```typescript
// Export specific presets
const exportData = await presets.export(
	['user-login-success', 'user-logout'],
	'json',
	false // Don't include version history
)

// Save to file or transfer to another environment
console.log('Export data length:', exportData.length)
```

### Import Presets

```typescript
const importResult = await presets.import(exportData, 'json', false)

console.log('Import results:')
console.log('Imported:', importResult.imported)
console.log('Skipped:', importResult.skipped)
console.log('Errors:', importResult.errors)
```

## Preset Duplication

```typescript
const duplicated = await presets.duplicate('user-login-success', 'admin-login-success', {
	description: 'Template for admin login events',
	tags: ['authentication', 'admin', 'login'],
	category: 'admin-authentication',
})

console.log('Duplicated preset:', duplicated.name)
```

## Validation Rules

The preset validation system supports comprehensive field validation:

### Basic Types

```typescript
const fieldValidation = {
	principalId: {
		type: 'string',
		required: true,
		minLength: 1,
		maxLength: 100,
	},
	age: {
		type: 'number',
		min: 0,
		max: 150,
	},
	isActive: {
		type: 'boolean',
		required: true,
	},
	email: {
		type: 'email',
		required: true,
	},
	website: {
		type: 'url',
	},
	birthDate: {
		type: 'date',
	},
}
```

### Advanced Validation

```typescript
const advancedValidation = {
	status: {
		type: 'string',
		enum: ['active', 'inactive', 'pending'],
		required: true,
	},
	tags: {
		type: 'array',
		minLength: 1,
		maxLength: 10,
	},
	metadata: {
		type: 'object',
		required: false,
	},
	customField: {
		type: 'string',
		pattern: '^[A-Z]{2,4}[0-9]{3,6}$', // Regex pattern
		customValidator: (value: string) => {
			// Custom validation logic
			return value.length > 5 || 'Must be longer than 5 characters'
		},
	},
}
```

## Error Handling

The service provides comprehensive error handling with detailed error information:

```typescript
try {
	const preset = await presets.create(presetInput)
} catch (error) {
	if (error.status === 409) {
		console.log('Preset already exists')
	} else if (error.status === 400) {
		console.log('Validation error:', error.message)
		// Access field-level errors if available
		if (error.details?.fieldErrors) {
			error.details.fieldErrors.forEach((fieldError) => {
				console.log(`${fieldError.field}: ${fieldError.message}`)
			})
		}
	} else {
		console.log('Unexpected error:', error.message)
	}
}
```

## Best Practices

### 1. Naming Conventions

Use descriptive, hierarchical names for presets:

```typescript
// Good
'user-login-success'
'user-login-failure'
'admin-password-reset'
'system-backup-completed'

// Avoid
'preset1'
'login'
'event'
```

### 2. Categorization

Organize presets with meaningful categories and tags:

```typescript
const preset = {
	name: 'user-login-success',
	category: 'authentication',
	tags: ['user', 'login', 'success', 'security'],
}
```

### 3. Validation Rules

Define comprehensive validation rules to ensure data quality:

```typescript
const validation = {
	requiredFields: ['principalId', 'organizationId'],
	optionalFields: ['sessionContext', 'customDetails'],
	fieldValidation: {
		principalId: {
			type: 'string',
			required: true,
			minLength: 1,
			maxLength: 255,
		},
		// Add validation for all important fields
	},
}
```

### 4. Version Management

Use semantic versioning and meaningful change descriptions:

```typescript
// When updating presets, provide clear change descriptions
const updates = {
	description: 'Added MFA support and enhanced security validation',
	// The system will automatically increment version and track changes
}
```

### 5. Testing Presets

Always validate presets before applying them in production:

```typescript
// Test validation
const validation = await presets.validate(presetName, testContext)
if (!validation.isValid) {
	console.log('Preset validation failed:', validation.errors)
	return
}

// Test application
const result = await presets.apply(presetName, testContext)
if (!result.success) {
	console.log('Preset application failed:', result.errors)
	return
}
```

## API Reference

For complete API documentation, see the [TypeScript definitions](../src/services/presets.ts) and [examples](../src/examples/presets-examples.ts).

### Main Methods

- `list(params?)` - List presets with filtering
- `get(name)` - Get a specific preset
- `create(preset)` - Create a new preset
- `update(name, updates)` - Update an existing preset
- `delete(name, force?)` - Delete a preset
- `validate(name, context)` - Validate context against preset
- `apply(name, context)` - Apply preset to create audit event
- `getVersionHistory(name, limit?)` - Get version history
- `getVersion(name, version)` - Get specific version
- `restoreVersion(name, version)` - Restore to specific version
- `getUsageStats(name, period?, limit?)` - Get usage statistics
- `duplicate(sourceName, targetName, updates?)` - Duplicate preset
- `export(names?, format?, includeHistory?)` - Export presets
- `import(data, format?, overwrite?)` - Import presets

### Type Definitions

All TypeScript interfaces and types are available in the main export:

```typescript
import type {
	AuditPreset,
	CreateAuditPresetInput,
	PresetApplicationResult,
	PresetContext,
	UpdateAuditPresetInput,
	ValidationResult,
	// ... and more
} from '@your-org/audit-client'
```
