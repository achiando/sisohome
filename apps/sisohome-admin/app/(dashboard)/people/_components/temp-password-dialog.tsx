'use client'

/**
 * One-time display of a newly created member's temporary password.
 * Shown exactly once — it is never retrievable again. Closing resets it.
 */

import { Button } from '@workspace/ui/components/button'
import { MemberDialog } from './member-dialog'

export function TempPasswordDialog({
  open,
  email,
  tempPassword,
  onClose,
}: {
  open: boolean
  email: string
  tempPassword: string
  onClose: () => void
}) {
  return (
    <MemberDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Member created"
      description={`Share this temporary password with ${email}. It is shown only once and cannot be retrieved again. They will be prompted to change it on first login.`}
      footer={
        <Button variant="primary" className="h-11 rounded-xl" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-muted p-4 text-center">
        <p className="font-mono text-lg font-semibold tracking-wide">
          {tempPassword}
        </p>
      </div>
    </MemberDialog>
  )
}
