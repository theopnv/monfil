import { useFeeds } from "@/providers/feeds-provider";

export default function River() {
  const feeds = useFeeds();

  return (
    <>
      {feeds.map((feed) => (
        <section key={feed.link} className="mt-6 border-b border-secondary pb-6">
          <h1 className="text-2xl font-bold text-brand-secondary">{feed.title}</h1>
          <ul className="mt-2 space-y-1">
            {feed.items.map((item) => (
              <li key={item.link} className="text-secondary">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-secondary hover:text-brand-secondary_hover"
                >
                  {item.title}
                </a>{' '}
                — {item.pubDate}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
