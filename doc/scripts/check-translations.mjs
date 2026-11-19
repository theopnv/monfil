// Fails when a translated docs page is missing or older than the English page it came from.
import { createLunaria } from '@lunariajs/core';

const lunaria = await createLunaria();
const status = await lunaria.getFullStatus();

const problems = status.flatMap((entry) =>
	entry.localizations
		.filter((localization) => localization.status !== 'up-to-date')
		.map((localization) => `${localization.status}: ${localization.path} (from ${entry.source.path})`),
);

if (problems.length > 0) {
	console.error(`${problems.length} translated docs page(s) need work:\n${problems.join('\n')}`);
	process.exit(1);
}
console.log(`All ${status.length} translatable docs pages are up to date in every language.`);
