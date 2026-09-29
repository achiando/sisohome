import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getSession, type SessionPayload } from "@/lib/session"

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect("/admin/login")

  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, isActive: true },
  })

  if (!admin || !admin.isActive) redirect("/admin/login")

  return session
}
