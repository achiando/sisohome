"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../dialog"
import { Button } from "../button"
import { FileUpload } from "../form/file-upload"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Bot,
  Upload,
  ExternalLink,
} from "lucide-react"
import type {
  BulkUploadConfig,
  FieldMapping,
  ParsedRow,
} from "./bulk-upload.types"
import {
  generateSampleCSV,
  downloadCSV,
  parseExcelFile,
  parseCSVFile,
} from "../../lib/bulk-upload/sample"
import type { UploadedFile } from "../../types/components/forms"

type Step = "upload" | "mapping" | "preview" | "importing" | "complete"
type ImportMode = "manual" | "ai"

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: BulkUploadConfig
}

const STEPS: { id: Step; labelKey: string }[] = [
  { id: "upload", labelKey: "bulkUpload.steps.upload" },
  { id: "mapping", labelKey: "bulkUpload.steps.mapping" },
  { id: "preview", labelKey: "bulkUpload.steps.preview" },
  { id: "importing", labelKey: "bulkUpload.steps.importing" },
  { id: "complete", labelKey: "bulkUpload.steps.complete" },
]

const STEP_ORDER: Step[] = [
  "upload",
  "mapping",
  "preview",
  "importing",
  "complete",
]

function AutoMappingIndicator({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        <span>High confidence</span>
      </div>
    )
  }
  if (confidence >= 0.5) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600">
        <Sparkles className="h-3 w-3" />
        <span>Review suggested</span>
      </div>
    )
  }
  return null
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  config,
}: BulkUploadDialogProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>("upload")
  const [importMode, setImportMode] = useState<ImportMode>("manual")
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  })
  const [importErrors, setImportErrors] = useState<Record<number, string>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  const resetState = useCallback(() => {
    setCurrentStep("upload")
    setImportMode("manual")
    setFile(null)
    setHeaders([])
    setRawRows([])
    setMappings([])
    setParsedRows([])
    setImportProgress({ current: 0, total: 0, success: 0, failed: 0 })
    setImportErrors({})
    setError(null)
    setIsAiProcessing(false)
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  const handleFileSelect = useCallback(
    async (uploadedFiles: UploadedFile[]) => {
      const uploadedFile = uploadedFiles[0]
      if (!uploadedFile) return

      const selectedFile = uploadedFile.file
      setFile(selectedFile)
      setError(null)
      setIsProcessing(true)

      try {
        const isExcel = selectedFile.name.match(/\.(xlsx|xls)$/i)
        const parseFn = isExcel ? parseExcelFile : parseCSVFile
        const result = await parseFn(selectedFile)

        setHeaders(result.headers)
        setRawRows(result.rows)

        const initialMappings: FieldMapping[] = result.headers.map(
          (header: string) => ({
            sourceColumn: header,
            targetField: null,
            confidence: 0,
            suggested: false,
          })
        )
        setMappings(initialMappings)

        setCurrentStep("mapping")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file")
      } finally {
        setIsProcessing(false)
      }
    },
    []
  )

  const handleAiImport = useCallback(
    async (selectedFile: File) => {
      if (!config.agentImport) return

      setFile(selectedFile)
      setError(null)
      setIsAiProcessing(true)

      try {
        const result = await config.agentImport(selectedFile, config.fields)
        if (!result) {
          setIsAiProcessing(false)
          return
        }
        setParsedRows(result.rows)
        setCurrentStep("preview")
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI import failed")
      } finally {
        setIsAiProcessing(false)
      }
    },
    [config]
  )

  const handleMappingChange = useCallback(
    (headerIndex: number, targetField: string | null) => {
      setMappings((prev) =>
        prev.map((m, i) => (i === headerIndex ? { ...m, targetField } : m))
      )
    },
    []
  )

  const autoMapColumns = useCallback(() => {
    const newMappings = mappings.map((mapping) => {
      const headerLower = mapping.sourceColumn.toLowerCase().trim()
      const matchedField = config.fields.find((field) => {
        const fieldLower = field.key.toLowerCase().trim()
        const labelLower = field.label.toLowerCase().trim()
        return (
          headerLower === fieldLower ||
          headerLower === labelLower ||
          headerLower.includes(fieldLower) ||
          fieldLower.includes(headerLower)
        )
      })
      return {
        ...mapping,
        targetField: matchedField?.key ?? null,
        confidence: matchedField ? 0.9 : 0,
        suggested: !!matchedField,
      }
    })
    setMappings(newMappings)
  }, [mappings, config.fields])

  const handlePreview = useCallback(() => {
    const mappedFieldKeys = mappings
      .filter((m) => m.targetField !== null)
      .map((m) => m.targetField as string)

    const validatedRows: ParsedRow[] = rawRows.map((rawRow, rowIndex) => {
      const data: Record<string, string | number | boolean | null> = {}
      const rowErrors: Record<string, string> = {}

      mappings.forEach((mapping) => {
        if (mapping.targetField) {
          const value = rawRow[mapping.sourceColumn]
          const field = config.fields.find((f) => f.key === mapping.targetField)

          if (field) {
            if (field.required && (!value || String(value).trim() === "")) {
              rowErrors[mapping.targetField] = `${field.label} is required`
            }

            if (
              value !== undefined &&
              value !== null &&
              String(value).trim() !== ""
            ) {
              switch (field.type) {
                case "number":
                case "currency":
                  const num = Number(String(value).replace(/[^0-9.-]/g, ""))
                  data[mapping.targetField] = isNaN(num) ? 0 : num
                  break
                case "boolean":
                  data[mapping.targetField] =
                    String(value).toLowerCase() === "true" ||
                    String(value) === "1" ||
                    String(value).toLowerCase() === "yes"
                  break
                default:
                  data[mapping.targetField] = String(value)
              }
            }
          }
        }
      })

      const requiredFields = config.fields.filter((f) => f.required)
      requiredFields.forEach((field) => {
        if (!mappedFieldKeys.includes(field.key)) {
          rowErrors[field.key] = `${field.label} was not mapped`
        }
      })

      return {
        rowIndex: rowIndex + 1,
        data,
        errors: rowErrors,
        valid: Object.keys(rowErrors).length === 0,
      }
    })

    setParsedRows(validatedRows)
    setCurrentStep("preview")
  }, [mappings, rawRows, config.fields])

  const handleImport = useCallback(async () => {
    setCurrentStep("importing")
    setImportProgress({
      current: 0,
      total: parsedRows.length,
      success: 0,
      failed: 0,
    })
    setImportErrors({})

    const validRows = parsedRows.filter((r) => r.valid)
    const errors: Record<number, string> = {}
    let success = 0
    let failed = 0

    try {
      const result = await config.onSubmit(validRows)
      success = result.success
      failed = result.failed
      if (result.errors) {
        Object.entries(result.errors).forEach(([key, value]) => {
          errors[Number(key)] = value
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
      failed = validRows.length
    }

    setImportProgress({
      current: validRows.length,
      total: validRows.length,
      success,
      failed,
    })
    setImportErrors(errors)
    setCurrentStep("complete")
  }, [parsedRows, config])

  const handleSampleDownload = useCallback(() => {
    const sample = generateSampleCSV(config.fields, 3)
    downloadCSV(sample)
  }, [config.fields])

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      const prevStep = STEP_ORDER[prevIndex]
      if (prevStep !== undefined) {
        setCurrentStep(prevStep)
      }
    }
  }, [currentStepIndex])

  const isMappingComplete = mappings.every((m) => m.targetField !== null)
  const hasValidRows = parsedRows.some((r) => r.valid)

  const renderUploadStep = () => (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {config.agentImport ? (
        <div className="space-y-3">
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setImportMode("manual")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                importMode === "manual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Manual
            </button>
            <button
              type="button"
              onClick={() => setImportMode("ai")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                importMode === "ai"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Bot className="h-4 w-4" />
              AI Import
            </button>
          </div>

          {importMode === "manual" ? (
            <div className="space-y-4">
              <FileUpload
                accept={config.accept ?? ".csv,.xlsx,.xls"}
                multiple={false}
                maxFiles={1}
                maxSizeMB={config.maxFileSizeMB ?? 10}
                onFilesChange={handleFileSelect}
                label="Drop your file here or click to browse"
              />
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Need a template?</p>
                    <p className="text-xs text-muted-foreground">
                      Download a sample file with the correct format
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSampleDownload}
                >
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <Download className="h-4 w-4 shrink-0" />
                    Download Sample
                  </span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileUpload
                accept={
                  config.accept ?? ".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                }
                multiple={false}
                maxFiles={1}
                maxSizeMB={config.maxFileSizeMB ?? 10}
                onFilesChange={async (files) => {
                  const f = files[0]?.file
                  if (f) await handleAiImport(f)
                }}
                label="Drop a file here or click to browse — CSV, Excel, PDF, or image"
              />
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">AI Smart Import</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload any file and AI will read it, detect the entity
                      type, map all fields automatically, and import them — even
                      from photos of paper records or handwritten lists.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/command")}
              >
                <span className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open AI Command Center
                </span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <FileUpload
            accept={config.accept ?? ".csv,.xlsx,.xls"}
            multiple={false}
            maxFiles={1}
            maxSizeMB={config.maxFileSizeMB ?? 10}
            onFilesChange={handleFileSelect}
            label="Drop your file here or click to browse"
          />
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download a sample file with the correct format
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSampleDownload}>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Download className="h-4 w-4 shrink-0" />
                Download Sample
              </span>
            </Button>
          </div>
        </div>
      )}

      {(isProcessing || isAiProcessing) && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            {isAiProcessing
              ? "AI is reading and parsing your file..."
              : "Processing file..."}
          </span>
        </div>
      )}
    </div>
  )

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{file?.name}</p>
          <p className="text-xs text-muted-foreground">
            {rawRows.length} rows found
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={autoMapColumns}>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="h-4 w-4 shrink-0" />
            Auto-map Columns
          </span>
        </Button>
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        {mappings.map((mapping, idx) => {
          return (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {mapping.sourceColumn}
                </p>
                {mapping.suggested && (
                  <AutoMappingIndicator confidence={mapping.confidence ?? 0} />
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Select
                value={mapping.targetField ?? ""}
                onValueChange={(v: string) =>
                  handleMappingChange(idx, v === "_none_" ? null : v)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Skip column" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="_none_">Skip column</SelectItem>
                  {config.fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                      {f.required && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )

  const renderPreviewStep = () => {
    const previewRows = parsedRows.slice(0, 10)
    const mappedFields = config.fields.filter((f) =>
      mappings.some((m) => m.targetField === f.key)
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {parsedRows.filter((r) => r.valid).length} valid rows,{" "}
              {parsedRows.filter((r) => !r.valid).length} with errors
            </p>
          </div>
        </div>

        <div className="max-h-[350px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                {mappedFields.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead className="w-16">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row) => (
                <TableRow
                  key={row.rowIndex}
                  className={!row.valid ? "bg-destructive/5" : ""}
                >
                  <TableCell className="font-medium">{row.rowIndex}</TableCell>
                  {mappedFields.map((f) => (
                    <TableCell key={f.key}>
                      <span
                        className={row.errors[f.key] ? "text-destructive" : ""}
                      >
                        {String(row.data[f.key] ?? "")}
                      </span>
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-xs text-destructive">
                          {Object.keys(row.errors).length}
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {parsedRows.length > 10 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing first 10 of {parsedRows.length} rows
          </p>
        )}
      </div>
    )
  }

  const renderImportingStep = () => (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center">
        <p className="font-medium">Importing...</p>
        <p className="text-sm text-muted-foreground">
          {importProgress.success} of {importProgress.total} rows completed
        </p>
      </div>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{
            width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  )

  const renderCompleteStep = () => (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      {importProgress.failed === 0 ? (
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      ) : (
        <AlertCircle className="h-12 w-12 text-amber-500" />
      )}
      <div className="text-center">
        <p className="text-lg font-medium">Import Complete</p>
        <p className="text-sm text-muted-foreground">
          {importProgress.success} successful, {importProgress.failed} failed
        </p>
      </div>
      {Object.keys(importErrors).length > 0 && (
        <div className="max-h-[150px] w-full max-w-md overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="mb-2 text-xs font-medium text-destructive">Errors:</p>
          {Object.entries(importErrors)
            .slice(0, 5)
            .map(([row, msg]) => (
              <p key={row} className="text-xs text-destructive">
                Row {row}: {msg}
              </p>
            ))}
          {Object.keys(importErrors).length > 5 && (
            <p className="mt-1 text-xs text-muted-foreground">
              ...and {Object.keys(importErrors).length - 5} more errors
            </p>
          )}
        </div>
      )}
    </div>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case "upload":
        return renderUploadStep()
      case "mapping":
        return renderMappingStep()
      case "preview":
        return renderPreviewStep()
      case "importing":
        return renderImportingStep()
      case "complete":
        return renderCompleteStep()
    }
  }

  const canGoBack =
    currentStepIndex > 0 &&
    currentStep !== "importing" &&
    currentStep !== "complete"
  const canGoNext =
    (currentStep === "upload" && file !== null) ||
    (currentStep === "mapping" && isMappingComplete) ||
    (currentStep === "preview" && hasValidRows) ||
    currentStep === "complete"

  const getNextLabel = () => {
    switch (currentStep) {
      case "mapping":
        return "Preview"
      case "preview":
        return "Import"
      case "complete":
        return "Done"
      default:
        return "Next"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-full max-w-5xl max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          {config.description && (
            <DialogDescription>{config.description}</DialogDescription>
          )}
        </DialogHeader>

        {currentStep !== "complete" && currentStep !== "importing" && (
          <div className="flex items-center gap-2 text-xs">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
                    idx <= currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < currentStepIndex ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-current text-[8px]">
                      {idx + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">
                    {step.labelKey.split(".").pop()}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${
                      idx < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{renderStepContent()}</div>

        <DialogFooter className="gap-2">
          {canGoBack && (
            <Button variant="outline" onClick={goBack}>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <ChevronLeft className="h-4 w-4 shrink-0" />
                Back
              </span>
            </Button>
          )}
          {currentStep !== "complete" && currentStep !== "importing" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {currentStep === "preview" ? (
                <Button onClick={handleImport} disabled={!hasValidRows}>
                  <span className="inline-flex items-center whitespace-nowrap">
                    Import {parsedRows.filter((r) => r.valid).length} Rows
                  </span>
                </Button>
              ) : (
                <Button onClick={handlePreview} disabled={!canGoNext}>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    {getNextLabel()}
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </span>
                </Button>
              )}
            </>
          )}
          {currentStep === "complete" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
