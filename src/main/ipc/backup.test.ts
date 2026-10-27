// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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

test('a finished backup writes to the chosen file', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'chosen/backup.db' });
  vi.mocked(backUpDatabase).mockResolvedValue();

  // Act
  const result = await handleAppBackUpDatabase();

  // Assert
  expect(result).toEqual({ success: true, data: undefined });
  expect(backUpDatabase).toHaveBeenCalledExactlyOnceWith('chosen/backup.db');
});

test('a dialog that returns no file path counts as cancelled', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: '' });

  // Act
  const result = await handleAppBackUpDatabase();

  // Assert
  expect(result).toMatchObject({ success: false, error: { name: 'CANCELLED' } });
  expect(backUpDatabase).not.toHaveBeenCalled();
});

test('the save dialog offers a dated .db file name', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });

  // Act
  await handleAppBackUpDatabase();

  // Assert
  const options = vi.mocked(dialog.showSaveDialog).mock.calls[0]?.[0];
  expect(options?.defaultPath).toMatch(/^monfil-backup-\d{4}-\d{2}-\d{2}\.db$/);
  expect(options?.filters).toEqual([{ name: 'SQLite database', extensions: ['db'] }]);
});

test('a backup failure that is not an Error keeps its text', async () => {
  // Arrange
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: 'backup.db' });
  vi.mocked(backUpDatabase).mockRejectedValue('quota exceeded');

  // Act
  const result = await handleAppBackUpDatabase();

  // Assert
  expect(result).toEqual({ success: false, error: { name: 'BACKUP_FAILED', message: 'quota exceeded' } });
});
