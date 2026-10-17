/**
 * Settings section layout — nested inside the AppShell.
 *
 * Desktop: settings sub-sidebar (SettingsNav) + content column.
 * Mobile: scrollable pill sub-nav under the shell app bar ("Settings"),
 * then the page content.
 */

import { SettingsNav } from './_components/settings-nav'

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="space-y-6">
      {/* Section header — mobile gets "Settings" from the shell app bar */}
      <div>
        <h1 className="hidden text-2xl font-semibold tracking-tight text-foreground md:block md:text-[24px]">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground md:mt-1">
          Your profile, workspace preferences, and access.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-8">
        <aside className="md:w-56 md:shrink-0">
          <SettingsNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
