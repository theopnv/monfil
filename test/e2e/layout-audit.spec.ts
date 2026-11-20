// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LANGUAGE_CODES } from '../../src/shared/i18n/languages';
import { expect, rss, serve, test as base } from './fixtures';

const REPORT_DIR = process.env['LAYOUT_AUDIT_DIR'];
const SEEDED_TEXT = ['Équipe RH et personnes', 'Un flux avec un titre assez long pour la barre', 'Technologie et ingénierie logicielle'] as const;

const bundles = new Map<string, unknown>();

async function label(code: string, ns: string, key: string): Promise<string> {
  const file = path.join('src/shared/i18n/locales', code, `${ns}.json`);
  if (!bundles.has(file)) {
    bundles.set(file, JSON.parse(await readFile(file, 'utf8')));
  }
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], bundles.get(file));
  if (typeof value !== 'string') {
    throw new Error(`no label ${ns}:${key} in ${code}`);
  }
  return value;
}

// Runs inside the page. Every problem is one line that names the element, so a failing run says what to fix.
async function layoutProblems(root: Locator): Promise<string[]> {
  return root.evaluate((rootElement, seeded) => {
    const problems: string[] = [];
    const rootBox = rootElement.getBoundingClientRect();
    const describe = (element: Element) => {
      const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const classes = (element.getAttribute('class') ?? '').split(/\s+/).slice(0, 3).join('.');
      return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}> "${text}"`;
    };
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const scrollsSideways = (element: Element) => {
      for (let node: Element | null = element; node && node !== rootElement.parentElement; node = node.parentElement) {
        if (node !== element && ['auto', 'scroll'].includes(getComputedStyle(node).overflowX)) {
          return true;
        }
      }
      return false;
    };

    if (rootElement.scrollWidth - rootElement.clientWidth > 1) {
      problems.push(`root scrolls sideways by ${rootElement.scrollWidth - rootElement.clientWidth}px`);
    }
    for (const element of rootElement.querySelectorAll('*')) {
      if (!visible(element) || element.closest('svg') || element.tagName === 'OPTION') {
        continue;
      }
      const box = element.getBoundingClientRect();
      if (!scrollsSideways(element) && (box.right > rootBox.right + 1 || box.left < rootBox.left - 1)) {
        problems.push(`outside the box: ${describe(element)}`);
      }
      const style = getComputedStyle(element);
      const hasText = (element.textContent ?? '').trim() !== '';
      const hasLiveRegion = element.querySelector('.sr-only') !== null || element.classList.contains('sr-only');
      const isSeededText = seeded.some((text) => (element.textContent ?? '').includes(text));
      if (hasText && !hasLiveRegion && !isSeededText && !(element instanceof HTMLInputElement) && !['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth - element.clientWidth > 1) {
        problems.push(`clipped sideways by ${element.scrollWidth - element.clientWidth}px: ${describe(element)}`);
      }
      if (hasText && !hasLiveRegion && ['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight - element.clientHeight > 4 && !element.matches('[role=dialog], section')) {
        problems.push(`clipped vertically by ${element.scrollHeight - element.clientHeight}px: ${describe(element)}`);
      }
      if (element.matches('button, [role=button], a') && hasText && (element.textContent ?? '').trim().length <= 40 && element.querySelectorAll('span').length < 3 && !isSeededText) {
        const tops: number[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if ((node.textContent ?? '').trim() === '') {
            continue;
          }
          const range = document.createRange();
          range.selectNodeContents(node);
          tops.push(...[...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => rect.top));
        }
        tops.sort((a, b) => a - b);
        const lines = tops.filter((top, index) => index === 0 || top - (tops[index - 1] ?? top) > 6).length;
        if (lines > 1) {
          problems.push(`label wraps over ${lines} lines: ${describe(element)}`);
        }
      }
      const direction = style.flexDirection;
      const buttons = element.classList.contains('border-t') && style.display.includes('flex') && direction.startsWith('row') ? [...element.children].filter((child) => child.matches('button, [role=button]') && visible(child)) : [];
      if (buttons.length > 1) {
        const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
        if (Math.max(...tops) - Math.min(...tops) > 6) {
          problems.push(`buttons split over several rows: ${describe(element)}`);
        }
      }
    }
    return problems;
  }, [...SEEDED_TEXT]);
}

type Context = {
  app: ElectronApplication;
  page: Page;
  code: string;
  blogUrl: string;
  ids: { workspace: number; feed: number; category: number };
  report: (scenario: string, root: Locator) => Promise<void>;
};

type Scenario = { name: string; run: (context: Context) => Promise<void> };

async function sendMenuAction(app: ElectronApplication, kind: string, action: string, id: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, menu) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('menu:action', menu);
  }, { kind, action, id });
}

async function goHome(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.history.pushState(null, '', '#/');
  });
  await page.waitForTimeout(250);
}

async function closeDialogs(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}

const dialogOf = (page: Page) => page.getByRole('dialog').last();

const SCENARIOS: Scenario[] = [
  {
    name: 'new workspace, feedpack browser, feedpack preview',
    run: async ({ page, code, report }) => {
      await goHome(page);
      await page.getByRole('button', { name: await label(code, 'workspace', 'rail.new') }).first().click();
      await expect(dialogOf(page)).toBeVisible();
      await report('new-workspace', dialogOf(page));
      await dialogOf(page).getByRole('button', { name: await label(code, 'workspace', 'dialog.browse') }).click();
      await page.waitForTimeout(500);
      await report('feedpack-browser', dialogOf(page));
      await dialogOf(page).locator('button.justify-start').first().click();
      await page.waitForTimeout(500);
      await report('feedpack-preview', dialogOf(page));
    },
  },
  {
    name: 'edit workspace',
    run: async ({ app, page, ids, report }) => {
      await sendMenuAction(app, 'workspace', 'edit', ids.workspace);
      await expect(dialogOf(page)).toBeVisible();
      await report('edit-workspace', dialogOf(page));
    },
  },
  {
    name: 'delete workspace',
    run: async ({ app, page, ids, report }) => {
      await sendMenuAction(app, 'workspace', 'delete', ids.workspace);
      await expect(dialogOf(page)).toBeVisible();
      await report('delete-workspace', dialogOf(page));
    },
  },
  {
    name: 'delete feed',
    run: async ({ app, page, ids, report }) => {
      await goHome(page);
      await sendMenuAction(app, 'feed', 'delete', ids.feed);
      await expect(dialogOf(page)).toBeVisible();
      await report('delete-feed', dialogOf(page));
    },
  },
  {
    name: 'move feed',
    run: async ({ app, page, ids, report }) => {
      await goHome(page);
      await sendMenuAction(app, 'feed', 'move', ids.feed);
      await expect(dialogOf(page)).toBeVisible();
      await report('move-feed', dialogOf(page));
    },
  },
  {
    name: 'delete folder',
    run: async ({ app, page, ids, report }) => {
      await goHome(page);
      await sendMenuAction(app, 'category', 'delete', ids.category);
      await expect(dialogOf(page)).toBeVisible();
      await report('delete-folder', dialogOf(page));
    },
  },
  {
    name: 'add feed wizard',
    run: async ({ page, code, blogUrl, report }) => {
      await goHome(page);
      await page.getByRole('button', { name: await label(code, 'river', 'sidebar.addFeed'), exact: true }).first().click();
      await expect(dialogOf(page)).toBeVisible();
      await report('add-feed-1-find', dialogOf(page));
      await dialogOf(page).getByRole('textbox').first().fill(blogUrl);
      await dialogOf(page).getByRole('button', { name: await label(code, 'addFeed', 'footer.continue') }).click();
      await page.waitForTimeout(1200);
      await report('add-feed-2-configure', dialogOf(page));
      await dialogOf(page).getByRole('button', { name: SEEDED_TEXT[2] }).click();
      await dialogOf(page).getByRole('button', { name: await label(code, 'addFeed', 'footer.add') }).click();
      await page.waitForTimeout(800);
      await report('add-feed-3-done', dialogOf(page));
    },
  },
  {
    name: 'import OPML',
    run: async ({ page, code, report }) => {
      await page.evaluate(() => {
        window.history.pushState(null, '', '#/settings');
      });
      await page.getByRole('button', { name: await label(code, 'settings', 'data.importOpml') }).first().click();
      await expect(dialogOf(page)).toBeVisible();
      await report('import-opml', dialogOf(page));
    },
  },
  {
    name: 'usage stats preview',
    run: async ({ page, code, report }) => {
      await page.evaluate(() => {
        window.history.pushState(null, '', '#/settings');
      });
      await page.getByRole('button', { name: await label(code, 'settings', 'privacy.preview') }).first().click();
      await expect(dialogOf(page)).toBeVisible();
      await page.waitForTimeout(400);
      await report('usage-preview', dialogOf(page));
    },
  },
  {
    name: 'workspace switcher',
    run: async ({ page, report }) => {
      await goHome(page);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
      await expect(dialogOf(page)).toBeVisible();
      await report('switcher', dialogOf(page));
    },
  },
  {
    name: 'search syntax and save search',
    run: async ({ page, code, report }) => {
      await goHome(page);
      await page.getByPlaceholder(await label(code, 'river', 'header.search')).first().fill('title:engineer');
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: await label(code, 'river', 'saveControl.saveSearch') }).first().click();
      await page.waitForTimeout(300);
      await report('save-search', dialogOf(page));
    },
  },
  {
    name: 'empty workspace',
    run: async ({ page, ids, report }) => {
      await page.evaluate((id) => {
        window.history.pushState(null, '', `#/workspace/${id}`);
      }, ids.workspace);
      await page.waitForTimeout(600);
      await report('page-empty-workspace', page.locator('#root'));
      await page.getByRole('button').filter({ hasText: /OPML/ }).first().click();
      await page.waitForTimeout(300);
      await report('import-opml-into-workspace', dialogOf(page));
    },
  },
  {
    name: 'reader',
    run: async ({ page, report }) => {
      await goHome(page);
      await closeDialogs(page);
      await page.locator('article').first().click();
      await page.waitForTimeout(900);
      await report('page-reader', page.locator('#root'));
    },
  },
  {
    name: 'expanded rail',
    run: async ({ page, report }) => {
      await page.evaluate(() => window.electron.ipcRenderer.invoke('settings:set', { key: 'workspaceRailExpanded', value: true }));
      await page.reload();
      await page.waitForTimeout(900);
      await report('page-expanded-rail', page.locator('#root'));
      await page.evaluate(() => window.electron.ipcRenderer.invoke('settings:set', { key: 'workspaceRailExpanded', value: false }));
    },
  },
  {
    name: 'whole pages',
    run: async ({ page, report }) => {
      await goHome(page);
      await closeDialogs(page);
      await report('page-home', page.locator('#root'));
      await page.evaluate(() => {
        window.history.pushState(null, '', '#/settings');
      });
      await page.waitForTimeout(500);
      await report('page-settings', page.locator('#root'));
    },
  },
];

