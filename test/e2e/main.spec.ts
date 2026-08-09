import { test, expect, _electron as electron } from '@playwright/test'
import type { ResolvedTheme } from '../../src/renderer/providers/theme-provider'

test('example test', async () => {
  const electronApp = await electron.launch({ args: ['.'] })
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    return app.isPackaged
  })

  expect(isPackaged).toBe(false)

  const window = await electronApp.firstWindow()
  await window.screenshot({ path: 'test-results/intro.png' })

  await electronApp.close()
})

test('should toggle theme', async () => {
  const electronApp = await electron.launch({ args: ['.'] })
  const window = await electronApp.firstWindow()
  const rootClassBefore = await window.evaluate(() => document.documentElement.className)

  const themeToggleButton = window.getByRole('button', { name: 'Toggle theme' })
  await themeToggleButton.click()

  const rootClass = await window.evaluate(() => document.documentElement.className)
  const darkTheme = 'dark' satisfies ResolvedTheme
  expect(rootClass).toContain(darkTheme)

  await themeToggleButton.click()
  const rootClassAfter = await window.evaluate(() => document.documentElement.className)
  expect(rootClassAfter).toBe(rootClassBefore)

  await electronApp.close()
})
