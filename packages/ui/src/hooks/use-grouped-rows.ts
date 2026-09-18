"use client"

import { useCallback, useMemo, useState } from "react"
import { FlatNode, TreeNode } from "../types/components"

interface UseGroupedRowsOptions<TData extends TreeNode> {
  data: TData[]
  defaultExpandedIds?: string[]
  defaultExpandAll?: boolean
}

function collectAllIds<TData extends TreeNode>(nodes: TData[]): string[] {
  return nodes.flatMap((n) => [
    n.id,
    ...(n.children ? collectAllIds(n.children as TData[]) : []),
  ])
}

function flatten<TData extends TreeNode>(
  nodes: TData[],
  expanded: Set<string>,
  depth = 0
): FlatNode<TData>[] {
  return nodes.flatMap((node) => {
    const hasChildren = !!node.children?.length
    const isExpanded = expanded.has(node.id)
    const flat: FlatNode<TData> = { ...node, depth, hasChildren, isExpanded }

    if (hasChildren && isExpanded) {
      return [flat, ...flatten(node.children as TData[], expanded, depth + 1)]
    }
    return [flat]
  })
}

export function useGroupedRows<TData extends TreeNode>({
  data,
  defaultExpandedIds = [],
  defaultExpandAll = false,
}: UseGroupedRowsOptions<TData>) {
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpandAll
      ? new Set(collectAllIds(data))
      : new Set(defaultExpandedIds)
  )

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpanded(new Set(collectAllIds(data)))
  }, [data])

  const collapseAll = useCallback(() => {
    setExpanded(new Set())
  }, [])

  const rows = useMemo(() => flatten(data, expanded), [data, expanded])

  return { rows, expanded, toggle, expandAll, collapseAll }
}
