import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Text } from '@workspace/ui/components/text'
import { CONSENT_VERSIONS } from '@/lib/consent-versions'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

/** Public legal document — must stay reachable without a session (proxy). */
export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
          <CardDescription>
            Version {CONSENT_VERSIONS.TERMS_OF_SERVICE} — effective{' '}
            {new Date(CONSENT_VERSIONS.TERMS_OF_SERVICE.split('-').slice(1).join('-')).toLocaleDateString(
              'en-US',
              { year: 'numeric', month: 'long', day: 'numeric' },
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Text variant="body">
            These Terms of Service govern your access to and use of SisoHome, including creating an
            account, joining an organization workspace, and using any feature offered through the
            product.
          </Text>

          <Text variant="headline" as="h2">1. Your account</Text>
          <Text variant="body">
            You must provide accurate information and keep your credentials secure. You are
            responsible for activity under your account and for maintaining access to the email
            address registered to it.
          </Text>

          <Text variant="headline" as="h2">2. Your workspace</Text>
          <Text variant="body">
            SisoHome is multi-tenant: each organization workspace is isolated. Your access to data
            inside a workspace is governed by the roles and permissions that workspace&apos;s
            administrators assign to you.
          </Text>

          <Text variant="headline" as="h2">3. Acceptable use</Text>
          <Text variant="body">
            Do not misuse the service, attempt to access data outside your workspaces, or use the
            product to violate applicable law.
          </Text>

          <Text variant="headline" as="h2">4. Changes</Text>
          <Text variant="body">
            When these Terms change, we will publish a new version and ask you to accept it before
            continuing to use the product. Previous versions remain on record with the date you
            accepted them.
          </Text>

          <Text variant="bodyMuted">
            Questions? Contact your workspace administrator or reply to any SisoHome email from your
            account address.
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
