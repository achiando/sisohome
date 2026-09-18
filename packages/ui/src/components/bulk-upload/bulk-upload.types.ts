export type FieldType = "text" | "number" | "boolean" | "select" | "currency"

export interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  helpText?: string
  aiHint?: string
}

export interface FieldMapping {
  sourceColumn: string
  targetField: string | null
  confidence?: number
  suggested?: boolean
}

export interface ParsedRow {
  rowIndex: number
  data: Record<string, string | number | boolean | null>
  errors: Record<string, string>
  valid: boolean
}

export interface BulkUploadConfig {
  title: string
  description?: string
  accept?: string
  maxFileSizeMB?: number
  maxRows?: number
  fields: FieldDefinition[]
  onSampleDownload?: () => {
    filename: string
    headers: string[]
    rows: string[][]
  }
  onParse?: (rows: Record<string, string>[]) => ParsedRow[]
  onValidate?: (rows: ParsedRow[], config: BulkUploadConfig) => ParsedRow[]
  onSubmit: (rows: ParsedRow[]) => Promise<{
    success: number
    failed: number
    errors?: Record<number, string>
  }>
  /**
   * Optional AI-powered import. When provided, an "AI Import" tab is shown
   * in the upload step. The function receives the File and must return
   * parsed rows ready for the preview step. Return null/undefined to
   * signal the user cancelled or the agent couldn't parse the file.
   */
  agentImport?: (
    file: File,
    fields: FieldDefinition[]
  ) => Promise<{ rows: ParsedRow[] } | null>
}

export interface UploadStep {
  id: "upload" | "mapping" | "preview" | "importing" | "complete"
  label: string
}

export type UploadState =
  | { step: "upload"; file: File | null }
  | {
      step: "mapping"
      file: File
      headers: string[]
      rows: Record<string, string>[]
      mappings: FieldMapping[]
    }
  | {
      step: "preview"
      file: File
      headers: string[]
      parsedRows: ParsedRow[]
      mappings: FieldMapping[]
    }
  | {
      step: "importing"
      progress: number
      total: number
      success: number
      failed: number
    }
  | {
      step: "complete"
      success: number
      failed: number
      errors?: Record<number, string>
    }

export interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: BulkUploadConfig
}
