import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { getSession } from "@/lib/session"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Admin Sign In",
}

export default async function AdminLoginPage() {
  const session = await getSession()
  if (session) redirect("/admin/products")

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl">TijwaWelders Admin</CardTitle>
        <CardDescription>Sign in to manage the catalogue.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
