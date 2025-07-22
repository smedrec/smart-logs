// @ts-check
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Smart Logs Docs',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/joseantcordeiro/smart-logs' },
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
			],
		}),
	],
})
