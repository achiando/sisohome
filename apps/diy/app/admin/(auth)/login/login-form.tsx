"use client"

import { useActionState } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { login, type LoginState } from "../../auth-actions"

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="admin@tijwawelders.com"
        required
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        showPasswordToggle
        required
      />

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  )
}
