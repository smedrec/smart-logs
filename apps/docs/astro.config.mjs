// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi'
// TODO: Temporarily disabled due to TypeDoc CommonJS compatibility issue
// import { createStarlightTypeDocPlugin } from 'starlight-typedoc'

// TODO: Re-enable when TypeDoc compatibility is fixed
// const [publicStarlightTypeDoc, publicTypeDocSidebarGroup] = createStarlightTypeDocPlugin()

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Smart Logs Docs',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/joseantcordeiro/smart-logs' },
			],
			plugins: [
				// TODO: Re-enable OpenAPI plugin when server is available
				// Generate the OpenAPI documentation pages.
				// starlightOpenAPI([
				// 	{
				// 		base: 'api',
				// 		schema: process.env.NODE_ENV === 'development' 
				// 			? 'http://localhost:3000/api/v1/openapi.json'
				// 			: 'https://api.smartlogs.com/api/v1/openapi.json',
				// 	},
				// ]),
				// TODO: Re-enable TypeDoc plugin when compatibility is fixed
				// Generate the documentation.
        // publicStarlightTypeDoc({
        //   entryPoints: ['../../packages/audit/src/index.ts'],
				// 	output: 'typeDoc-public',
        //   tsconfig: '../../packages/audit/tsconfig.json',
        // }),
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'index' },
						{ label: 'Quick Start', slug: 'audit-client/quick-start' },
					],
				},
				{
					label: 'Audit Client Library',
					items: [
						{ label: 'Overview', slug: 'audit-client/overview' },
						{ label: 'Quick Start', slug: 'audit-client/quick-start' },
						{ label: 'Configuration', slug: 'audit-client/configuration' },
						{ label: 'Plugin Architecture', slug: 'audit-client/plugins' },
						{ label: 'Framework Integration', slug: 'audit-client/frameworks' },
						{ label: 'Code Examples', slug: 'audit-client/examples' },
					],
				},
				{
					label: 'Core System',
					items: [
						{ label: 'Audit Core', slug: 'audit/audit' },
						{ label: 'Database Layer', slug: 'audit/audit-db' },
						{ label: 'Security & Compliance', slug: 'audit/security' },
						{ label: 'Archival System', slug: 'audit/archival-system' },
						{ label: 'Deprecated SDK', slug: 'audit/audit-sdk' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Get Started', slug: 'audit/get-started' },
						{ label: 'Examples', slug: 'audit/examples' },
						{ label: 'API Reference', slug: 'audit/api-reference' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				// Add the generated sidebar group to the sidebar.
				// ...openAPISidebarGroups,
				// TODO: Re-enable when TypeDoc compatibility is fixed
				// {
				//   label: 'type docs',
				//   // Add the generated public sidebar group to the sidebar.
				//   items: [publicTypeDocSidebarGroup],
				// }
			],
		}),
	],
})