import type { Metadata } from 'next'
import ChangePasswordScreen from './change-password-screen'

export const metadata: Metadata = {
  title: 'Change password',
}

/**
 * Forced password-change screen (route: /change-password) — server wrapper
 * for metadata; all interactivity lives in the client screen.
 */
export default function ChangePasswordPage() {
  return <ChangePasswordScreen />
}
