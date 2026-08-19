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
