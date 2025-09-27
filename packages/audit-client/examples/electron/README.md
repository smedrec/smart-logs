# Electron Integration Example

This example demonstrates how to integrate the `@smedrec/audit-client` library with Electron applications for cross-platform desktop audit logging.

## Features Demonstrated

- ✅ Electron main and renderer process integration
- ✅ IPC communication for audit operations
- ✅ TypeScript support with strict typing
- ✅ Secure storage for credentials
- ✅ System-level event auditing
- ✅ File system operation auditing
- ✅ Window and menu action auditing
- ✅ Auto-updater audit logging
- ✅ Crash reporting integration
- ✅ Performance monitoring

## Setup

```bash
npm install
npm run dev
```

## Key Files

- `src/main/` - Main process audit integration
- `src/renderer/` - Renderer process audit hooks
- `src/shared/` - Shared types and utilities
- `src/preload/` - Preload script for secure IPC
- `main.ts` - Main Electron process
- `renderer.tsx` - React renderer process

## Usage Patterns

### Main Process Integration

```typescript
import { AuditService } from './services/audit-service'

class MainAuditService {
	async logSystemEvent(action: string, details?: any) {
		await this.auditService.logEvent({
			action: `system.${action}`,
			targetResourceType: 'desktop_app',
			// ... other fields
		})
	}
}
```

### Renderer Process Integration

```typescript
import { useElectronAudit } from './hooks/useElectronAudit'

function MyComponent() {
	const { logUserAction, logFileOperation } = useElectronAudit()

	const handleFileOpen = async () => {
		const result = await window.electronAPI.openFile()
		await logFileOperation('file.open', { path: result.path })
	}
}
```

## Desktop-Specific Features

1. **System Integration**: Log system-level events and operations
2. **File System**: Audit file operations and access
3. **Security**: Secure credential storage and IPC communication
4. **Performance**: Desktop-optimized batching and caching
5. **Updates**: Audit auto-updater events and installations

## Best Practices

1. **Security**: Use secure IPC and credential storage
2. **Performance**: Optimize for desktop performance characteristics
3. **Privacy**: Be mindful of local file system access
4. **Updates**: Audit application updates and installations
5. **Testing**: Test on multiple desktop platforms
