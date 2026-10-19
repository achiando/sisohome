import type { Metadata } from "next"
import CreateOrganizationScreen from "./_components/create-organization-screen"

export const metadata: Metadata = {
  title: "Create a workspace",
}

/**
 * Create an organization (route: /create-organization) — the ONE create
 * flow, reused by onboarding ("set up / create another") and the dashboard
 * shell (mobile "+"). Server wrapper for metadata; interactivity is client.
 */
export default function CreateOrganizationPage() {
  return <CreateOrganizationScreen />
}
