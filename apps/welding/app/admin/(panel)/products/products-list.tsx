"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Pencil, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ResponsiveDataListing } from "@workspace/ui/components/shared"
import { deleteProduct } from "./actions"

export interface AdminProduct {
  id: string
  name: string
  slug: string
  shortDesc: string
  isFeatured: boolean
  isActive: boolean
  sortOrder: number
  image: string | null
  category: { id: string; name: string; slug: string }
}

export function ProductsList({ products }: { products: AdminProduct[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [listError, setListError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminProduct | null>(null)
  const [isPending, startTransition] = useTransition()

  const categories = useMemo(() => {
    const byId = new Map<string, string>()
    for (const product of products) byId.set(product.category.id, product.category.name)
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [products])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      if (categoryFilter && product.category.id !== categoryFilter) return false
      if (!query) return true
      return (
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.category.name.toLowerCase().includes(query)
      )
    })
  }, [products, search, categoryFilter])

  const confirmDelete = () => {
    if (!toDelete) return
    setListError(null)
    startTransition(async () => {
      const result = await deleteProduct(toDelete.id)
      if (!result.ok) {
        setListError(result.error ?? "Could not delete that product.")
      } else {
        setToDelete(null)
        router.refresh()
      }
    })
  }

  const columns = [
    {
      header: "Product",
      cell: (product: AdminProduct) => (
        <div className="min-w-0">
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {product.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            /{product.category.slug}/{product.slug}
          </p>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (product: AdminProduct) => <Badge>{product.category.name}</Badge>,
    },
    {
      header: "Status",
      cell: (product: AdminProduct) =>
        product.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="warning">Hidden</Badge>
        ),
    },
    {
      header: "Featured",
      cell: (product: AdminProduct) =>
        product.isFeatured ? <Badge variant="info">Featured</Badge> : null,
    },
    {
      header: "Actions",
      cell: (product: AdminProduct) => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" aria-label={`Edit ${product.name}`}>
            <Link href={`/admin/products/${product.id}/edit`}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Delete ${product.name}`}
            onClick={() => setToDelete(product)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
  ]

  return (
    <div className="space-y-4">
      {listError ? (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      <ResponsiveDataListing
        title="Products"
        description={`${products.length} ${products.length === 1 ? "product" : "products"} in the catalogue`}
        items={visibleProducts}
        columns={columns}
        rowKey={(product) => product.id}
        loading={false}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products..."
        filters={[
          {
            key: "category",
            label: "Category",
            options: categories,
            value: categoryFilter,
            onChange: setCategoryFilter,
          },
        ]}
        primaryAction={{
          label: "Add product",
          icon: Plus,
          onClick: () => router.push("/admin/products/new"),
        }}
        cardMapper={{
          id: (product) => product.id,
          title: (product) => product.name,
          subtitle: (product) => product.category.name,
          image: (product) => product.image,
          fallbackIcon: () => <Package className="h-8 w-8 text-muted-foreground" />,
          statusBadge: (product) =>
            product.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="warning">Hidden</Badge>
            ),
          description: (product) => product.shortDesc,
          actions: (product) => [
            {
              label: "Edit",
              icon: Pencil,
              variant: "outline",
              onClick: () => router.push(`/admin/products/${product.id}/edit`),
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onClick: () => setToDelete(product),
            },
          ],
        }}
        emptyState={{
          icon: Package,
          title: products.length === 0 ? "No products yet" : "No products found",
          description:
            products.length === 0
              ? "Add your first product to start building the catalogue."
              : "Try a different search or category filter.",
          actionLabel: "Add product",
          onAction: () => router.push("/admin/products/new"),
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from the website. Pages that link to it will need to be
              updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
