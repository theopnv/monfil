// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://theopnv.github.io',
	base: '/monfil',
	integrations: [
		starlight({
			title: 'Monfil',
			customCss: ['./src/styles/monfil.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/theopnv/monfil' }],
			sidebar: [
				{ label: 'Changelog', slug: 'changelog' },
				{
					label: 'For users',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Use Monfil', slug: 'user-guide/home' },
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
