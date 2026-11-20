# Working in `doc/`

`doc/` is the Astro Starlight site that serves the user guide and the contributor guide. Run commands from the repository root, or with `npm --prefix doc` as shown. Run `npm ci --prefix doc` once, because `doc/` has its own lock file.

## Commands

| Task | Command |
| --- | --- |
| Preview the site | `npm --prefix doc run dev` |
| Build the site into `doc/dist` | `npm --prefix doc run build` |
| Lint the public Markdown | `npm run lint:docs` |
| Check the translated user pages | `npm --prefix doc run check:translations` |

Run `npm run lint:docs` and the build before you submit a documentation change. CI runs both.

## Content

- Pages live in `doc/src/content/docs/`. The contributor guide is under `contributor-guide/` and the user guide under `user-guide/`. Name files in kebab case and give each page a `sidebar.order` that no other page in its folder uses.
- The user guide is translated into the languages in `doc/lunaria.config.mjs`. Lunaria tracks only `index.mdx` and `user-guide/`, and `check:translations` fails when a translated page is missing or older than its English source. The contributor guide and the changelog stay in English.
- The release sections of `doc/src/content/docs/changelog.md` are generated from the GitHub releases and the version tags by `doc/scripts/generate-changelog.mjs`. The `deploy-docs.yml` and `docs-lint.yml` workflows run it before they build, so do not edit those sections by hand.

## Deploy

`doc/wrangler.jsonc` deploys the build to Cloudflare Workers under `monfil.app/docs`. The `deploy-docs.yml` workflow builds and publishes it for a push to `main` that touches `doc/`, for a release, and after a successful `Publish` run. Do not deploy by hand.
