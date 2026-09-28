import { createElement, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { openLink } from "@/lib/river/utils";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import { prepareReaderHtml } from "@/lib/reader/prepareReaderHtml";
import { resolveEmbedUrl, type EmbedDescriptor } from "../../../shared/embeds";

export interface ArticleBodyProps {
  html: string;
  sourceUrl?: string | undefined;
}

const PROVIDER_NAMES = {
  youtube: 'YouTube',
  x: 'X',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  spotify: 'Spotify',
} as const;

const PROVIDER_PRIVACY_URLS = {
  youtube: 'https://policies.google.com/privacy',
  x: 'https://x.com/en/privacy',
  vimeo: 'https://vimeo.com/legal/privacy',
  instagram: 'https://www.facebook.com/privacy/policy/',
  spotify: 'https://www.spotify.com/legal/privacy-policy/',
} as const;

function EmbedCard({ embed, title }: { embed: EmbedDescriptor; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const name = PROVIDER_NAMES[embed.provider];
  const frameHeight = embed.provider === 'spotify' ? 'h-64' : embed.provider === 'x' || embed.provider === 'instagram' ? 'h-[560px]' : 'aspect-video';

  return (
    <span className="block w-full rounded-lg border border-secondary bg-secondary p-4">
      <span className="mb-3 block text-sm font-semibold">{title || `${name} embed`}</span>
      <span className="mb-3 block text-xs text-tertiary">Loading this embed connects to {name}. The provider may use cookies.</span>
      {loaded ? (
        <iframe
          className={`block w-full rounded-md border-0 ${frameHeight}`}
          src={embed.frameUrl}
          title={`${name} embed`}
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className="rounded-md bg-brand-solid px-3 py-2 text-sm font-semibold text-white hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-brand-solid" onClick={() => setLoaded(true)}>
          Load {name}
        </button>
      )}
      <span className="mt-3 block text-xs text-tertiary">
        <a href={embed.sourceUrl}>Open on {name}</a>
        <span aria-hidden="true"> · </span>
        <a href={PROVIDER_PRIVACY_URLS[embed.provider]}>Provider privacy policy</a>
      </span>
    </span>
  );
}

function renderNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === 'a' && element.hasAttribute('data-monfil-embed')) {
    const embed = resolveEmbedUrl(element.getAttribute('href') ?? '');
    if (embed) {
      return <EmbedCard key={key} embed={embed} title={element.textContent?.trim() ?? ''} />;
    }
  }

  const props: Record<string, string> = {};
  for (const attribute of element.attributes) {
    if (attribute.name === 'data-monfil-embed') {
      continue;
    }
    props[attribute.name === 'srcset' ? 'srcSet' : attribute.name] = attribute.value;
  }
  if (tag === 'img' || tag === 'br' || tag === 'hr' || tag === 'source') {
    return createElement(tag, { ...props, key });
  }
  const children = [...element.childNodes].map((child, index) => renderNode(child, `${key}.${index}`));
  return createElement(tag, { ...props, key }, ...children);
}

const PROSE_CLASSES = [
  "flex flex-col gap-5.5 text-primary",
  "[&_p]:text-base [&_p]:leading-relaxed",
  "[&_a]:text-brand-secondary [&_a]:underline",
  "[&_strong]:font-bold [&_em]:italic",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:leading-relaxed",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4.5 [&_blockquote]:text-lg",
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold [&_h4]:text-base [&_h4]:font-bold",
  "[&_img]:max-w-full [&_img]:rounded-lg",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-secondary [&_pre]:p-3 [&_code]:font-mono [&_code]:text-sm",
  "[&_figcaption]:text-xs [&_figcaption]:text-tertiary",
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-secondary [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-secondary [&_td]:p-2",
  "[&_hr]:my-6 [&_hr]:border-secondary",
].join(" ");

export default function ArticleBody({ html: rawHtml, sourceUrl }: ArticleBodyProps) {
  const nodes = useMemo(() => {
    const html = sanitizeArticleHtml(prepareReaderHtml(rawHtml, sourceUrl));
    const document = new DOMParser().parseFromString(html, 'text/html');
    return [...document.body.childNodes].map((node, index) => renderNode(node, String(index)));
  }, [rawHtml, sourceUrl]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    openLink(anchor.getAttribute("href") ?? undefined);
  };

  return (
    <div data-testid="article-body" onClick={handleClick} className={`mb-8.5 ${PROSE_CLASSES}`}>
      {nodes}
    </div>
  );
}