const auditTest = base.extend<{ blogUrl: string }>({
  blogUrl: async ({}, use) => {
    const server = await serve((request, response) => {
      if (request.url === '/posts.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss([{ title: 'Hello', link: 'http://127.0.0.1/hello' }], 'Blog posts'));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><head><title>Local blog</title><link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.xml"></head><body>Hello</body></html>');
    });
    try {
      await use(`${server.origin}/`);
    } finally {
      await server.close();
    }
  },
});

function item(index: number) {
  return {
    title: `Article ${index}`, guid: `guid-${index}`, link: `http://127.0.0.1/a${index}`, pubDate: new Date().toISOString(),
    description: '<p>A summary of the article that is long enough to fill a line or two of the card.</p>', image: undefined, author: undefined, extra: undefined, read_at: undefined,
  };
}

// The longest drafts (de, fr), a CJK script (ja), and a right-to-left one (ar). LAYOUT_AUDIT_ALL=1 checks every language.
const AUDITED = process.env['LAYOUT_AUDIT_ALL'] ? LANGUAGE_CODES : (['fr', 'de', 'ja', 'ar'] as const);

for (const code of AUDITED) {
  auditTest(`no dialog breaks its layout in ${code}`, async ({ blogUrl, launchElectron }, testInfo) => {
    testInfo.setTimeout(240_000);
    const { app, page } = await launchElectron();
    const problems: string[] = [];
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('select, button').first()).toBeVisible();
    const created = await page.evaluate((name) => window.electron.ipcRenderer.invoke('workspaces:create', { name, icon: 'Code01', color: '#d67f48' }), SEEDED_TEXT[0]);
    const added = await page.evaluate(({ items, title, categoryName }) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
      link: 'http://127.0.0.1/feed-audit', title, type: 'rss', items, categoryName, workspaceId: 1, showInWorkspace: true,
    }), { items: [1, 2, 3].map(item), title: SEEDED_TEXT[1], categoryName: SEEDED_TEXT[2] });
    if (!('success' in created) || !created.success || !('success' in added) || !added.success) {
      throw new Error('seeding failed');
    }
    const categories = await page.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list-categories', { workspaceId: 1 }));
    await page.evaluate(() => {
      window.history.pushState(null, '', '#/settings');
    });
    await page.locator('select').filter({ has: page.locator('option[value="ar"]') }).selectOption(code);
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(code);
    await page.reload();
    await page.waitForTimeout(800);
    const ids = { workspace: created.data.id, feed: added.data.id, category: (categories as { id: number }[])[0]?.id ?? 0 };

    const context: Context = {
      app, page, code, blogUrl, ids,
      report: async (scenario, root) => {
        for (const problem of await layoutProblems(root)) {
          problems.push(`${code} | ${scenario} | ${problem}`);
        }
        if (REPORT_DIR) {
          await mkdir(REPORT_DIR, { recursive: true });
          await root.screenshot({ path: path.join(REPORT_DIR, `${code}-${scenario}.png`) });
        }
      },
    };
    for (const scenario of SCENARIOS) {
      try {
        await scenario.run(context);
      } catch (error) {
        problems.push(`${code} | ${scenario.name} | could not run: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        if (REPORT_DIR) {
          await mkdir(REPORT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(REPORT_DIR, `${code}-FAILED-${scenario.name.replaceAll(' ', '-')}.png`) });
        }
      }
      await closeDialogs(page);
    }
    if (REPORT_DIR) {
      await writeFile(path.join(REPORT_DIR, `${code}.txt`), `${problems.join('\n')}\n`);
    }
    expect(problems).toEqual([]);
  });
}
