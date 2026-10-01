"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { UniversalForm } from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { ImagesEditor, RowActions, moveRow } from "@/components/admin/images-editor"
import { createProject, updateProject } from "./actions"
import { parseProductImages, type ProductImageInput } from "@/lib/product-input"
import type {
  ProjectInput,
  ProjectProductLinkInput,
  ProjectStepInput,
} from "@/lib/validate"

interface FormProduct {
  id: string
  name: string
}

export interface ProjectFormProject {
  id: string
  title: string
  slug: string
  category: string | null
  shortDesc: string | null
  description: string | null
  steps: unknown
  images: unknown
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string | null
  seoDesc: string | null
  productLinks: { productId: string; quantity: number; isRequired: boolean }[]
}

interface StepRow {
  title: string
  body: string
}

interface LinkRow {
  productId: string
  quantity: string
  isRequired: boolean
}

function toStepRows(raw: unknown): StepRow[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry): StepRow[] => {
    if (entry && typeof entry === "object") {
      const item = entry as { title?: unknown; body?: unknown }
      const title = typeof item.title === "string" ? item.title : ""
      const body = typeof item.body === "string" ? item.body : ""
      return title || body ? [{ title, body }] : []
    }
    return []
  })
}

function toImageRows(raw: unknown) {
  return parseProductImages(raw).map((item) => ({ url: item.url, alt: item.alt }))
}

function toLinkRows(links: ProjectFormProject["productLinks"]): LinkRow[] {
  return links.map((link) => ({
    productId: link.productId,
    quantity: String(link.quantity),
    isRequired: link.isRequired,
  }))
}

function StepsEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: unknown) => void
  error?: string
}) {
  const rows: StepRow[] = Array.isArray(value)
    ? (value as StepRow[]).map((row) => ({
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
      }))
    : []

  const update = (index: number, patch: Partial<StepRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No build steps yet. Add clear, safe steps a customer can follow.
        </p>
      ) : null}

      <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_auto]">
        <span>Step</span>
        <span>Instructions</span>
        <span className="w-24 text-right">Order</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_auto] sm:items-start"
        >
          <Input
            aria-label={`Step ${index + 1} title`}
            inputSize="sm"
            placeholder="Wire the sensor"
            value={row.title}
            onChange={(e) => update(index, { title: e.target.value })}
          />
          <Textarea
            aria-label={`Step ${index + 1} instructions`}
            size="sm"
            rows={2}
            placeholder="What to do in this step."
            value={row.body}
            onChange={(e) => update(index, { body: e.target.value })}
          />
          <RowActions
            index={index}
            count={rows.length}
            label="step"
            onMove={(i, dir) => onChange(moveRow(rows, i, dir))}
            onRemove={(i) => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={Plus}
        onClick={() => onChange([...rows, { title: "", body: "" }])}
      >
        Add step
      </Button>
    </div>
  )
}

function ProjectProductsEditor({
  value,
  onChange,
  products,
}: {
  value: unknown
  onChange: (next: unknown) => void
  products: FormProduct[]
  error?: string
}) {
  const rows: LinkRow[] = Array.isArray(value)
    ? (value as LinkRow[]).map((row) => ({
        productId: String(row.productId ?? ""),
        quantity: String(row.quantity ?? "1"),
        isRequired: row.isRequired !== false,
      }))
    : []

  const update = (index: number, patch: Partial<LinkRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {products.length === 0
            ? "No products in the catalogue yet. Add products first, then list what a project needs here."
            : "No products listed yet. Add what the customer needs for this project."}
        </p>
      ) : null}

      <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.8fr)_5.5rem_8rem_auto]">
        <span>Product</span>
        <span>Qty</span>
        <span>Required</span>
        <span className="w-24 text-right">Order</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[minmax(0,1.8fr)_5.5rem_8rem_auto] sm:items-end"
        >
          <Select
            value={row.productId || undefined}
            onValueChange={(next) => update(index, { productId: next ?? "" })}
          >
            <SelectTrigger
              aria-label={`Product ${index + 1}`}
              size="sm"
              placeholder="Select product..."
            />
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={`Quantity for product ${index + 1}`}
            inputSize="sm"
            type="number"
            min={1}
            value={row.quantity}
            onChange={(e) => update(index, { quantity: e.target.value })}
          />
          <Switch
            size="sm"
            label={row.isRequired ? "Required" : "Recommended"}
            checked={row.isRequired}
            onCheckedChange={(checked) => update(index, { isRequired: checked })}
          />
          <RowActions
            index={index}
            count={rows.length}
            label="product"
            onMove={(i, dir) => onChange(moveRow(rows, i, dir))}
            onRemove={(i) => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={Plus}
        disabled={products.length === 0}
        onClick={() => onChange([...rows, { productId: "", quantity: "1", isRequired: true }])}
      >
        Add product
      </Button>
    </div>
  )
}

