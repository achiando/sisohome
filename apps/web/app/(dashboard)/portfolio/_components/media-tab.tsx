'use client'

/**
 * MediaTab — property documents gallery + file list (plan-slice-1 §3.4, §4.2).
 *
 * Covers are managed via `document.update` (single PHOTO winner per entity,
 * enforced server-side); uploads register an object-storage key (no bytes
 * flow through this route). Gated: read = document.read, upload = document.upload,
 * cover/edit = document.update, delete = document.delete.
 */

import { useMemo, useState } from 'react'
import { FileText, History, Image as ImageIcon, Plus, Star, Trash2, Video } from 'lucide-react'
import type { FormSection, SelectOption } from '@workspace/ui/types/components'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { PageLoader } from '@workspace/ui/components/loader'
import { Text } from '@workspace/ui/components/text'
import { toast } from '@workspace/ui/components/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { UniversalForm } from '@workspace/ui/components/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select'
import type { UploadedFile } from '@workspace/ui/types/components'
import { formatDate } from '@/app/(dashboard)/_components/domain/format'
import { useUiPermission } from '@/components/shell/use-ui-permission'
import { DOCUMENT_KINDS, formatDocumentKind, isPhotoKind } from '@/lib/domain/document-constants'
import { cloudinaryUploadHandler } from '@/lib/upload'

/** Documents accept images + common office/text formats (server mirrors this). */
const DOC_ACCEPT =
  'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv'

/** First successfully uploaded entry, else a pasted http(s) URL. */
function resolveStorageKey(
  files: UploadedFile[],
  pastedUrl: string,
): { key: string; uploaded: UploadedFile | null; error?: string } {
  if (files.some((f) => f.status === 'uploading')) return { key: '', uploaded: null, error: 'Upload in progress — wait for it to finish' }
  if (files.some((f) => f.status === 'error')) return { key: '', uploaded: null, error: 'Upload failed — remove the file and try again' }
  const uploaded = files.find((f) => f.status === 'success' && f.remoteUrl) ?? null
  if (uploaded?.remoteUrl) return { key: uploaded.remoteUrl, uploaded }
  const url = pastedUrl.trim()
  if (!url) return { key: '', uploaded: null, error: 'Upload a file or paste an existing URL' }
  if (!/^https?:\/\//.test(url)) return { key: '', uploaded: null, error: 'URL must start with http:// or https://' }
  return { key: url, uploaded: null }
}

function fileNameFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop()
    return last ?? 'document'
  } catch {
    return 'document'
  }
}

interface VersionRow {
  id: string
  version: number
  fileName: string
  createdAt: string
}

export interface DocRow {
  id: string
  entityType: string
  entityId: string
  kind: string
  storageKey: string
  fileName: string
  mimeType?: string | null
  sizeBytes?: number | null
  caption?: string | null
  isCover: boolean
  version: number
  createdAt: string
  versions?: VersionRow[]
}

// ── dialogs ───────────────────────────────────────────────────────────────────

