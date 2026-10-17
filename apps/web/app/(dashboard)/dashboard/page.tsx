import { redirect } from 'next/navigation'

/** Legacy `/dashboard` URL — Overview now lives at `/`. */
export default function LegacyDashboardPage() {
  redirect('/')
}
