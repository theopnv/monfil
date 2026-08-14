import { test, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import FeedAvatar from './FeedAvatar';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test.for([
  { title: 'SingleWord', expected: 'SI' },
  { title: 'Two Words', expected: 'TW' },
  { title: 'Three Words', expected: 'TW' },
  { title: '   Leading and trailing spaces   ', expected: 'LA' },
  { title: 'Single', expected: 'SI' },
  { title: '', expected: '' },
])('FeedAvatar($title) renders $expected initials correctly', async ({ title, expected }) => {
  // Act
  const { getByText } = await render(<FeedAvatar title={title} />);

  // Assert
  await expect.element(getByText(expected)).toBeInTheDocument();
});

test('renders the favicon image when it loads', async () => {
  // Act
  const { getByTestId, getByText } = await render(<FeedAvatar title="Example Feed" faviconUrl={TINY_PNG} />);

  // Assert
  await expect.element(getByTestId('favicon-img')).toBeVisible();
  await expect.element(getByText('EF', { exact: true })).not.toBeInTheDocument();
});

test('falls back to initials when the favicon fails to load', async () => {
  // Act
  const { getByText } = await render(<FeedAvatar title="Example Feed" faviconUrl="/definitely-not-a-real-favicon.ico" />);

  // Assert
  await expect.element(getByText('EF', { exact: true })).toBeInTheDocument();
});
