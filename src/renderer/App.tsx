import { useFeeds } from "@/providers/feeds-provider";

export default function App() {
  const feeds = useFeeds();

  return (
    <>
      {Object.entries(feeds).map(([url, result]) => (
        <section key={url} className="mt-6 border-b border-secondary pb-6">
          <h1 className="text-2xl font-bold text-brand-secondary">{url}</h1>
          {result.success ? (
            <ul className="mt-2 space-y-1">
              {result.value.map((item) => (
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
          ) : (
            <p className="text-error-primary">Failed to load: {result.error.message}</p>
          )}
        </section>
      ))}
    </>
  );
}
