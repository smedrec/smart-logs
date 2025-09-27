# React Native Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with React Native applications for cross-platform mobile audit logging.

## Features Demonstrated

- ✅ React Native integration with TypeScript
- ✅ Context provider for audit client management
- ✅ Custom hooks for audit operations
- ✅ Offline support with local storage
- ✅ Network state handling
- ✅ Background sync capabilities
- ✅ Push notification audit logging
- ✅ Biometric authentication auditing
- ✅ Device information logging
- ✅ Performance optimization for mobile

## Setup

```bash
# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Key Files

- `src/providers/AuditProvider.tsx` - Context provider with offline support
- `src/hooks/useAudit.ts` - Mobile-optimized audit hooks
- `src/services/AuditService.ts` - Service with offline queue
- `src/components/AuditEventForm.tsx` - Mobile form component
- `src/utils/deviceInfo.ts` - Device information utilities
- `src/storage/auditStorage.ts` - Local storage management

## Usage Patterns

### Basic Setup

```tsx
import { App } from './App'
import { AuditProvider } from './providers/AuditProvider'

export default function Root() {
	return (
		<AuditProvider>
			<App />
		</AuditProvider>
	)
}
```

### Mobile-Specific Auditing

```tsx
import { useAuditMobile } from './hooks/useAudit'

function MyScreen() {
	const { logScreenView, logUserAction } = useAuditMobile()

	useEffect(() => {
		logScreenView('UserProfile')
	}, [])

	const handleButtonPress = () => {
		logUserAction('button_press', { button: 'save' })
	}
}
```

## Mobile-Specific Features

1. **Offline Support**: Queue events when offline, sync when online
2. **Device Context**: Include device info in audit events
3. **App State**: Track app foreground/background transitions
4. **Network Awareness**: Adapt behavior based on connection
5. **Battery Optimization**: Batch events to preserve battery life

## Best Practices

1. **Offline First**: Always assume network might be unavailable
2. **Battery Conscious**: Batch operations and minimize background activity
3. **Privacy Aware**: Be mindful of sensitive data in mobile context
4. **Performance**: Use React Native performance best practices
5. **Testing**: Test on both iOS and Android devices
