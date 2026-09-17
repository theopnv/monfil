import { generateOpml } from 'feedsmith';

export interface OpmlFeedInput {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
}

export interface OpmlCategoryInput {
  name: string;
  feeds: OpmlFeedInput[];
}

/**
 * Generates an OPML document for one workspace: one folder outline per category, feeds as leaves.
 * Category names are written as-is, with no workspace prefix, so the file reads as a plain feed
 * list to any other reader.
 * @param workspaceName the workspace's name, written as the document's own title
 * @param categories the workspace's categories, each with its feeds
 */
export function generateWorkspaceOpml(workspaceName: string, categories: OpmlCategoryInput[]): string {
  return generateOpml({
    head: { title: workspaceName },
    body: {
      outlines: categories.map((category) => ({
        text: category.name,
        outlines: category.feeds.map((feed) => ({
          text: feed.title,
          title: feed.title,
          type: 'rss',
          xmlUrl: feed.xmlUrl,
          ...(feed.htmlUrl ? { htmlUrl: feed.htmlUrl } : {}),
        })),
      })),
    },
  });
}
