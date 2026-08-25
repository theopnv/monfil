import { useMemo, type MouseEvent } from "react";
import { openLink } from "@/lib/river";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";

export interface ArticleBodyProps {
  html: string;
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
  "[&_figcaption]:text-xs [&_figcaption]:text-quaternary",
  "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-secondary [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-secondary [&_td]:p-2",
  "[&_hr]:my-6 [&_hr]:border-secondary",
].join(" ");

export default function ArticleBody({ html: rawHtml }: ArticleBodyProps) {
  const html = useMemo(() => sanitizeArticleHtml(rawHtml), [rawHtml]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) {
      return;
    }
    event.preventDefault();
    openLink(anchor.getAttribute("href") ?? undefined);
  };

  return (
    <div
      data-testid="article-body"
      onClick={handleClick}
      className={`mb-8.5 ${PROSE_CLASSES}`}
      // html is sanitized by sanitizeArticleHtml above before it reaches the DOM
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
