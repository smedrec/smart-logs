import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/__tests__/**/*.test.ts'],
		testTimeout: 30000, // 30 seconds for database operations
		hookTimeout: 30000, // 30 seconds for setup/teardown
	},
})