export function ProjectForm({
  project,
  products,
}: {
  project?: ProjectFormProject
  products: FormProduct[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    title: project?.title ?? "",
    slug: project?.slug ?? "",
    category: project?.category ?? "",
    shortDesc: project?.shortDesc ?? "",
    description: project?.description ?? "",
    steps: toStepRows(project?.steps),
    images: toImageRows(project?.images),
    products: project ? toLinkRows(project.productLinks) : [],
    sortOrder: project?.sortOrder ?? 0,
    isFeatured: project?.isFeatured ?? false,
    isActive: project?.isActive ?? true,
    seoTitle: project?.seoTitle ?? "",
    seoDesc: project?.seoDesc ?? "",
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

  const buildInput = (source: Record<string, unknown>): ProjectInput => {
    const stepRows: StepRow[] = Array.isArray(source.steps) ? (source.steps as StepRow[]) : []
    const imageRows: ProductImageInput[] = parseProductImages(source.images)
    const linkRows: LinkRow[] = Array.isArray(source.products)
      ? (source.products as LinkRow[])
      : []

    return {
      title: String(source.title ?? ""),
      slug: String(source.slug ?? ""),
      category: String(source.category ?? ""),
      shortDesc: String(source.shortDesc ?? ""),
      description: String(source.description ?? ""),
      steps: stepRows
        .map((row): ProjectStepInput => ({
          title: row.title.trim(),
          body: row.body.trim(),
        }))
        .filter((row) => row.title || row.body),
      images: imageRows.map((row) => ({ url: row.url.trim(), alt: row.alt.trim() })),
      sortOrder: Number(source.sortOrder ?? 0),
      isFeatured: source.isFeatured === true,
      isActive: source.isActive !== false,
      seoTitle: String(source.seoTitle ?? ""),
      seoDesc: String(source.seoDesc ?? ""),
      products: linkRows
        .filter((row) => row.productId.trim())
        .map(
          (row): ProjectProductLinkInput => ({
            productId: row.productId.trim(),
            quantity: Math.trunc(Number(row.quantity)),
            isRequired: row.isRequired !== false,
          }),
        ),
    }
  }

  const handleSubmit = (source: Record<string, unknown>) => {
    setErrors({})
    setFormError(null)
    const input = buildInput(source)

    startTransition(async () => {
      const result = project
        ? await updateProject(project.id, input)
        : await createProject(input)

      if (result.ok) {
        router.push("/admin/projects")
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
          href="/admin/projects"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All projects
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project ? "Edit project" : "Add project"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {project
            ? `Update ${project.title}. Changes go live on the website immediately.`
            : "Show something customers can build, and list the products it needs."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <UniversalForm
          title={project ? "Edit project" : "Add project"}
          mode={project ? "edit" : "create"}
          isLoading={isPending}
          values={values}
          errors={errors}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/projects")}
          primaryLabel={project ? "Save project" : "Create project"}
          formClassName="w-full"
          sections={[
            {
              id: "basics",
              title: "Basics",
              description: "How the project is named and grouped.",
              columns: 4,
              fields: [
                {
                  name: "title",
                  label: "Project title",
                  type: "text",
                  colSpan: 2,
                  required: true,
                  placeholder: "Automatic Plant Watering System",
                },
                {
                  name: "slug",
                  label: "Slug",
                  type: "text",
                  colSpan: 2,
                  helperText:
                    "Leave blank to generate it from the title. Lowercase letters, numbers and hyphens.",
                },
                {
                  name: "category",
                  label: "Project category",
                  type: "text",
                  colSpan: 2,
                  helperText: "e.g. Electronics Projects. Leave blank if not needed.",
                },
                {
                  name: "sortOrder",
                  label: "Sort order",
                  type: "number",
                  colSpan: 2,
                  helperText: "Lower numbers appear first.",
                },
              ],
            },
            {
              id: "content",
              title: "Content",
              description: "What customers read on the project page.",
              columns: 4,
              fields: [
                {
                  name: "shortDesc",
                  label: "Short description",
                  type: "textarea",
                  rows: 2,
                  colSpan: 4,
                  required: true,
                  placeholder: "One or two sentences used on cards and listings.",
                },
                {
                  name: "description",
                  label: "Overview",
                  type: "textarea",
                  rows: 5,
                  colSpan: 4,
                  placeholder: "What the project does and how it works.",
                },
              ],
            },
            {
              id: "steps",
              title: "Build steps",
              description: "Step-by-step instructions. Safety notes belong here where relevant.",
              columns: 4,
              fields: [
                {
                  name: "steps",
                  label: "Steps",
                  type: "custom",
                  colSpan: "full",
                  render: ({ value, onChange }) => (
                    <StepsEditor value={value} onChange={onChange} />
                  ),
                },
              ],
            },
            {
              id: "images",
              title: "Images",
              description: "Real build imagery. The first image is used as the cover.",
              columns: 4,
              fields: [
                {
                  name: "images",
                  label: "Project images",
                  type: "custom",
                  colSpan: "full",
                  render: ({ value, onChange }) => (
                    <ImagesEditor value={value} onChange={onChange} />
                  ),
                },
              ],
            },
            {
              id: "products",
              title: "What You Need",
              description:
                "Products required or recommended for this project. Required items are what the customer needs; recommended ones are optional extras. Order matters.",
              columns: 4,
              fields: [
                {
                  name: "products",
                  label: "Project products",
                  type: "custom",
                  colSpan: "full",
                  render: ({ value, onChange, error }) => (
                    <ProjectProductsEditor
                      value={value}
                      onChange={onChange}
                      error={error}
                      products={products}
                    />
                  ),
                },
              ],
            },
            {
              id: "visibility",
              title: "Visibility",
              description: "How the project appears on the website.",
              columns: 4,
              fields: [
                {
                  name: "isFeatured",
                  label: "Featured",
                  type: "toggle",
                  colSpan: 2,
                  toggleLabel: "Show on the home page",
                },
                {
                  name: "isActive",
                  label: "Published",
                  type: "toggle",
                  colSpan: 2,
                  toggleLabel: "Visible on the site",
                },
              ],
            },
            {
              id: "seo",
              title: "SEO",
              description: "Search title and description for this project.",
              columns: 4,
              fields: [
                {
                  name: "seoTitle",
                  label: "SEO title",
                  type: "text",
                  colSpan: 4,
                  placeholder: "Automatic Plant Watering System - DIY",
                },
                {
                  name: "seoDesc",
                  label: "SEO description",
                  type: "textarea",
                  rows: 2,
                  colSpan: 4,
                  placeholder: "Summary shown in search results.",
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
