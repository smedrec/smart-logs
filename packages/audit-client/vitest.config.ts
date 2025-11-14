import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./src/__tests__/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/index.ts',
				'src/types.ts',
				'src/**/*.types.ts',
				'src/**/types.ts',
				'src/__tests__/**/*',
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/examples/**/*',
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
		},
	},
})
