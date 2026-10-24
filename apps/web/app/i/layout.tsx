import type { Metadata } from 'next'

/**
 * /i route group layout — branded frame for the public self-onboarding
 * page (people plan §5). Applicants arrive with no session, so this sits
 * outside the auth flow and mirrors the (auth) shell: brand bar, centered
 * card, quiet footer. Capability URLs stay out of search results.
 */

export const metadata: Metadata = {
  title: 'Apply',
  robots: { index: false, follow: false },
}

export default function IntakeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-2.5 px-4 py-4 md:px-8">
        <span
          className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <span className="text-base font-bold leading-none">S</span>
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          SisoHome
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6 md:px-8">
        <div className="w-full max-w-xl">{children}</div>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-muted-foreground md:px-8">
        Property operations, calmly organized.
      </footer>
    </div>
  )
}
