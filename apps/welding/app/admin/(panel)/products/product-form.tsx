"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Plus, X } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { UniversalForm } from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { createProduct, updateProduct } from "./actions"
import {
  parseProductImages,
  type ProductImageInput,
  type ProductInput,
} from "@/lib/product-input"
import { parseSpecifications, type SpecificationItem } from "@/lib/specifications"

interface FormCategory {
  id: string
  name: string
}

export interface ProductFormProduct {
  id: string
  categoryId: string
  name: string
  slug: string
  shortDesc: string
  description: string | null
  priceRange: string | null
  sortOrder: number
  isFeatured: boolean
  isActive: boolean
  seoTitle: string | null
  seoDesc: string | null
  specifications: unknown
  images: unknown
}

interface SpecRow {
  label: string
  material: string
  pieces: string
}

interface ImageRow {
  url: string
  alt: string
}

function toSpecRows(raw: unknown): SpecRow[] {
  return parseSpecifications(raw).map((item) => ({
    label: item.label,
    material: item.material,
    pieces: item.pieces === null ? "" : String(item.pieces),
  }))
}

function toImageRows(raw: unknown): ImageRow[] {
  return parseProductImages(raw).map((item) => ({ url: item.url, alt: item.alt }))
}

function SpecificationsEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: unknown) => void
  error?: string
}) {
  const rows: SpecRow[] = Array.isArray(value)
    ? (value as SpecRow[]).map((row) => ({
        label: String(row.label ?? ""),
        material: String(row.material ?? ""),
        pieces: String(row.pieces ?? ""),
      }))
    : []

  const update = (index: number, patch: Partial<SpecRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No materials listed yet. Add what the product is built from.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_5.5rem_auto] sm:items-end"
        >
          <Input
            id={`spec-label-${index}`}
            label="Label"
            inputSize="sm"
            placeholder="Frame"
            value={row.label}
            onChange={(e) => update(index, { label: e.target.value })}
          />
          <Input
            id={`spec-material-${index}`}
            label="Material"
            inputSize="sm"
            placeholder='3/4" tube'
            value={row.material}
            onChange={(e) => update(index, { material: e.target.value })}
          />
          <Input
            id={`spec-pieces-${index}`}
            label="Pieces"
            inputSize="sm"
            type="number"
            min={1}
            placeholder="—"
            value={row.pieces}
            onChange={(e) => update(index, { pieces: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove specification ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="mb-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={Plus}
        onClick={() => onChange([...rows, { label: "", material: "", pieces: "" }])}
      >
        Add specification
      </Button>
    </div>
  )
}

function ImagesEditor({
  value,
  onChange,
}: {
  value: unknown
  onChange: (next: unknown) => void
  error?: string
}) {
  const rows: ImageRow[] = Array.isArray(value)
    ? (value as ImageRow[]).map((row) => ({
        url: String(row.url ?? ""),
        alt: String(row.alt ?? ""),
      }))
    : []

  const update = (index: number, patch: Partial<ImageRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No images yet. Add the product photography you want on the site.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <Input
            id={`image-url-${index}`}
            label="Image URL"
            inputSize="sm"
            placeholder="https://..."
            value={row.url}
            onChange={(e) => update(index, { url: e.target.value })}
          />
          <Input
            id={`image-alt-${index}`}
            label="Alt text"
            inputSize="sm"
            placeholder="Steel sliding gate installed at a property"
            value={row.alt}
            onChange={(e) => update(index, { alt: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove image ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            className="mb-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={Plus}
        onClick={() => onChange([...rows, { url: "", alt: "" }])}
      >
        Add image
      </Button>
    </div>
  )
}

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductFormProduct
  categories: FormCategory[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    shortDesc: product?.shortDesc ?? "",
    description: product?.description ?? "",
    priceRange: product?.priceRange ?? "",
    sortOrder: product?.sortOrder ?? 0,
    isFeatured: product?.isFeatured ?? false,
    isActive: product?.isActive ?? true,
    seoTitle: product?.seoTitle ?? "",
    seoDesc: product?.seoDesc ?? "",
    specifications: toSpecRows(product?.specifications),
    images: toImageRows(product?.images),
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

  const buildInput = (source: Record<string, unknown>): ProductInput => {
    const specRows: SpecRow[] = Array.isArray(source.specifications)
      ? (source.specifications as SpecRow[])
      : []
    const imageRows: ImageRow[] = Array.isArray(source.images)
      ? (source.images as ImageRow[])
      : []

    return {
      name: String(source.name ?? ""),
      slug: String(source.slug ?? ""),
      categoryId: String(source.categoryId ?? ""),
      shortDesc: String(source.shortDesc ?? ""),
      description: String(source.description ?? ""),
      priceRange: String(source.priceRange ?? ""),
      sortOrder: Number(source.sortOrder ?? 0),
      isFeatured: source.isFeatured === true,
      isActive: source.isActive !== false,
      seoTitle: String(source.seoTitle ?? ""),
      seoDesc: String(source.seoDesc ?? ""),
      specifications: specRows
        .map((row): SpecificationItem => ({
          label: row.label.trim(),
          material: row.material.trim(),
          pieces:
            row.pieces.trim() === "" ? null : Math.trunc(Number(row.pieces)),
        }))
        .filter((row) => row.label || row.material),
      images: imageRows
        .map((row): ProductImageInput => ({ url: row.url.trim(), alt: row.alt.trim() }))
        .filter((row) => row.url || row.alt),
    }
  }

  const handleSubmit = (source: Record<string, unknown>) => {
    setErrors({})
    setFormError(null)
    const input = buildInput(source)

    startTransition(async () => {
      const result = product
        ? await updateProduct(product.id, input)
        : await createProduct(input)

      if (result.ok) {
        router.push("/admin/products")
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
          href="/admin/products"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All products
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {product ? "Edit product" : "Add product"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {product
            ? `Update ${product.name}. Changes go live on the website immediately.`
            : "Create a catalogue product. It appears on the website as soon as you save."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <UniversalForm
          title={product ? "Edit product" : "Add product"}
          mode={product ? "edit" : "create"}
          isLoading={isPending}
          values={values}
          errors={errors}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/admin/products")}
          primaryLabel={product ? "Save product" : "Create product"}
          formClassName="w-full"
          sections={[
            {
              id: "basics",
              title: "Basics",
              description: "How the product is named and grouped.",
              columns: 4,
              fields: [
                {
                  name: "name",
                  label: "Product name",
                  type: "text",
                  colSpan: 2,
                  required: true,
                  placeholder: "Steel Sliding Gate",
                },
                {
                  name: "slug",
                  label: "Slug",
                  type: "text",
                  colSpan: 2,
                  helperText: "Leave blank to generate it from the name. Lowercase letters, numbers and hyphens.",
                },
                {
                  name: "categoryId",
                  label: "Category",
                  type: "select",
                  colSpan: 2,
                  required: true,
                  options: categories.map((category) => ({
                    label: category.name,
                    value: category.id,
                  })),
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
              description: "What customers read on the product page.",
              columns: 4,
              fields: [
                {
                  name: "shortDesc",
                  label: "Short description",
                  type: "textarea",
                  rows: 2,
                  colSpan: 4,
                  required: true,
                  placeholder: "One or two sentences used in catalogue listings.",
                },
                {
                  name: "description",
                  label: "Full description",
                  type: "textarea",
                  rows: 5,
                  colSpan: 4,
                  placeholder: "How it is built, where it fits, what to expect.",
                },
              ],
            },
            {
              id: "materials",
              title: "Required materials",
              description: "Materials and piece counts confirmed before quotation.",
              columns: 4,
              fields: [
                {
                  name: "specifications",
                  label: "Specifications",
                  type: "custom",
                  colSpan: "full",
                  render: ({ value, onChange }) => (
                    <SpecificationsEditor value={value} onChange={onChange} />
                  ),
                },
              ],
            },
            {
              id: "images",
              title: "Images",
              description: "Photography shown on the catalogue and product page.",
              columns: 4,
              fields: [
                {
                  name: "images",
                  label: "Product images",
                  type: "custom",
                  colSpan: "full",
                  render: ({ value, onChange }) => (
                    <ImagesEditor value={value} onChange={onChange} />
                  ),
                },
              ],
            },
            {
              id: "options",
              title: "Pricing & visibility",
              description: "Optional pricing text and how the product is shown.",
              columns: 4,
              fields: [
                {
                  name: "priceRange",
                  label: "Price range",
                  type: "text",
                  colSpan: 2,
                  helperText: "Only when real figures are known. Leave blank otherwise.",
                },
                {
                  name: "isFeatured",
                  label: "Featured",
                  type: "toggle",
                  colSpan: 1,
                  toggleLabel: "Show on the home page",
                },
                {
                  name: "isActive",
                  label: "Visibility",
                  type: "toggle",
                  colSpan: 1,
                  toggleLabel: "Visible on the site",
                },
              ],
            },
            {
              id: "seo",
              title: "SEO",
              description: "Search title and description for this product.",
              columns: 4,
              fields: [
                {
                  name: "seoTitle",
                  label: "SEO title",
                  type: "text",
                  colSpan: 4,
                  placeholder: "Steel Sliding Gate - TijwaWelders",
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
