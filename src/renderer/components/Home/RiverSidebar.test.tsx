import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider } from '@/providers/feeds-provider';
import RiverSidebar from './RiverSidebar';

beforeEach(() => {
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn().mockResolvedValue([]),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('clicking "Add feed" opens the add-feed modal', async () => {
  // Arrange
  const { getByRole } = await render(
    <FeedsProvider>
      <RiverSidebar feeds={[]} selectedFeedLink={null} onSelectFeed={vi.fn()} />
    </FeedsProvider>,
  );
  await expect.element(getByRole('heading', { name: 'Add a source' })).not.toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Add feed' }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Add a source' })).toBeInTheDocument();
});
