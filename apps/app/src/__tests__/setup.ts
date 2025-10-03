/**
 * Vitest setup file
 */

import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('VITE_SERVER_URL', 'http://localhost:3000')

// Mock WebSocket for tests
global.WebSocket = vi.fn().mockImplementation(() => ({
	close: vi.fn(),
	send: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	readyState: 1,
}))

// Mock EventSource for tests
global.EventSource = vi.fn().mockImplementation(() => ({
	close: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	readyState: 1,
}))
