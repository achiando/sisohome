import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Text } from '@workspace/ui/components/text'
import { CONSENT_VERSIONS } from '@/lib/consent-versions'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

/** Public legal document — must stay reachable without a session (proxy). */
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
          <CardDescription>
            Version {CONSENT_VERSIONS.PRIVACY_POLICY} — effective{' '}
            {new Date(CONSENT_VERSIONS.PRIVACY_POLICY.split('-').slice(1).join('-')).toLocaleDateString(
              'en-US',
              { year: 'numeric', month: 'long', day: 'numeric' },
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Text variant="body">
            This Privacy Policy explains what SisoHome collects, why, and the choices you have. It
            applies to your account and to your activity inside every organization workspace you
            belong to.
          </Text>

          <Text variant="headline" as="h2">What we collect</Text>
          <Text variant="body">
            Your name, email address, and optionally a phone number and profile details. Inside a
            workspace, the content administrators and members put there (properties, people,
            activity) is stored to provide the service. Security metadata — sign-in times, device
            and approximate location for sign-in notices, and consent records — is kept to protect
            your account.
          </Text>

          <Text variant="headline" as="h2">How it is used</Text>
          <Text variant="body">
            To run the product: authenticate you, isolate each organization&apos;s data, notify you
            of security-relevant events, and support administrators who manage your access.
          </Text>

          <Text variant="headline" as="h2">Sharing</Text>
          <Text variant="body">
            Data inside a workspace is visible to that workspace&apos;s administrators according to
            their role permissions. We do not sell your personal data.
          </Text>

          <Text variant="headline" as="h2">Retention and your choices</Text>
          <Text variant="body">
            Consent records are kept as a legal record of what you accepted and when. You can ask
            your workspace administrator to export or delete workspace content, and ask us to
            delete your account where no legal obligation requires retention.
          </Text>

          <Text variant="headline" as="h2">Changes</Text>
          <Text variant="body">
            When this policy changes we publish a new version and ask you to accept it before
            continuing. Earlier versions stay on record with your acceptance date.
          </Text>

          <div className="pt-2">
            <Link href="/signup" className="text-sm text-primary hover:underline">
              Back to sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
