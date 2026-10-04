import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { requireAdmin } from "@/lib/admin"
import { AdminNav } from "./admin-nav"
import { LogoutButton } from "./logout-button"

export default async function AdminPanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col md:flex-row">
        <aside className="flex w-full flex-col gap-5 border-b border-border bg-card p-4 md:w-64 md:shrink-0 md:border-r md:border-b-0 md:p-5">
          <div className="flex items-center justify-between gap-3 md:block">
            <Link href="/admin/products" className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight">
                ODHERU Electronics
              </span>
              <Badge className="text-[10px] tracking-wider uppercase">
                Admin
              </Badge>
            </Link>
            <div className="md:hidden">
              <LogoutButton compact />
            </div>
          </div>

          <AdminNav />

          <div className="mt-auto hidden md:block">
            <LogoutButton />
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
