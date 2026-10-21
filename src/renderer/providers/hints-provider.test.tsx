// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useState } from 'react';
import { HINT_ORDER, HINTS_STORAGE_KEY, type HintId } from '@/lib/hints';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { HintsProvider, useHint } from './hints-provider';
import { HOME_WORKSPACE_ID, type FeedSummary, type WorkspaceSummary } from '../../shared/contracts';

const feed = { id: 1, link: 'https://a.example/feed', title: 'Feed A', showInWorkspace: 1, workspaceId: HOME_WORKSPACE_ID } as FeedSummary;
const home = { id: HOME_WORKSPACE_ID, name: 'Home' } as WorkspaceSummary;
const second = { id: 2, name: 'Work' } as WorkspaceSummary;

let invokeMock: ReturnType<typeof vi.fn>;

function stubElectron({ feeds = [] as FeedSummary[], workspaces = [home], hintsEnabled = true } = {}) {
  invokeMock = vi.fn((channel: string) => {
    switch (channel) {
      case 'app:hints-enabled': return Promise.resolve(hintsEnabled);
      case 'feeds:list': return Promise.resolve(feeds);
      case 'workspaces:list': return Promise.resolve(workspaces);
      default: return Promise.resolve(undefined);
    }
  });
  window.electron = {
    ipcRenderer: { invoke: invokeMock, on: vi.fn(() => vi.fn()), sendMessage: vi.fn(), once: vi.fn() },
  } as unknown as typeof window.electron;
}

function Probe({ id, ready = true }: { id: HintId; ready?: boolean }) {
  const { isOpen, dismiss } = useHint(id, { ready });
  return (
    <div>
      <output aria-label={`${id} state`}>{isOpen ? 'open' : 'closed'}</output>
      <button type="button" onClick={dismiss}>{`Got it ${id}`}</button>
    </div>
  );
}

function AllProbes({ ready = {} }: { ready?: Partial<Record<HintId, boolean>> }) {
  return <>{HINT_ORDER.map((id) => <Probe key={id} id={id} ready={ready[id] ?? true} />)}</>;
}

function storedState() {
  return JSON.parse(localStorage.getItem(HINTS_STORAGE_KEY) ?? 'null') as { initialized: boolean; seen: HintId[] } | null;
}

beforeEach(() => {
  localStorage.clear();
  stubElectron();
});

describe('HintsProvider on a fresh profile', () => {
  test('opens only the first hint of the order', async () => {
    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('open');
    await expect.element(getByLabelText('filter state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('save state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('workspace state')).toHaveTextContent('closed');
  });

  test('opens nothing before the first-run check finishes', async () => {
    // Arrange
    invokeMock.mockImplementation(() => new Promise(() => undefined));

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
  });

  test('"Got it" saves the hint as seen and opens the next one', async () => {
    // Arrange
    const { getByLabelText, getByRole } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('open');

    // Act
    await getByRole('button', { name: 'Got it add-feed' }).click();

    // Assert
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('filter state')).toHaveTextContent('open');
    expect(storedState()).toEqual({ initialized: true, seen: ['add-feed'] });
  });

  test('a later hint waits while the hint before it is not ready', async () => {
    // Arrange
    const { getByLabelText, getByRole } = await renderWithQueryClient(<HintsProvider><AllProbes ready={{ filter: false }} /></HintsProvider>);
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('open');

    // Act
    await getByRole('button', { name: 'Got it add-feed' }).click();

    // Assert
    await expect.element(getByLabelText('filter state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('save state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('workspace state')).toHaveTextContent('closed');
  });

  test('a hint opens once it becomes ready', async () => {
    // Arrange
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ initialized: true, seen: ['add-feed'] }));
    function ReadyLater() {
      const [ready, setReady] = useState(false);
      return (
        <>
          <Probe id="filter" ready={ready} />
          <button type="button" onClick={() => setReady(true)}>Add feeds</button>
        </>
      );
    }
    const { getByLabelText, getByRole } = await renderWithQueryClient(<HintsProvider><ReadyLater /></HintsProvider>);
    await expect.element(getByLabelText('filter state')).toHaveTextContent('closed');

    // Act
    await getByRole('button', { name: 'Add feeds' }).click();

    // Assert
    await expect.element(getByLabelText('filter state')).toHaveTextContent('open');
  });

  test('a hint without a mounted anchor does not open', async () => {
    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><Probe id="workspace" /></HintsProvider>);

    // Assert
    await expect.element(getByLabelText('workspace state')).toHaveTextContent('closed');
  });

  test('the first run is recorded', async () => {
    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('open');

    // Assert
    expect(storedState()).toEqual({ initialized: true, seen: [] });
  });
});

describe('HintsProvider for current users', () => {
  test('skips every hint when the Home workspace has feeds', async () => {
    // Arrange
    stubElectron({ feeds: [feed] });

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await vi.waitFor(() => expect(storedState()).toEqual({ initialized: true, seen: [...HINT_ORDER] }));
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
    await expect.element(getByLabelText('filter state')).toHaveTextContent('closed');
  });

  test('skips every hint when there is more than one workspace', async () => {
    // Arrange
    stubElectron({ workspaces: [home, second] });

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await vi.waitFor(() => expect(storedState()).toEqual({ initialized: true, seen: [...HINT_ORDER] }));
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
  });

  test('does not check again once the profile is initialized', async () => {
    // Arrange
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ initialized: true, seen: ['add-feed'] }));
    stubElectron({ feeds: [feed] });

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await expect.element(getByLabelText('filter state')).toHaveTextContent('open');
    expect(invokeMock).not.toHaveBeenCalledWith('feeds:list', expect.anything());
    expect(storedState()).toEqual({ initialized: true, seen: ['add-feed'] });
  });

  test('stays closed after a relaunch once every hint was seen', async () => {
    // Arrange
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ initialized: true, seen: [...HINT_ORDER] }));

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('app:hints-enabled', undefined));
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
  });
});

describe('HintsProvider off switch', () => {
  test('opens no hint when hints are off', async () => {
    // Arrange
    stubElectron({ hintsEnabled: false });

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);

    // Assert
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('app:hints-enabled', undefined));
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
  });

  test('does not write the profile when hints are off', async () => {
    // Arrange
    stubElectron({ hintsEnabled: false });

    // Act
    const { getByLabelText } = await renderWithQueryClient(<HintsProvider><AllProbes /></HintsProvider>);
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');

    // Assert
    expect(storedState()).toBeNull();
  });
});

describe('useHint without a provider', () => {
  test('stays closed', async () => {
    // Act
    const { getByLabelText } = await renderWithQueryClient(<Probe id="add-feed" />);

    // Assert
    await expect.element(getByLabelText('add-feed state')).toHaveTextContent('closed');
  });
});
