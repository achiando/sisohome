"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react"
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
import { deleteProject } from "./actions"

export interface AdminProject {
  id: string
  title: string
  slug: string
  category: string | null
  shortDesc: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  image: string | null
  productCount: number
}

export function ProjectsList({ projects }: { projects: AdminProject[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [listError, setListError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminProject | null>(null)
  const [isPending, startTransition] = useTransition()

  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const project of projects) if (project.category) names.add(project.category)
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((label) => ({ value: label, label }))
  }, [projects])

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (categoryFilter && project.category !== categoryFilter) return false
      if (!query) return true
      return (
        project.title.toLowerCase().includes(query) ||
        project.slug.toLowerCase().includes(query) ||
        (project.category ?? "").toLowerCase().includes(query)
      )
    })
  }, [projects, search, categoryFilter])

  const confirmDelete = () => {
    if (!toDelete) return
    setListError(null)
    startTransition(async () => {
      const result = await deleteProject(toDelete.id)
      if (!result.ok) {
        setListError(result.error ?? "Could not delete that project.")
      } else {
        setToDelete(null)
        router.refresh()
      }
    })
  }

  const columns = [
    {
      header: "Project",
      cell: (project: AdminProject) => (
        <div className="min-w-0">
          <Link
            href={`/admin/projects/${project.id}/edit`}
            className="font-medium text-foreground transition-colors hover:text-primary"
          >
            {project.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">/projects/{project.slug}</p>
        </div>
      ),
    },
    {
      header: "Category",
      cell: (project: AdminProject) =>
        project.category ? <Badge>{project.category}</Badge> : null,
    },
    {
      header: "Products",
      cell: (project: AdminProject) => (
        <span className="text-sm text-muted-foreground">
          {project.productCount} {project.productCount === 1 ? "item" : "items"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (project: AdminProject) => (
        <div className="flex flex-wrap gap-1">
          {project.isActive ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="warning">Hidden</Badge>
          )}
          {project.isFeatured ? <Badge variant="info">Featured</Badge> : null}
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (project: AdminProject) => (
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" aria-label={`Edit ${project.title}`}>
            <Link href={`/admin/projects/${project.id}/edit`}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Delete ${project.title}`}
            onClick={() => setToDelete(project)}
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
        title="Projects"
        description={`${projects.length} ${
          projects.length === 1 ? "project" : "projects"
        } in the workspace`}
        items={visibleProjects}
        columns={columns}
        rowKey={(project) => project.id}
        loading={false}
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects..."
        filters={
          categories.length > 0
            ? [
                {
                  key: "category",
                  label: "Category",
                  options: categories,
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                },
              ]
            : []
        }
        primaryAction={{
          label: "Add project",
          icon: Plus,
          onClick: () => router.push("/admin/projects/new"),
        }}
        cardMapper={{
          id: (project) => project.id,
          title: (project) => project.title,
          subtitle: (project) => project.category ?? `/projects/${project.slug}`,
          image: (project) => project.image,
          fallbackIcon: () => <FolderKanban className="h-8 w-8 text-muted-foreground" />,
          statusBadge: (project) =>
            project.isActive ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="warning">Hidden</Badge>
            ),
          description: (project) => project.shortDesc ?? "",
          actions: (project) => [
            {
              label: "Edit",
              icon: Pencil,
              variant: "outline",
              onClick: () => router.push(`/admin/projects/${project.id}/edit`),
            },
            {
              label: "Delete",
              icon: Trash2,
              variant: "destructive",
              onClick: () => setToDelete(project),
            },
          ],
        }}
        emptyState={{
          icon: FolderKanban,
          title: projects.length === 0 ? "No projects yet" : "No projects found",
          description:
            projects.length === 0
              ? "Add a project to show customers what they can build."
              : "Try a different search or category filter.",
          actionLabel: "Add project",
          onAction: () => router.push("/admin/projects/new"),
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and its product list from the website. Products
              themselves are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
