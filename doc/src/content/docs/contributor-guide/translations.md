---
title: Translations
description: Where the interface text lives, how a change keeps every language in step, and what the i18n check tests.
sidebar:
  order: 15
---

The interface text lives in JSON files under `src/shared/i18n/locales/<language>/`. English (`en`) is the source. Each file is one namespace, such as `river.json`. A key is written `namespace:path`, for example `river:readTime`.

The target languages are `fr`, `de`, `es`, `it`, `pt` (Brazilian Portuguese), `zh` (Simplified Chinese), `ja`, and `ar`. A language that no native speaker has checked shows a "beta" tag in the language picker. See `languages.ts` for the `reviewed` flag.

## Change the text

A change that adds or edits English text also adds or edits the same key in every language, in the same pull request. A person or a coding agent such as Claude Code writes the translations. No tool calls a model for it.

1. Edit the file in `locales/en/`. Give the key a name that tells where the text appears, such as `item.action.read` and `item.state.read`.
2. Use `{{value}}` for values and `<bold>text</bold>` for markup that `Trans` fills in.
3. For a count, write the plural keys with the CLDR suffixes. English has `_one` and `_other`. Each language needs the forms of its own rules: Japanese and Chinese need `_other`, French needs `_one`, `_many`, and `_other`, and Arabic needs all six.
4. Translate the key in each language folder. Use the terms in `src/shared/i18n/glossary.json`. It lists the names that stay in English (`Monfil`, `RSS`) and the term for each of `feed`, `river`, `workspace`, `feedpack`, and `folder` in each language.
5. Run `npm run i18n:check -- --update-lock`.

## Check

`npm run i18n:check` runs in CI. For each language that has files, it fails on:

- a key with no translation, or a plural without every form that the language needs
- a translation made from English text that has changed since
- a translation that the lock file does not cover
- a translation of a key that English no longer has
- a translation that adds or drops a `{{value}}` or a `<tag>`

For English, it fails on a key that no source file names. It reads the string literals of `src/`, and a template literal such as `` `codes.${name}` `` counts as naming every key that starts with `codes.`.

A language that has no folder is skipped. Add `--all` to fail for it too.

## The lock file

The file `src/shared/i18n/locales/translations.lock.json` holds a digest of the English text that each translation came from, by language and key. It is how the check knows that a translation is stale.

`npm run i18n:check -- --update-lock` records the English text of today for every translation that exists and keeps its placeholders. Run it after you write or fix translations, and commit the file. A key with no translation, or with a broken one, keeps its old entry and still fails the check.

## Fix a translation

Edit the JSON file of the language and open a pull request. Keep the `{{values}}` and `<tags>` of the English text, then run `npm run i18n:check -- --update-lock`. A translation that a native speaker has checked can lose its "beta" tag: set `reviewed` to `true` for the language in `languages.ts`.
