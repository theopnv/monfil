import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import RiverCardImage from './RiverCardImage';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('renders the image when src is given', async () => {
  // Act
  const { getByTestId, getByText } = await render(<RiverCardImage src={TINY_PNG} />);

  // Assert
  await expect.element(getByTestId('river-card-image')).toBeVisible();
  await expect.element(getByText('article image')).not.toBeInTheDocument();
});

test('falls back to the placeholder when src is undefined', async () => {
  // Act
  const { getByText, getByTestId } = await render(<RiverCardImage src={undefined} />);

  // Assert
  await expect.element(getByText('article image')).toBeInTheDocument();
  await expect.element(getByTestId('river-card-image')).not.toBeInTheDocument();
});

test('falls back to the placeholder when the image fails to load', async () => {
  // Arrange
  const { getByText, getByTestId } = await render(<RiverCardImage src="/definitely-not-a-real-image.jpg" />);

  // Act
  getByTestId('river-card-image').element().dispatchEvent(new Event('error'));

  // Assert
  await expect.element(getByText('article image')).toBeInTheDocument();
});
