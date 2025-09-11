import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['cjs', 'esm'],
	dts: true,
	sourcemap: true,
	clean: true,
	splitting: false,
	minify: false,
	target: 'es2020',
	outDir: 'dist',
	external: [
		// Mark peer dependencies as external
		'react',
		'react-dom',
		'vue',
		'@angular/core',
	],
	banner: {
		js: '// @smedrec/audit-client - Enhanced TypeScript SDK for Smart Logs Audit API',
	},
	esbuildOptions(options) {
		options.conditions = ['module']
	},
	onSuccess: async () => {
		console.log('✅ Build completed successfully')
	},
})
