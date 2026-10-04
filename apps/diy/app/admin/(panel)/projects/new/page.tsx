import type { Metadata } from "next"
import { prisma } from "@/lib/db"
import { ProjectForm } from "../project-form"

export const metadata: Metadata = {
  title: "Add Project - ODHERU Electronics Admin",
}

export default async function NewProjectPage() {
  const products = await prisma.diyProduct.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return <ProjectForm products={products} />
}
