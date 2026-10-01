"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Tags, Trash2 } from "lucide-react"
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
import { deleteCategory } from "./actions"

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
  productCount: number
}

export function CategoriesList({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [listError, setListError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminCategory | null>(null)
  const [isPending, startTransition] = useTransition()

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return categories
    return categories.filter(
      (category) =>
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query),
    )
  }, [categories, search])

  const confirmDelete = () => {
    if (!toDelete) return
    setListError(null)
    startTransition(async () => {
      const result = await deleteCategory(toDelete.id)
      if (!result.ok) {
        setListError(result.error ?? "Could not delete that category.")
        setToDelete(null)
      } else {
        setToDelete(null)
        router.refresh()
      }
    })
  }

  const columns = [
    {
      header: "Category",
      cell: (category: AdminCategory) => (
        <div className="min-w-0">
          <Link
            href={`/admin/categories/${category.id}/edit`}
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {category.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">/{category.slug}</p>
        </div>
      ),
    },
    {
      header: "Products",
      cell: (category: AdminCategory) => (
        <span className="text-sm text-muted-foreground">
          {category.productCount} {category.productCount === 1 ? "product" : "products"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (category: AdminCategory) =>
        category.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="warning">Hidden</Badge>
        ),
    },
    {
      header: "Actions",
      cell: (category: AdminCategory) => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" aria-label={`Edit ${category.name}`}>
            <Link href={`/admin/categories/${category.id}/edit`}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Delete ${category.name}`}
            onClick={() => setToDelete(category)}
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
        title="Categories"
        description={`${categories.length} ${
          categories.length === 1 ? "category" : "categories"
        } in the catalogue`}
        items={visibleCategories}
        columns={columns}
        rowKey={(category) => category.id}
        loading={false}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories..."
        primaryAction={{
          label: "Add category",
          icon: Plus,
          onClick: () => router.push("/admin/categories/new"),
        }}
        cardMapper={{
          id: (category) => category.id,
          title: (category) => category.name,
          subtitle: (category) => `/${category.slug}`,
          image: () => null,
          fallbackIcon: () => <Tags className="h-8 w-8 text-muted-foreground" />,
          statusBadge: (category) =>
            category.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="warning">Hidden</Badge>
            ),
          description: (category) =>
            category.description ?? `${category.productCount} products`,
          actions: (category) => [
            {
              label: "Edit",
              icon: Pencil,
              variant: "outline",
              onClick: () => router.push(`/admin/categories/${category.id}/edit`),
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onClick: () => setToDelete(category),
            },
          ],
        }}
        emptyState={{
          icon: Tags,
          title: categories.length === 0 ? "No categories yet" : "No categories found",
          description:
            categories.length === 0
              ? "Add a category to start grouping the catalogue."
              : "Try a different search.",
          actionLabel: "Add category",
          onAction: () => router.push("/admin/categories/new"),
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This only works when the category has no products. Products in it must be moved
              or deleted first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
