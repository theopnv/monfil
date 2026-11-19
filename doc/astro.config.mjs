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
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				fr: { label: 'Français', lang: 'fr' },
				de: { label: 'Deutsch', lang: 'de' },
				es: { label: 'Español', lang: 'es' },
				it: { label: 'Italiano', lang: 'it' },
				'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' },
				'zh-cn': { label: '简体中文', lang: 'zh-CN' },
				ja: { label: '日本語', lang: 'ja' },
				ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
			},
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
				{
					label: 'Changelog',
					slug: 'changelog',
					translations: {
						fr: 'Journal des modifications',
						de: 'Änderungsprotokoll',
						es: 'Registro de cambios',
						it: 'Registro delle modifiche',
						'pt-BR': 'Registro de alterações',
						'zh-CN': '更新日志',
						ja: '変更履歴',
						ar: 'سجل التغييرات',
					},
				},
				{
					label: 'For users',
					translations: {
						fr: 'Pour les utilisateurs',
						de: 'Für Nutzer',
						es: 'Para usuarios',
						it: 'Per gli utenti',
						'pt-BR': 'Para usuários',
						'zh-CN': '用户指南',
						ja: 'ユーザー向け',
						ar: 'للمستخدمين',
					},
					// Each item takes its label from the title of the page, so a translated page names itself.
					items: [
						'user-guide/install',
						'user-guide/home',
						'user-guide/supported-sources',
						'user-guide/search',
						'user-guide/jobs',
						'user-guide/use-cases',
						'user-guide/submit-a-feedpack',
						'user-guide/privacy',
					],
				},
				{
					label: 'For contributors',
					translations: {
						fr: 'Pour les contributeurs',
						de: 'Für Mitwirkende',
						es: 'Para colaboradores',
						it: 'Per i contributori',
						'pt-BR': 'Para colaboradores',
						'zh-CN': '贡献者指南',
						ja: 'コントリビューター向け',
						ar: 'للمساهمين',
					},
					items: [{ autogenerate: { directory: 'contributor-guide' } }],
				},
			],
		}),
	],
});
