/**
 * Test setup file for vitest
 * Provides global mocks and test utilities
 */

import { afterEach, beforeAll, vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {}

	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value.toString()
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key]
		}),
		clear: vi.fn(() => {
			store = {}
		}),
		get length() {
			return Object.keys(store).length
		},
		key: vi.fn((index: number) => {
			const keys = Object.keys(store)
			return keys[index] || null
		}),
	}
})()

global.localStorage = localStorageMock as any

// Mock sessionStorage
const sessionStorageMock = (() => {
	let store: Record<string, string> = {}

	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value.toString()
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key]
		}),
		clear: vi.fn(() => {
			store = {}
		}),
		get length() {
			return Object.keys(store).length
		},
		key: vi.fn((index: number) => {
			const keys = Object.keys(store)
			return keys[index] || null
		}),
	}
})()

global.sessionStorage = sessionStorageMock as any

// Reset all mocks after each test
afterEach(() => {
	vi.clearAllMocks()
	localStorageMock.clear()
	sessionStorageMock.clear()
})

// Setup before all tests
beforeAll(() => {
	// Suppress console errors in tests unless explicitly needed
	vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})
