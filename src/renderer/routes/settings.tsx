import { createFileRoute } from '@tanstack/react-router'

import { ThemeToggle } from '@/components/ThemeToggle';

export const Route = createFileRoute('/settings')({
  component: SettingsComponent,
})

function SettingsComponent() {
  return <div>
    <h1>Settings</h1>
    <ThemeToggle />
  </div>
}
