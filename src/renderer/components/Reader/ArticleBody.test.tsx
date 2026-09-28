// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import ArticleBody from './ArticleBody';

beforeEach(() => {
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('renders allowed markup', async () => {
  // Act
  const { getByText } = await render(<ArticleBody html="<p>Hello <strong>world</strong></p>" />);

  // Assert
  await expect.element(getByText('world', { exact: true })).toBeInTheDocument();
});

test('a script/onerror payload never reaches the DOM', async () => {
  // Arrange
  const malicious = '<p>Safe</p><script>window.__pwned = true;</script><img src="x.png" onerror="window.__pwned = true">';

  // Act
  const { getByTestId } = await render(<ArticleBody html={malicious} />);

  // Assert
  const html = getByTestId('article-body').element().innerHTML;
  expect(html).not.toContain('<script');
  expect(html).not.toContain('onerror');
});

test('clicking an internal anchor calls openLink instead of navigating', async () => {
  // Arrange
  const { getByText } = await render(<ArticleBody html='<p><a href="https://example.com/article">Read more</a></p>' />);

  // Act
  await getByText('Read more', { exact: true }).click();

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('link:open', 'https://example.com/article');
});

test('loads only the clicked embed', async () => {
  // Arrange
  const html = '<figure><a data-monfil-embed="youtube" href="https://www.youtube.com/watch?v=5HcjtbfJfCY">Castlevania video</a></figure><figure><a data-monfil-embed="x" href="https://x.com/levelsio/status/2103855452828147936">X post</a></figure>';
  const { getByTestId, getByRole } = await render(<ArticleBody html={html} />);

  // Assert
  expect(getByTestId('article-body').element().querySelectorAll('iframe')).toHaveLength(0);

  // Act
  await getByRole('button', { name: 'Load YouTube' }).click();

  // Assert
  const frames = getByTestId('article-body').element().querySelectorAll('iframe');
  expect(frames).toHaveLength(1);
  expect(frames[0]?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/5HcjtbfJfCY');
  await expect.element(getByRole('button', { name: 'Load X' })).toBeInTheDocument();
});

test('shows a load button for a saved X quote without its embed class', async () => {
  // Arrange
  const html = '<figure><blockquote><p>Launch coverage starts soon <a href="https://t.co/example">Watch live</a></p>— SpaceX (@SpaceX) <a href="https://x.com/SpaceX/status/2104354931595423762?ref_src=twsrc%5Etfw">September 27, 2026</a></blockquote></figure>';

  // Act
  const { getByRole, getByTestId } = await render(<ArticleBody html={html} />);

  // Assert
  await expect.element(getByRole('button', { name: 'Load X' })).toBeInTheDocument();
  expect(getByTestId('article-body').element().textContent).not.toContain('Launch coverage starts soon');
});

test('normalizes a feed-supplied iframe and lazy image', async () => {
  // Arrange
  const html = '<iframe src="https://player.vimeo.com/video/12345678"></iframe><iframe src="https://www.instagram.com/p/Cx123456789/embed/"></iframe><iframe src="https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ"></iframe><img data-src="images/story.jpg" src="data:image/svg+xml,%3Csvg/%3E" alt="Story image">';

  // Act
  const { getByRole, getByTestId } = await render(<ArticleBody html={html} sourceUrl="https://example.com/news/story" />);

  // Assert
  await expect.element(getByRole('button', { name: 'Load Vimeo' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Load Instagram' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Load Spotify' })).toBeInTheDocument();
  expect(getByTestId('article-body').element().querySelector('img')?.getAttribute('src')).toBe('https://example.com/news/images/story.jpg');
});

test('does not load an unsafe marker as a frame', async () => {
  // Arrange
  const html = '<a data-monfil-embed="youtube" href="https://www.youtube.com.evil.example/embed/5HcjtbfJfCY">Video</a>';

  // Act
  const { getByTestId } = await render(<ArticleBody html={html} />);

  // Assert
  expect(getByTestId('article-body').element().querySelector('iframe')).toBeNull();
  expect(getByTestId('article-body').element().querySelector('button')).toBeNull();
});
