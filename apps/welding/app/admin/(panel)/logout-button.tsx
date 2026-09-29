"use client"

import { LogOut } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export function LogoutButton({ compact }: { compact?: boolean }) {
  return (
    <form action="/admin/logout" method="post">
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        leftIcon={LogOut}
        className={compact ? "gap-1.5 text-muted-foreground" : "w-full justify-start gap-2 text-muted-foreground"}
      >
        Sign out
      </Button>
    </form>
  )
}
