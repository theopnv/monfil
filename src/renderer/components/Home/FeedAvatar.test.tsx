import { test, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import FeedAvatar from './FeedAvatar';

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
