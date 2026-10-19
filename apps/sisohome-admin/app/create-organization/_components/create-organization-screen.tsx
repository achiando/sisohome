"use client"

/**
 * Create an organization — the single create flow for the whole app.
 *
 * Reached from:
 * - Onboarding ("Set up your workspace" / "Create another")
 * - Dashboard shell (mobile "+")
 *
 * Captures everything the previous inline/dialog flows had: kind selection
 * (each seeds its own roles), organization name, creation via POST
 * /api/onboarding (activates the new org on the session), and the `?next=`
 * deep link through to the destination. LANDLORD skips the naming step —
 * selecting it creates the workspace immediately from the user's account
 * details ("<name>'s Properties"). Guards: signed-out → login and
 * temporary-password → forced change, both returning here afterwards.
 *
 * Custom pieces live in _components/ (brand bar, kind picker); everything
 * else is @workspace/ui (Card, Text, Input, Button, PageLoader, toast).
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { PageLoader } from "@workspace/ui/components/loader"
import { Text } from "@workspace/ui/components/text"
import { toast } from "@workspace/ui/components/toast"
import { useAuth } from "@workspace/auth-ui"
import { readNextParam } from "@/lib/deep-link"
import { BrandBar } from "./brand-bar"
import { KindPicker, type OrgKind } from "./kind-picker"

export default function CreateOrganizationScreen() {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    isLoading,
    needsPasswordChange,
    refreshSession,
  } = useAuth()

  const [selected, setSelected] = useState<OrgKind | null>(null)
  const [orgName, setOrgName] = useState("")
  const [creating, setCreating] = useState(false)

  /** Return to THIS page (including any ?next=) after login / password change. */
  const returnHere = () => "/create-organization" + window.location.search

  // Guards: signed-out → login; temporary password → forced change first.
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(returnHere())}`)
    } else if (needsPasswordChange) {
      router.replace(
        `/change-password?next=${encodeURIComponent(returnHere())}`
      )
    }
  }, [isLoading, isAuthenticated, needsPasswordChange, router])

  /**
   * Landlord workspaces need no naming step — they're created instantly on
   * selection, using the signed-in landlord's own details for the org name.
   */
  const deriveLandlordName = () => {
    const name = user?.name?.trim()
    return name ? `${name}'s Properties` : "My Properties"
  }

  const createWorkspace = async (name: string, kind: OrgKind) => {
    setCreating(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, kind }),
      })
      const data = await res.json()
      if (!res.ok || !data.success)
        throw new Error(data.error || "Failed to create organization")
      await refreshSession()
      toast.success(
        kind === "LANDLORD" ? `Landlord workspace created — ${name}` : "Organization created"
      )
      router.push(readNextParam() ?? "/")
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create organization"
      )
      // Landlord: clear the selection so the tap can be retried (or another
      // kind chosen) instead of being stuck on a half-created state.
      if (kind === "LANDLORD") setSelected(null)
    } finally {
      setCreating(false)
    }
  }

  const handleKindChange = (kind: OrgKind) => {
    if (creating) return
    setSelected(kind)
    if (kind === "LANDLORD") void createWorkspace(deriveLandlordName(), "LANDLORD")
  }

  const handleCreate = () => {
    if (!selected || !orgName.trim() || creating) return
    void createWorkspace(orgName.trim(), selected)
  }

  const handleCancel = () => {
    // With an org → dashboard; freshly signing up → back to workspace pick.
    router.push(user?.organizationId ? "/" : "/onboarding")
  }

  // While auth resolves (or the guard redirects away).
  if (isLoading || !isAuthenticated || needsPasswordChange) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <BrandBar />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
          <PageLoader
            title="Preparing your workspace"
            description="One moment…"
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <BrandBar />

      {/* Full-height single-column card */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <Card variant="elevated" size="lg">
          <Text variant="headline" as="h1">
            Create a workspace
          </Text>
          <Text variant="bodyMuted">
            Pick the kind that fits. Landlord workspaces are set up instantly
            from your account — company kinds let you name them.
          </Text>

          <KindPicker
            value={selected}
            onChange={handleKindChange}
            disabled={creating}
          />

          <div className="space-y-3">
            {creating ? (
              <Text variant="bodyMuted">Setting up your workspace…</Text>
            ) : selected !== "LANDLORD" ? (
              <Input
                label="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Properties"
                disabled={creating}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    orgName.trim() &&
                    selected &&
                    !creating
                  ) {
                    handleCreate()
                  }
                }}
              />
            ) : null}
            <Button
              onClick={handleCreate}
              disabled={creating || !orgName.trim() || !selected}
              loading={creating}
              rightIcon={creating ? undefined : ArrowRight}
              className="w-full"
            >
              Create workspace
            </Button>
            <Button
              variant="text"
              onClick={handleCancel}
              disabled={creating}
              leftIcon={ArrowLeft}
              className="w-full"
            >
              {user?.organizationId ? "Cancel" : "Back to workspace selection"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}