function UploadInner({
  propertyId,
  onClose,
  onSaved,
}: {
  propertyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({
    kind: 'PHOTO',
    docFile: [],
    storageUrl: '',
    caption: '',
    isCover: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const uploadHandler = useMemo(
    () => cloudinaryUploadHandler(`properties/${propertyId}`),
    [propertyId],
  )

  const sections = useMemo<FormSection[]>(
    () => [
      {
        id: 'document',
        title: 'Document',
        columns: 2,
        fields: [
          { name: 'kind', label: 'Kind', type: 'select', required: true, colSpan: 2, options: DOCUMENT_KINDS },
          {
            name: 'docFile',
            label: 'File',
            type: 'file',
            colSpan: 2,
            accept: DOC_ACCEPT,
            multiple: false,
            maxFiles: 1,
            maxSizeMB: 20,
            onUpload: uploadHandler,
            helperText: 'Uploads straight to secure storage — the stored URL becomes the storage key.',
          },
          {
            name: 'storageUrl',
            label: '…or paste an existing URL',
            type: 'text',
            colSpan: 2,
            placeholder: 'https://…',
            helperText: 'Optional fallback when the file already lives online (skips the upload)',
          },
          { name: 'caption', label: 'Caption', type: 'text', colSpan: 2 },
          { name: 'isCover', label: 'Set as cover photo', type: 'checkbox', colSpan: 2, helperText: 'Only one photo can be the cover' },
        ],
      },
    ],
    [uploadHandler],
  )

  const handleSubmit = async (v: Record<string, unknown>) => {
    const files = (Array.isArray(v.docFile) ? v.docFile : []) as UploadedFile[]
    const resolved = resolveStorageKey(files, String(v.storageUrl ?? ''))
    const errs: Record<string, string> = {}
    if (resolved.error) errs.docFile = resolved.error
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const fileName = resolved.uploaded?.name ?? fileNameFromUrl(resolved.key)

    setSaving(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'PROPERTY',
          entityId: propertyId,
          kind: v.kind,
          fileName,
          storageKey: resolved.key,
          mimeType: resolved.uploaded?.type ?? null,
          sizeBytes: typeof resolved.uploaded?.size === 'number' ? resolved.uploaded.size : null,
          caption: String(v.caption ?? '').trim() || null,
          isCover: v.isCover === true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add document')
        setSaving(false)
        return
      }
      toast.success('Document added')
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — document not saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="Add document"
      mode="create"
      variant="standard"
      sections={sections}
      values={values}
      errors={errors}
      onChange={(name, value) => {
        setErrors((prev) => {
          if (!prev[name]) return prev
          const next = { ...prev }
          delete next[name]
          return next
        })
        setValues((prev) => ({ ...prev, [name]: value }))
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isLoading={saving}
      primaryLabel="Add document"
      bare
      formClassName="w-full"
    />
  )
}

function VersionInner({
  doc,
  propertyId,
  onClose,
  onSaved,
}: {
  doc: DocRow
  propertyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>({
    versionFile: [],
    storageUrl: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const uploadHandler = useMemo(
    () => cloudinaryUploadHandler(`properties/${propertyId}`),
    [propertyId],
  )

  const sections = useMemo<FormSection[]>(
    () => [
      {
        id: 'version',
        title: `New version (v${doc.version + 1})`,
        columns: 2,
        fields: [
          {
            name: 'versionFile',
            label: 'Replacement file',
            type: 'file',
            colSpan: 2,
            accept: DOC_ACCEPT,
            multiple: false,
            maxFiles: 1,
            maxSizeMB: 20,
            onUpload: uploadHandler,
            helperText: 'Prior versions stay in the history chain.',
          },
          {
            name: 'storageUrl',
            label: '…or paste an existing URL',
            type: 'text',
            colSpan: 2,
            placeholder: 'https://…',
            helperText: 'Optional fallback when the file already lives online',
          },
        ],
      },
    ],
    [doc.version, uploadHandler],
  )

  const handleSubmit = async (v: Record<string, unknown>) => {
    const files = (Array.isArray(v.versionFile) ? v.versionFile : []) as UploadedFile[]
    const resolved = resolveStorageKey(files, String(v.storageUrl ?? ''))
    const errs: Record<string, string> = {}
    if (resolved.error) errs.versionFile = resolved.error
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const fileName = resolved.uploaded?.name ?? fileNameFromUrl(resolved.key)

    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/versions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: resolved.key,
          fileName,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add version')
        setSaving(false)
        return
      }
      toast.success(`Version ${doc.version + 1} added`)
      onSaved()
      onClose()
    } catch {
      toast.error('Network error — version not saved')
      setSaving(false)
    }
  }

  return (
    <UniversalForm
      title="Add version"
      mode="edit"
      variant="standard"
      sections={sections}
      values={values}
      errors={errors}
      onChange={(name, value) => {
        setErrors((prev) => {
          if (!prev[name]) return prev
          const next = { ...prev }
          delete next[name]
          return next
        })
        setValues((prev) => ({ ...prev, [name]: value }))
      }}
      onSubmit={handleSubmit}
      onCancel={onClose}
      isLoading={saving}
      primaryLabel="Save version"
      bare
      formClassName="w-full"
    />
  )
}

function DocumentDialogs({
  propertyId,
  uploadOpen,
  versionDoc,
  onCloseUpload,
  onCloseVersion,
  onSaved,
}: {
  propertyId: string
  uploadOpen: boolean
  versionDoc: DocRow | null
  onCloseUpload: () => void
  onCloseVersion: () => void
  onSaved: () => void
}) {
  return (
    <>
      <Dialog open={uploadOpen} onOpenChange={(o) => !o && onCloseUpload()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>
              Register an uploaded object against this property. Bytes stay in private storage.
            </DialogDescription>
          </DialogHeader>
          <UploadInner propertyId={propertyId} onClose={onCloseUpload} onSaved={onSaved} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(versionDoc)}
        onOpenChange={(o) => !o && onCloseVersion()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add version</DialogTitle>
            <DialogDescription>
              {versionDoc ? `${versionDoc.fileName} — history is append-only.` : ''}
            </DialogDescription>
          </DialogHeader>
          {versionDoc ? (
            <VersionInner doc={versionDoc} propertyId={propertyId} onClose={onCloseVersion} onSaved={onSaved} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── main tab ──────────────────────────────────────────────────────────────────

/** Demo/CDN galleries store a public URL in storageKey — render it for real. */
function isHttpUrl(key: string): boolean {
  return key.startsWith('https://') || key.startsWith('http://')
}

function PhotoCard({
  doc,
  canUpdate,
  canDelete,
  onCover,
  onVersion,
  onDelete,
}: {
  doc: DocRow
  canUpdate: boolean
  canDelete: boolean
  onCover: () => void
  onVersion: () => void
  onDelete: () => void
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = isHttpUrl(doc.storageKey) && !imgFailed
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative flex aspect-square items-center justify-center bg-muted/60">
        {showImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- demo/CDN URLs */
          <img
            src={doc.storageKey}
            alt={doc.caption ?? doc.fileName}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground/50" aria-hidden />
        )}
        {doc.isCover ? (
          <Badge variant="primary" size="sm" className="absolute left-2 top-2 gap-1">
            <Star className="size-3" /> Cover
          </Badge>
        ) : null}
        <span className="absolute right-2 top-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          v{doc.version}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium" title={doc.fileName}>
          {doc.fileName}
        </p>
        {doc.caption ? <p className="truncate text-xs text-muted-foreground">{doc.caption}</p> : null}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{formatDate(doc.createdAt)}</span>
          <div className="flex items-center gap-0.5">
            {canUpdate && !doc.isCover ? (
              <Button variant="ghost" size="icon-sm" leftIcon={Star} onClick={onCover} aria-label="Set as cover" />
            ) : null}
            <Button variant="ghost" size="icon-sm" leftIcon={History} onClick={onVersion} aria-label="Add version" />
            {canDelete ? (
              <Button variant="ghost" size="icon-sm" leftIcon={Trash2} onClick={onDelete} aria-label="Delete document" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function FileRow({
  doc,
  canDelete,
  onVersion,
  onDelete,
}: {
  doc: DocRow
  canDelete: boolean
  onVersion: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{doc.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {[formatDocumentKind(doc.kind), `v${doc.version}`, doc.sizeBytes ? `${Math.ceil(doc.sizeBytes / 1024)} KB` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
        <Button variant="ghost" size="icon-sm" leftIcon={History} onClick={onVersion} aria-label="Add version" />
        {canDelete ? (
          <Button variant="ghost" size="icon-sm" leftIcon={Trash2} onClick={onDelete} aria-label="Delete document" />
        ) : null}
      </div>
    </div>
  )
}

export function MediaTab({
  propertyId,
  docs,
  videoUrl,
  loading,
  onRefresh,
}: {
  propertyId: string
  docs: DocRow[]
  videoUrl: string | null
  loading: boolean
  onRefresh: () => void
}) {
  const { hasUiPermission } = useUiPermission()
  const [kindFilter, setKindFilter] = useState<string>('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionDoc, setVersionDoc] = useState<DocRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null)
  const [busy, setBusy] = useState(false)

  const presentKinds = useMemo(() => {
    const set = new Set(docs.map((d) => d.kind))
    return DOCUMENT_KINDS.filter((k) => set.has(k.value))
  }, [docs])

  const kindOptions: SelectOption[] = [
    { value: 'ALL', label: `All kinds (${docs.length})` },
    ...presentKinds.map((k) => ({ value: k.value, label: k.label })),
  ]

  const visible = kindFilter === 'ALL' ? docs : docs.filter((d) => d.kind === kindFilter)
  const photos = visible.filter((d) => isPhotoKind(d.kind))
  const files = visible.filter((d) => !isPhotoKind(d.kind))

  const canUpload = hasUiPermission('document.upload')
  const canUpdate = hasUiPermission('document.update')
  const canDelete = hasUiPermission('document.delete')

  const runCover = async (doc: DocRow) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCover: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to set cover')
        return
      }
      toast.success('Cover photo updated')
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete document')
        return
      }
      toast.success('Document deleted')
      setDeleteTarget(null)
      onRefresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader title="Loading media…" description="" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text variant="title">Media & documents</Text>
          <Text variant="bodyMuted">
            {docs.length === 0 ? 'No documents yet.' : `${docs.length} document${docs.length === 1 ? '' : 's'} · gallery cover wins per property.`}
          </Text>
        </div>
        <div className="flex items-center gap-2">
          {presentKinds.length > 1 ? (
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-48" aria-label="Filter by kind">
                <SelectValue placeholder="Filter by kind" />
              </SelectTrigger>
              <SelectContent>
                {kindOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {canUpload ? (
            <Button variant="primary" leftIcon={Plus} onClick={() => setUploadOpen(true)}>
              Add document
            </Button>
          ) : null}
        </div>
      </div>

      {videoUrl ? (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-4" /> Property tour video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-xl bg-muted"
            />
          </CardContent>
        </Card>
      ) : null}

      {docs.length === 0 ? (
        <Card variant="outlined" size="sm" className="items-center p-8 text-center">
          <Text variant="bodyMuted">
            {canUpload
              ? 'Upload title deeds, plans, inspection photos and contracts.'
              : 'No documents have been uploaded yet.'}
          </Text>
        </Card>
      ) : (
        <>
          {photos.length > 0 ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="size-4" /> Gallery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((doc) => (
                    <PhotoCard
                      key={doc.id}
                      doc={doc}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onCover={() => runCover(doc)}
                      onVersion={() => setVersionDoc(doc)}
                      onDelete={() => setDeleteTarget(doc)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {files.length > 0 ? (
            <Card variant="outlined">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4" /> Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {files.map((doc) => (
                  <FileRow
                    key={doc.id}
                    doc={doc}
                    canDelete={canDelete}
                    onVersion={() => setVersionDoc(doc)}
                    onDelete={() => setDeleteTarget(doc)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {visible.length === 0 ? (
            <Card variant="outlined" size="sm" className="items-center p-8 text-center">
              <Text variant="bodyMuted">No documents of this kind yet.</Text>
            </Card>
          ) : null}
        </>
      )}

      <DocumentDialogs
        propertyId={propertyId}
        uploadOpen={uploadOpen}
        versionDoc={versionDoc}
        onCloseUpload={() => setUploadOpen(false)}
        onCloseVersion={() => setVersionDoc(null)}
        onSaved={onRefresh}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.fileName}” and its version history will be permanently removed. The action is
              kept in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => confirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
