import { beforeEach, expect, test, vi } from 'vitest';
import { dialog } from 'electron';
import { backUpDatabase } from '../db/database';
import { handleAppBackUpDatabase } from './handlers';

vi.mock(import('electron'), () => ({ dialog: { showSaveDialog: vi.fn() } as unknown as Electron.Dialog }));
vi.mock(import('../db/database'), async (importOriginal) => ({ ...await importOriginal(), backUpDatabase: vi.fn() }));

beforeEach(() => {
  vi.mocked(dialog.showSaveDialog).mockReset();
  vi.mocked(backUpDatabase).mockReset();
});

test('cancelling a backup leaves the database alone', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });

  // Act
  const result = await handleAppBackUpDatabase();

  // Assert
  expect(result).toMatchObject({ success: false, error: { name: 'CANCELLED' } });
  expect(backUpDatabase).not.toHaveBeenCalled();
});

test('backup failure reaches Settings', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'backup.db' });
  vi.mocked(backUpDatabase).mockRejectedValue(new Error('disk full'));

  // Act
  const result = await handleAppBackUpDatabase();

  // Assert
  expect(result).toEqual({ success: false, error: { name: 'BACKUP_FAILED', message: 'disk full' } });
});
