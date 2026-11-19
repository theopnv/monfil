import { defineConfig } from '@lunariajs/core/config';

export default defineConfig({
	repository: { name: 'theopnv/monfil', rootDir: 'doc' },
	sourceLocale: { label: 'English', lang: 'en' },
	locales: [
		{ label: 'Français', lang: 'fr' },
		{ label: 'Deutsch', lang: 'de' },
		{ label: 'Español', lang: 'es' },
		{ label: 'Italiano', lang: 'it' },
		{ label: 'Português (Brasil)', lang: 'pt-br' },
		{ label: '简体中文', lang: 'zh-cn' },
		{ label: '日本語', lang: 'ja' },
		{ label: 'العربية', lang: 'ar' },
	],
	// The contributor guide and the changelog stay in English, so they are not tracked.
	files: [
		{
			include: ['src/content/docs/index.mdx', 'src/content/docs/user-guide/**/*.md'],
			pattern: {
				source: 'src/content/docs/@path',
				locales: 'src/content/docs/@lang/@path',
			},
			type: 'universal',
		},
	],
});
