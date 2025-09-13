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
				// Generate the OpenAPI documentation pages.
				starlightOpenAPI([
					{
						base: 'api',
						schema: 'http://localhost:3000/api/v1/openapi.json',
					},
				]),
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
					label: 'Development',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Get Started', slug: 'audit/get-started' },
						{ label: 'Audit SDK', slug: 'audit/audit' },
						{ label: 'Audit DB', slug: 'audit/audit-db' },
						{ label: 'API Reference', slug: 'audit/api-reference' },
						{ label: 'Examples', slug: 'audit/examples' },
						{ label: 'Security', slug: 'audit/security' },
						{ label: 'Archival', slug: 'audit/archival-system' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Audit Client',
					autogenerate: { directory: 'audit-client' },
				},
				// Add the generated sidebar group to the sidebar.
				...openAPISidebarGroups,
				// TODO: Re-enable when TypeDoc compatibility is fixed
				// {
        	// 	label: 'type docs',
          // Add the generated public sidebar group to the sidebar.
          // items: [publicTypeDocSidebarGroup],
				// }
			],
		}),
	],
})