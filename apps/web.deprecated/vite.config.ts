import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
//import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		/**nodePolyfills({
			// To add only specific polyfills, add them here. If no option is passed, adds all polyfills
			include: ['buffer', 'os', 'stream', 'util', 'dns'],
			globals: {
				Buffer: true, // can also be 'build', 'dev', or false
				global: true,
				process: true,
			},
		}),*/
		tailwindcss(),
		tanstackRouter({}),
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'smart-logs',
				short_name: 'smart-logs',
				description: 'smart-logs - PWA Application',
				theme_color: '#0c0c0c',
			},
			pwaAssets: { disabled: false, config: true },
			devOptions: { enabled: true },
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
})
