// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

// https://astro.build/config
export default defineConfig({
	site: 'https://monfil.app',
	base: '/docs',
	integrations: [
		starlight({
			title: 'Monfil',
			plugins: [
				starlightLlmsTxt({
					projectName: 'Monfil',
					description: 'Keep track of what matters to you and stay ahead.',
				}),
			],
			head: [
				{
					tag: 'script',
					attrs: {
						type: 'module',
						src: 'https://static.cloudflareinsights.com/beacon.min.js',
						'data-cf-beacon': JSON.stringify({ token: '3cccf2a0871f4ecd9ee3b231de82bfbd' }),
					},
				},
			],
			customCss: ['./src/styles/monfil.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/theopnv/monfil' }],
			sidebar: [
				{ label: 'Changelog', slug: 'changelog' },
				{
					label: 'For users',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Install Monfil', slug: 'user-guide/install' },
						{ label: 'Use Monfil', slug: 'user-guide/home' },
						{ label: 'Supported sources', slug: 'user-guide/supported-sources' },
						{ label: 'Search and saved searches', slug: 'user-guide/search' },
						{ label: 'Jobs', slug: 'user-guide/jobs' },
						{ label: 'Use cases', slug: 'user-guide/use-cases' },
						{ label: 'Submit a feedpack', slug: 'user-guide/submit-a-feedpack' },
						{ label: 'Privacy notice', slug: 'user-guide/privacy' },
					],
				},
				{
					label: 'For contributors',
					items: [{ autogenerate: { directory: 'contributor-guide' } }],
				},
			],
		}),
	],
});
