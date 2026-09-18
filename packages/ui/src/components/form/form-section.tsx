"use client"

import React from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Separator } from "../separator"
import {
  FormSection as FormSectionType,
  FieldDef,
} from "@workspace/ui/types/components"
import { FormField } from "./form-field"
import { GRID_COLS_CLASS } from "@workspace/ui/lib/constants/form"
import { Text } from "../text"

interface FormSectionProps {
  section: FormSectionType
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
  className?: string
  hideTitle?: boolean
}

export function FormSectionBlock({
  section,
  values,
  errors,
  onChange,
  className,
  hideTitle = false,
}: FormSectionProps) {
  const cols = section.columns ?? 4
  const gridClass = GRID_COLS_CLASS[cols as 2 | 4]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Section header */}
      {!hideTitle && (
        <div className="space-y-0.5">
          <Text
            variant="h3"
            className="text-sm font-semibold tracking-tight text-foreground"
            as="h3"
          >
            {section.title}
          </Text>
          {section.description && (
            <Text variant="bodyMuted" className="text-xs">
              {section.description}
            </Text>
          )}
        </div>
      )}

      {/* <Separator /> */}

      {/* Field grid */}
      <div className={cn("grid gap-x-4 gap-y-5", gridClass)}>
        {section.fields.map((field: FieldDef) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(v) => onChange(field.name, v)}
            error={errors[field.name]}
          />
        ))}
      </div>
    </div>
  )
}
