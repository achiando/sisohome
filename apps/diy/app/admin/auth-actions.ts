"use server"

import { redirect } from "next/navigation"
import { verifyPassword } from "@workspace/tijwa-db/password"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/session"

export interface LoginState {
  error?: string
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { error: "Enter your email and password." }

  const admin = await prisma.admin.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })

  if (!admin || !admin.isActive || !verifyPassword(password, admin.password)) {
    return { error: "Invalid email or password." }
  }

  await createSession(admin.id)
  redirect("/admin/products")
}
