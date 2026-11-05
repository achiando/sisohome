import type { Metadata } from "next"

import { VerifyEmailCard } from "@workspace/auth-ui"

export const metadata: Metadata = {
  title: "Verify your email",
}

export default async function VerifyEmailByCodePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; email?: string | string[] }>
}) {
  const params = await searchParams
  const code = typeof params.code === "string" ? params.code : ""
  // Carried from login/signup so resend works in one click — no retyping.
  const email = typeof params.email === "string" ? params.email : ""

  return <VerifyEmailCard code={code} mode="code" email={email} redirectTo="/onboarding" />
}
