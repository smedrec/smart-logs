import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [tailwindcss(), tanstackRouter({}), react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		// Enable code splitting and chunk optimization
		rollupOptions: {
			output: {
				manualChunks: {
					// Vendor chunks for better caching
					'react-vendor': ['react', 'react-dom'],
					'router-vendor': ['@tanstack/react-router'],
					'ui-vendor': [
						'@radix-ui/react-dialog',
						'@radix-ui/react-dropdown-menu',
						'@radix-ui/react-select',
					],
					// Compliance-specific chunks
					'compliance-dashboard': [
						'./src/components/compliance/dashboard/dashboard-stats',
						'./src/components/compliance/dashboard/recent-executions',
						'./src/components/compliance/dashboard/upcoming-reports',
						'./src/components/compliance/dashboard/system-health',
					],
					'compliance-forms': [
						'./src/components/compliance/forms/report-configuration-form',
						'./src/components/compliance/forms/criteria-builder',
						'./src/components/compliance/forms/schedule-builder',
					],
				},
			},
		},
		// Optimize chunk size
		chunkSizeWarningLimit: 1000,
		// Enable source maps for production debugging
		sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
	},
	// Performance optimizations
	optimizeDeps: {
		include: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query'],
	},
})
