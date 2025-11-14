import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/__tests__/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		exclude: ['node_modules', 'dist', '.turbo', '.tanstack', 'src-tauri'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			exclude: [
				'node_modules/',
				'dist/',
				'.turbo/',
				'.tanstack/',
				'src-tauri/',
				'src/__tests__/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/coverage/**',
			],
			// Coverage thresholds for compliance components
			thresholds: {
				lines: 70,
				functions: 70,
				branches: 65,
				statements: 70,
			},
			// Include compliance components in coverage
			include: ['src/components/compliance/**/*.{ts,tsx}', 'src/contexts/compliance-*.tsx'],
		},
		testTimeout: 30000,
		hookTimeout: 30000,
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, './src'),
		},
	},
})
