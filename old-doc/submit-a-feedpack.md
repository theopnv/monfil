# Submit a feedpack

A feedpack is a curated OPML file for one subject. You can submit a feedpack with a pull request. Feedpack pull
requests are reviewed and merged when the sources look legitimate and the pack has a clear purpose.

## Create the OPML file

Use one of these methods:

- Create a workspace in Monfil, add and organise the sources, then right-click the workspace and export it as OPML.
- Write an OPML 2.0 file manually.

Put the file in `feedpacks/`. Use a short kebab-case file name, such as `web-performance.opml`.

Each folder is an `<outline>` that contains source outlines. Each source must have a title, a supported `type`, and
an `xmlUrl`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Web Performance</title></head>
  <body>
    <outline text="Browsers">
      <outline
        text="Example browser blog"
        title="Example browser blog"
        type="rss"
        xmlUrl="https://example.com/feed.xml"
      />
    </outline>
  </body>
</opml>
```

Check the exported or hand-written file before you submit it. Remove duplicate sources, broken feeds, and sources
that do not match the subject.

## Add the catalog entry

Add one object to the `packs` array in `feedpacks/index.json`:

```json
{
  "slug": "web-performance",
  "title": "Web Performance",
  "description": "Browser performance, metrics, tooling, and field research.",
  "tags": ["web", "performance", "browsers"],
  "curator": "Your name or handle",
  "sourceCount": 12,
  "updatedAt": "2026-09-21",
  "opml": "web-performance.opml"
}
```

Use these rules for each field:

- `slug`: Use a unique, stable, kebab-case identifier.
- `title`: Use the name shown in the feedpack browser.
- `description`: Explain the subject and scope in one short sentence.
- `tags`: Add a small set of lowercase search terms.
- `curator`: Add the person or group that maintains the selection.
- `sourceCount`: Use the total number of source outlines in the OPML file.
- `updatedAt`: Use the date of the last source review in `YYYY-MM-DD` format.
- `opml`: Use the exact file name that you added to `feedpacks/`.

Keep the root `version` value unchanged.

## Validate the feedpack

Install the project dependencies, then run:

```bash
npm run check:feedpacks
```

This check confirms that each catalog entry points to an OPML file, that `sourceCount` matches the file, and that
each source URL responds successfully. The same check runs in continuous integration.

You can also import the OPML file into Monfil before you open the pull request. Confirm that the folders and source
names are useful and that the feeds return the content you expect.

## Open the pull request

Include the OPML file and the `feedpacks/index.json` change in one pull request. In the pull request description,
state the purpose of the pack, how you selected the sources, and any source that needs special context.

The review checks that:

- the sources are legitimate and publish content related to the stated subject;
- the pack is curated and has a clear scope;
- the feeds work and do not contain obvious spam;
- the catalog metadata matches the OPML file.

Reviewers can ask you to remove, replace, or reorganise sources. A curated feedpack that passes these checks can be
merged and becomes available through the feedpack catalog.
