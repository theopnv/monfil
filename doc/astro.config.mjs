// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Monfil',
			customCss: ['./src/styles/monfil.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/theopnv/monfil' }],
			sidebar: [
				{
					label: 'User Guide',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'User Guide', slug: 'user-guide/home' },
					],
				},
				{
					label: 'Contributor Guide',
					items: [{ autogenerate: { directory: 'contributor-guide' } }],
				},
			],
		}),
	],
});
