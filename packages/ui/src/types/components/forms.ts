import React from "react"

// ─── Field Column Span ────────────────────────────────────────────────────────
export type ColSpan = 1 | 2 | 3 | 4 | "full"

// ─── Field Types ──────────────────────────────────────────────────────────────
export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "textarea"
  | "select"
  | "multi-select"
  | "radio"
  | "checkbox"
  | "toggle"
  | "date"
  | "datetime"
  | "file"
  | "password"
  | "custom"

// ─── Select Option ────────────────────────────────────────────────────────────
export interface SelectOption {
  label: string
  value: string
  icon?: React.ReactNode
  disabled?: boolean
}

// ─── Base Field Definition ────────────────────────────────────────────────────
export interface BaseFieldDef {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  /** Grid column span (default: 2, i.e. half of a 4-col grid) */
  colSpan?: ColSpan
}

export interface TextField extends BaseFieldDef {
  type: "text" | "email" | "number" | "password"
}

export interface PhoneField extends BaseFieldDef {
  type: "phone"
  /** Default country code (ISO 3166-1 alpha-2, e.g., "KE" for Kenya) */
  defaultCountry?: string
}

export interface TextareaField extends BaseFieldDef {
  type: "textarea"
  rows?: number
}

export interface SelectField extends BaseFieldDef {
  type: "select"
  options: SelectOption[]
}

export interface MultiSelectField extends BaseFieldDef {
  type: "multi-select"
  options: SelectOption[]
}

export interface RadioField extends BaseFieldDef {
  type: "radio"
  options: SelectOption[]
  inline?: boolean
}

export interface CheckboxField extends BaseFieldDef {
  type: "checkbox"
  checkboxLabel?: string
}

export interface ToggleField extends BaseFieldDef {
  type: "toggle"
  toggleLabel?: string
}

export interface DateField extends BaseFieldDef {
  type: "date" | "datetime"
}

export interface FileFieldDef extends BaseFieldDef {
  type: "file"
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSizeMB?: number
  /** Existing URLs to show in edit mode */
  existingUrls?: string[]
}

export interface CustomField extends BaseFieldDef {
  type: "custom"
  render: (props: {
    value: unknown
    onChange: (v: unknown) => void
    error?: string
  }) => React.ReactNode
}

export type FieldDef =
  | TextField
  | PhoneField
  | TextareaField
  | SelectField
  | MultiSelectField
  | RadioField
  | CheckboxField
  | ToggleField
  | DateField
  | FileFieldDef
  | CustomField

// ─── Section ──────────────────────────────────────────────────────────────────
export interface FormSection {
  id: string
  title: string
  description?: string
  /** Number of columns in this section's grid (default: 4) */
  columns?: 2 | 4
  fields: FieldDef[]
}

// ─── Wizard Step ──────────────────────────────────────────────────────────────
export interface WizardStep {
  id: string
  title: string
  description?: string
  /** Icon name (Lucide icon key or emoji) shown in the step indicator */
  icon?: string
  /** Encouraging message shown when this step is completed */
  completionMessage?: string
  sections: FormSection[]
}

// ─── Wizard Form Props ────────────────────────────────────────────────────────
export interface WizardFormProps {
  title: string
  description?: string
  mode?: FormMode
  isLoading?: boolean
  onCancel?: () => void
  values: Record<string, unknown>
  errors?: Record<string, string>
  onChange: (name: string, value: unknown) => void
  primaryLabel?: string
  sticky?: boolean
  className?: string
  children?: React.ReactNode
  formClassName?: string
  primaryFullWidth?: boolean
  /** Add Card wrapper — defaults to false (no card by default) */
  bare?: boolean
  variant: "wizard"
  steps: WizardStep[]
  onSubmit: (values: Record<string, unknown>) => void
  /** Called on step change for per-step validation */
  onValidateStep?: (
    stepIndex: number,
    values: Record<string, unknown>
  ) => Record<string, string>
  /** Called when a step is completed with its data for incremental submission */
  onStepSubmit?: (
    stepIndex: number,
    stepData: Record<string, unknown>
  ) => void | Promise<void>
  /** Render custom content per step (replaces children inside step area) */
  renderStepContent?: (stepIndex: number) => React.ReactNode
  /** Hide section titles to reduce visual clutter */
  hideSectionTitles?: boolean
  /** Hide step title if it's redundant with form title */
  hideStepTitle?: boolean
  /** Compact layout with reduced spacing */
  compact?: boolean
}

// ─── Form Mode ────────────────────────────────────────────────────────────────
export type FormMode = "create" | "edit" | "view"

// ─── Form Variant ─────────────────────────────────────────────────────────────
export type FormVariant = "standard" | "wizard" | "section-edit"

// ─── Uploaded File ────────────────────────────────────────────────────────────
export interface UploadedFile {
  id: string
  name: string
  size?: number
  type?: string
  file: File
  url?: string
  status: "pending" | "uploading" | "success" | "error"
  progress?: number
  errorMessage?: string
  /** Returned URL after upload */
  remoteUrl?: string
}
