export type FeedCategory = {
  name: string;
};

export type Feed = {
  link: string;
  title: string;
  category: FeedCategory;
}

export type FeedItem = {
  title: string;
  link: string | undefined;
  pubDate: string;
};

export const listOfFeeds = [
  {
    link: 'https://aws.amazon.com/blogs/architecture/feed/',
    title: 'AWS Architecture Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://netflixtechblog.com/feed',
    title: 'Netflix Tech Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://research.google/blog/rss/',
    title: 'Google Research Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://engineering.fb.com/feed/',
    title: 'Facebook Engineering Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://medium.com/feed/airbnb-engineering',
    title: 'Airbnb Engineering Blog',
    category: {
      name: 'tech'
    },
  },
];
