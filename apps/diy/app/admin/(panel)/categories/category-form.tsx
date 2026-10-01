"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { UniversalForm } from "@workspace/ui/components/form"
import { createCategory, updateCategory } from "./actions"
import type { CategoryInput } from "@/lib/validate"

export interface CategoryFormCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

export function CategoryForm({ category }: { category?: CategoryFormCategory }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    sortOrder: category?.sortOrder ?? 0,
    isActive: category?.isActive ?? true,
  }))

  const handleChange = (name: string, value: unknown) => {
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  const buildInput = (source: Record<string, unknown>): CategoryInput => ({
    name: String(source.name ?? ""),
    slug: String(source.slug ?? ""),
    description: String(source.description ?? ""),
    sortOrder: Number(source.sortOrder ?? 0),
    isActive: source.isActive !== false,
  })

  const handleSubmit = (source: Record<string, unknown>) => {
    setErrors({})
    setFormError(null)
    const input = buildInput(source)

    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, input)
        : await createCategory(input)

      if (result.ok) {
        router.push("/admin/categories")
        router.refresh()
        return
      }

      setErrors(result.fieldErrors ?? {})
      setFormError(
        result.error ?? "Check the highlighted fields and try saving again.",
      )
    })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/categories"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All categories
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {category ? "Edit category" : "Add category"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {category
            ? `Update ${category.name}. Changes go live on the website immediately.`
            : "Create a category to group products in the catalogue."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <UniversalForm
          title={category ? "Edit category" : "Add category"}
          mode={category ? "edit" : "create"}
          isLoading={isPending}
          values={values}
          errors={errors}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/categories")}
          primaryLabel={category ? "Save category" : "Create category"}
          formClassName="w-full"
          sections={[
            {
              id: "basics",
              title: "Basics",
              description: "How the category is named and ordered.",
              columns: 4,
              fields: [
                {
                  name: "name",
                  label: "Category name",
                  type: "text",
                  colSpan: 2,
                  required: true,
                  placeholder: "Electronics Components",
                },
                {
                  name: "slug",
                  label: "Slug",
                  type: "text",
                  colSpan: 2,
                  helperText:
                    "Leave blank to generate it from the name. Lowercase letters, numbers and hyphens.",
                },
                {
                  name: "sortOrder",
                  label: "Sort order",
                  type: "number",
                  colSpan: 2,
                  helperText: "Lower numbers appear first in the catalogue.",
                },
              ],
            },
            {
              id: "content",
              title: "Content",
              description: "What customers read on the category page.",
              columns: 4,
              fields: [
                {
                  name: "description",
                  label: "Description",
                  type: "textarea",
                  rows: 3,
                  colSpan: 4,
                  placeholder: "One or two sentences about this group of products.",
                },
              ],
            },
            {
              id: "visibility",
              title: "Visibility",
              description: "Whether the category appears on the website.",
              columns: 4,
              fields: [
                {
                  name: "isActive",
                  label: "Visibility",
                  type: "toggle",
                  colSpan: 2,
                  toggleLabel: "Visible on the site",
                },
              ],
            },
          ]}
        >
          {formError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
        </UniversalForm>
      </div>
    </div>
  )
}
