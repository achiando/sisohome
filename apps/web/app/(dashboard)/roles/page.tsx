import { redirect } from 'next/navigation'

/** Legacy `/roles` URL — Roles & Permissions now lives under Settings. */
export default function LegacyRolesPage() {
  redirect('/settings/roles')
}
